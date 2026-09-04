// One place that owns "am I signed in, and for how much longer".
//
// The extension used to read the site's token out of a tab, which expires about
// an hour after it was minted and left the user staring at "sign in again". With
// its own login the extension holds the refresh token too, so a session survives
// as long as the platform lets it — and a refresh is attempted before a request
// goes out, not after one fails.
import { getSession, setSession } from '../util/store.js';

const SKEW_MS = 60_000; // treat a token as dead a minute early

export function decodeClaims(token) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

/**
 * Expiry in epoch ms. Snapp Market's JWT uses `exp` in seconds; Digikala Jet's
 * uses `expire_time`, also in seconds.
 */
export function expiryOf(token) {
  const claims = decodeClaims(token);
  if (!claims) return 0;
  const seconds = claims.exp ?? claims.expire_time ?? 0;
  return seconds * 1000;
}

export function isLive(session, now = Date.now()) {
  if (!session?.accessToken) return false;
  const expiresAt = session.expiresAt || expiryOf(session.accessToken);
  return !expiresAt || expiresAt > now + SKEW_MS;
}

export function canRefresh(session) {
  return Boolean(session?.refreshToken);
}

const key = (platform) => `auth:${platform}`;

export async function readSession(platform) {
  return getSession(key(platform));
}

export async function writeSession(platform, session) {
  await setSession(key(platform), session || null);
  return session || null;
}

export async function clearSession(platform) {
  return writeSession(platform, null);
}

/** Shape every platform's login returns, so the rest of the code sees one thing. */
export function makeSession({ accessToken, refreshToken = null, subject = null, extra = {} }) {
  return {
    accessToken,
    refreshToken,
    subject,
    expiresAt: expiryOf(accessToken),
    createdAt: Date.now(),
    ...extra,
  };
}

/**
 * Returns a live access token for the platform, refreshing first when it can.
 *
 * `refresh` is the platform's own refresh call; it receives the stored session
 * and returns a new one, or throws. A refresh failure clears the session rather
 * than leaving a dead token behind for the next call to trip over.
 */
export async function withFreshToken(platform, refresh) {
  const session = await readSession(platform);
  if (isLive(session)) return session;

  if (!canRefresh(session)) {
    await clearSession(platform);
    return null;
  }

  try {
    const refreshed = await refresh(session);
    if (!refreshed?.accessToken) throw new Error('refresh returned no token');
    return writeSession(platform, refreshed);
  } catch {
    await clearSession(platform);
    return null;
  }
}
