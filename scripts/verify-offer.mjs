#!/usr/bin/env node
/**
 * Ground-truth check for one query.
 *
 * Collects the campaign offers the extension would show, then opens the winning
 * vendor's own page and searches it in the browser, so the price the extension
 * reports can be compared against the price the store actually lists.
 *
 *   Q='نوشابه زیرو کوکاکولا' node scripts/verify-offer.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedProfile } from './profile.mjs';
import { matchScore, normalize, tokenize } from '../extension/src/util/text.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SEED = path.join(ROOT, '.browser-profile', 'session');
const PROFILE = path.join(ROOT, '.browser-profile', 'verify-offer');
const QUERY = process.env.Q || 'نوشابه زیرو کوکاکولا';

seedProfile(SEED, PROFILE);

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1280, height: 900 },
  locale: 'fa-IR',
  timezoneId: 'Asia/Tehran',
});

const calls = [];
ctx.on('response', async (res) => {
  const url = res.request().url();
  if (!url.includes('svc.snapp.market') || res.request().resourceType() !== 'xhr') return;
  const entry = { url, status: res.status() };
  try {
    if ((res.headers()['content-type'] || '').includes('json')) entry.body = await res.text();
  } catch {
    /* body gone */
  }
  calls.push(entry);
});

const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto('https://snapp.market/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);

const session = await page.evaluate(() => {
  const claims = (jwt) => {
    try {
      return JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return null;
    }
  };

  // The PWA has moved the token around between builds: sometimes it is in the
  // redux slice, sometimes in a bare `JWT` key. Take whichever is a live,
  // account-bound JWT.
  const found = [];
  for (const key of Object.keys(localStorage)) {
    for (const jwt of (localStorage.getItem(key) || '').match(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    ) || []) {
      const payload = claims(jwt);
      if (payload?.aud !== 'end_user_api') continue;
      found.push({
        key,
        jwt,
        sub: payload.sub || '',
        expiresIn: Math.round(payload.exp * 1000 - Date.now()) / 1000,
      });
    }
  }
  const live = found.filter((f) => f.expiresIn > 60);
  const best = live.find((f) => f.sub) || live[0] || null;
  // Fall back to whatever the page is actually sending, so an expired stored
  // token does not stop the comparison from running anonymously.
  if (!best) {
    const anonymous = performance
      .getEntriesByType('resource')
      .some((entry) => entry.name.includes('svc.snapp.market'));
    if (anonymous)
      return {
        token: null,
        tokens: found.map(({ jwt: _jwt, ...rest }) => rest),
        address: null,
        needsAnonymous: true,
      };
  }

  let address = null;
  try {
    const outer = JSON.parse(localStorage.getItem('persist:siteState'));
    const user = JSON.parse(JSON.parse(outer.user))?.information?.data?.user;
    const addresses = (user?.addresses || []).filter((a) => a.latitude);
    address = addresses[addresses.length - 1] || null;
  } catch {
    /* no saved address */
  }

  return { token: best?.jwt || null, tokens: found.map(({ jwt: _jwt, ...rest }) => rest), address };
});

console.log('tokens found in localStorage:', JSON.stringify(session.tokens));

let token = session.token;
let mode = 'account';
if (!token) {
  // Mint the same anonymous token the website mints for a signed-out visitor.
  const udid = crypto.randomUUID();
  const response = await fetch(
    `https://svc.snapp.market/oauth2/default/token?client=PWA&deviceType=PWA&appVersion=1.399.10&UDID=${udid}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://snapp.market',
        referer: 'https://snapp.market/',
      },
      body: JSON.stringify({
        data: {
          time: new Date().toISOString(),
          device_uid: udid,
          client_id: 'snappfood_pwa',
          grant_type: 'client_credentials',
          scope: 'mobile_v2 mobile_v1 webview',
          client_secret: 'snappfood_pwa_secret',
        },
      }),
    },
  );
  token = (await response.json())?.data?.access_token;
  mode = 'anonymous';
}
if (!token) throw new Error('could not obtain any token');
console.log(`mode: ${mode}`);

const { lat, lng } = session.address
  ? { lat: session.address.latitude, lng: session.address.longitude }
  : { lat: Number(process.env.LAT || 35.722358), lng: Number(process.env.LNG || 51.47813) };
console.log(
  `address: ${session.address?.label || '(from env)'} (${lat.toFixed(6)}, ${lng.toFixed(6)})\n`,
);

const HEADERS = {
  accept: 'application/json, text/plain, */*',
  authorization: `Bearer ${token}`,
  origin: 'https://snapp.market',
  referer: 'https://snapp.market/',
};
const common = `client=PWA&deviceType=PWA&appVersion=1.399.10&lat=${lat}&long=${lng}`;
const api = async (url) => (await fetch(url, { headers: HEADERS })).json();

// 1. every nearby vendor in the campaign
const vendors = [];
for (let p = 0; p < 10; p += 1) {
  const json = await api(
    `https://svc.snapp.market/market-party/${lat}/${lng}?deal_type=supermarket&isPro=false&page=${p}&page_size=20&${common}`,
  );
  const batch = json?.data?.vendors || [];
  vendors.push(...batch);
  if (vendors.length >= (json?.data?.total_count ?? 0) || !batch.length) break;
}
console.log(`vendors in campaign: ${vendors.length}\n`);

// 2. each vendor's full shelf, matched against the query
const tokens = tokenize(QUERY);
const normalized = normalize(QUERY);
const hits = [];
for (const vendor of vendors) {
  const json = await api(
    `https://svc.snapp.market/market-party/${vendor.vendor_code}?variable=${vendor.vendor_code}&page_size=100&${common}`,
  );
  const list = json?.data?.products?.List || [];
  const personalized =
    json?.data?.personalizedProducts?.List || json?.data?.personalizedProducts || [];
  for (const [source, products] of [
    ['products', list],
    ['personalized', personalized],
  ]) {
    for (const product of products) {
      const { score, strict } = matchScore(
        product.productVariationTitle || product.title,
        tokens,
        normalized,
      );
      if (!score) continue;
      hits.push({
        source,
        strict,
        vendorCode: vendor.vendor_code,
        vendorName: vendor.vendor_name,
        vendorFromProduct: product.vendorCode,
        title: product.productVariationTitle || product.title,
        id: product.productVariationId,
        price: product.price,
        discount: product.discount,
        ratio: product.discountRatio,
        segment: product.segment,
        stock: product.stock,
        deliveryFee: vendor.delivery_fee,
      });
    }
  }
}

hits.sort((a, b) => b.ratio - a.ratio);
console.log(`matches for "${QUERY}": ${hits.length}\n`);
for (const hit of hits.slice(0, 12)) {
  console.log(
    [
      `${String(hit.ratio).padStart(3)}%`,
      `price=${String(hit.price).padStart(8)}`,
      `discount=${String(hit.discount).padStart(8)}`,
      `minus=${String(hit.price - hit.discount).padStart(8)}`,
      `seg=${String(hit.segment).padEnd(9)}`,
      `src=${hit.source.padEnd(12)}`,
      `strict=${hit.strict ? 'y' : 'n'}`,
      `vendor=${hit.vendorCode}${hit.vendorFromProduct && hit.vendorFromProduct !== hit.vendorCode ? ` !!MISMATCH(${hit.vendorFromProduct})` : ''}`,
      hit.title,
    ].join('  '),
  );
}

// 3. ground truth: open the winning vendor and search it in the browser
const top = hits[0];
if (top) {
  console.log(`\n─── opening ${top.vendorName} (${top.vendorCode}) ───`);
  await page.goto(`https://snapp.market/supermarket/x/${top.vendorCode}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(8000);
  calls.length = 0;
  const box = page.locator('input[placeholder*="جستجو"], input[type="search"]').first();
  await box.click({ timeout: 15000 }).catch((e) => console.error('search box:', e.message));
  await page.keyboard.type(QUERY, { delay: 90 });
  await page.waitForTimeout(2000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(9000);
  fs.mkdirSync(path.join(ROOT, 'probe-out'), { recursive: true });
  await page.screenshot({
    path: path.join(ROOT, 'probe-out', 'verify-vendor.png'),
    fullPage: false,
  });

  console.log('\nin-vendor requests:');
  for (const call of calls) {
    console.log(' ', call.status, call.url.replace(/&client=PWA.*/, '').slice(0, 150));
  }
  fs.writeFileSync(
    path.join(ROOT, 'probe-out', 'verify-vendor.json'),
    JSON.stringify(calls, null, 1),
  );
  console.log('\nbodies → probe-out/verify-vendor.json, screenshot → probe-out/verify-vendor.png');
}

await page.waitForTimeout(2000);
await ctx.close();
