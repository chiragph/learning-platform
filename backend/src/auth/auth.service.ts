import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword, verifyPassword } from './password.js';
import { isInstructorEmail, publicAccount } from './account-access.js';

const publicUser = { id: true, name: true, email: true, role: true } as const;
const invalidCredentials = () =>
  new UnauthorizedException('Invalid email or password.');

function validate(body: unknown, register: boolean) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Enter your email and password.');
  }
  const input = body as Record<string, unknown>;
  const email =
    typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException('Enter a valid email address.');
  }
  if (
    !password ||
    password.length > 1024 ||
    (register && password.length < 8)
  ) {
    throw new BadRequestException(
      register
        ? 'Use between 8 and 1024 characters for your password.'
        : 'Enter your password (up to 1024 characters).',
    );
  }
  if (register && (name.length < 2 || name.length > 100)) {
    throw new BadRequestException(
      'Enter your full name (between 2 and 100 characters).',
    );
  }
  if (input.remember !== undefined && typeof input.remember !== 'boolean') {
    throw new BadRequestException('Remember me must be true or false.');
  }
  return { email, password, name, remember: input.remember === true };
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function newSession(remember: boolean) {
  const token = randomBytes(32).toString('hex');
  const maxAge = (remember ? 30 * 24 : 12) * 60 * 60 * 1000;
  return {
    token,
    maxAge,
    tokenHash: tokenHash(token),
    expiresAt: new Date(Date.now() + maxAge),
  };
}

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async database<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        'Authentication is temporarily unavailable. Please try again.',
      );
    }
  }

  async register(body: unknown) {
    const { email, password, name } = validate(body, true);
    if (isInstructorEmail(email)) {
      throw new ConflictException('This account is reserved. Sign in instead.');
    }
    const passwordHash = await hashPassword(password);
    const session = newSession(false);
    return this.database(async () => {
      try {
        // Creating the account and its first session is one atomic database write.
        const user = await this.prisma.user.create({
          data: {
            name,
            email,
            passwordHash,
            role: 'STUDENT',
            sessions: {
              create: {
                tokenHash: session.tokenHash,
                expiresAt: session.expiresAt,
              },
            },
          },
          select: publicUser,
        });
        return {
          user: publicAccount(user),
          token: session.token,
          maxAge: session.maxAge,
          remember: false,
        };
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'P2002'
        ) {
          throw new ConflictException(
            'An account with this email already exists. Sign in instead.',
          );
        }
        throw error;
      }
    });
  }

  async login(body: unknown) {
    const { email, password, remember } = validate(body, false);
    return this.database(async () => {
      const record = await this.prisma.user.findUnique({ where: { email } });
      const matches = await verifyPassword(password, record?.passwordHash);
      if (!record || !matches) throw invalidCredentials();
      const session = newSession(remember);
      await this.prisma.session.create({
        data: {
          userId: record.id,
          tokenHash: session.tokenHash,
          expiresAt: session.expiresAt,
        },
      });
      const { id, name, role } = record;
      return {
        user: publicAccount({ id, name, email: record.email, role }),
        token: session.token,
        maxAge: session.maxAge,
        remember,
      };
    });
  }

  async me(token?: string) {
    if (!token) throw new UnauthorizedException('Please sign in.');
    return this.database(async () => {
      const session = await this.prisma.session.findUnique({
        where: { tokenHash: tokenHash(token) },
        include: { user: { select: publicUser } },
      });
      if (!session || session.expiresAt.getTime() <= Date.now()) {
        throw new UnauthorizedException(
          'Your session has expired. Please sign in again.',
        );
      }
      return { user: publicAccount(session.user) };
    });
  }

  async logout(token?: string) {
    if (token) {
      await this.database(() =>
        this.prisma.session.deleteMany({
          where: { tokenHash: tokenHash(token) },
        }),
      );
    }
    return { message: 'Signed out successfully.' };
  }
}
