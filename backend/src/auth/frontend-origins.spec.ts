import { vi } from 'vitest';
import { allowedFrontendOrigins, frontendOriginAllowed } from './frontend-origins.js';

describe('Frontend origin allowlist', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('FRONTEND_URL', 'http://localhost:3000');
    vi.stubEnv('FRONTEND_ORIGINS', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(['localhost', '127.0.0.1', '[::1]'])('accepts the expected local Next ports on %s', host => {
    for (const port of [3000, 3001, 3100]) expect(frontendOriginAllowed(`http://${host}:${port}`)).toBe(true);
  });
  it.each([
    'https://untrusted.example', 'http://localhost.evil.example:3000',
    'http://localhost:9999', 'null', 'http://localhost:3000/path',
    'http://localhost:3000/', 'http://user@localhost:3000',
  ])('rejects unconfigured or malformed origins: %s', origin => {
    expect(frontendOriginAllowed(origin)).toBe(false);
  });
  it('does not automatically allow development origins in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('FRONTEND_URL', 'https://decode.example/');
    expect(allowedFrontendOrigins()).toEqual(['https://decode.example']);
    expect(frontendOriginAllowed('http://localhost:3001')).toBe(false);
    expect(frontendOriginAllowed('http://127.0.0.1:3000')).toBe(false);
  });
  it('requires exact configuration even for a loopback production deployment', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(allowedFrontendOrigins()).toEqual(['http://localhost:3000']);
    expect(frontendOriginAllowed('http://localhost:3001')).toBe(false);
  });
  it('allows explicitly configured additional deployment origins', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('FRONTEND_URL', 'https://decode.example');
    vi.stubEnv('FRONTEND_ORIGINS', ' https://instructors.decode.example/ ,https://decode.example');
    expect(allowedFrontendOrigins()).toEqual(['https://decode.example', 'https://instructors.decode.example']);
  });
  it('does not add local defaults when the configured frontend is a remote deployment', () => {
    vi.stubEnv('FRONTEND_URL', 'https://decode.example');
    expect(allowedFrontendOrigins()).toEqual(['https://decode.example']);
  });
  it('normalizes the configured URL and includes loopback aliases for a custom local port', () => {
    vi.stubEnv('FRONTEND_URL', ' http://localhost:3200/ ');
    expect(frontendOriginAllowed('http://127.0.0.1:3200')).toBe(true);
    expect(frontendOriginAllowed('http://localhost:3200')).toBe(true);
  });
  it.each(['*', 'https://user:secret@decode.example', 'https://decode.example/path'])('rejects unsafe configuration instead of trusting request headers: %s', value => {
    vi.stubEnv('FRONTEND_ORIGINS', value);
    expect(() => allowedFrontendOrigins()).toThrow('Frontend URLs must be HTTP(S) origins');
  });
});
