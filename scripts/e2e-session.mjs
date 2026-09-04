// Full-path check: content-script session capture, suggestions, hunt, open-store.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedProfile } from './profile.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const EXT = path.join(ROOT, 'extension');
const SEED = path.join(ROOT, '.browser-profile', 'session'); // already signed in to snapp.market
const PROFILE = path.join(ROOT, '.browser-profile', 'e2e-session');

seedProfile(SEED, PROFILE);
fs.cpSync(SEED, PROFILE, { recursive: true });
for (const f of fs.readdirSync(PROFILE))
  if (f.startsWith('Singleton')) fs.rmSync(path.join(PROFILE, f), { force: true });

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1280, height: 900 },
  locale: 'fa-IR',
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

let [worker] = ctx.serviceWorkers();
if (!worker) worker = await ctx.waitForEvent('serviceworker');
const id = new URL(worker.url()).host;
const errors = [];
worker.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[sw] ${m.text()}`);
});

// 1. content script should hand over the logged-in token + saved addresses
const snappTab = await ctx.newPage();
await snappTab.goto('https://snapp.market/', { waitUntil: 'domcontentloaded' });
await snappTab.waitForTimeout(12000);
const captured = await worker.evaluate(async () => {
  const s = await chrome.storage.local.get(['snappSessionToken', 'snappAddresses', 'location']);
  return {
    hasToken: Boolean(s.snappSessionToken?.token),
    addresses: (s.snappAddresses || []).map((a) => a.label),
    location: s.location,
  };
});
console.log('session capture:', JSON.stringify(captured));

// 2. popup: suggestions + hunt
const popup = await ctx.newPage();
popup.on('pageerror', (e) => errors.push(`[popup] ${e.message}`));
popup.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[popup] ${m.text()}`);
});
await popup.goto(`chrome-extension://${id}/popup/popup.html`);
await popup.waitForTimeout(800);

await popup.click('#queryInput');
await popup.type('#queryInput', 'بستنی', { delay: 90 });
await popup.waitForSelector('#suggestions li', { timeout: 15000 });
const suggestions = await popup.$$eval('#suggestions li', (ns) => ns.map((n) => n.textContent));
console.log('suggestions:', suggestions.slice(0, 4).join(' | '));

await popup.click('#searchButton');
await popup.waitForFunction(() => document.getElementById('searchButton').disabled, null, {
  timeout: 15000,
});
await popup.waitForFunction(() => !document.getElementById('searchButton').disabled, null, {
  timeout: 240000,
});
const status = await popup.textContent('#statusBar');
console.log('status:', status.trim());
console.log('suggestions hidden after search:', await popup.isHidden('#suggestions'));
console.log('progress hidden after search:', await popup.isHidden('#progress'));

// 3. open-store button must open the vendor page
const before = ctx.pages().length;
const [opened] = await Promise.all([
  ctx.waitForEvent('page', { timeout: 20000 }),
  popup.click('.offer .open-store'),
]);
await opened.waitForLoadState('domcontentloaded').catch(() => {});
console.log(
  'opened tab:',
  decodeURIComponent(opened.url()).slice(0, 90),
  `(pages ${before} → ${ctx.pages().length})`,
);

// 4. location panel
await popup.click('#locationChip');
const addressButtons = await popup.$$eval('#addressList .address b', (ns) =>
  ns.map((n) => n.textContent),
);
console.log('address chips in panel:', addressButtons.join(' | ') || '(none)');

console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no console errors');
await ctx.close();
