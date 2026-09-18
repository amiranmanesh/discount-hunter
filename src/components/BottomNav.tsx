'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PLATFORMS } from '../store/auth';
import { useSettings } from '../store/settings';
import { useBasket } from '../store/basket';

const icons = {
  deals: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2a2 2 0 0 1-.6-1.4V4.6A1.6 1.6 0 0 1 4.4 3h7.4a2 2 0 0 1 1.4.6l7.4 7.4a2 2 0 0 1 0 2.4Z" />
      <circle cx="7.5" cy="7.5" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" strokeLinecap="round" />
    </svg>
  ),
  basket: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 4h2.2l2.1 10.2a1.6 1.6 0 0 0 1.6 1.3h8.3a1.6 1.6 0 0 0 1.6-1.2L20.5 8H6" />
      <circle cx="9.5" cy="19.5" r="1.3" />
      <circle cx="17" cy="19.5" r="1.3" />
    </svg>
  ),
  accounts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" strokeLinecap="round" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path
        d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"
        strokeLinecap="round"
      />
    </svg>
  ),
};

export default function BottomNav() {
  const pathname = usePathname();
  const sessions = useSettings((state) => state.sessions);
  const inBasket = useBasket((state) => state.items.length);
  const missing = PLATFORMS.filter(
    (platform) => platform.required && !sessions[platform.id]?.accessToken,
  ).length;

  // `aria-current` is what marks the tab as the page you are on — for a screen
  // reader, and for the stylesheet, which draws the highlight from it.
  const current = (href: string) => (pathname === href ? 'page' : undefined);

  return (
    <nav className="bottom-nav" aria-label="ناوبری اصلی">
      <Link href="/" aria-current={current('/')}>
        {icons.deals}
        <span>تخفیف‌ها</span>
      </Link>
      <Link href="/search" aria-current={current('/search')}>
        {icons.search}
        <span>جستجو</span>
      </Link>
      <Link href="/basket" aria-current={current('/basket')}>
        {icons.basket}
        <span>سبد</span>
        {inBasket > 0 && (
          <span className="nav-badge nav-badge--count" aria-label={`${inBasket} کالا در سبد`}>
            {inBasket}
          </span>
        )}
      </Link>
      <Link href="/accounts" aria-current={current('/accounts')}>
        {icons.accounts}
        <span>حساب‌ها</span>
        {missing > 0 && (
          <span className="nav-badge" aria-label={`${missing} حساب وارد نشده`}>
            {missing}
          </span>
        )}
      </Link>
      <Link href="/settings" aria-current={current('/settings')}>
        {icons.settings}
        <span>تنظیمات</span>
      </Link>
    </nav>
  );
}
