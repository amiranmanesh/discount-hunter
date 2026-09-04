#!/usr/bin/env node
/**
 * Serves the built app and proxies the two shopping APIs from the same origin.
 *
 * This is not an optional nicety. Neither platform allows a cross-origin browser
 * request: Snapp Market echoes `Access-Control-Allow-Origin` only for
 * `https://snapp.market`, and Digikala Jet sends no such header at all — so a
 * page on any other origin cannot read their responses, whatever the code does.
 * Serving the app together with a pass-through proxy makes every call
 * same-origin, and is why the app is a served PWA rather than a static bundle.
 *
 * The proxy keeps nothing. It forwards the request, sets the `Origin`/`Referer`
 * the upstream expects, and streams the answer back. The user's token rides in
 * the `Authorization` header they attached, and is neither read nor stored here.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROXY_TARGETS } from './targets.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

/**
 * Headers worth passing upstream. Hop-by-hop and identifying ones are dropped.
 * Okala's gateway also expects its own `x-*` trio — a per-device id, a
 * per-request correlation id, and the flag that marks a call as needing no
 * token — so `x-` headers the client sets are forwarded as well.
 */
const FORWARDED_REQUEST_HEADERS = ['authorization', 'content-type', 'accept', 'accept-language'];
const FORWARDED_HEADER_PREFIX = 'x-';

async function proxy(req, res, prefix, target) {
  const upstreamUrl = `${target.origin}${req.url.slice(prefix.length)}`;

  const headers = {
    'user-agent': 'discount-hunter',
    origin: target.referer,
    referer: `${target.referer}/`,
  };
  for (const [name, value] of Object.entries(req.headers)) {
    if (FORWARDED_REQUEST_HEADERS.includes(name) || name.startsWith(FORWARDED_HEADER_PREFIX)) {
      // `x-forwarded-*` describes our own hop and means nothing upstream.
      if (name.startsWith('x-forwarded-')) continue;
      headers[name] = value;
    }
  }

  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    body = Buffer.concat(chunks);
  }

  try {
    const upstream = await fetch(upstreamUrl, { method: req.method, headers, body });
    const payload = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
      ...(upstream.headers.get('retry-after')
        ? { 'retry-after': upstream.headers.get('retry-after') }
        : {}),
    });
    res.end(payload);
  } catch (error) {
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ message: `دسترسی به سرویس ممکن نشد: ${error.message}` }));
  }
}

function serveFile(res, file, { immutable = false } = {}) {
  res.writeHead(200, {
    'content-type': MIME[path.extname(file)] ?? 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  // Container health check: no upstream calls, so it stays honest about this
  // process rather than about Snapp Market being up.
  if (req.url === '/healthz') {
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    return res.end(JSON.stringify({ status: 'ok', build: existsSync(DIST) }));
  }

  const prefix = Object.keys(PROXY_TARGETS).find((candidate) => req.url.startsWith(candidate));
  if (prefix) return proxy(req, res, prefix, PROXY_TARGETS[prefix]);

  if (!existsSync(DIST)) {
    res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('dist/ is missing — run `npm run build` first.\n');
  }

  const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const candidate = path.join(DIST, requested);
  // Never serve outside dist/, whatever the path claims.
  if (candidate.startsWith(DIST) && existsSync(candidate) && statSync(candidate).isFile()) {
    return serveFile(res, candidate, { immutable: requested.startsWith('/assets/') });
  }

  // Anything else is a client route: hand back the shell.
  const shell = path.join(DIST, 'index.html');
  if (!existsSync(shell)) {
    res.writeHead(404).end();
    return;
  }
  const html = await readFile(shell);
  res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-cache' });
  res.end(html);
});

server.listen(PORT, HOST, () => {
  console.log(`شکارچی تخفیف → http://localhost:${PORT}`);
});
