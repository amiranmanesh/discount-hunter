import { afterEach, describe, expect, it } from 'vitest';
import { randomUuid } from '../src/core/uuid';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const real = globalThis.crypto;
afterEach(() => {
  Object.defineProperty(globalThis, 'crypto', { value: real, configurable: true });
});

/** What a page served over plain HTTP actually sees. */
function insecureContext(): void {
  Object.defineProperty(globalThis, 'crypto', {
    value: { getRandomValues: real.getRandomValues.bind(real) },
    configurable: true,
  });
}

describe('randomUuid', () => {
  it('uses crypto.randomUUID when the context allows it', () => {
    expect(randomUuid()).toMatch(V4);
  });

  // The bug this exists for: on http, `crypto.randomUUID` is undefined, and
  // calling it threw `TypeError: crypto.randomUUID is not a function` — which
  // killed every Snapp Market and Okala request, since both need a device id.
  it('still answers when randomUUID is missing, instead of throwing', () => {
    insecureContext();
    expect(randomUuid()).toMatch(V4);
  });

  it('answers even with no web crypto at all', () => {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    expect(randomUuid()).toMatch(V4);
  });

  it('does not repeat itself', () => {
    insecureContext();
    const ids = new Set(Array.from({ length: 200 }, () => randomUuid()));
    expect(ids.size).toBe(200);
  });
});
