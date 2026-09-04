#!/usr/bin/env node
/**
 * Opens a real browser and records every API call to `probe-out/`, so a new
 * platform's endpoints can be read off a real session rather than guessed.
 *
 *   START=https://www.okala.com/ node scripts/recon.mjs
 *
 * Every captured line contains whatever credentials the site sent. `probe-out/`
 * is git-ignored; strip tokens before sharing anything from it.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = path.join(ROOT, 'probe-out');
const PROFILE = path.join(ROOT, '.browser-profile', 'recon');
const START = (process.env.START || 'https://www.okala.com/').split(',');

fs.mkdirSync(OUT, { recursive: true });
const logPath = path.join(OUT, `net-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);
const log = fs.createWriteStream(logPath, { flags: 'a' });

const SKIP_EXT = /\.(png|jpe?g|gif|webp|svg|ico|css|woff2?|ttf|otf|mp4|m4s|avif)(\?|$)/i;
const SKIP_HOST =
  /(google-analytics|googletagmanager|doubleclick|yektanet|clarity\.ms|sentry|hotjar|metrix|webengage|smartlook|gstatic|facebook|mediaad|intrack|digiwiseid)/i;

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: null,
  locale: 'fa-IR',
  timezoneId: 'Asia/Tehran',
  args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
});

let n = 0;
ctx.on('response', async (res) => {
  const req = res.request();
  const url = req.url();
  if (SKIP_EXT.test(url) || SKIP_HOST.test(url) || !/^https?:/.test(url)) return;
  if (!['xhr', 'fetch', 'document'].includes(req.resourceType())) return;

  const entry = {
    i: ++n,
    t: new Date().toISOString(),
    method: req.method(),
    url,
    status: res.status(),
    reqHeaders: req.headers(),
    reqBody: (() => {
      try {
        return req.postData();
      } catch {
        return null;
      }
    })(),
  };
  try {
    if ((res.headers()['content-type'] || '').includes('json')) {
      const body = await res.text();
      entry.respBody = body.length > 300000 ? `${body.slice(0, 300000)}…[truncated]` : body;
    }
  } catch {
    /* body unavailable */
  }
  log.write(`${JSON.stringify(entry)}\n`);
  process.stdout.write(`[${entry.i}] ${entry.status} ${entry.method} ${url.slice(0, 130)}\n`);
});

for (const [index, target] of START.entries()) {
  const page = index === 0 ? (ctx.pages()[0] ?? (await ctx.newPage())) : await ctx.newPage();
  await page
    .goto(target.trim(), { waitUntil: 'domcontentloaded' })
    .catch((error) => console.error('goto failed', target, error.message));
}

console.error(`\n>>> recording to ${path.relative(ROOT, logPath)}`);
console.error('>>> sign in and browse. close the window when done.\n');

await new Promise((resolve) => ctx.on('close', resolve));
log.end();
