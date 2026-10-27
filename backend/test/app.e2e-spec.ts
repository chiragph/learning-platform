import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { vi } from 'vitest';
import { hashPassword } from '../src/auth/password.js';
import { allowedFrontendOrigins } from '../src/auth/frontend-origins.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const findFirst = vi.fn();
  const findUnique = vi.fn();
  const create = vi.fn();
  const sessionCreate = vi.fn();
  const sessionFindUnique = vi.fn();
  const deleteMany = vi.fn();
  const user = {
    id: 'student-id',
    name: 'Student',
    email: 'student@example.com',
    role: 'STUDENT',
  };
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await hashPassword('correct password');
  });

  beforeEach(async () => {
    vi.resetAllMocks();
    findUnique.mockResolvedValue({ ...user, passwordHash });
    create.mockResolvedValue(user);
    sessionCreate.mockResolvedValue({});
    deleteMany.mockResolvedValue({ count: 1 });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        user: { findFirst, findUnique, create },
        session: {
          create: sessionCreate,
          findUnique: sessionFindUnique,
          deleteMany,
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.enableCors({ origin: allowedFrontendOrigins(), credentials: true });
    app.setGlobalPrefix('api');
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect('Hello World!');
  });

  it('reports application health without querying the database', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok' });

    expect(findFirst).not.toHaveBeenCalled();
  });

  it.each([null, { id: 'existing-user' }])(
    'reports database readiness for an empty or populated users table: %j',
    async (user) => {
      findFirst.mockResolvedValue(user);

      await request(app.getHttpServer())
        .get('/api/health/database')
        .expect(200)
        .expect({ status: 'ok', database: 'connected' });

      expect(findFirst).toHaveBeenCalledWith({ select: { id: true } });
    },
  );

  it('returns 503 without leaking database errors when the database is unavailable or unmigrated', async () => {
    findFirst.mockRejectedValue(new Error('private connection details'));

    const response = await request(app.getHttpServer())
      .get('/api/health/database')
      .expect(503);

    expect(response.body.message).toBe('Database is not ready');
    expect(response.text).not.toContain('private connection details');
  });

  it('signs in using an HttpOnly session cookie, restores the session, and revokes it on logout', async () => {
    const agent = request.agent(app.getHttpServer());
    const response = await agent
      .post('/api/auth/login')
      .send({ email: user.email, password: 'correct password' })
      .expect(200);
    expect(response.body).toEqual({ user });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['set-cookie'][0]).toMatch(
      /decode_session=[a-f0-9]{64}; Path=\/; HttpOnly; SameSite=Lax/,
    );
    expect(response.headers['set-cookie'][0]).not.toContain('Expires=');
    sessionFindUnique.mockResolvedValue({
      user,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await agent.get('/api/auth/me').expect(200).expect({ user });
    await agent.post('/api/auth/logout').send({}).expect(200);
    expect(deleteMany).toHaveBeenCalledOnce();
    await agent.get('/api/auth/me').expect(401);
  });

  it('registers a student and sets a session without leaking credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ ...user, password: 'correct password' })
      .expect(201);
    expect(response.body).toEqual({ user });
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.text).not.toContain('password');
  });

  it('sets a persistent cookie only when Remember me is checked', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password: 'correct password', remember: true })
      .expect(200);
    expect(response.headers['set-cookie'][0]).toContain('Max-Age=2592000');
    expect(response.headers['set-cookie'][0]).toContain('Expires=');
  });

  it('rejects wrong passwords without issuing a cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password: 'wrong password' })
      .expect(401);
    expect(response.body.message).toBe('Invalid email or password.');
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it.each(['/api/auth/login', '/api/auth/register', '/api/auth/logout'])(
    'blocks cross-origin form and JSON submissions to %s',
    async (path) => {
      await request(app.getHttpServer())
        .post(path)
        .type('form')
        .send({ email: user.email, password: 'correct password' })
        .expect(415);
      await request(app.getHttpServer())
        .post(path)
        .set('Origin', 'https://untrusted.example')
        .send({ email: user.email, password: 'correct password' })
        .expect(403);
      expect(create).not.toHaveBeenCalled();
      expect(sessionCreate).not.toHaveBeenCalled();
      expect(deleteMany).not.toHaveBeenCalled();
    },
  );

  it.each(['http://localhost:3001', 'http://127.0.0.1:3001'])(
    'accepts local port fallback origin %s with credentials and the browser same-origin proxy context', async origin => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('Origin', origin)
        .set('Sec-Fetch-Site', 'same-origin')
        .send({ email: user.email, password: 'correct password' })
        .expect(200);
      expect(response.body).toEqual({ user });
      expect(response.headers['access-control-allow-origin']).toBe(origin);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    },
  );

  it('keeps cross-site requests blocked even when their Origin is in the local allowlist', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:3001')
      .set('Sec-Fetch-Site', 'cross-site')
      .send({ email: user.email, password: 'correct password' })
      .expect(403);
    expect(sessionCreate).not.toHaveBeenCalled();
  });

  it('does not leak database errors or issue cookies during an outage', async () => {
    findUnique.mockRejectedValue(new Error('private database password'));
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password: 'correct password' })
      .expect(503);
    expect(response.text).not.toContain('private database password');
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  afterEach(async () => {
    await app.close();
  });
});
