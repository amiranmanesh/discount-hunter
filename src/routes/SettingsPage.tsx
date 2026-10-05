'use client';

import { useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as jet from '../api/jet';
import { useSettings } from '../store/settings';
import { useTokens } from '../hooks/useTokens';
import type { Location } from '../core/types';
import { detectPlatform, install, usePwa, type Platform } from '../pwa/state';

function sameChoice(a: Location | null, b: Location | null): boolean {
  if (!a || !b) return false;
  return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
}

export default function SettingsPage() {
  const {
    location,
    savedLocations,
    viewMode,
    setViewMode,
    selectLocation,
    addSavedLocation,
    removeSavedLocation,
    updateSavedLocationLabel,
    snappPro,
    patch,
  } = useSettings();
  const { data: tokens } = useTokens();

  const [status, setStatus] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [newLabel, setNewLabel] = useState('');

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
    if (!window.isSecureContext) {
      setStatus(
        'روی آدرس http موقعیت‌یابی مرورگر بسته است — با HTTPS باز کن، یا مختصات را دستی وارد کن',
      );
      return;
    }
    setStatus('در حال گرفتن موقعیت…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        const label = newLabel.trim() || 'موقعیت فعلی';
        const created = addSavedLocation({ lat, lng, label });
        selectLocation(created);
        setNewLabel('');
        setStatus(`موقعیت روی «${label}» تنظیم و ذخیره شد`);
      },
      (error) => setStatus(`موقعیت‌یابی ناموفق بود: ${error.message}`),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const handleManualAdd = (lat: number, lng: number) => {
    const label = newLabel.trim() || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const created = addSavedLocation({ lat, lng, label });
    selectLocation(created);
    setNewLabel('');
    setStatus(`موقعیت «${label}» اضافه و انتخاب شد`);
  };

  return (
    <div className="page-narrow">
      <h1 className="page-title">تنظیمات</h1>

      <section className="card stack">
        <b>حالت نمایش فهرست</b>
        <p className="muted" style={{ margin: 0 }}>
          بین حالت کارت بزرگ و حالت لیستی فشرده انتخاب کن.
        </p>
        <div className="segmented segmented--wide" role="radiogroup" aria-label="حالت نمایش">
          <button
            type="button"
            role="radio"
            aria-checked={viewMode === 'grid'}
            onClick={() => setViewMode('grid')}
          >
            کارتی (بزرگ)
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={viewMode === 'compact'}
            onClick={() => setViewMode('compact')}
          >
            فشرده (لیستی)
          </button>
        </div>
      </section>

      <section className="card stack" style={{ marginTop: 10 }}>
        <b>موقعیت‌های تحویل ذخیره‌شده</b>
        <p className="muted" style={{ margin: 0 }}>
          چند آدرس ذخیره کن تا سریع بین خانه، محل کار و غیره سوییچ کنی.
        </p>

        {savedLocations.length > 0 && (
          <div className="stack" style={{ gap: 8 }}>
            {savedLocations.map((loc) => {
              const isCurrent =
                location &&
                loc.lat === location.lat &&
                loc.lng === location.lng &&
                loc.label === location.label;
              const isEditing = editingId === loc.id;

              return (
                <div
                  key={loc.id || `${loc.lat},${loc.lng}`}
                  className={`address-option${isCurrent ? ' address-option--selected' : ''}`}
                >
                  <div className="address-option-head">
                    {isEditing ? (
                      <div className="row" style={{ flex: 1, gap: 6 }}>
                        <input
                          type="text"
                          value={editingLabel}
                          onChange={(e) => setEditingLabel(e.target.value)}
                          placeholder="نام جدید موقعیت"
                          style={{ padding: '4px 8px', fontSize: '13px' }}
                        />
                        <button
                          type="button"
                          className="button button--primary"
                          style={{ padding: '4px 8px', minHeight: '32px', fontSize: '12px' }}
                          onClick={() => {
                            if (loc.id && editingLabel.trim()) {
                              updateSavedLocationLabel(loc.id, editingLabel.trim());
                            }
                            setEditingId(null);
                          }}
                        >
                          ذخیره
                        </button>
                        <button
                          type="button"
                          className="button"
                          style={{ padding: '4px 8px', minHeight: '32px', fontSize: '12px' }}
                          onClick={() => setEditingId(null)}
                        >
                          لغو
                        </button>
                      </div>
                    ) : (
                      <>
                        <b style={{ fontSize: '14px' }}>{loc.label}</b>
                        {isCurrent && (
                          <span className="address-tag address-tag--current">✓ فعلی</span>
                        )}
                        <span className="muted" dir="ltr" style={{ fontSize: '11px' }}>
                          ({loc.lat}, {loc.lng})
                        </span>
                      </>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="row" style={{ marginTop: 6, gap: 6, alignItems: 'center' }}>
                      {!isCurrent && (
                        <button
                          type="button"
                          className="button button--primary"
                          style={{ padding: '4px 10px', minHeight: '30px', fontSize: '12px' }}
                          onClick={() => {
                            selectLocation(loc);
                            setStatus(`موقعیت روی «${loc.label}» تنظیم شد`);
                          }}
                        >
                          انتخاب این موقعیت
                        </button>
                      )}
                      <button
                        type="button"
                        className="button"
                        style={{ padding: '4px 8px', minHeight: '30px', fontSize: '12px' }}
                        onClick={() => {
                          setEditingId(loc.id || null);
                          setEditingLabel(loc.label);
                        }}
                      >
                        ویرایش نام
                      </button>
                      {savedLocations.length > 1 && loc.id && (
                        <button
                          type="button"
                          className="button"
                          style={{ padding: '4px 8px', minHeight: '30px', fontSize: '12px' }}
                          onClick={() => removeSavedLocation(loc.id!)}
                        >
                          حذف
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '8px 0' }} />

        <b>افزودن موقعیت جدید</b>
        <label className="field">
          نام دلخواه برای موقعیت جدید (اختیاری)
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="مثلاً: خانه، محل کار،..."
          />
        </label>

        <button type="button" className="button button--primary button--block" onClick={locate}>
          استفاده از موقعیت GPS فعلی
        </button>

        <ManualCoordinates
          initial={location}
          onPick={({ lat, lng }) => handleManualAdd(lat, lng)}
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
            return (
              <button
                key={address.id}
                type="button"
                className="address-option"
                onClick={() => {
                  const created = addSavedLocation({
                    lat: address.lat,
                    lng: address.lng,
                    label: address.label,
                  });
                  selectLocation(created);
                  setStatus(`موقعیت «${address.label}» اضافه و انتخاب شد`);
                }}
              >
                <span className="address-option-head">
                  <b>{address.label}</b>
                  {current && <span className="address-tag address-tag--current">✓ فعلی</span>}
                </span>
                <span className="muted">{address.address}</span>
              </button>
            );
          })}
        </section>
      )}

      <InstallCard />

      <section className="card stack" style={{ marginTop: 10 }}>
        <b>هزینهٔ ارسال</b>
        <label className="toggle">
          <input
            type="checkbox"
            checked={snappPro}
            onChange={(event) => patch({ snappPro: event.target.checked })}
          />
          <span>
            اشتراک اسنپ پرو دارم
            <span className="muted" style={{ display: 'block' }}>
              فروشگاه‌های «پرو» اسنپ‌مارکت فقط برای مشترک پرو ارسال ارزان دارند؛ بدون اشتراک همان
              هزینهٔ کامل را می‌پردازی.
            </span>
          </span>
        </label>
      </section>

      <section className="card stack" style={{ marginTop: 10 }}>
        <b>دربارهٔ این برنامه</b>
        <p className="muted" style={{ margin: 0 }}>
          پروژه‌ای مستقل و متن‌باز. از همان APIهای عمومی‌ای استفاده می‌کند که وب‌اپ اسنپ‌مارکت،
          دیجی‌کالا جت و اوکالا صدا می‌زنند.
        </p>
      </section>
    </div>
  );
}

function ManualCoordinates({
  initial,
  onPick,
  onInvalid,
}: {
  initial: Location | null;
  onPick: (coords: { lat: number; lng: number }) => void;
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
    onPick({ lat: parsedLat, lng: parsedLng });
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
        افزودن و استفاده از این مختصات
      </button>
    </>
  );
}

const never = () => () => {};

function InstallCard() {
  const standalone = usePwa((state) => state.standalone);
  const canPrompt = usePwa((state) => Boolean(state.installPrompt));
  const platform = useSyncExternalStore<Platform | null>(never, detectPlatform, () => null);
  const secure = useSyncExternalStore(
    never,
    () => window.isSecureContext,
    () => true,
  );
  const [result, setResult] = useState<string | null>(null);

  if (standalone || !platform) return null;

  return (
    <section className="card stack" style={{ marginTop: 10 }}>
      <b>نصب برنامه</b>
      <p className="muted" style={{ margin: 0 }}>
        نصب‌شده، مثل یک برنامهٔ معمولی از صفحهٔ اصلی باز می‌شود.
      </p>

      {!secure ? (
        <p className="note" style={{ margin: 0 }}>
          نصب فقط روی نشانی HTTPS ممکن است.
        </p>
      ) : canPrompt ? (
        <button
          type="button"
          className="button button--primary button--block"
          onClick={() =>
            void install().then((accepted) =>
              setResult(accepted ? 'نصب شد.' : 'نصب انجام نشد؛ هر وقت خواستی دوباره بزن.'),
            )
          }
        >
          نصب روی این دستگاه
        </button>
      ) : platform === 'ios' ? (
        <ol className="install-steps">
          <li>این صفحه را در Safari باز کن.</li>
          <li>دکمهٔ اشتراک‌گذاری را بزن.</li>
          <li>«Add to Home Screen» را انتخاب کن.</li>
        </ol>
      ) : platform === 'android' ? (
        <p className="muted" style={{ margin: 0 }}>
          از منوی مرورگر «نصب برنامه» یا «Add to Home screen» را بزن.
        </p>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          در Chrome یا Edge، آیکن نصب را در سمت راست نوار نشانی بزن.
        </p>
      )}

      {result && (
        <p className="note" style={{ margin: 0 }} role="status">
          {result}
        </p>
      )}
    </section>
  );
}
