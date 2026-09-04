#!/usr/bin/env node
/**
 * Builds nothing and asserts nothing — it just renders the built app at a phone
 * and a laptop size and reports what came back, so a layout regression is one
 * command away rather than a story someone tells you later.
 *
 *   npm run build && node scripts/preview.mjs
 *
 * Screenshots land in `.preview/`, which is git-ignored.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = path.join(ROOT, '.preview');
const PORT = process.env.PORT || '4191';
const LOCATION = {
  lat: Number(process.env.LAT || 35.722358),
  lng: Number(process.env.LNG || 51.47813),
  label: process.env.LABEL || 'تهران',
};

mkdirSync(OUT, { recursive: true });

const server = spawn('node', [path.join(ROOT, 'server/index.mjs')], {
  env: { ...process.env, PORT },
  stdio: 'ignore',
});
await new Promise((resolve) => setTimeout(resolve, 2500));

const browser = await chromium.launch({ headless: false });
const problems = [];

for (const [name, viewport] of [
  ['mobile', { width: 390, height: 844 }],
  ['laptop', { width: 1280, height: 800 }],
]) {
  const context = await browser.newContext({ viewport, locale: 'fa-IR', deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on('pageerror', (error) => problems.push(`[${name}] ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`[${name}] ${message.text()}`);
  });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  // Seed a delivery point. Digikala Jet needs no token, so the feed has
  // something to show even signed out.
  await page.evaluate((location) => {
    localStorage.setItem(
      'discount-hunter',
      JSON.stringify({
        state: {
          location,
          sortMode: 'best-discount',
          sources: { snapp: true, jet: true },
          onlyCampaign: false,
          onlyOpen: true,
          minDiscount: 0,
          recentQueries: [],
          sessions: { snapp: null, jet: null },
          limits: {
            snapp: { requests: [], verifyAttempts: 0, blockedUntil: 0 },
            jet: { requests: [], verifyAttempts: 0, blockedUntil: 0 },
          },
        },
        version: 1,
      }),
    );
  }, LOCATION);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  const cards = await page.locator('.offer').count();
  if (overflow) problems.push(`[${name}] the page scrolls horizontally`);
  console.log(`${name}: ${cards} offers, horizontal overflow: ${overflow ? 'yes' : 'no'}`);

  for (const [route, file] of [
    ['/', 'deals'],
    ['/search', 'search'],
    ['/accounts', 'accounts'],
    ['/settings', 'settings'],
  ]) {
    await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(route === '/' ? 6000 : 900);
    await page.screenshot({ path: path.join(OUT, `${name}-${file}.png`) });
  }

  await context.close();
}

await browser.close();
server.kill();

console.log(
  problems.length ? `\nproblems:\n${[...new Set(problems)].join('\n')}` : '\nno problems',
);
process.exit(problems.length ? 1 : 0);
