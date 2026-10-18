import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android shell for شکارچی تخفیف.
 *
 * The app is a Next.js server and its own proxy: none of Snapp Market,
 * Digikala Jet or Okala answers a cross-origin browser request, so every call
 * must pass through the server (`/api/*`). A static WebView bundle could not
 * make a single one of them work. The shell therefore loads the app from a
 * server address — the LAN address of your own `npm start` / Docker container.
 * `www/index.html` is the splash + server picker: it holds the configured
 * address, probes `/api/health`, and redirects the WebView once the server
 * answers. Change the address with the gear button it shows.
 */
const config: CapacitorConfig = {
  appId: 'com.discount.hunter',
  appName: 'شکارچی تخفیف',
  webDir: 'www',
  android: {
    // The picker page is served from https://localhost by the shell while the
    // user's own server is plain http on the LAN; without this the WebView
    // refuses the health probe (and later the app itself) as mixed content.
    // After the redirect the whole WebView is on the server origin, so this
    // only ever relaxes the http-LAN case a home deployment uses.
    allowMixedContent: true,
    // Remote debugging via `adb forward`. Flip to true while developing the
    // shell (and rebuild); kept false for the signed release APK so a
    // production install exposes no DevTools endpoint.
    webContentsDebuggingEnabled: false,
  },
  server: {
    // Allows the plain-http LAN server (a home deployment with no TLS).
    cleartext: true,
    // The WebView must navigate to the user's own server host — an arbitrary
    // LAN IP or a personal domain, unknown at build time. Without this the
    // redirect from the picker page would bounce out to the system browser.
    allowNavigation: ['*'],
  },
};

export default config;
