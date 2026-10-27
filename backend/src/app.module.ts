import { LearningService } from './learning/learning.service.js';
import { LearningController } from './learning/learning.controller.js';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthController } from './health/health.controller.js';
import { AuthModule } from './auth/auth.module.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AppController, HealthController, LearningController],
  providers: [AppService, LearningService],
})
export class AppModule {}