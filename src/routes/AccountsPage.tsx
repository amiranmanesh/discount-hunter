import { useEffect, useState } from 'react';
import { PLATFORMS, accountStatus, requestCode, signOut, verifyCode } from '../store/auth';
import { useSettings } from '../store/settings';
import type { PlatformId } from '../core/types';

export default function AccountsPage() {
  const sessions = useSettings((state) => state.sessions);

  return (
    <>
      <h1 className="page-title">حساب‌ها</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        ورود با شماره موبایل و کد پیامکی، برای هر پلتفرم جدا. توکن روی همین دستگاه می‌ماند و فقط به
        همان پلتفرمی می‌رود که از آن آمده.
      </p>

      <div className="stack">
        {PLATFORMS.map((platform) => (
          <AccountCard
            key={platform.id}
            id={platform.id}
            name={platform.name}
            note={platform.note}
            required={platform.required}
            linked={Boolean(sessions[platform.id]?.accessToken)}
          />
        ))}
      </div>
    </>
  );
}

interface CardProps {
  id: PlatformId;
  name: string;
  note: string;
  required: boolean;
  linked: boolean;
}

function AccountCard({ id, name, note, required, linked }: CardProps) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const status = accountStatus(id);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const send = async () => {
    setBusy(true);
    setMessage({ text: 'در حال ارسال کد…' });
    try {
      const result = await requestCode(id, phone);
      setStage('code');
      setCooldown(result.resendAfter);
      setMessage({ text: `کد به ${result.phone} پیامک شد.` });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : String(error), error: true });
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setMessage({ text: 'در حال بررسی کد…' });
    try {
      await verifyCode(id, phone, code);
      setOpen(false);
      setStage('phone');
      setPhone('');
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
            if (stage === 'phone') void send();
            else void confirm();
          }}
        >
          {stage === 'phone' ? (
            <label className="field">
              شماره موبایل
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="09123456789"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
              />
            </label>
          ) : (
            <label className="field">
              کد پیامک‌شده به {phone}
              <input
                className="code-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
                autoFocus
              />
            </label>
          )}

          <div className="otp-actions">
            <button className="button button--primary" type="submit" disabled={busy}>
              {stage === 'phone' ? 'ارسال کد' : 'تأیید و ورود'}
            </button>
            {stage === 'code' && (
              <>
                <button
                  type="button"
                  className="button"
                  disabled={busy || cooldown > 0}
                  onClick={() => void send()}
                >
                  {cooldown > 0 ? `ارسال دوباره (${cooldown})` : 'ارسال دوباره'}
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setStage('phone');
                    setMessage(null);
                  }}
                >
                  تغییر شماره
                </button>
              </>
            )}
          </div>

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
