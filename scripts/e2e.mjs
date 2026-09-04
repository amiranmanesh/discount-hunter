// Loads the unpacked extension in a real Chromium and drives the popup.
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedProfile } from './profile.mjs';
import fs from 'node:fs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const EXT = path.join(ROOT, 'extension');
const SEED = path.join(ROOT, '.browser-profile', 'session');
const PROFILE = path.join(ROOT, '.browser-profile', 'e2e');
const QUERY = process.env.Q || 'پفک مینو';

// Chrome caches extension resources per profile; `seedProfile` strips that cache
// so each run tests the code that is actually on disk. There is no guest mode, so
// the signed-in profile is the seed.
seedProfile(SEED, PROFILE);
fs.mkdirSync(path.join(ROOT, 'probe-out'), { recursive: true });

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1280, height: 900 },
  locale: 'fa-IR',
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

let [worker] = ctx.serviceWorkers();
if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 20000 });
const extensionId = new URL(worker.url()).host;
console.log('extension id:', extensionId);

worker.on('console', (m) => console.log('[sw]', m.text()));

// Seed a Tehran delivery point so the run does not depend on a logged-in tab.
await worker.evaluate(async () => {
  await chrome.storage.local.set({
    location: { lat: 35.722358, lng: 51.47813, label: 'تهران — تسلیحات' },
  });
});

const page = await ctx.newPage();
page.on('console', (m) => console.log('[popup]', m.type(), m.text()));
page.on('pageerror', (e) => console.log('[popup error]', e.message));
await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(ROOT, 'probe-out', 'ext-01-idle.png') });

if (process.env.ALL === '1') await page.uncheck('#onlyOrange');
await page.fill('#queryInput', QUERY);
await page.evaluate(() => chrome.runtime.sendMessage({ type: 'clear-result' }));
await page.click('#searchButton');
// wait for the hunt to actually start before waiting for it to finish
await page.waitForFunction(() => document.getElementById('searchButton').disabled, null, {
  timeout: 15000,
});
await page.waitForFunction(() => !document.getElementById('searchButton').disabled, null, {
  timeout: 240000,
});
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(ROOT, 'probe-out', 'ext-02-results.png') });

const cached = await worker.evaluate(
  async () => (await chrome.storage.local.get('lastResult')).lastResult,
);
console.log(
  'stats:',
  JSON.stringify(cached?.stats),
  'query:',
  cached?.query,
  'finishedAt:',
  cached?.finishedAt,
);

const summary = await page.evaluate(() => ({
  status: document.getElementById('statusBar').textContent,
  banner: document.getElementById('banner').hidden
    ? null
    : document.getElementById('banner').textContent,
  count: document.querySelectorAll('.offer').length,
  platforms: [...document.querySelectorAll('.badge.platform')].reduce((acc, b) => {
    acc[b.textContent] = (acc[b.textContent] || 0) + 1;
    return acc;
  }, {}),
  brokenImages: [...document.querySelectorAll('.offer-image')].filter(
    (i) => !i.complete || i.naturalWidth === 0,
  ).length,
  sampleImage: document.querySelector('.offer-image')?.src || null,
  top: [...document.querySelectorAll('.offer')].slice(0, 6).map((o) => ({
    title: o.querySelector('.offer-title').textContent,
    discount: o.querySelector('.badge.discount')?.textContent || '',
    price: o.querySelector('.final').textContent,
    vendor: o.querySelector('.vendor-name').textContent,
    meta: o.querySelector('.vendor-meta').textContent,
    total: o.querySelector('.total-cost').textContent,
  })),
}));
console.log(JSON.stringify(summary, null, 1));

await ctx.close();
