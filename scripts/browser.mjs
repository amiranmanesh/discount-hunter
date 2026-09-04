// Opens a real Chromium with the extension loaded and the Snapp Market session
// signed in, then stays up so the scenario can be driven by hand.
//   node tools/dev.mjs
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedProfile } from './profile.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const EXT = path.join(ROOT, 'extension');
const SEED = path.join(ROOT, '.browser-profile', 'session');
const PROFILE = path.join(ROOT, '.browser-profile', 'dev');

// Chrome caches extension resources per profile, so start from a clean copy of
// the signed-in profile on every launch.
seedProfile(SEED, PROFILE);

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: null,
  locale: 'fa-IR',
  timezoneId: 'Asia/Tehran',
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--start-maximized',
    '--disable-blink-features=AutomationControlled',
  ],
});

let [worker] = ctx.serviceWorkers();
if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 30000 });
const id = new URL(worker.url()).host;

worker.on('console', (m) => console.log(`[sw ${m.type()}]`, m.text()));

// Load snapp.market first so the content script hands over the saved addresses
// before the popup opens. Authentication is the extension's own — sign in from
// the popup's panel.
const snappTab = ctx.pages()[0] || (await ctx.newPage());
await snappTab.goto('https://snapp.market/', { waitUntil: 'domcontentloaded' });
await snappTab.waitForTimeout(9000);

const captured = await worker.evaluate(async () => {
  const s = await chrome.storage.local.get([
    'auth:snapp',
    'auth:jet',
    'snappAddresses',
    'location',
  ]);
  return {
    snapp: Boolean(s['auth:snapp']?.accessToken),
    jet: Boolean(s['auth:jet']?.accessToken),
    addresses: (s.snappAddresses || []).map((a) => a.label),
    location: s.location,
  };
});

const popup = await ctx.newPage();
await popup.goto(`chrome-extension://${id}/popup/popup.html`);
await popup.bringToFront();

console.log('\n────────────────────────────────────────────');
console.log('extension id :', id);
console.log('snapp login  :', captured.snapp ? 'بله' : 'خیر — از پنل افزونه وارد شو');
console.log('jet login    :', captured.jet ? 'بله' : 'خیر — اختیاری');
console.log('addresses    :', captured.addresses.join(' | ') || '(none)');
console.log('location     :', captured.location?.label || '(not set)');
console.log('popup tab    :', `chrome-extension://${id}/popup/popup.html`);
console.log('────────────────────────────────────────────');
console.log('تب دوم = پنل افزونه. سرچ کن، تست کن. برای پایان، پنجره را ببند.\n');

await new Promise((resolve) => ctx.on('close', resolve));
