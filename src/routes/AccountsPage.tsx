'use client';

import { useEffect, useRef, useState } from 'react';
import { PLATFORMS, accountStatus, requestCode, signOut, verifyCode } from '../store/auth';
import { useSettings } from '../store/settings';
import { digitsOnly } from '../core/digits';
import { normalizePhone } from '../auth/phone';
import type { PlatformId } from '../core/types';

export default function AccountsPage() {
  const sessions = useSettings((state) => state.sessions);
  const phone = useSettings((state) => state.phone);
  const patch = useSettings((state) => state.patch);
  const phoneInput = useRef<HTMLInputElement>(null);

  // The same number opens all three accounts, so it is asked for once, here,
  // and every card below signs in with it. Only the code is per platform.
  const normalized = normalizePhone(phone);
  const invalid = phone.length > 0 && !normalized;

  return (
    <div className="page-narrow">
      <h1 className="page-title">حساب‌ها</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        یک شماره برای هر سه پلتفرم. کد پیامکی را جدا می‌فرستد، چون حساب‌ها جدا هستند. توکن روی همین
        دستگاه می‌ماند و فقط به همان پلتفرمی می‌رود که از آن آمده.
      </p>

      <section className="card stack">
        <label className="field">
          شماره موبایل
          <input
            ref={phoneInput}
            className="input--digits"
            type="tel"
            // `numeric` rather than `tel`: a tel pad offers `+`, `*` and `#`,
            // none of which can appear in the field anyway.
            inputMode="numeric"
            // iOS reads this as "digits only" and keeps the pad on the Latin
            // numerals whatever the system keyboard language is.
            pattern="[0-9]*"
            lang="en"
            dir="ltr"
            autoComplete="tel"
            spellCheck={false}
            // Deliberately no `maxLength`: the attribute truncates the raw text
            // before this component can strip it, so pasting `+98 912-345 6789`
            // would be cut to 13 characters of punctuation and end up as the
            // wrong number. The cap belongs where the filtering happens.
            placeholder="09123456789"
            aria-invalid={invalid}
            value={phone}
            // Persian and Arabic digits are rewritten as they are typed, and
            // anything that is not a digit never reaches the field. See
            // `src/core/digits.ts`.
            onChange={(event) => patch({ phone: digitsOnly(event.target.value, 13) })}
          />
        </label>

        {invalid ? (
          <p className="note note--error" style={{ margin: 0 }}>
            شماره باید ۱۱ رقم و به شکل ۰۹xxxxxxxxx باشد.
          </p>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            {normalized
              ? `با ${normalized} وارد می‌شوی. برای هر پلتفرم فقط کد پیامکی می‌ماند.`
              : 'شماره را یک بار وارد کن؛ هر سه کارت پایین از همین استفاده می‌کنند.'}
          </p>
        )}
      </section>

      <div className="stack">
        {PLATFORMS.map((platform) => (
          <AccountCard
            key={platform.id}
            id={platform.id}
            name={platform.name}
            note={platform.note}
            required={platform.required}
            linked={Boolean(sessions[platform.id]?.accessToken)}
            phone={normalized}
            onNeedPhone={() => phoneInput.current?.focus()}
          />
        ))}
      </div>
    </div>
  );
}

interface CardProps {
  id: PlatformId;
  name: string;
  note: string;
  required: boolean;
  linked: boolean;
  /** The shared number, already normalised, or null while it is not usable. */
  phone: string | null;
  onNeedPhone: () => void;
}

function AccountCard({ id, name, note, required, linked, phone, onNeedPhone }: CardProps) {
  const [open, setOpen] = useState(false);
  // The number a code was last sent to, rather than a plain "sent" flag. Edit
  // the shared number and the card falls back to asking for a code again,
  // because the one already in flight was sent to a different phone — derived
  // from the props instead of reset in an effect, so there is no render where
  // the two disagree.
  const [sentFor, setSentFor] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const status = accountStatus(id);
  const sent = phone !== null && sentFor === phone;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const send = async () => {
    if (!phone) {
      setMessage({ text: 'اول شماره موبایل را بالا وارد کن', error: true });
      onNeedPhone();
      return;
    }
    setBusy(true);
    setMessage({ text: 'در حال ارسال کد…' });
    try {
      const result = await requestCode(id, phone);
      setSentFor(phone);
      setCode('');
      setCooldown(result.resendAfter);
      setMessage({ text: `کد به ${result.phone} پیامک شد.` });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : String(error), error: true });
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!phone) return;
    setBusy(true);
    setMessage({ text: 'در حال بررسی کد…' });
    try {
      await verifyCode(id, phone, code);
      setOpen(false);
      setSentFor(null);
      setCode('');
      setMessage(null);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : String(error), error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`card${linked ? ' account--linked' : ''}`}>
      <div className="account-head">
        <b>{name}</b>
        <span className="account-state">
          {linked
            ? `متصل${status.subject ? ` · ${status.subject}` : ''}`
            : required
              ? 'وارد نشده — لازم است'
              : 'وارد نشده — اختیاری'}
        </span>
        <button
          type="button"
          className="button"
          onClick={() => (linked ? signOut(id) : setOpen((value) => !value))}
        >
          {linked ? 'خروج' : open ? 'بستن' : 'ورود'}
        </button>
      </div>

      <p className="muted" style={{ margin: 0 }}>
        {note}
      </p>

      {!linked && open && (
        <form
          className="otp-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!sent) void send();
            else void confirm();
          }}
        >
          {sent && (
            <label className="field">
              کد پیامک‌شده به {phone}
              <input
                className="code-input input--digits"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                lang="en"
                dir="ltr"
                autoComplete="one-time-code"
                spellCheck={false}
                value={code}
                onChange={(event) => setCode(digitsOnly(event.target.value, 8))}
                required
                autoFocus
              />
            </label>
          )}

          <div className="otp-actions">
            <button className="button button--primary" type="submit" disabled={busy || !phone}>
              {sent ? 'تأیید و ورود' : 'ارسال کد'}
            </button>
            {sent && (
              <button
                type="button"
                className="button"
                disabled={busy || cooldown > 0}
                onClick={() => void send()}
              >
                {cooldown > 0 ? `ارسال دوباره (${cooldown})` : 'ارسال دوباره'}
              </button>
            )}
          </div>

          {!phone && (
            <p className="note" style={{ margin: 0 }}>
              شماره موبایل بالای صفحه خالی است.
            </p>
          )}

          {message && (
            <p className={`note${message.error ? ' note--error' : ''}`} style={{ margin: 0 }}>
              {message.text}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
