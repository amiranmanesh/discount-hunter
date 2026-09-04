// The auth surface the rest of the extension talks to.
//
// One registry, two platforms, and a rate-limit budget in front of both. Every
// OTP request is checked against the budget before it leaves, and a server-side
// throttle is folded back into it, so a user cannot get their number blocked by
// hammering the button.
import * as snappAuth from './snapp-auth.js';
import * as jetAuth from './jet-auth.js';
import { clearSession, readSession, withFreshToken, writeSession } from './session.js';
import { RateLimit, formatWait } from '../util/backoff.js';
import { getSession, setSession } from '../util/store.js';
import { maskPhone, normalizePhone } from './phone.js';

const PLATFORMS = {
  snapp: { name: 'اسنپ‌مارکت', api: snappAuth },
  jet: { name: 'دیجی‌کالا جت', api: jetAuth },
};

const limitKey = (platform) => `rateLimit:${platform}`;

function platformOf(id) {
  const platform = PLATFORMS[id];
  if (!platform) throw new Error(`پلتفرم ناشناخته: ${id}`);
  return platform;
}

async function readLimit(id) {
  return new RateLimit((await getSession(limitKey(id))) || {});
}

async function writeLimit(id, limit) {
  await setSession(limitKey(id), limit.toJSON());
}

/** What the popup renders: one entry per platform. */
export async function status() {
  const out = {};
  for (const [id, platform] of Object.entries(PLATFORMS)) {
    const session = await readSession(id);
    out[id] = {
      name: platform.name,
      linked: Boolean(session?.accessToken),
      subject: session?.subject ? maskPhone(session.subject) : null,
      expiresAt: session?.expiresAt || null,
    };
  }
  return out;
}

export async function requestCode({ platform: id, phone: raw, location }) {
  const platform = platformOf(id);
  const phone = normalizePhone(raw);
  if (!phone) throw new Error('شماره موبایل معتبر نیست');

  const limit = await readLimit(id);
  const wait = limit.waitBeforeRequest();
  if (wait > 0) throw new Error(`${formatWait(wait)} دیگر می‌توانی کد بعدی را بگیری`);

  try {
    const result = await platform.api.requestCode(phone, { location });
    limit.recordRequest();
    await writeLimit(id, limit);
    return {
      message: result?.message || 'کد پیامک شد.',
      resendAfter: result?.resendAfter || limit.options.resendAfter,
      phone: maskPhone(phone),
    };
  } catch (error) {
    if (error?.retryAfter) {
      const blocked = limit.block(error.retryAfter);
      await writeLimit(id, limit);
      throw new Error(`${error.message} (${formatWait(blocked)})`, { cause: error });
    }
    // A rejected request still counts: it is one SMS attempt against the number.
    limit.recordRequest();
    await writeLimit(id, limit);
    throw error;
  }
}

export async function verifyCode({ platform: id, phone: raw, code, location }) {
  const platform = platformOf(id);
  const phone = normalizePhone(raw);
  if (!phone) throw new Error('شماره موبایل معتبر نیست');
  if (!/^\d{4,8}$/.test(String(code || '').trim())) throw new Error('کد تأیید معتبر نیست');

  const limit = await readLimit(id);
  if (limit.attemptsLeft <= 0) {
    throw new Error('تعداد تلاش‌ها تمام شد؛ کد جدید بگیر');
  }

  try {
    const session = await platform.api.verifyCode(phone, String(code).trim(), { location });
    limit.reset();
    await writeLimit(id, limit);
    await writeSession(id, session);
    return { linked: true, subject: maskPhone(phone) };
  } catch (error) {
    const left = limit.recordVerifyFailure();
    await writeLimit(id, limit);
    throw new Error(left > 0 ? `${error.message} (${left} تلاش باقی مانده)` : error.message, {
      cause: error,
    });
  }
}

export async function signOut(id) {
  platformOf(id);
  await clearSession(id);
  const limit = await readLimit(id);
  limit.reset();
  await writeLimit(id, limit);
  return true;
}

/**
 * A live access token for the platform, refreshed if it can be.
 * Returns null when the user has to sign in again.
 */
export async function accessToken(id, { location } = {}) {
  const platform = platformOf(id);
  const session = await withFreshToken(id, (stored) => platform.api.refresh(stored, { location }));
  return session?.accessToken || null;
}
