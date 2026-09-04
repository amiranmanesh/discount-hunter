// Rate-limit bookkeeping for the OTP endpoints.
//
// These are the easiest way to get a number throttled, so the budget is
// deliberately conservative: a cooldown the user can see, a cap on codes, and an
// honest wait when the server pushes back.

export interface RateLimitState {
  requests: number[];
  verifyAttempts: number;
  blockedUntil: number;
}

export interface RateLimitOptions {
  resendAfter: number;
  maxRequests: number;
  windowSeconds: number;
  maxVerifyAttempts: number;
}

export const DEFAULT_LIMITS: RateLimitOptions = {
  resendAfter: 120,
  maxRequests: 5,
  windowSeconds: 900,
  maxVerifyAttempts: 5,
};

export const emptyLimit = (): RateLimitState => ({
  requests: [],
  verifyAttempts: 0,
  blockedUntil: 0,
});

export class RateLimit {
  readonly options: RateLimitOptions;
  requests: number[];
  verifyAttempts: number;
  blockedUntil: number;

  constructor(state: Partial<RateLimitState> = {}, options: Partial<RateLimitOptions> = {}) {
    this.options = { ...DEFAULT_LIMITS, ...options };
    this.requests = state.requests ?? [];
    this.verifyAttempts = state.verifyAttempts ?? 0;
    this.blockedUntil = state.blockedUntil ?? 0;
  }

  toJSON(): RateLimitState {
    return {
      requests: this.requests,
      verifyAttempts: this.verifyAttempts,
      blockedUntil: this.blockedUntil,
    };
  }

  private prune(now: number) {
    const cutoff = now - this.options.windowSeconds * 1000;
    this.requests = this.requests.filter((at) => at > cutoff);
  }

  /** Seconds to wait before requesting a code; 0 when it may go now. */
  waitBeforeRequest(now = Date.now()): number {
    this.prune(now);
    if (this.blockedUntil > now) return Math.ceil((this.blockedUntil - now) / 1000);

    const last = this.requests.at(-1);
    if (last !== undefined) {
      const since = (now - last) / 1000;
      if (since < this.options.resendAfter) return Math.ceil(this.options.resendAfter - since);
    }

    if (this.requests.length >= this.options.maxRequests) {
      const oldest = this.requests[0];
      return Math.ceil((oldest + this.options.windowSeconds * 1000 - now) / 1000);
    }
    return 0;
  }

  recordRequest(now = Date.now()) {
    this.prune(now);
    this.requests.push(now);
    this.verifyAttempts = 0;
  }

  recordVerifyFailure(): number {
    this.verifyAttempts += 1;
    return this.attemptsLeft;
  }

  get attemptsLeft(): number {
    return Math.max(this.options.maxVerifyAttempts - this.verifyAttempts, 0);
  }

  /** Honours a server-side throttle. `retryAfter` is in seconds. */
  block(retryAfter: number | null, now = Date.now()): number {
    const seconds = Number(retryAfter) > 0 ? Number(retryAfter) : this.options.resendAfter;
    this.blockedUntil = Math.max(this.blockedUntil, now + seconds * 1000);
    return Math.ceil((this.blockedUntil - now) / 1000);
  }

  reset() {
    this.requests = [];
    this.verifyAttempts = 0;
    this.blockedUntil = 0;
  }
}

/** Reads `Retry-After` in either of the two forms the spec allows. */
export function retryAfterSeconds(response: Response | undefined): number | null {
  const header = response?.headers?.get?.('retry-after');
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds;
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(Math.ceil((date - Date.now()) / 1000), 0) : null;
}

export function formatWait(seconds: number): string {
  if (seconds <= 0) return '';
  if (seconds < 60) return `${seconds} ثانیه`;
  return `${Math.ceil(seconds / 60)} دقیقه`;
}
