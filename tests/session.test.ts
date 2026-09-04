import { describe, expect, it } from 'vitest';
import { expiryOf, isLive, makeSession } from '../src/auth/session';
import { fakeJwt } from './setup';

const jwt = (payload: Record<string, unknown>) => {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'none' })}.${encode(payload)}.sig`;
};

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
    expect(isLive(makeSession({ accessToken: fakeJwt(3600) }))).toBe(true);
  });

  it('rejects one inside the safety margin', () => {
    expect(isLive(makeSession({ accessToken: fakeJwt(30) }))).toBe(false);
  });

  it('rejects nothing at all', () => {
    expect(isLive(null)).toBe(false);
  });
});
