import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';

export type SessionScope = 'student' | 'instructor';
export const legacySessionCookie = 'decode_session';
export const roleSessionCookies = {
  student: 'decode_student_session',
  instructor: 'decode_instructor_session',
} as const;

export function sessionScope(request: Request): SessionScope | undefined {
  const scope = request.query.scope;
  if (scope === undefined) return undefined;
  if (scope !== 'student' && scope !== 'instructor') {
    throw new BadRequestException('Choose a valid session scope.');
  }
  return scope;
}

export function cookieToken(request: Request, name: string) {
  const part = request.headers.cookie
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(name + '='));
  return part?.slice(name.length + 1);
}

export function readSessionToken(request: Request, scope?: SessionScope) {
  // Prefer the requested workspace cookie. Legacy sessions remain usable until
  // the next sign-in without allowing an invalid role cookie to fall back.
  const raw = scope
    ? (cookieToken(request, roleSessionCookies[scope]) ??
      cookieToken(request, legacySessionCookie))
    : cookieToken(request, legacySessionCookie);
  return raw && /^[a-f0-9]{64}$/.test(raw) ? raw : undefined;
}
