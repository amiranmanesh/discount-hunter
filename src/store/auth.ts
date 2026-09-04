// Sign-in, sign-out and "give me a live token", for both platforms.
import * as snapp from '../api/snapp';
import * as jet from '../api/jet';
import * as okala from '../api/okala';
import { RateLimit, formatWait } from '../auth/backoff';
import { isLive, type Session } from '../auth/session';
import { maskPhone, normalizePhone } from '../auth/phone';
import { ApiError, NotSignedInError } from '../api/http';
import { useSettings } from './settings';
import type { Location, PlatformId } from '../core/types';

export const PLATFORMS: {
  id: PlatformId;
  name: string;
  /** Snapp Market gates the search; Jet's catalogue answers without a token. */
  required: boolean;
  note: string;
}[] = [
  {
    id: 'snapp',
    name: 'اسنپ‌مارکت',
    required: true,
    note: 'برای جستجو لازم است — مهمان کمپین دیگری با قیمت دیگری می‌بیند.',
  },
  {
    id: 'jet',
    name: 'دیجی‌کالا جت',
    required: false,
    note: 'اختیاری — نتایج بدون ورود هم می‌آید؛ ورود آدرس‌های ذخیره‌شده‌ات را اضافه می‌کند.',
  },
  {
    id: 'okala',
    name: 'اوکالا',
    required: false,
    note: 'اختیاری — تخفیف‌هایش بدون ورود هم می‌آید، ولی جستجو در اوکالا توکن می‌خواهد.',
  },
];

const api = {
  snapp: {
    requestCode: (phone: string, location?: Location) => snapp.requestCode(phone, location),
    verifyCode: (phone: string, code: string, location?: Location) =>
      snapp.verifyCode(phone, code, location),
    refresh: (session: Session, location?: Location) => snapp.refresh(session, location),
  },
  jet: {
    requestCode: (phone: string) => jet.requestCode(phone),
    verifyCode: (phone: string, code: string) => jet.verifyCode(phone, code),
    refresh: () => jet.refresh(),
  },
  okala: {
    requestCode: (phone: string) => okala.requestCode(phone),
    verifyCode: (phone: string, code: string) => okala.verifyCode(phone, code),
    refresh: () => okala.refresh(),
  },
} as const;

function limitFor(platform: PlatformId) {
  return new RateLimit(useSettings.getState().limits[platform]);
}

function saveLimit(platform: PlatformId, limit: RateLimit) {
  useSettings.getState().setLimit(platform, limit.toJSON());
}

export interface AccountStatus {
  linked: boolean;
  subject: string | null;
  expiresAt: number | null;
}

export function accountStatus(platform: PlatformId): AccountStatus {
  const session = useSettings.getState().sessions[platform];
  return {
    linked: Boolean(session?.accessToken),
    subject: session?.subject ? maskPhone(session.subject) : null,
    expiresAt: session?.expiresAt ?? null,
  };
}

export async function requestCode(platform: PlatformId, rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new Error('شماره موبایل معتبر نیست');

  const limit = limitFor(platform);
  const wait = limit.waitBeforeRequest();
  if (wait > 0) throw new Error(`${formatWait(wait)} دیگر می‌توانی کد بعدی را بگیری`);

  const { location } = useSettings.getState();
  try {
    const result =
      platform === 'snapp'
        ? await api.snapp.requestCode(phone, location ?? undefined)
        : await api[platform].requestCode(phone);
    limit.recordRequest();
    saveLimit(platform, limit);
    return {
      resendAfter:
        (result as { resendAfter?: number } | void)?.resendAfter ?? limit.options.resendAfter,
      phone: maskPhone(phone),
    };
  } catch (error) {
    if (error instanceof ApiError && error.retryAfter) {
      const blocked = limit.block(error.retryAfter);
      saveLimit(platform, limit);
      throw new Error(`${error.message} (${formatWait(blocked)})`, { cause: error });
    }
    // A rejected request still counts: it is one SMS attempt against the number.
    limit.recordRequest();
    saveLimit(platform, limit);
    throw error;
  }
}

export async function verifyCode(platform: PlatformId, rawPhone: string, code: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new Error('شماره موبایل معتبر نیست');
  if (!/^\d{4,8}$/.test(code.trim())) throw new Error('کد تأیید معتبر نیست');

  const limit = limitFor(platform);
  if (limit.attemptsLeft <= 0) throw new Error('تعداد تلاش‌ها تمام شد؛ کد جدید بگیر');

  const { location, setSession } = useSettings.getState();
  try {
    const session =
      platform === 'snapp'
        ? await api.snapp.verifyCode(phone, code.trim(), location ?? undefined)
        : await api[platform].verifyCode(phone, code.trim());
    limit.reset();
    saveLimit(platform, limit);
    setSession(platform, session);
    return session;
  } catch (error) {
    const left = limit.recordVerifyFailure();
    saveLimit(platform, limit);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(left > 0 ? `${message} (${left} تلاش باقی مانده)` : message, { cause: error });
  }
}

export function signOut(platform: PlatformId) {
  const state = useSettings.getState();
  state.setSession(platform, null);
  const limit = limitFor(platform);
  limit.reset();
  saveLimit(platform, limit);
}

/**
 * A live access token, refreshed first when it can be. Returns null rather than
 * throwing for the optional platform; the required one is checked by the caller.
 */
export async function accessToken(platform: PlatformId): Promise<string | null> {
  const state = useSettings.getState();
  const session = state.sessions[platform];
  if (isLive(session)) return session!.accessToken;
  if (!session?.refreshToken) {
    if (session) state.setSession(platform, null);
    return null;
  }

  try {
    const refreshed =
      platform === 'snapp'
        ? await api.snapp.refresh(session, state.location ?? undefined)
        : await api[platform].refresh();
    state.setSession(platform, refreshed);
    return refreshed.accessToken;
  } catch {
    state.setSession(platform, null);
    return null;
  }
}

/** The Snapp token, or a typed error the UI turns into the sign-in screen. */
export async function requireSnappToken(): Promise<string> {
  const token = await accessToken('snapp');
  if (!token) throw new NotSignedInError('برای جستجو باید وارد حساب اسنپ‌مارکت باشی');
  return token;
}
