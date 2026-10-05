import type { Metadata } from 'next';
import DealsAndSearchPage from '@/routes/DealsAndSearchPage';

export const metadata: Metadata = {
  title: 'جستجو · شکارچی تخفیف',
  description: 'جستجوی یک محصول و مشاهدهٔ تخفیف‌های کمپینی در همین صفحه.',
};

export default function Page() {
  return <DealsAndSearchPage />;
}
