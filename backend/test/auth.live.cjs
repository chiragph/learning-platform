// Explicit live check: both apps and the migrated PostgreSQL database must be running.
// Uses a unique temporary account and removes only that account in the finally block.
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const { randomBytes, createHash } = require('node:crypto');
const { Client } = require('pg');

const frontend = process.env.FRONTEND_URL ?? 'http://localhost:3000';
const database = new Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});
const email = `auth-check-${randomBytes(12).toString('hex')}@example.com`;
const password = randomBytes(24).toString('base64url');

async function api(path, body, cookie) {
  const response = await fetch(`${frontend}/api/auth/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  return {
    response,
    result,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  };
}

(async () => {
  await database.connect();
  try {
    const registration = await api('register', {
      name: 'Authentication Check',
      email: email.toUpperCase(),
      password,
    });
    assert.equal(
      registration.response.status,
      201,
      JSON.stringify(registration.result),
    );
    assert.equal(registration.result.user.email, email);
    assert.equal(registration.result.user.role, 'STUDENT');
    assert.ok(!('passwordHash' in registration.result.user));
    assert.match(registration.response.headers.get('set-cookie'), /HttpOnly/);

    const stored = await database.query(
      'SELECT password_hash FROM users WHERE email = $1',
      [email],
    );
    assert.match(stored.rows[0].password_hash, /^scrypt:/);
    assert.notEqual(stored.rows[0].password_hash, password);
    assert.equal(
      (await api('me', undefined, registration.cookie)).response.status,
      200,
    );
    assert.equal(
      (await api('register', { name: 'Duplicate', email, password })).response
        .status,
      409,
    );
    assert.equal(
      (await api('login', { email, password: 'incorrect password' })).response
        .status,
      401,
    );
    assert.equal(
      (await api('login', { email: `missing-${email}`, password })).response
        .status,
      401,
    );
    console.log(
      'PASS: PostgreSQL registration, salted password, duplicate email, invalid credentials.',
    );

    const login = await api('login', { email, password, remember: true });
    assert.equal(login.response.status, 200, JSON.stringify(login.result));
    assert.match(login.response.headers.get('set-cookie'), /Max-Age=2592000/);
    const token = login.cookie.slice('decode_session='.length);
    const hash = createHash('sha256').update(token).digest('hex');
    const session = await database.query(
      'SELECT token_hash FROM sessions WHERE token_hash = $1',
      [hash],
    );
    assert.equal(session.rows.length, 1);
    assert.notEqual(session.rows[0].token_hash, token);
    assert.equal(
      (await api('me', undefined, login.cookie)).result.user.email,
      email,
    );

    const success = await fetch(`${frontend}/login/success`, {
      headers: { Cookie: login.cookie },
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(success.status, 200);
    assert.match(await success.text(), /<h1>Login successful\.<\/h1>/);
    console.log(
      'PASS: Frontend API proxy, real login, Remember me, hashed session, protected success page.',
    );

    await database.query(
      "UPDATE sessions SET expires_at = NOW() - INTERVAL '1 second' WHERE token_hash = $1",
      [hash],
    );
    assert.equal(
      (await api('me', undefined, login.cookie)).response.status,
      401,
      'Expired session must be rejected',
    );
    assert.equal(
      (await api('logout', {}, registration.cookie)).response.status,
      200,
    );
    assert.equal(
      (await api('me', undefined, registration.cookie)).response.status,
      401,
      'Revoked session must be rejected',
    );
    assert.equal(
      (await api('me')).response.status,
      401,
      'Missing session must be rejected',
    );
    console.log(
      'PASS: Session expiration, logout revocation, unauthenticated access.',
    );
  } finally {
    await database.query('DELETE FROM users WHERE email = $1', [email]);
    await database.end();
    console.log('Removed the temporary test account and its sessions.');
  }
})().catch((error) => {
  console.error(
    error instanceof assert.AssertionError
      ? error.message
      : `Live authentication check failed (${error.code ?? error.name}).`,
  );
  process.exitCode = 1;
});
