import type { PlatformId } from '../core/types';

export interface Session {
  accessToken: string;
  refreshToken: string | null;
  subject: string | null;
  expiresAt: number;
  createdAt: number;
  userId?: number | null;
}

const SKEW_MS = 60_000; // treat a token as dead a minute early

export function decodeClaims(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Expiry in epoch ms. Snapp Market's JWT carries `exp` in seconds; Digikala
 * Jet's carries `expire_time`, also in seconds.
 */
export function expiryOf(token: string): number {
  const claims = decodeClaims(token);
  if (!claims) return 0;
  const seconds = Number(claims.exp ?? claims.expire_time ?? 0);
  return seconds * 1000;
}

export function isLive(session: Session | null | undefined, now = Date.now()): boolean {
  if (!session?.accessToken) return false;
  const expiresAt = session.expiresAt || expiryOf(session.accessToken);
  return !expiresAt || expiresAt > now + SKEW_MS;
}

export function makeSession(input: {
  accessToken: string;
  refreshToken?: string | null;
  subject?: string | null;
  userId?: number | null;
}): Session {
  return {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken ?? null,
    subject: input.subject ?? null,
    userId: input.userId ?? null,
    expiresAt: expiryOf(input.accessToken),
    createdAt: Date.now(),
  };
}

export type SessionMap = Partial<Record<PlatformId, Session | null>>;
