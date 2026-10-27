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
  UnauthorizedException,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { frontendOriginAllowed } from './frontend-origins.js';

import {
  cookieToken,
  legacySessionCookie as cookieName,
  readSessionToken,
  roleSessionCookies,
  sessionScope,
} from './session-cookies.js';

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
      (origin && !frontendOriginAllowed(origin))
    ) {
      throw new ForbiddenException('Request origin is not allowed.');
    }
  }

  private setSession(
    response: Response,
    result: Awaited<ReturnType<AuthService['login']>>,
  ) {
    const options = {
      ...cookieOptions(),
      ...(result.remember ? { maxAge: result.maxAge } : {}),
    };
    response.cookie(cookieName, result.token, options);
    response.cookie(
      roleSessionCookies[
        result.user.role === 'INSTRUCTOR' ? 'instructor' : 'student'
      ],
      result.token,
      options,
    );
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
    return this.auth.me(readSessionToken(request, sessionScope(request)));
  }

  @Post('logout')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.checkRequest(request);
    const scope = sessionScope(request);
    let token = readSessionToken(request, scope);
    if (scope && token) {
      try {
        const { user } = await this.auth.me(token);
        const actualScope =
          user.role === 'INSTRUCTOR' ? 'instructor' : 'student';
        if (actualScope !== scope) token = undefined;
      } catch (error) {
        if (!(error instanceof UnauthorizedException)) throw error;
        token = undefined;
      }
    }
    const result = await this.auth.logout(token);
    const clear = new Set<string>(
      scope ? [roleSessionCookies[scope]] : [cookieName],
    );
    // Clear aliases of this token without touching the other role's session.
    if (token)
      for (const name of [cookieName, ...Object.values(roleSessionCookies)]) {
        if (cookieToken(request, name) === token) clear.add(name);
      }
    for (const name of clear) response.clearCookie(name, cookieOptions());
    return result;
  }
}
