import 'dotenv/config';
import { Injectable } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is required. Configure it in backend/.env.',
      );
    }

    // Prisma opens the database connection when the first query is made.
    super({
      adapter: new PrismaPg({
        connectionString,
        // Prisma's pg adapter expects UTC timestamp text. Keep session expiry
        // correct when the local PostgreSQL server uses Asia/Calcutta or another zone.
        options: '-c timezone=UTC',
        connectionTimeoutMillis: 5_000,
        query_timeout: 5_000,
      }),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
