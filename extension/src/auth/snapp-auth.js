// Snapp Market phone + OTP login.
//
//   POST /mobile/v4/user/loginMobileWithNoPass   form-encoded, sends the code
//   POST /mobile/v2/user/loginMobileWithToken    form-encoded, exchanges it
//   POST /oauth2/default/token                   refreshes the access token
//
// Neither OTP call carries an Authorization header — they are how you get one.
import { getSession, setSession } from '../util/store.js';
import { makeSession } from './session.js';
import { retryAfterSeconds } from '../util/backoff.js';

const BASE = 'https://svc.snapp.market';
const APP_VERSION = '1.399.10';
const UDID_KEY = 'snappUdid';
const CLIENT_ID = 'snappfood_pwa';
const CLIENT_SECRET = 'snappfood_pwa_secret';
const SCOPE = 'mobile_v2 mobile_v1 webview';

const HEADERS = {
  accept: 'application/json, text/plain, */*',
  origin: 'https://snapp.market',
  referer: 'https://snapp.market/',
};

export async function deviceId() {
  let udid = await getSession(UDID_KEY);
  if (!udid) {
    udid = crypto.randomUUID();
    await setSession(UDID_KEY, udid);
  }
  return udid;
}

async function commonQuery(location) {
  return new URLSearchParams({
    client: 'PWA',
    deviceType: 'PWA',
    appVersion: APP_VERSION,
    UDID: await deviceId(),
    ...(location?.lat ? { lat: String(location.lat), long: String(location.lng) } : {}),
  });
}

class AuthError extends Error {
  constructor(message, { retryAfter = null } = {}) {
    super(message);
    this.name = 'AuthError';
    this.retryAfter = retryAfter;
  }
}

async function post(path, { location, body, form = true }) {
  const response = await fetch(`${BASE}${path}?${await commonQuery(location)}`, {
    method: 'POST',
    headers: {
      ...HEADERS,
      'content-type': form ? 'application/x-www-form-urlencoded' : 'application/json',
    },
    body: form ? body.toString() : JSON.stringify(body),
  });

  if (response.status === 429) {
    throw new AuthError('اسنپ‌مارکت فعلاً درخواست بیشتری قبول نمی‌کند. کمی بعد دوباره امتحان کن.', {
      retryAfter: retryAfterSeconds(response),
    });
  }

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AuthError(json?.message || `اسنپ‌مارکت ${path} → ${response.status}`);
  }
  // The API answers 200 with `status: false` for a rejected code or number.
  if (json?.status === false) throw new AuthError(json.message || 'درخواست پذیرفته نشد');
  return json;
}

/** Asks Snapp Market to text a code to the number. */
export async function requestCode(phone, { location } = {}) {
  await post('/mobile/v4/user/loginMobileWithNoPass', {
    location,
    body: new URLSearchParams({ captcha: '', cellphone: phone, optionalLoginToken: 'true' }),
  });
  return { message: 'کد به شماره‌ات پیامک شد.' };
}

/** Exchanges the code for a session. */
export async function verifyCode(phone, code, { location } = {}) {
  const json = await post('/mobile/v2/user/loginMobileWithToken', {
    location,
    body: new URLSearchParams({ cellphone: phone, code }),
  });

  const token = json?.data?.oauth2_token;
  if (!token?.access_token) throw new AuthError('پاسخ ورود اسنپ‌مارکت نامعتبر بود');

  return makeSession({
    accessToken: token.access_token,
    refreshToken: token.refresh_token || null,
    subject: phone,
    extra: { isRegistered: Boolean(json.data.is_registered) },
  });
}

/** Trades the refresh token for a new access token, same grant the PWA uses. */
export async function refresh(session, { location } = {}) {
  if (!session?.refreshToken) throw new AuthError('توکن تمدید موجود نیست');

  const json = await post('/oauth2/default/token', {
    location,
    form: false,
    body: {
      data: {
        time: new Date().toISOString(),
        device_uid: await deviceId(),
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: session.refreshToken,
        scope: SCOPE,
      },
    },
  });

  const data = json?.data;
  if (!data?.access_token) throw new AuthError('تمدید نشست اسنپ‌مارکت ناموفق بود');

  return makeSession({
    accessToken: data.access_token,
    // The grant may or may not rotate the refresh token; keep the old one if not.
    refreshToken: data.refresh_token || session.refreshToken,
    subject: session.subject,
  });
}
