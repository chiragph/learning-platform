import { createHash } from 'node:crypto';
import { vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword, verifyPassword } from './password.js';

describe('Database authentication', () => {
  const user = {
    id: 'test-user',
    name: 'Test Student',
    email: 'student@example.com',
    role: 'STUDENT',
  };
  const password = 'a real password 123';
  let passwordHash: string;
  const prisma = {
    user: { create: vi.fn(), findUnique: vi.fn() },
    session: { create: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
  };
  let service: AuthService;

  beforeAll(async () => {
    passwordHash = await hashPassword(password);
  });
  beforeEach(() => {
    vi.resetAllMocks();
    service = new AuthService(prisma as unknown as PrismaService);
    prisma.user.create.mockResolvedValue(user);
    prisma.user.findUnique.mockResolvedValue({ ...user, passwordHash });
    prisma.session.create.mockResolvedValue({});
    prisma.session.deleteMany.mockResolvedValue({ count: 1 });
  });

  it('registers normalized email with a salted password and atomic student session, ignoring an injected admin role', async () => {
    const result = await service.register({
      name: ' Test Student ',
      email: ' STUDENT@EXAMPLE.COM ',
      password,
      role: 'ADMIN',
    });
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      name: user.name,
      email: user.email,
      role: 'STUDENT',
    });
    expect(data.passwordHash).not.toBe(password);
    expect(data.passwordHash).not.toBe(passwordHash);
    expect(await verifyPassword(password, data.passwordHash)).toBe(true);
    expect(data.sessions.create.tokenHash).toBe(
      createHash('sha256').update(result.token).digest('hex'),
    );
    expect(data.sessions.create.tokenHash).not.toBe(result.token);
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('authenticates case-insensitive, trimmed email and creates a hashed session token', async () => {
    const result = await service.login({
      email: ' STUDENT@EXAMPLE.COM ',
      password,
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: user.email },
    });
    expect(result.user).toEqual(user);
    expect(result.token).toMatch(/^[a-f0-9]{64}$/);
    expect(prisma.session.create.mock.calls[0][0].data.tokenHash).toBe(
      createHash('sha256').update(result.token).digest('hex'),
    );
    expect(result.remember).toBe(false);
    expect(result.maxAge).toBe(12 * 60 * 60 * 1000);
  });

  it('uses a 30 day expiry when Remember me is checked', async () => {
    const result = await service.login({
      email: user.email,
      password,
      remember: true,
    });
    expect(result.remember).toBe(true);
    expect(result.maxAge).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it.each(['wrong password', 'missing user', 'invalid stored hash'])(
    'rejects %s with the same error and creates no session',
    async (scenario) => {
      if (scenario === 'missing user')
        prisma.user.findUnique.mockResolvedValue(null);
      if (scenario === 'invalid stored hash')
        prisma.user.findUnique.mockResolvedValue({
          ...user,
          passwordHash: 'plaintext',
        });
      await expect(
        service.login({
          email: user.email,
          password: scenario === 'wrong password' ? 'wrong' : password,
        }),
      ).rejects.toThrow('Invalid email or password.');
      expect(prisma.session.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    null,
    [],
    {},
    { email: 10, password },
    { email: user.email, password: {} },
    { email: user.email, password, remember: 'true' },
  ])(
    'rejects malformed login input before querying PostgreSQL: %j',
    async (body) => {
      await expect(service.login(body)).rejects.toMatchObject({ status: 400 });
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    },
  );

  it.each([
    { name: 'A', password },
    { name: user.name, password: 'short' },
  ])('validates registration on the server: %j', async (input) => {
    await expect(
      service.register({ email: user.email, ...input }),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('handles concurrent duplicate registrations as a conflict', async () => {
    prisma.user.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.register({ ...user, password })).rejects.toMatchObject(
      { status: 409 },
    );
  });

  it('returns a safe 503 when the database is unavailable', async () => {
    prisma.user.findUnique.mockRejectedValue(
      new Error('postgresql://private-credentials'),
    );
    await expect(
      service.login({ email: user.email, password }),
    ).rejects.toThrow(
      'Authentication is temporarily unavailable. Please try again.',
    );
  });

  it('allows a valid session and rejects missing, expired, or revoked sessions', async () => {
    await expect(service.me()).rejects.toMatchObject({ status: 401 });
    prisma.session.findUnique.mockResolvedValue({
      user,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(service.me('a'.repeat(64))).resolves.toEqual({ user });
    prisma.session.findUnique.mockResolvedValue({
      user,
      expiresAt: new Date(Date.now() - 1),
    });
    await expect(service.me('a'.repeat(64))).rejects.toMatchObject({
      status: 401,
    });
    prisma.session.findUnique.mockResolvedValue(null);
    await expect(service.me('a'.repeat(64))).rejects.toMatchObject({
      status: 401,
    });
  });

  it('revokes the current session on logout and permits repeated logout', async () => {
    const token = 'b'.repeat(64);
    await service.logout(token);
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: createHash('sha256').update(token).digest('hex') },
    });
    await expect(service.logout()).resolves.toEqual({
      message: 'Signed out successfully.',
    });
  });
});
