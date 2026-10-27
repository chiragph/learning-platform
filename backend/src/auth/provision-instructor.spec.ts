import { vi } from 'vitest';
const { provisionInstructor } = require('../../scripts/provision-instructor.cjs');

describe('Instructor account bootstrap', () => {
  const helpers = { hashPassword: vi.fn(), verifyPassword: vi.fn() };
  const client = { query: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    helpers.hashPassword.mockResolvedValue('salted-scrypt-hash');
    helpers.verifyPassword.mockResolvedValue(true);
    client.query.mockResolvedValue({ rows: [] });
  });
  it('creates only the designated identity, with a generated UUID and password hash inside a transaction', async () => {
    expect(await provisionInstructor(client, 'test-password', helpers)).toBe('created');
    const insert = client.query.mock.calls.find(([sql]) => sql.startsWith('INSERT'));
    expect(insert[1][0]).toMatch(/^[a-f0-9-]{36}$/);
    expect(insert[1].slice(1)).toEqual(['DECODE Instructor', 'decode.instructor@gmail.com', 'salted-scrypt-hash', 'INSTRUCTOR']);
    expect(client.query.mock.calls.at(-1)[0]).toBe('COMMIT');
  });
  it('is idempotent and preserves an already provisioned identity, password, and sessions', async () => {
    client.query.mockImplementation(async (sql: string) => ({ rows: sql.startsWith('SELECT id,') ? [{ id: 'existing-uuid', email: 'decode.instructor@gmail.com', role: 'INSTRUCTOR', password_hash: 'existing-hash' }] : [] }));
    expect(await provisionInstructor(client, 'test-password', helpers)).toBe('verified');
    expect(helpers.hashPassword).not.toHaveBeenCalled();
    expect(client.query.mock.calls.some(([sql]) => /^(INSERT|UPDATE|DELETE)/.test(sql))).toBe(false);
  });
  it('requires the existing password before promoting a reserved student and revokes previous sessions', async () => {
    client.query.mockImplementation(async (sql: string) => ({ rows: sql.startsWith('SELECT id,') ? [{ id: 'same-uuid', email: 'decode.instructor@gmail.com', role: 'STUDENT', password_hash: 'existing-hash' }] : [] }));
    await provisionInstructor(client, 'test-password', helpers);
    expect(helpers.verifyPassword).toHaveBeenCalledWith('test-password', 'existing-hash');
    expect(client.query).toHaveBeenCalledWith(expect.stringMatching(/^UPDATE users/), ['decode.instructor@gmail.com', 'INSTRUCTOR', 'same-uuid']);
    expect(client.query).toHaveBeenCalledWith('DELETE FROM sessions WHERE user_id = $1', ['same-uuid']);
  });
  it('rolls back a conflicting existing account without overwriting its password or role', async () => {
    client.query.mockImplementation(async (sql: string) => ({ rows: sql.startsWith('SELECT id,') ? [{ id: 'existing-uuid', password_hash: 'other-hash' }] : [] }));
    helpers.verifyPassword.mockResolvedValue(false);
    await expect(provisionInstructor(client, 'test-password', helpers)).rejects.toThrow('credentials were not overwritten');
    expect(client.query.mock.calls.at(-1)[0]).toBe('ROLLBACK');
    expect(client.query.mock.calls.some(([sql]) => /^(INSERT|UPDATE|DELETE)/.test(sql))).toBe(false);
  });
  it('rejects missing secrets before issuing database writes', async () => {
    await expect(provisionInstructor(client, undefined, helpers)).rejects.toThrow('INSTRUCTOR_BOOTSTRAP_PASSWORD');
    expect(client.query).not.toHaveBeenCalled();
  });
});
