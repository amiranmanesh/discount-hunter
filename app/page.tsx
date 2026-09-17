import type { Metadata } from 'next';
import DealsPage from '@/routes/DealsPage';

export const metadata: Metadata = {
  title: 'تخفیف‌ها · شکارچی تخفیف',
  description: 'همهٔ تخفیف‌های کمپینی اطرافت، عمیق‌ترین اول.',
};

export default function Page() {
  return <DealsPage />;
}
