import { describe, expect, it, vi } from 'vitest';
import {
  clearSession,
  expiryOf,
  isLive,
  makeSession,
  readSession,
  withFreshToken,
  writeSession,
} from '../extension/src/auth/session.js';

const jwt = (payload) => {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode(payload)}.sig`;
};
const inSeconds = (seconds) => Math.floor(Date.now() / 1000) + seconds;

describe('expiryOf', () => {
  it("reads Snapp Market's `exp`", () => {
    expect(expiryOf(jwt({ exp: 1_700_000_000 }))).toBe(1_700_000_000_000);
  });

  it("reads Digikala Jet's `expire_time`", () => {
    expect(expiryOf(jwt({ expire_time: 1_700_000_000 }))).toBe(1_700_000_000_000);
  });

  it('returns 0 for something that is not a JWT', () => {
    expect(expiryOf('not-a-token')).toBe(0);
  });
});

describe('isLive', () => {
  it('accepts a token with time left', () => {
    expect(isLive(makeSession({ accessToken: jwt({ exp: inSeconds(3600) }) }))).toBe(true);
  });

  it('rejects one inside the safety margin', () => {
    expect(isLive(makeSession({ accessToken: jwt({ exp: inSeconds(30) }) }))).toBe(false);
  });

  it('rejects nothing at all', () => {
    expect(isLive(null)).toBe(false);
  });
});

describe('withFreshToken', () => {
  it('returns the stored session untouched while it is live', async () => {
    const session = makeSession({ accessToken: jwt({ exp: inSeconds(3600) }) });
    await writeSession('snapp', session);
    const refresh = vi.fn();

    expect(await withFreshToken('snapp', refresh)).toMatchObject({
      accessToken: session.accessToken,
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes an expired session and stores the result', async () => {
    await writeSession(
      'snapp',
      makeSession({ accessToken: jwt({ exp: inSeconds(-10) }), refreshToken: 'r1' }),
    );
    const fresh = makeSession({ accessToken: jwt({ exp: inSeconds(3600) }), refreshToken: 'r2' });

    const result = await withFreshToken('snapp', async () => fresh);

    expect(result.refreshToken).toBe('r2');
    expect((await readSession('snapp')).refreshToken).toBe('r2');
  });

  it('clears the session when the refresh fails', async () => {
    await writeSession(
      'snapp',
      makeSession({ accessToken: jwt({ exp: inSeconds(-10) }), refreshToken: 'r1' }),
    );

    expect(
      await withFreshToken('snapp', async () => {
        throw new Error('nope');
      }),
    ).toBeNull();
    expect(await readSession('snapp')).toBeNull();
  });

  it('clears an expired session with no refresh token', async () => {
    await writeSession('snapp', makeSession({ accessToken: jwt({ exp: inSeconds(-10) }) }));
    expect(await withFreshToken('snapp', vi.fn())).toBeNull();
    expect(await readSession('snapp')).toBeNull();
  });

  it('keeps the two platforms apart', async () => {
    await writeSession('snapp', makeSession({ accessToken: jwt({ exp: inSeconds(3600) }) }));
    await writeSession('jet', makeSession({ accessToken: jwt({ expire_time: inSeconds(3600) }) }));
    await clearSession('snapp');

    expect(await readSession('snapp')).toBeNull();
    expect(await readSession('jet')).not.toBeNull();
  });
});
