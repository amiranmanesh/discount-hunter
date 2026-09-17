import type { MetadataRoute } from 'next';

/**
 * Served at `/manifest.webmanifest`. Paths are relative so the manifest stays
 * correct on whatever origin the app is deployed to.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'شکارچی تخفیف',
    short_name: 'شکارچی تخفیف',
    description:
      'بیشترین تخفیف اسنپ‌مارکت، دیجی‌کالا جت و اوکالا در فروشگاه‌های اطرافت، مرتب‌شده بر اساس درصد تخفیف.',
    lang: 'fa',
    dir: 'rtl',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fbfbfd',
    theme_color: '#ff5f00',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
