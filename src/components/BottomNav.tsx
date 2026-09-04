import { NavLink } from 'react-router';
import { PLATFORMS } from '../store/auth';
import { useSettings } from '../store/settings';

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
  const sessions = useSettings((state) => state.sessions);
  const missing = PLATFORMS.filter(
    (platform) => platform.required && !sessions[platform.id]?.accessToken,
  ).length;

  return (
    <nav className="bottom-nav" aria-label="ناوبری اصلی">
      <NavLink to="/" end>
        {icons.deals}
        <span>تخفیف‌ها</span>
      </NavLink>
      <NavLink to="/search">
        {icons.search}
        <span>جستجو</span>
      </NavLink>
      <NavLink to="/accounts">
        {icons.accounts}
        <span>حساب‌ها</span>
        {missing > 0 && (
          <span className="nav-badge" aria-label={`${missing} حساب وارد نشده`}>
            {missing}
          </span>
        )}
      </NavLink>
      <NavLink to="/settings">
        {icons.settings}
        <span>تنظیمات</span>
      </NavLink>
    </nav>
  );
}
