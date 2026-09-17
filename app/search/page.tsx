import type { Metadata } from 'next';
import SearchPage from '@/routes/SearchPage';

export const metadata: Metadata = {
  title: 'جستجو · شکارچی تخفیف',
  description: 'یک محصول، قیمت‌گرفته در هر فروشگاهی که به تو تحویل می‌دهد.',
};

export default function Page() {
  return <SearchPage />;
}
