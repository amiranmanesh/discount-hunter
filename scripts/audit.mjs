#!/usr/bin/env node
/**
 * Independent audit of one search.
 *
 * Runs the extension's own hunt in a signed-in browser, then asks each winning
 * store directly — with the same account token — and prints both numbers side by
 * side. Any row where they disagree is a bug in the extension, not in the store.
 *
 *   Q='نوشابه زیرو کوکاکولا' node scripts/audit.mjs
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedProfile } from './profile.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const EXT = path.join(ROOT, 'extension');
const SEED = path.join(ROOT, '.browser-profile', 'session');
const PROFILE = path.join(ROOT, '.browser-profile', 'audit');
const QUERY = process.env.Q || 'نوشابه زیرو کوکاکولا';

seedProfile(SEED, PROFILE);

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1200, height: 900 },
  locale: 'fa-IR',
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

let [worker] = ctx.serviceWorkers();
if (!worker) worker = await ctx.waitForEvent('serviceworker', { timeout: 20000 });
const id = new URL(worker.url()).host;

const snappTab = await ctx.newPage();
await snappTab.goto('https://snapp.market/', { waitUntil: 'domcontentloaded' });
await snappTab.waitForTimeout(11000);

const session = await worker.evaluate(async () => {
  const state = await chrome.storage.local.get(['snappSessionToken', 'location']);
  return { token: state.snappSessionToken?.token || null, location: state.location || null };
});
if (!session.token) throw new Error('not signed in — run `npm run browser` and sign in first');
const claims = JSON.parse(Buffer.from(session.token.split('.')[1], 'base64url'));
console.log(
  `account ${claims.sub} · ${session.location?.label} (${session.location?.lat}, ${session.location?.lng})\n`,
);

const popup = await ctx.newPage();
await popup.goto(`chrome-extension://${id}/popup/popup.html`);
await popup.waitForTimeout(1000);
await popup.fill('#queryInput', QUERY);
await popup.click('#searchButton');
await popup.waitForFunction(() => document.getElementById('searchButton').disabled, null, {
  timeout: 20000,
});
await popup.waitForFunction(() => !document.getElementById('searchButton').disabled, null, {
  timeout: 300000,
});
await popup.waitForTimeout(1500);

const shown = await worker.evaluate(async () => {
  const { lastResult } = await chrome.storage.local.get('lastResult');
  return {
    stats: lastResult?.stats,
    offers: (lastResult?.offers || []).slice(0, 12).map((o) => ({
      platform: o.platform,
      title: o.title,
      productId: o.productId,
      vendor: o.vendor.code,
      vendorName: o.vendor.name,
      price: o.price,
      finalPrice: o.finalPrice,
      percent: o.discountPercent,
      verified: Boolean(o.verified),
      verifiedBy: o.verifiedBy || null,
    })),
  };
});

console.log('stats:', JSON.stringify(shown.stats), '\n');

const { lat, lng } = session.location;
const headers = {
  authorization: `Bearer ${session.token}`,
  origin: 'https://snapp.market',
  referer: 'https://snapp.market/',
};

console.log('shown vs the store, asked directly with the same token:\n');
let mismatches = 0;
for (const offer of shown.offers) {
  if (offer.platform !== 'snapp') {
    console.log(`  [jet]   ${offer.finalPrice.toLocaleString()}  ${offer.title.slice(0, 44)}`);
    continue;
  }
  const url =
    `https://svc.snapp.market/mobile/v2/product-variation/search?query=${encodeURIComponent(offer.title)}` +
    `&vendorCode=${offer.vendor}&firstPage=true&page=0&page_size=10&size=10&origin=vp-search&source=2` +
    `&latitude=${lat}&longitude=${lng}&client=PWA&deviceType=PWA&appVersion=1.399.10&lat=${lat}&long=${lng}`;
  const json = await (await fetch(url, { headers })).json();
  const rows = json?.data?.result || [];
  const match =
    rows.find((row) => String(row.id) === offer.productId) ||
    rows.find((row) => row.title?.trim() === offer.title.trim());
  const truth = match ? Number(match.price) - Number(match.discount ?? 0) : null;
  const agree = truth !== null && truth === offer.finalPrice;
  if (!agree) mismatches += 1;
  console.log(
    `  ${agree ? 'ok ' : 'BAD'}  shown ${String(offer.finalPrice).padStart(8)}  store ${String(truth ?? 'missing').padStart(8)}` +
      `  ${offer.percent}%  ${offer.verifiedBy || '-'}  ${offer.vendorName.slice(0, 22)}  ${offer.title.slice(0, 40)}`,
  );
}
console.log(
  `\n${mismatches} mismatch(es) out of ${shown.offers.filter((o) => o.platform === 'snapp').length} Snapp rows`,
);

await ctx.close();
