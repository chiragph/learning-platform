const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
const developmentPorts = ['3000', '3001', '3100'];

function configuredOrigin(value: string) {
  try {
    const url = new URL(value);
    if (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username && !url.password && url.pathname === '/' &&
      !url.search && !url.hash
    ) return url.origin;
  } catch { /* Invalid configuration must never grant an origin access. */ }
  throw new Error('Frontend URLs must be HTTP(S) origins without credentials, paths, queries, or fragments.');
}

export function allowedFrontendOrigins(): string[] {
  const primary = configuredOrigin(process.env.FRONTEND_URL?.trim() || 'http://localhost:3000');
  const origins = new Set([primary]);
  for (const value of (process.env.FRONTEND_ORIGINS ?? '').split(',')) {
    if (value.trim()) origins.add(configuredOrigin(value.trim()));
  }
  // Next chooses 3001 when 3000 is occupied. These are explicit local origins,
  // never an arbitrary port, reflected Host header, or deployment wildcard.
  if (process.env.NODE_ENV !== 'production' && loopbackHosts.has(new URL(primary).hostname)) {
    for (const host of loopbackHosts) {
      for (const port of developmentPorts) origins.add(`http://${host}:${port}`);
    }
    const localPrimary = new URL(primary);
    for (const host of loopbackHosts) {
      origins.add(`${localPrimary.protocol}//${host}${localPrimary.port ? `:${localPrimary.port}` : ''}`);
    }
  }
  return [...origins];
}

export function frontendOriginAllowed(origin: string) {
  // Compare the browser's exact Origin value; don't normalize malformed inputs.
  return allowedFrontendOrigins().includes(origin);
}
