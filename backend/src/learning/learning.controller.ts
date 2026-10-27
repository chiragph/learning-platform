import { readSessionToken } from '../auth/session-cookies.js';
import {
  Body,
  Controller,
  Param,
  ForbiddenException,
  Get,
  Header,
  Inject,
  Post,
  Put,
  Req,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { frontendOriginAllowed } from '../auth/frontend-origins.js';
import { LearningService } from './learning.service.js';
@Controller('learning')
export class LearningController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(LearningService) private readonly learning: LearningService,
  ) {}
  private async user(req: Request, role: string, write = false) {
    if (write) {
      if (!req.is('application/json'))
        throw new UnsupportedMediaTypeException('Send JSON.');
      if (
        req.headers['sec-fetch-site'] === 'cross-site' ||
        (req.headers.origin && !frontendOriginAllowed(req.headers.origin))
      )
        throw new ForbiddenException('Request origin is not allowed.');
    }
    const token = readSessionToken(
      req,
      role === 'INSTRUCTOR' ? 'instructor' : 'student',
    );
    const { user } = await this.auth.me(token);
    if (user.role !== role)
      throw new ForbiddenException(
        'This action is not available to this account.',
      );
    return user.id;
  }
  @Header('Cache-Control', 'no-store')
  @Get('instructor/submissions')
  async submissions(@Req() req: Request) {
    return this.learning.submissions(await this.user(req, 'INSTRUCTOR'), true);
  }
  @Header('Cache-Control', 'no-store')
  @Post('instructor/reviews')
  async review(@Req() req: Request, @Body() body: unknown) {
    return this.learning.review(await this.user(req, 'INSTRUCTOR', true), body);
  }
  @Header('Cache-Control', 'no-store')
  @Get('instructor/submissions/:id/code')
  async code(@Req() req: Request, @Param('id') id: string) {
    return this.learning.submissionCode(await this.user(req, 'INSTRUCTOR'), id);
  }
  @Header('Cache-Control', 'no-store')
  @Get('submissions')
  async own(@Req() req: Request) {
    return this.learning.submissions(await this.user(req, 'STUDENT'));
  }
  @Header('Cache-Control', 'no-store')
  @Post('submissions/resubmit')
  async resubmit(@Req() req: Request, @Body() body: unknown) {
    return this.learning.resubmit(await this.user(req, 'STUDENT', true), body);
  }
  @Header('Cache-Control', 'no-store')
  @Get('instructor')
  async workspace(@Req() req: Request) {
    return this.learning.workspace(await this.user(req, 'INSTRUCTOR'));
  }
  @Header('Cache-Control', 'no-store')
  @Post('instructor/import-drafts')
  async importDrafts(@Req() req: Request, @Body() body: unknown) {
    return this.learning.importDrafts(
      await this.user(req, 'INSTRUCTOR', true),
      body,
    );
  }
  @Header('Cache-Control', 'no-store')
  @Post('instructor/commands')
  async command(@Req() req: Request, @Body() body: unknown) {
    return this.learning.command(
      await this.user(req, 'INSTRUCTOR', true),
      body,
    );
  }
  @Header('Cache-Control', 'no-store')
  @Get('instructor/insights')
  async insights(@Req() req: Request) {
    return this.learning.insights(await this.user(req, 'INSTRUCTOR'));
  }
  @Header('Cache-Control', 'no-store')
  @Get('curriculum')
  async curriculum(@Req() req: Request) {
    await this.user(req, 'STUDENT');
    return this.learning.curriculum();
  }
  @Header('Cache-Control', 'no-store')
  @Get('progress')
  async progress(@Req() req: Request) {
    return this.learning.progress(await this.user(req, 'STUDENT'));
  }
  @Header('Cache-Control', 'no-store')
  @Put('progress')
  async save(@Req() req: Request, @Body() body: unknown) {
    return this.learning.saveProgress(
      await this.user(req, 'STUDENT', true),
      body,
    );
  }
  @Header('Cache-Control', 'no-store')
  @Post('progress/reset')
  async reset(@Req() req: Request, @Body() body: unknown) {
    return this.learning.resetProgress(
      await this.user(req, 'STUDENT', true),
      body,
    );
  }
  @Header('Cache-Control', 'no-store')
  @Post('quiz-attempts')
  async quiz(@Req() req: Request, @Body() body: unknown) {
    return this.learning.quiz(await this.user(req, 'STUDENT', true), body);
  }
}
