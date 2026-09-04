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

beforeEach(() => {
  storageReset();
  vi.restoreAllMocks();
});
