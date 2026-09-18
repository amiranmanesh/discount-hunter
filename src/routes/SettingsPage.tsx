'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as jet from '../api/jet';
import { useSettings } from '../store/settings';
import { useTokens } from '../hooks/useTokens';
import type { Location } from '../core/types';

/**
 * The same choice: the same point, to the precision any platform stores one
 * with, under the same name — two saved addresses can share a point.
 */
function sameChoice(a: Location | null, b: Location | null): boolean {
  if (!a || !b) return false;
  return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6 && a.label === b.label;
}

/**
 * Every way of choosing a point here — GPS, a saved address, typed coordinates —
 * only proposes it. Nothing changes until «تأیید» is pressed, because every
 * price and delivery fee in the app hangs off this point, and a stray tap on a
 * long list of addresses used to move it without a word.
 */
export default function SettingsPage() {
  const { location, setLocation } = useSettings();
  const { data: tokens } = useTokens();
  const [draft, setDraft] = useState<Location | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const addresses = useQuery({
    queryKey: ['jet-addresses', tokens?.jet],
    enabled: Boolean(tokens?.jet),
    queryFn: () => jet.savedAddresses(tokens!.jet!),
    staleTime: 10 * 60_000,
  });

  // A proposal that is already the current point is no proposal at all.
  const pending = draft && !sameChoice(draft, location) ? draft : null;

  const propose = (next: Location) => {
    setDraft(next);
    setStatus(null);
  };

  const confirm = () => {
    if (!pending) return;
    setLocation(pending);
    setDraft(null);
    setStatus(`موقعیت روی «${pending.label}» تنظیم شد`);
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setStatus('این مرورگر موقعیت‌یابی ندارد');
      return;
    }
    // Geolocation is a secure-context feature. On a plain-HTTP deployment the
    // API is present but every call is refused, with a message the browser
    // words as an ordinary permission denial — so say what is actually wrong
    // instead of letting it look like a settings problem.
    if (!window.isSecureContext) {
      setStatus(
        'روی آدرس http موقعیت‌یابی مرورگر بسته است — با HTTPS باز کن، یا مختصات را دستی وارد کن',
      );
      return;
    }
    setStatus('در حال گرفتن موقعیت…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        propose({
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
          label: 'موقعیت فعلی',
        });
      },
      (error) => setStatus(`موقعیت‌یابی ناموفق بود: ${error.message}`),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return (
    <>
      <h1 className="page-title">تنظیمات</h1>

      <section className="card stack">
        <b>موقعیت تحویل</b>
        <p className="muted" style={{ margin: 0 }}>
          هر قیمت، هزینهٔ ارسال و فهرست فروشگاه به این نقطه بستگی دارد. انتخاب کن و بعد «تأیید» را
          بزن.
        </p>
        <p className="current-location">
          <span className="muted">الان:</span> <b>{location ? location.label : 'تنظیم نشده'}</b>
        </p>

        <button type="button" className="button button--primary button--block" onClick={locate}>
          استفاده از موقعیت فعلی
        </button>

        {/* Keyed on the stored point so the fields show it once storage has
            been read, rather than the empty state the page first renders. */}
        <ManualCoordinates
          key={location ? `${location.lat},${location.lng}` : 'none'}
          initial={location}
          onPick={propose}
          onInvalid={() => setStatus('مختصات معتبر نیست')}
        />

        {status && (
          <p className="note" style={{ margin: 0 }} role="status">
            {status}
          </p>
        )}
      </section>

      {tokens?.jet && (
        <section className="card stack" style={{ marginTop: 10 }}>
          <b>آدرس‌های دیجی‌کالا جت</b>
          {addresses.isPending && <p className="muted">در حال خواندن…</p>}
          {addresses.data?.length === 0 && <p className="muted">آدرسی ذخیره نشده.</p>}
          {addresses.data?.map((address) => {
            const current = sameChoice(address, location);
            const chosen = sameChoice(address, pending);
            return (
              <button
                key={address.id}
                type="button"
                className="address-option"
                aria-pressed={chosen}
                onClick={() =>
                  propose({ lat: address.lat, lng: address.lng, label: address.label })
                }
              >
                <span className="address-option-head">
                  <b>{address.label}</b>
                  {current && <span className="address-tag address-tag--current">✓ فعلی</span>}
                  {chosen && <span className="address-tag">انتخاب‌شده</span>}
                </span>
                <span className="muted">{address.address}</span>
              </button>
            );
          })}
        </section>
      )}

      <section className="card stack" style={{ marginTop: 10 }}>
        <b>دربارهٔ این برنامه</b>
        <p className="muted" style={{ margin: 0 }}>
          پروژه‌ای مستقل و متن‌باز. از همان APIهای عمومی‌ای استفاده می‌کند که وب‌اپ اسنپ‌مارکت و
          دیجی‌کالا جت در مرورگر خودت صدا می‌زنند، با حساب و آدرس خودت. هیچ وابستگی‌ای به اسنپ یا
          دیجی‌کالا ندارد.
        </p>
      </section>

      {pending && (
        <div className="confirm-bar" role="region" aria-label="تأیید موقعیت">
          <span className="confirm-bar-text">
            <span className="muted">موقعیت جدید:</span> <b>{pending.label}</b>
          </span>
          <button type="button" className="button" onClick={() => setDraft(null)}>
            انصراف
          </button>
          <button type="button" className="button button--primary" onClick={confirm}>
            تأیید
          </button>
        </div>
      )}
    </>
  );
}

function ManualCoordinates({
  initial,
  onPick,
  onInvalid,
}: {
  initial: Location | null;
  onPick: (location: Location) => void;
  onInvalid: () => void;
}) {
  const [lat, setLat] = useState(initial ? String(initial.lat) : '');
  const [lng, setLng] = useState(initial ? String(initial.lng) : '');

  const pick = () => {
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (!lat.trim() || !lng.trim() || !Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      onInvalid();
      return;
    }
    onPick({
      lat: parsedLat,
      lng: parsedLng,
      label: `${parsedLat.toFixed(4)}, ${parsedLng.toFixed(4)}`,
    });
  };

  return (
    <>
      <div className="row">
        <label className="field">
          عرض جغرافیایی
          <input
            inputMode="decimal"
            dir="ltr"
            value={lat}
            onChange={(event) => setLat(event.target.value)}
            placeholder="35.7223"
          />
        </label>
        <label className="field">
          طول جغرافیایی
          <input
            inputMode="decimal"
            dir="ltr"
            value={lng}
            onChange={(event) => setLng(event.target.value)}
            placeholder="51.4781"
          />
        </label>
      </div>
      <button type="button" className="button" onClick={pick}>
        استفاده از این مختصات
      </button>
    </>
  );
}
