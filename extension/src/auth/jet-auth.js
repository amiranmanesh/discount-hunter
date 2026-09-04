// Digikala Jet phone + OTP login.
//
//   POST /user/login-register/   { phone }         → a short-lived flow token
//   POST /user/confirm-phone/    { token, code, phone } → the session
//
// The flow token from the first call has to be handed back to the second, so it
// is held in storage between the two steps. Jet's access token lasts about a day
// and its refresh token about ninety, so a signed-in account stays signed in.
import { getSession, setSession } from '../util/store.js';
import { makeSession } from './session.js';
import { retryAfterSeconds } from '../util/backoff.js';

const BASE = 'https://api.digikalajet.ir';
const PENDING_KEY = 'jetPendingLogin';

const HEADERS = {
  accept: 'application/json, text/plain, */*',
  'content-type': 'application/json',
  origin: 'https://www.digikalajet.com',
  referer: 'https://www.digikalajet.com/',
};

class AuthError extends Error {
  constructor(message, { retryAfter = null } = {}) {
    super(message);
    this.name = 'AuthError';
    this.retryAfter = retryAfter;
  }
}

async function post(path, body) {
  const response = await fetch(`${BASE}${path}?ch=jj`, {
    method: 'POST',
    headers: { ...HEADERS, 'x-request-uuid': crypto.randomUUID() },
    body: JSON.stringify(body),
  });

  if (response.status === 429) {
    throw new AuthError('دیجی‌کالا جت فعلاً درخواست بیشتری قبول نمی‌کند. کمی بعد امتحان کن.', {
      retryAfter: retryAfterSeconds(response),
    });
  }

  const json = await response.json().catch(() => null);
  if (!response.ok || (json?.status && json.status >= 400)) {
    throw new AuthError(
      json?.data?.message || json?.message || `دیجی‌کالا جت ${path} → ${response.status}`,
    );
  }
  return json;
}

/** Asks Jet to text a code, and remembers the flow token it answers with. */
export async function requestCode(phone) {
  const json = await post('/user/login-register/', { phone });
  const data = json?.data;
  if (!data?.token) throw new AuthError('پاسخ ورود دیجی‌کالا جت نامعتبر بود');

  await setSession(PENDING_KEY, { phone, token: data.token, at: Date.now() });
  if (data.needs_captcha) {
    throw new AuthError('دیجی‌کالا جت کپچا خواست؛ یک بار در سایت وارد شو و دوباره امتحان کن.');
  }

  return {
    message: 'کد به شماره‌ات پیامک شد.',
    // `sms_ttl` is how long the code is valid, which is also how long the site
    // makes you wait before offering another one.
    resendAfter: Number(data.sms_ttl) || 120,
  };
}

/** Exchanges the code, plus the flow token from `requestCode`, for a session. */
export async function verifyCode(phone, code) {
  const pending = await getSession(PENDING_KEY);
  if (!pending?.token || pending.phone !== phone) {
    throw new AuthError('اول کد را درخواست کن');
  }

  const json = await post('/user/confirm-phone/', { token: pending.token, code, phone });
  const data = json?.data;
  if (!data?.token) throw new AuthError('کد پذیرفته نشد');

  await setSession(PENDING_KEY, null);
  return makeSession({
    accessToken: data.token,
    refreshToken: data.refresh_token || null,
    subject: phone,
    extra: { userId: data.user_id ?? null },
  });
}

/**
 * Jet has no refresh endpoint the web app uses — it simply carries a token good
 * for a day. Signalling that here keeps `withFreshToken` honest: the session is
 * cleared and the user is asked to sign in again, rather than a dead token being
 * retried forever.
 */
export async function refresh() {
  throw new AuthError('نشست دیجی‌کالا جت منقضی شده؛ دوباره وارد شو');
}
