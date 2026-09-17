import type { Metadata } from 'next';
import AccountsPage from '@/routes/AccountsPage';

export const metadata: Metadata = {
  title: 'حساب‌ها · شکارچی تخفیف',
  description: 'ورود به اسنپ‌مارکت، دیجی‌کالا جت و اوکالا با شمارهٔ خودت.',
};

export default function Page() {
  return <AccountsPage />;
}
