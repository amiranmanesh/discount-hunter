/**
 * Cross-origin rules for the proxy routes.
 *
 * Only needed when the app and its proxy sit on different origins — a browser
 * extension, a second front-end, a separate staging host. When the app is
 * served by this same Next.js server, which is the normal case on a personal
 * domain, there is no CORS to configure and `ALLOWED_ORIGINS` stays empty.
 *
 * The list is never `*`: these routes forward whatever `Authorization` header
 * they are handed, so any origin echoed back is an origin that can spend the
 * user's session.
 */
export function parseAllowedOrigins(value: string | undefined | null): string[] {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

/** The origin to echo back, or null when the request needs no CORS headers. */
export function resolveOrigin(
  requestOrigin: string | undefined | null,
  allowed: string[],
): string | null {
  if (!requestOrigin || !allowed.length) return null;
  const normalised = requestOrigin.replace(/\/$/, '');
  return allowed.includes(normalised) ? normalised : null;
}

export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': '*',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

/** Read at request time, not at module load, so a restart is enough to change it. */
export function allowedOrigins(): string[] {
  return parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
}
