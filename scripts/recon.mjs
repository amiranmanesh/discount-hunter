// Network recon harness: opens a real Chromium with a persistent profile,
// records every non-static request/response to a JSONL log for later analysis.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT_DIR = process.env.OUT_DIR || path.join(ROOT, 'probe-out');
const PROFILE = process.env.PROFILE_DIR || path.join(ROOT, '.browser-profile', 'recon');
const START_URLS = (
  process.env.START_URLS || 'https://snapp.market/,https://www.digikalajet.com/'
).split(',');

fs.mkdirSync(OUT_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const logPath = path.join(OUT_DIR, `net-${stamp}.jsonl`);
const log = fs.createWriteStream(logPath, { flags: 'a' });

const SKIP_EXT = /\.(png|jpe?g|gif|webp|svg|ico|css|woff2?|ttf|otf|mp4|m4s|avif)(\?|$)/i;
const SKIP_HOST =
  /(google-analytics|googletagmanager|doubleclick|yektanet|clarity\.ms|sentry\.io|hotjar|metrix|webengage|smartlook|gstatic|facebook)/i;

function interesting(url) {
  if (SKIP_EXT.test(url)) return false;
  if (SKIP_HOST.test(url)) return false;
  return /^https?:/.test(url);
}

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
  if (!interesting(url)) return;
  const rt = req.resourceType();
  if (!['xhr', 'fetch', 'document', 'other'].includes(rt)) return;

  const entry = {
    i: ++n,
    t: new Date().toISOString(),
    method: req.method(),
    url,
    status: res.status(),
    resourceType: rt,
    reqHeaders: req.headers(),
    reqBody: (() => {
      try {
        return req.postData();
      } catch {
        return null;
      }
    })(),
    respHeaders: res.headers(),
  };
  try {
    const ct = res.headers()['content-type'] || '';
    if (ct.includes('json')) {
      const body = await res.text();
      entry.respBody = body.length > 200000 ? body.slice(0, 200000) + '…[truncated]' : body;
    }
  } catch {
    /* body unavailable (redirect/aborted) */
  }
  log.write(JSON.stringify(entry) + '\n');
  process.stdout.write(`[${entry.i}] ${entry.status} ${entry.method} ${url.slice(0, 140)}\n`);
});

for (const [idx, u] of START_URLS.entries()) {
  const page = idx === 0 ? ctx.pages()[0] || (await ctx.newPage()) : await ctx.newPage();
  await page
    .goto(u.trim(), { waitUntil: 'domcontentloaded' })
    .catch((e) => console.error('goto fail', u, e.message));
}

console.error(`\n>>> logging to ${logPath}`);
console.error('>>> log in and browse. close the browser window when done.\n');

await new Promise((resolve) => ctx.on('close', resolve));
log.end();
