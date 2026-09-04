import { beforeEach, vi } from 'vitest';

// jsdom has no crypto.randomUUID in every version, and none of the tests care
// which id they get.
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: { ...globalThis.crypto, randomUUID: () => 'test-uuid' },
    configurable: true,
  });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

/** A JWT whose only job is to carry an expiry the session store accepts. */
export function fakeJwt(secondsFromNow = 3600): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'none' })}.${encode({ exp: Math.floor(Date.now() / 1000) + secondsFromNow })}.sig`;
}
