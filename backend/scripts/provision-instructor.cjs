// Explicit bootstrap only. No credentials are committed or changed on startup.
const { randomUUID } = require('node:crypto');
const email = 'decode.instructor@gmail.com';

class ProvisioningError extends Error {}

async function provisionInstructor(client, password, helpers) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 1024) {
    throw new ProvisioningError('Set INSTRUCTOR_BOOTSTRAP_PASSWORD to the instructor password (8–1024 characters).');
  }
  await client.query('BEGIN');
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('decode:instructor-bootstrap'))");
    const { rows } = await client.query(
      'SELECT id, email, password_hash, role FROM users WHERE lower(btrim(email)) = $1 FOR UPDATE', [email],
    );
    if (rows.length > 1) throw new ProvisioningError('Multiple matching instructor emails exist. Reconcile those accounts before provisioning.');
    const existing = rows[0];
    if (existing) {
      if (!await helpers.verifyPassword(password, existing.password_hash)) {
        throw new ProvisioningError('The reserved account already exists with a different password. Its credentials were not overwritten.');
      }
      if (existing.role !== 'INSTRUCTOR' || existing.email !== email) {
        await client.query('UPDATE users SET email = $1, role = $2, updated_at = NOW() WHERE id = $3', [email, 'INSTRUCTOR', existing.id]);
        await client.query('DELETE FROM sessions WHERE user_id = $1', [existing.id]);
      }
    } else {
      const hash = await helpers.hashPassword(password);
      await client.query(
        'INSERT INTO users (id, name, email, password_hash, role, updated_at) VALUES ($1, $2, $3, $4, $5, NOW())',
        [randomUUID(), 'DECODE Instructor', email, hash, 'INSTRUCTOR'],
      );
    }
    await client.query('COMMIT');
    return existing ? 'verified' : 'created';
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  require('dotenv').config({ quiet: true });
  if (!process.env.DATABASE_URL) throw new ProvisioningError('Configure DATABASE_URL in backend/.env first.');
  const { Client } = require('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, query_timeout: 10000 });
  try {
    await client.connect();
    if (process.argv.includes('--check')) {
      const { rows } = await client.query('SELECT role, count(*)::int AS count FROM users GROUP BY role');
      const reserved = await client.query('SELECT role FROM users WHERE lower(btrim(email)) = $1', [email]);
      console.log(JSON.stringify({ database: 'connected', roles: rows, instructorReady: reserved.rows.length === 1 && reserved.rows[0].role === 'INSTRUCTOR' }));
      return;
    }
    const helpers = require('../dist/auth/password.js');
    const result = await provisionInstructor(client, process.env.INSTRUCTOR_BOOTSTRAP_PASSWORD, helpers);
    console.log(`Instructor account ${result}: ${email}. Password and session tokens are not displayed.`);
  } finally {
    await client.end();
  }
}

module.exports = { provisionInstructor, ProvisioningError };
if (require.main === module) {
  main().catch(error => {
    console.error(error instanceof ProvisioningError ? error.message : `Instructor provisioning failed (${error.code ?? 'database_or_build_unavailable'}). Check database readiness and run npm run build first.`);
    process.exitCode = 1;
  });
}
