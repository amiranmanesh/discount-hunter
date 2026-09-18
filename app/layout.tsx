import type { Metadata, Viewport } from 'next';
import BottomNav from '@/components/BottomNav';
import LocationChip from '@/components/LocationChip';
import Providers from './providers';
import '@/styles/global.css';

/**
 * Every page is rendered per request, never prerendered.
 *
 * A prerendered page goes out with `Cache-Control: s-maxage=31536000`, which
 * tells a CDN in front of the app — the production domain sits behind one —
 * to keep the HTML for a year. The HTML is only a shell, but it names the
 * build's hashed script files, and a new deploy deletes the old ones: a CDN
 * still serving last week's shell would serve an app that cannot load. Rendered
 * per request, the shell goes out as `no-store`, while `/_next/static/*`, whose
 * names change with their content, stays cacheable forever. The pages render
 * no data on the server, so this costs next to nothing.
 */
export const dynamic = 'force-dynamic';

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
    // Full-bleed: iOS paints a transparent corner black before rounding it.
    apple: { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
  },
  appleWebApp: { capable: true, title: 'شکارچی تخفیف', statusBarStyle: 'default' },
  // Nothing here is public or shareable — every page is the user's own account.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // The status bar takes the header's colour, so the installed app reads as one
  // surface; the brand orange stays in the manifest for the splash screen.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#171a20' },
  ],
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
