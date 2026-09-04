import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as jet from '../api/jet';
import { useSettings } from '../store/settings';
import { useTokens } from '../hooks/useTokens';
import type { Address } from '../core/types';

export default function SettingsPage() {
  const { location, setLocation } = useSettings();
  const { data: tokens } = useTokens();
  const [lat, setLat] = useState(location ? String(location.lat) : '');
  const [lng, setLng] = useState(location ? String(location.lng) : '');
  const [status, setStatus] = useState<string | null>(null);

  const addresses = useQuery({
    queryKey: ['jet-addresses', tokens?.jet],
    enabled: Boolean(tokens?.jet),
    queryFn: () => jet.savedAddresses(tokens!.jet!),
    staleTime: 10 * 60_000,
  });

  const locate = () => {
    if (!navigator.geolocation) {
      setStatus('این مرورگر موقعیت‌یابی ندارد');
      return;
    }
    setStatus('در حال گرفتن موقعیت…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
          label: 'موقعیت فعلی',
        };
        setLat(String(next.lat));
        setLng(String(next.lng));
        setLocation(next);
        setStatus('موقعیت از GPS گرفته شد');
      },
      (error) => setStatus(`موقعیت‌یابی ناموفق بود: ${error.message}`),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const saveManual = () => {
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      setStatus('مختصات معتبر نیست');
      return;
    }
    setLocation({
      lat: parsedLat,
      lng: parsedLng,
      label: `${parsedLat.toFixed(4)}, ${parsedLng.toFixed(4)}`,
    });
    setStatus('موقعیت ذخیره شد');
  };

  const pick = (address: Address) => {
    setLat(String(address.lat));
    setLng(String(address.lng));
    setLocation({ lat: address.lat, lng: address.lng, label: address.label });
    setStatus(`موقعیت روی «${address.label}» تنظیم شد`);
  };

  return (
    <>
      <h1 className="page-title">تنظیمات</h1>

      <section className="card stack">
        <b>موقعیت تحویل</b>
        <p className="muted" style={{ margin: 0 }}>
          هر قیمت، هزینهٔ ارسال و فهرست فروشگاه به این نقطه بستگی دارد.
          {location && ` الان: ${location.label}`}
        </p>

        <button type="button" className="button button--primary button--block" onClick={locate}>
          استفاده از موقعیت فعلی
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <label className="field" style={{ flex: 1 }}>
            عرض جغرافیایی
            <input
              inputMode="decimal"
              value={lat}
              onChange={(event) => setLat(event.target.value)}
              placeholder="35.7223"
            />
          </label>
          <label className="field" style={{ flex: 1 }}>
            طول جغرافیایی
            <input
              inputMode="decimal"
              value={lng}
              onChange={(event) => setLng(event.target.value)}
              placeholder="51.4781"
            />
          </label>
        </div>
        <button type="button" className="button" onClick={saveManual}>
          ذخیرهٔ مختصات
        </button>

        {status && (
          <p className="note" style={{ margin: 0 }}>
            {status}
          </p>
        )}
      </section>

      {tokens?.jet && (
        <section className="card stack" style={{ marginTop: 10 }}>
          <b>آدرس‌های دیجی‌کالا جت</b>
          {addresses.isPending && <p className="muted">در حال خواندن…</p>}
          {addresses.data?.length === 0 && <p className="muted">آدرسی ذخیره نشده.</p>}
          {addresses.data?.map((address) => (
            <button
              key={address.id}
              type="button"
              className="button"
              style={{ justifyContent: 'flex-start', textAlign: 'start' }}
              onClick={() => pick(address)}
            >
              <span>
                <b>{address.label}</b>
                <br />
                <span className="muted">{address.address}</span>
              </span>
            </button>
          ))}
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
    </>
  );
}
