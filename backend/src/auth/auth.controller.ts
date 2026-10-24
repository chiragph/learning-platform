import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service.js';

const cookieName = 'decode_session';

function readToken(request: Request) {
  const cookie = request.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));
  const token = cookie?.slice(cookieName.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : undefined;
}

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  private checkRequest(request: Request) {
    if (!request.is('application/json'))
      throw new UnsupportedMediaTypeException(
        'Send authentication requests as JSON.',
      );
    const origin = request.headers.origin;
    if (
      request.headers['sec-fetch-site'] === 'cross-site' ||
      (origin &&
        origin !== (process.env.FRONTEND_URL ?? 'http://localhost:3000'))
    ) {
      throw new ForbiddenException('Request origin is not allowed.');
    }
  }

  private setSession(
    response: Response,
    result: Awaited<ReturnType<AuthService['login']>>,
  ) {
    response.cookie(cookieName, result.token, {
      ...cookieOptions(),
      ...(result.remember ? { maxAge: result.maxAge } : {}),
    });
    return { user: result.user };
  }

  @Post('register')
  @Header('Cache-Control', 'no-store')
  async register(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.checkRequest(request);
    return this.setSession(response, await this.auth.register(body));
  }

  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async login(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.checkRequest(request);
    return this.setSession(response, await this.auth.login(body));
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  me(@Req() request: Request) {
    return this.auth.me(readToken(request));
  }

  @Post('logout')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.checkRequest(request);
    const result = await this.auth.logout(readToken(request));
    response.clearCookie(cookieName, cookieOptions());
    return result;
  }
}
