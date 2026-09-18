import type { Metadata } from 'next';
import BasketPage from '@/routes/BasketPage';

export const metadata: Metadata = {
  title: 'سبد خرید · شکارچی تخفیف',
  description: 'کالاهایی که می‌خواهی، و ارزان‌ترین راه خریدنشان از یک تا سه فروشگاه.',
};

export default function Page() {
  return <BasketPage />;
}
