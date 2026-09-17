import type { Metadata } from 'next';
import SettingsPage from '@/routes/SettingsPage';

export const metadata: Metadata = {
  title: 'تنظیمات · شکارچی تخفیف',
  description: 'موقعیت تحویل، منابع و فیلترها.',
};

export default function Page() {
  return <SettingsPage />;
}
