import { beforeEach, vi } from 'vitest';

// Node ≥26 exposes a built-in `localStorage`/`sessionStorage` global (an
// unusable stub without --localstorage-file) that shadows jsdom's and cannot
// be reassigned by the environment. Re-define the properties so the tests get
// a real in-memory Storage whatever the runtime exposes.
function polyfillStorage(name: 'localStorage' | 'sessionStorage') {
  const makeStorage = (): Storage => {
    const map = new Map<string, string>();
    return {
      get length() {
        return map.size;
      },
      clear: () => map.clear(),
      getItem: (k: string) => map.get(String(k)) ?? null,
      key: (i: number) => [...map.keys()][i] ?? null,
      removeItem: (k: string) => void map.delete(String(k)),
      setItem: (k: string, v: string) => void map.set(String(k), String(v)),
    } as Storage;
  };
  try {
    const existing = (globalThis as unknown as Record<string, { clear?: unknown } | undefined>)[
      name
    ];
    if (typeof existing?.clear === 'function') return;
  } catch {
    /* reading it throws on some Node builds */
  }
  Object.defineProperty(globalThis, name, {
    value: makeStorage(),
    writable: true,
    configurable: true,
  });
}
polyfillStorage('localStorage');
polyfillStorage('sessionStorage');

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
