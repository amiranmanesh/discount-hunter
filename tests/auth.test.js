import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  accessToken,
  requestCode,
  signOut,
  status,
  verifyCode,
} from '../extension/src/auth/index.js';
import { fakeJwt } from './setup.js';

const PHONE = '09123456789';

function mockFetch(handler) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const result = handler(String(url), init) || {};
    return {
      ok: result.ok ?? true,
      status: result.status ?? 200,
      headers: { get: (name) => result.headers?.[name.toLowerCase()] ?? null },
      json: async () => result.body ?? {},
    };
  });
}

beforeEach(() => {
  globalThis.crypto ??= {};
  if (!globalThis.crypto.randomUUID) globalThis.crypto.randomUUID = () => 'uuid';
});

describe('status', () => {
  it('reports both platforms as signed out to begin with', async () => {
    expect(await status()).toEqual({
      snapp: { name: 'اسنپ‌مارکت', linked: false, subject: null, expiresAt: null },
      jet: { name: 'دیجی‌کالا جت', linked: false, subject: null, expiresAt: null },
    });
  });
});

describe('Snapp Market login', () => {
  it('sends the code form-encoded, with no Authorization header', async () => {
    const fetchMock = mockFetch(() => ({ body: { status: true } }));

    await requestCode({ platform: 'snapp', phone: PHONE });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/mobile/v4/user/loginMobileWithNoPass');
    expect(init.headers['content-type']).toBe('application/x-www-form-urlencoded');
    expect(init.headers.authorization).toBeUndefined();
    expect(init.body).toBe(`captcha=&cellphone=${PHONE}&optionalLoginToken=true`);
  });

  it('normalises the number before sending it', async () => {
    const fetchMock = mockFetch(() => ({ body: { status: true } }));
    await requestCode({ platform: 'snapp', phone: '+98 912 345 6789' });
    expect(fetchMock.mock.calls[0][1].body).toContain(`cellphone=${PHONE}`);
  });

  it('rejects a number that is not a mobile', async () => {
    const fetchMock = mockFetch(() => ({ body: { status: true } }));
    await expect(requestCode({ platform: 'snapp', phone: '02112345678' })).rejects.toThrow(
      'معتبر نیست',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stores the session the code exchange returns', async () => {
    mockFetch((url) =>
      url.includes('loginMobileWithNoPass')
        ? { body: { status: true } }
        : {
            body: {
              status: true,
              data: {
                is_registered: true,
                oauth2_token: { access_token: fakeJwt(), refresh_token: 'refresh-1' },
              },
            },
          },
    );

    await requestCode({ platform: 'snapp', phone: PHONE });
    await verifyCode({ platform: 'snapp', phone: PHONE, code: '12345' });

    const state = await status();
    expect(state.snapp).toMatchObject({ linked: true, subject: '0912***6789' });
  });

  it('surfaces the API message when the code is wrong', async () => {
    mockFetch((url) =>
      url.includes('loginMobileWithNoPass')
        ? { body: { status: true } }
        : { body: { status: false, message: 'کد نادرست است' } },
    );

    await requestCode({ platform: 'snapp', phone: PHONE });
    await expect(verifyCode({ platform: 'snapp', phone: PHONE, code: '00000' })).rejects.toThrow(
      'کد نادرست است',
    );
  });

  it('refreshes an expired session instead of asking to sign in again', async () => {
    mockFetch((url) =>
      url.includes('loginMobileWithNoPass')
        ? { body: { status: true } }
        : url.includes('loginMobileWithToken')
          ? {
              body: {
                status: true,
                data: { oauth2_token: { access_token: fakeJwt(-10), refresh_token: 'refresh-1' } },
              },
            }
          : { body: { status: true, data: { access_token: fakeJwt(3600) } } },
    );

    await requestCode({ platform: 'snapp', phone: PHONE });
    await verifyCode({ platform: 'snapp', phone: PHONE, code: '12345' });

    // The stored token is already dead; the refresh grant should rescue it.
    expect(await accessToken('snapp')).toBeTruthy();
  });
});

describe('Digikala Jet login', () => {
  it('carries the flow token from the first call into the second', async () => {
    const fetchMock = mockFetch((url) =>
      url.includes('login-register')
        ? { body: { status: 200, data: { token: 'flow-token', sms_ttl: 120 } } }
        : { body: { status: 200, data: { token: fakeJwt(), refresh_token: 'r', user_id: 1 } } },
    );

    const requested = await requestCode({ platform: 'jet', phone: PHONE });
    expect(requested.resendAfter).toBe(120);

    await verifyCode({ platform: 'jet', phone: PHONE, code: '583051' });

    const confirm = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(confirm).toEqual({ token: 'flow-token', code: '583051', phone: PHONE });
    expect((await status()).jet.linked).toBe(true);
  });

  it('refuses to verify before a code was requested', async () => {
    mockFetch(() => ({ body: {} }));
    await expect(verifyCode({ platform: 'jet', phone: PHONE, code: '123456' })).rejects.toThrow(
      'اول کد را درخواست کن',
    );
  });

  it('says so when Jet demands a captcha', async () => {
    mockFetch(() => ({ body: { status: 200, data: { token: 't', needs_captcha: true } } }));
    await expect(requestCode({ platform: 'jet', phone: PHONE })).rejects.toThrow('کپچا');
  });
});

describe('rate limiting', () => {
  it('refuses a second code before the cooldown', async () => {
    mockFetch(() => ({ body: { status: true } }));
    await requestCode({ platform: 'snapp', phone: PHONE });
    await expect(requestCode({ platform: 'snapp', phone: PHONE })).rejects.toThrow('دیگر می‌توانی');
  });

  it('honours a 429 with Retry-After', async () => {
    mockFetch(() => ({ ok: false, status: 429, headers: { 'retry-after': '300' }, body: {} }));
    await expect(requestCode({ platform: 'snapp', phone: PHONE })).rejects.toThrow('5 دقیقه');
  });

  it('counts down verification attempts', async () => {
    mockFetch((url) =>
      url.includes('loginMobileWithNoPass')
        ? { body: { status: true } }
        : { body: { status: false, message: 'کد نادرست' } },
    );

    await requestCode({ platform: 'snapp', phone: PHONE });
    await expect(verifyCode({ platform: 'snapp', phone: PHONE, code: '11111' })).rejects.toThrow(
      '4 تلاش باقی مانده',
    );
    await expect(verifyCode({ platform: 'snapp', phone: PHONE, code: '22222' })).rejects.toThrow(
      '3 تلاش باقی مانده',
    );
  });

  it('keeps the two platforms on separate budgets', async () => {
    mockFetch((url) =>
      url.includes('login-register')
        ? { body: { status: 200, data: { token: 'flow', sms_ttl: 120 } } }
        : { body: { status: true } },
    );

    await requestCode({ platform: 'snapp', phone: PHONE });
    await expect(requestCode({ platform: 'jet', phone: PHONE })).resolves.toBeTruthy();
  });
});

describe('signOut', () => {
  it('forgets the session and lets a new code be requested at once', async () => {
    mockFetch(() => ({ body: { status: true } }));
    await requestCode({ platform: 'snapp', phone: PHONE });

    await signOut('snapp');

    expect((await status()).snapp.linked).toBe(false);
    await expect(requestCode({ platform: 'snapp', phone: PHONE })).resolves.toBeTruthy();
  });

  it('rejects an unknown platform', async () => {
    await expect(signOut('bale')).rejects.toThrow('پلتفرم ناشناخته');
  });
});
