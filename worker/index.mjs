/**
 * The proxy, as a Cloudflare Worker.
 *
 * A static host cannot call the three shopping APIs: none of them sends
 * `Access-Control-Allow-Origin` on a real response for anyone but its own site,
 * so the browser refuses to hand the answer to a page on another origin. This is
 * the smallest thing that fixes it — the same pass-through `server/index.mjs`
 * does, deployed somewhere a static site can reach.
 *
 * Two ways to point the app at it:
 *
 *   Same origin   Route `https://yourdomain/api/*` to this Worker and serve the
 *                 rest from Pages. No CORS involved at all; leave
 *                 `ALLOWED_ORIGINS` empty.
 *   Its own origin  Deploy to `*.workers.dev` and build the app with
 *                 `VITE_API_BASE=https://…/api`. Then `ALLOWED_ORIGINS` has to
 *                 list the app's origin, and only that.
 *
 * It stores nothing and logs nothing. The user's token rides in the header they
 * attached and is forwarded untouched — which is exactly why this should be your
 * Worker and not somebody else's.
 */
import { PROXY_TARGETS } from './targets.mjs';

const FORWARDED_REQUEST_HEADERS = ['authorization', 'content-type', 'accept', 'accept-language'];

/** `x-forwarded-*` describes our own hop and means nothing upstream. */
const isForwardable = (name) =>
  FORWARDED_REQUEST_HEADERS.includes(name) ||
  (name.startsWith('x-') && !name.startsWith('x-forwarded-'));

function allowedOrigin(request, env) {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  const allowed = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  // No list means same-origin routing, where CORS never comes up.
  if (!allowed.length) return null;
  return allowed.includes(origin) ? origin : null;
}

function corsHeaders(origin) {
  if (!origin) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': '*',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = allowedOrigin(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === '/healthz') {
      return Response.json({ status: 'ok' }, { headers: corsHeaders(origin) });
    }

    const prefix = Object.keys(PROXY_TARGETS).find((candidate) =>
      url.pathname.startsWith(candidate),
    );
    if (!prefix) {
      return Response.json(
        { message: 'مسیر ناشناخته' },
        { status: 404, headers: corsHeaders(origin) },
      );
    }

    const target = PROXY_TARGETS[prefix];
    const upstream = new URL(target.origin);
    upstream.pathname = url.pathname.slice(prefix.length);
    upstream.search = url.search;

    const headers = new Headers({
      'user-agent': 'discount-hunter',
      origin: target.referer,
      referer: `${target.referer}/`,
    });
    for (const [name, value] of request.headers) {
      if (isForwardable(name)) headers.set(name, value);
    }

    try {
      const response = await fetch(upstream, {
        method: request.method,
        headers,
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      });

      const out = new Headers({
        'content-type': response.headers.get('content-type') ?? 'application/json',
        'cache-control': 'no-store',
        ...corsHeaders(origin),
      });
      const retryAfter = response.headers.get('retry-after');
      if (retryAfter) out.set('retry-after', retryAfter);

      return new Response(response.body, { status: response.status, headers: out });
    } catch (error) {
      return Response.json(
        { message: `دسترسی به سرویس ممکن نشد: ${error.message}` },
        { status: 502, headers: corsHeaders(origin) },
      );
    }
  },
};
