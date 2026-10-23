import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  getHealth() {
    return { status: 'ok' };
  }

  @Get('database')
  async getDatabaseHealth() {
    try {
      // An empty users table is healthy; a missing migration is not.
      await this.prisma.user.findFirst({ select: { id: true } });
      return { status: 'ok', database: 'connected' };
    } catch {
      // Database errors may contain credentials or internal server details.
      throw new ServiceUnavailableException('Database is not ready');
    }
  }
}
