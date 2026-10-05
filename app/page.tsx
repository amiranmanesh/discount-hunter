import type { Metadata } from 'next';
import DealsAndSearchPage from '@/routes/DealsAndSearchPage';

export const metadata: Metadata = {
  title: 'تخفیف‌ها · شکارچی تخفیف',
  description: 'همهٔ تخفیف‌ها و جستجوی محصولات در یک صفحه، مرتب‌شده بر اساس درصد تخفیف.',
};

export default function Page() {
  return <DealsAndSearchPage />;
}
