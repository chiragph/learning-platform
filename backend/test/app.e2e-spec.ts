import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { vi } from 'vitest';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const findFirst = vi.fn();

  beforeEach(async () => {
    findFirst.mockReset();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ user: { findFirst } })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('reports application health without querying the database', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });

    expect(findFirst).not.toHaveBeenCalled();
  });

  it.each([null, { id: 'existing-user' }])(
    'reports database readiness for an empty or populated users table: %j',
    async (user) => {
      findFirst.mockResolvedValue(user);

      await request(app.getHttpServer())
        .get('/health/database')
        .expect(200)
        .expect({ status: 'ok', database: 'connected' });

      expect(findFirst).toHaveBeenCalledWith({ select: { id: true } });
    },
  );

  it('returns 503 without leaking database errors when the database is unavailable or unmigrated', async () => {
    findFirst.mockRejectedValue(new Error('private connection details'));

    const response = await request(app.getHttpServer())
      .get('/health/database')
      .expect(503);

    expect(response.body.message).toBe('Database is not ready');
    expect(response.text).not.toContain('private connection details');
  });

  afterEach(async () => {
    await app.close();
  });
});
