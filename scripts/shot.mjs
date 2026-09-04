// Renders a popup-sized screenshot for the README.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const EXT = path.join(ROOT, 'extension');
const PROFILE = path.join(ROOT, '.browser-profile', 'shot');
fs.rmSync(PROFILE, { recursive: true, force: true });

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 430, height: 600 },
  locale: 'fa-IR',
  deviceScaleFactor: 2,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

let [worker] = ctx.serviceWorkers();
if (!worker) worker = await ctx.waitForEvent('serviceworker');
const id = new URL(worker.url()).host;
await worker.evaluate(async () => {
  await chrome.storage.local.set({
    location: { lat: 35.722358, lng: 51.47813, label: 'تهران — تسلیحات' },
  });
});

const page = await ctx.newPage();
await page.goto(`chrome-extension://${id}/popup/popup.html`);
await page.fill('#queryInput', process.env.Q || 'بستنی میهن');
await page.click('#searchButton');
await page.waitForFunction(() => document.getElementById('searchButton').disabled, null, {
  timeout: 15000,
});
await page.waitForFunction(() => !document.getElementById('searchButton').disabled, null, {
  timeout: 240000,
});
await page.waitForTimeout(2500);
fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
await page.screenshot({ path: path.join(ROOT, 'docs', 'popup.png') });
console.log('docs/popup.png');
await ctx.close();
