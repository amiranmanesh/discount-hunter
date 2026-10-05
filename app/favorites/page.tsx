import type { Metadata } from 'next';
import FavoritesPage from '@/routes/FavoritesPage';

export const metadata: Metadata = {
  title: 'نشان‌شده‌ها · شکارچی تخفیف',
  description: 'کالاهای نشان‌شده و علاقه‌مندی‌ها برای دسترسی سریع.',
};

export default function Page() {
  return <FavoritesPage />;
}
