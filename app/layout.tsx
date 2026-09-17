import type { Metadata, Viewport } from 'next';
import BottomNav from '@/components/BottomNav';
import LocationChip from '@/components/LocationChip';
import Providers from './providers';
import '@/styles/global.css';

export const metadata: Metadata = {
  title: 'شکارچی تخفیف',
  description:
    'بیشترین تخفیف اسنپ‌مارکت، دیجی‌کالا جت و اوکالا در فروشگاه‌های اطرافت، مرتب‌شده بر اساس درصد تخفیف.',
  applicationName: 'شکارچی تخفیف',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/icon-192.png',
  },
  appleWebApp: { capable: true, title: 'شکارچی تخفیف', statusBarStyle: 'default' },
  // Nothing here is public or shareable — every page is the user's own account.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#ff5f00',
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <Providers>
          <div className="app">
            <header className="app-header">
              <div className="wrap">
                <span className="brand">
                  {/* A 26px icon already in `public/`: the image optimiser
                      would add a round trip and a runtime for nothing. */}
                  <img src="/icons/icon-192.png" alt="" width={26} height={26} />
                  شکارچی تخفیف
                </span>
                <div style={{ marginInlineStart: 'auto' }}>
                  <LocationChip />
                </div>
              </div>
            </header>

            <BottomNav />

            <main className="app-main">
              <div className="wrap">{children}</div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
