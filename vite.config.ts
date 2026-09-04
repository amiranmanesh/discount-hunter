import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { PROXY_TARGETS } from './server/targets.mjs';

/**
 * The dev server carries the same `/api/*` proxy the production server does.
 *
 * Neither platform allows a cross-origin browser request — Snapp Market echoes
 * `Access-Control-Allow-Origin` only for `https://snapp.market`, Digikala Jet
 * sends none at all — so every call has to leave from this app's own origin.
 */
const proxy = Object.fromEntries(
  Object.entries(PROXY_TARGETS).map(([prefix, target]) => [
    prefix,
    {
      target: target.origin,
      changeOrigin: true,
      rewrite: (path: string) => path.replace(prefix, ''),
      headers: { origin: target.referer, referer: `${target.referer}/` },
    },
  ]),
);

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'شکارچی تخفیف',
        short_name: 'شکارچی تخفیف',
        description:
          'بیشترین تخفیف اسنپ‌مارکت و دیجی‌کالا جت در فروشگاه‌های اطرافت، مرتب‌شده بر اساس درصد تخفیف.',
        lang: 'fa',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#fbfbfd',
        theme_color: '#ff5f00',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Prices change by the hour and every response is account-specific:
        // cache the shell, never the API.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(static|cdn)\.snapp\.express\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'product-images',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: /^https:\/\/dkstatics-public\.digikala\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'product-images-jet',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
});
