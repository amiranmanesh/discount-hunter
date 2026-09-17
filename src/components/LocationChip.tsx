'use client';

import { useRouter } from 'next/navigation';
import { useSettings } from '../store/settings';

export default function LocationChip() {
  const location = useSettings((state) => state.location);
  const router = useRouter();

  return (
    <button
      type="button"
      className={`chip${location ? '' : ' warn'}`}
      onClick={() => router.push('/settings')}
      title="تغییر موقعیت تحویل"
    >
      <span aria-hidden="true">◎</span>
      {location ? location.label : 'موقعیت تنظیم نشده'}
    </button>
  );
}
