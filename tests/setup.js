// The extension modules talk to `chrome.storage.local` and `crypto.randomUUID`.
// Both get an in-memory stand-in so the pure logic can be tested in Node.
import { beforeEach, vi } from 'vitest';

const store = new Map();

globalThis.chrome = {
  storage: {
    local: {
      async get(keys) {
        const wanted = Array.isArray(keys) ? keys : [keys];
        return Object.fromEntries(
          wanted.filter((key) => store.has(key)).map((key) => [key, store.get(key)]),
        );
      },
      async set(patch) {
        for (const [key, value] of Object.entries(patch)) store.set(key, value);
      },
    },
  },
  runtime: { sendMessage: vi.fn(async () => undefined), lastError: null },
  tabs: { create: vi.fn(async () => ({})) },
};

export function storageReset() {
  store.clear();
}

/** A JWT whose only job is to carry an expiry the session store accepts. */
export function fakeJwt(secondsFromNow = 3600) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode({ exp: Math.floor(Date.now() / 1000) + secondsFromNow })}.sig`;
}

/** Puts a live session in storage, the way a successful OTP login would. */
export async function signIn(
  platform = 'snapp',
  { secondsFromNow = 3600, refreshToken = 'r' } = {},
) {
  const accessToken = fakeJwt(secondsFromNow);
  await chrome.storage.local.set({
    [`auth:${platform}`]: {
      accessToken,
      refreshToken,
      subject: '09123456789',
      expiresAt: Date.now() + secondsFromNow * 1000,
      createdAt: Date.now(),
    },
  });
  return accessToken;
}

beforeEach(() => {
  storageReset();
  vi.restoreAllMocks();
});
