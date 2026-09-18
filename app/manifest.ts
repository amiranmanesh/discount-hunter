import type { MetadataRoute } from 'next';

/**
 * Served at `/manifest.webmanifest`. Paths are relative so the manifest stays
 * correct on whatever origin the app is deployed to.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // A stable identity, so a later change of `start_url` is an update of the
    // installed app rather than a second app.
    id: '/',
    name: 'شکارچی تخفیف',
    short_name: 'شکارچی تخفیف',
    description:
      'بیشترین تخفیف اسنپ‌مارکت، دیجی‌کالا جت و اوکالا در فروشگاه‌های اطرافت، و ارزان‌ترین راه خریدن سبدت.',
    lang: 'fa',
    dir: 'rtl',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    // Every page works both ways, and a tablet or a laptop is not held upright.
    orientation: 'any',
    // The page background, so the splash screen fades into the app, not a flash.
    background_color: '#f6f7f9',
    theme_color: '#ff5f00',
    categories: ['shopping', 'food', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Full-bleed, glyph inside the safe circle: Android crops these to its own shape.
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // A long-press on the installed icon.
    shortcuts: [
      {
        name: 'جستجوی کالا',
        short_name: 'جستجو',
        url: '/search',
        icons: [{ src: '/icons/icon-96.png', sizes: '96x96', type: 'image/png' }],
      },
      {
        name: 'سبد خرید',
        short_name: 'سبد',
        url: '/basket',
        icons: [{ src: '/icons/icon-96.png', sizes: '96x96', type: 'image/png' }],
      },
    ],
    // Shown in the richer install sheet on Android and desktop Chrome.
    screenshots: [
      {
        src: '/screenshots/deals-narrow.jpg',
        sizes: '390x844',
        type: 'image/jpeg',
        form_factor: 'narrow',
        label: 'بیشترین تخفیف‌های اطرافت',
      },
      {
        src: '/screenshots/basket-narrow.jpg',
        sizes: '390x844',
        type: 'image/jpeg',
        form_factor: 'narrow',
        label: 'ارزان‌ترین راه خریدن سبدت',
      },
      {
        src: '/screenshots/deals-wide.jpg',
        sizes: '1280x800',
        type: 'image/jpeg',
        form_factor: 'wide',
        label: 'بیشترین تخفیف‌های اطرافت',
      },
    ],
  };
}
