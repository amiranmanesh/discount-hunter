// Opens a real Chromium with the extension loaded and the Snapp Market session
// signed in, then stays up so the scenario can be driven by hand.
//   node tools/dev.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const EXT = path.join(ROOT, 'extension');
const SEED = path.join(ROOT, '.browser-profile', 'session');
const PROFILE = path.join(ROOT, '.browser-profile', 'dev');

// Chrome caches extension resources per profile, so start from a clean copy of
// the signed-in profile on every launch.
fs.rmSync(PROFILE, { recursive: true, force: true });
fs.cpSync(SEED, PROFILE, { recursive: true });
for (const f of fs.readdirSync(PROFILE)) {
  if (f.startsWith('Singleton')) fs.rmSync(path.join(PROFILE, f), { force: true });
}

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

// Load snapp.market first so the content script hands over the live token and
// the saved addresses before the popup opens.
const snappTab = ctx.pages()[0] || (await ctx.newPage());
await snappTab.goto('https://snapp.market/', { waitUntil: 'domcontentloaded' });
await snappTab.waitForTimeout(9000);

const captured = await worker.evaluate(async () => {
  const s = await chrome.storage.local.get(['snappSessionToken', 'snappAddresses', 'location']);
  return {
    loggedIn: Boolean(s.snappSessionToken?.token),
    addresses: (s.snappAddresses || []).map((a) => a.label),
    location: s.location,
  };
});

const popup = await ctx.newPage();
await popup.goto(`chrome-extension://${id}/popup/popup.html`);
await popup.bringToFront();

console.log('\n────────────────────────────────────────────');
console.log('extension id :', id);
console.log('logged in    :', captured.loggedIn ? 'بله' : 'خیر');
console.log('addresses    :', captured.addresses.join(' | ') || '(none)');
console.log('location     :', captured.location?.label || '(not set)');
console.log('popup tab    :', `chrome-extension://${id}/popup/popup.html`);
console.log('────────────────────────────────────────────');
console.log('تب دوم = پنل افزونه. سرچ کن، تست کن. برای پایان، پنجره را ببند.\n');

await new Promise((resolve) => ctx.on('close', resolve));
