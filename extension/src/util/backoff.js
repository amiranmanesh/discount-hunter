// Rate-limit bookkeeping for the auth endpoints.
//
// OTP endpoints are the easiest way to get an account or an IP throttled, and
// the platforms answer a throttle with 429 or a plain error the UI has to
// respect. Everything here is deliberately conservative: a cooldown the user can
// see, a cap on attempts, and an honest wait when the server pushes back.

const DEFAULTS = {
  /** Seconds before the same phone number may request another code. */
  resendAfter: 120,
  /** How many codes may be requested before the user has to wait it out. */
  maxRequests: 5,
  /** Window the request count applies to. */
  windowSeconds: 900,
  /** How many wrong codes before the flow resets. */
  maxVerifyAttempts: 5,
};

export class RateLimit {
  constructor(state = {}, options = {}) {
    this.options = { ...DEFAULTS, ...options };
    this.requests = state.requests || []; // epoch ms of each code request
    this.verifyAttempts = state.verifyAttempts || 0;
    this.blockedUntil = state.blockedUntil || 0; // set by a 429 from the server
  }

  toJSON() {
    return {
      requests: this.requests,
      verifyAttempts: this.verifyAttempts,
      blockedUntil: this.blockedUntil,
    };
  }

  #prune(now) {
    const cutoff = now - this.options.windowSeconds * 1000;
    this.requests = this.requests.filter((at) => at > cutoff);
  }

  /** Seconds the caller must wait before requesting a code, 0 when it may go. */
  waitBeforeRequest(now = Date.now()) {
    this.#prune(now);
    if (this.blockedUntil > now) return Math.ceil((this.blockedUntil - now) / 1000);

    const last = this.requests[this.requests.length - 1];
    if (last) {
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
    this.#prune(now);
    this.requests.push(now);
    this.verifyAttempts = 0;
  }

  recordVerifyFailure() {
    this.verifyAttempts += 1;
    return this.attemptsLeft;
  }

  get attemptsLeft() {
    return Math.max(this.options.maxVerifyAttempts - this.verifyAttempts, 0);
  }

  /** Honour a server-side throttle. `retryAfter` is in seconds. */
  block(retryAfter, now = Date.now()) {
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
export function retryAfterSeconds(response) {
  const header = response?.headers?.get?.('retry-after');
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds;
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(Math.ceil((date - Date.now()) / 1000), 0) : null;
}

/** Persian-friendly rendering of a cooldown. */
export function formatWait(seconds) {
  if (seconds <= 0) return '';
  if (seconds < 60) return `${seconds} ثانیه`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} دقیقه`;
}
