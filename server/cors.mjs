/**
 * Cross-origin rules, shared by the Node server and the Worker.
 *
 * Only needed when the app and its proxy sit on different origins — a build on
 * GitHub Pages talking to a proxy elsewhere. When both are the same host there
 * is no CORS to configure and `ALLOWED_ORIGINS` stays empty.
 *
 * The list is never `*`: this proxy forwards whatever `Authorization` header it
 * is handed, so any origin it echoes is an origin that can spend the user's
 * session.
 */
export function parseAllowedOrigins(value) {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

/** The origin to echo back, or null when the request needs no CORS headers. */
export function resolveOrigin(requestOrigin, allowed) {
  if (!requestOrigin || !allowed.length) return null;
  const normalised = requestOrigin.replace(/\/$/, '');
  return allowed.includes(normalised) ? normalised : null;
}

export function corsHeaders(origin) {
  if (!origin) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': '*',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}
