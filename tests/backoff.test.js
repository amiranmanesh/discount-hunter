import { describe, expect, it } from 'vitest';
import { RateLimit, formatWait, retryAfterSeconds } from '../extension/src/util/backoff.js';

const T0 = 1_700_000_000_000;

describe('RateLimit', () => {
  it('allows the first request', () => {
    expect(new RateLimit().waitBeforeRequest(T0)).toBe(0);
  });

  it('holds a resend for two minutes', () => {
    const limit = new RateLimit();
    limit.recordRequest(T0);
    expect(limit.waitBeforeRequest(T0 + 1000)).toBe(119);
    expect(limit.waitBeforeRequest(T0 + 120_000)).toBe(0);
  });

  it('caps the number of codes in the window', () => {
    const limit = new RateLimit();
    for (let i = 0; i < 5; i += 1) limit.recordRequest(T0 + i * 130_000);
    // Past the per-resend cooldown, but the window cap still applies.
    expect(limit.waitBeforeRequest(T0 + 5 * 130_000)).toBeGreaterThan(0);
  });

  it('forgets requests once the window slides past them', () => {
    const limit = new RateLimit();
    for (let i = 0; i < 5; i += 1) limit.recordRequest(T0 + i * 1000);
    expect(limit.waitBeforeRequest(T0 + 950_000)).toBe(0);
  });

  it('honours a server-side throttle', () => {
    const limit = new RateLimit();
    expect(limit.block(300, T0)).toBe(300);
    expect(limit.waitBeforeRequest(T0 + 60_000)).toBe(240);
  });

  it('never shortens an existing block', () => {
    const limit = new RateLimit();
    limit.block(600, T0);
    limit.block(30, T0);
    expect(limit.waitBeforeRequest(T0)).toBe(600);
  });

  it('counts down verification attempts and resets them on a new code', () => {
    const limit = new RateLimit();
    expect(limit.attemptsLeft).toBe(5);
    limit.recordVerifyFailure();
    limit.recordVerifyFailure();
    expect(limit.attemptsLeft).toBe(3);
    limit.recordRequest(T0);
    expect(limit.attemptsLeft).toBe(5);
  });

  it('survives a round trip through storage', () => {
    const limit = new RateLimit();
    limit.recordRequest(T0);
    limit.recordVerifyFailure();
    const restored = new RateLimit(JSON.parse(JSON.stringify(limit)));
    expect(restored.waitBeforeRequest(T0 + 1000)).toBe(119);
    expect(restored.attemptsLeft).toBe(4);
  });
});

describe('retryAfterSeconds', () => {
  const withHeader = (value) => ({ headers: { get: () => value } });

  it('reads the numeric form', () => {
    expect(retryAfterSeconds(withHeader('90'))).toBe(90);
  });

  it('reads the date form', () => {
    const future = new Date(Date.now() + 60_000).toUTCString();
    expect(retryAfterSeconds(withHeader(future))).toBeGreaterThan(50);
  });

  it('returns null when the header is absent', () => {
    expect(retryAfterSeconds(withHeader(null))).toBeNull();
    expect(retryAfterSeconds(undefined)).toBeNull();
  });
});

describe('formatWait', () => {
  it('reads naturally in Persian', () => {
    expect(formatWait(0)).toBe('');
    expect(formatWait(45)).toBe('45 ثانیه');
    expect(formatWait(90)).toBe('2 دقیقه');
  });
});
