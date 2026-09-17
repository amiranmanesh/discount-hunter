/**
 * The pass-through proxy, and the reason this app is served rather than shipped
 * as static files.
 *
 * Neither Snapp Market, Digikala Jet nor Okala lets a browser on another origin
 * read their answers, whatever the client code does (see `src/server/targets`).
 * A request that leaves from here is not a browser request at all, so no
 * cross-origin rule applies to it, and the app works from any domain it happens
 * to be deployed on — that is the entire trick.
 *
 * Nothing is kept. The request is forwarded with the `Origin`/`Referer` the
 * upstream expects, and the answer is streamed straight back. The user's token
 * rides in the `Authorization` header their own browser attached; it is neither
 * read, logged nor stored on this side.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { PROXY_TARGETS, isPlatform } from '@/server/targets';
import { allowedOrigins, corsHeaders, resolveOrigin } from '@/server/cors';

// Every answer is account-specific and priced by the hour: never prerender,
// never cache, and run on Node rather than the edge.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * Headers worth passing upstream. Hop-by-hop and identifying ones are dropped.
 * Okala's gateway also expects its own `x-*` trio — a per-device id, a
 * per-request correlation id, and the flag that marks a call as needing no
 * token — so `x-` headers the client sets are forwarded as well.
 */
const FORWARDED_REQUEST_HEADERS = ['authorization', 'content-type', 'accept', 'accept-language'];
const FORWARDED_HEADER_PREFIX = 'x-';

function upstreamHeaders(request: NextRequest, referer: string): Headers {
  const headers = new Headers({
    'user-agent': 'discount-hunter',
    origin: referer,
    referer: `${referer}/`,
  });
  request.headers.forEach((value, name) => {
    const allowed =
      FORWARDED_REQUEST_HEADERS.includes(name) || name.startsWith(FORWARDED_HEADER_PREFIX);
    // `x-forwarded-*` describes our own hop and means nothing upstream.
    if (allowed && !name.startsWith('x-forwarded-')) headers.set(name, value);
  });
  return headers;
}

async function forward(request: NextRequest, platform: string): Promise<Response> {
  const origin = resolveOrigin(request.headers.get('origin'), allowedOrigins());

  if (!isPlatform(platform)) {
    return NextResponse.json(
      { message: `سرویس ناشناخته: ${platform}` },
      { status: 404, headers: corsHeaders(origin) },
    );
  }

  const target = PROXY_TARGETS[platform];
  // Taken from the raw path rather than the route params so an upstream path
  // that carries encoded characters is forwarded exactly as it arrived.
  const suffix = request.nextUrl.pathname.slice(`/api/${platform}`.length);
  const upstreamUrl = `${target.origin}${suffix}${request.nextUrl.search}`;

  const body =
    request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();

  try {
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers: upstreamHeaders(request, target.referer),
      body,
      cache: 'no-store',
      redirect: 'follow',
    });

    const retryAfter = upstream.headers.get('retry-after');
    return new NextResponse(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'application/json',
        'cache-control': 'no-store',
        ...(retryAfter ? { 'retry-after': retryAfter } : {}),
        ...corsHeaders(origin),
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { message: `دسترسی به سرویس ممکن نشد: ${reason}` },
      { status: 502, headers: { 'cache-control': 'no-store', ...corsHeaders(origin) } },
    );
  }
}

type Context = { params: Promise<{ platform: string }> };

export async function GET(request: NextRequest, context: Context) {
  return forward(request, (await context.params).platform);
}

export async function POST(request: NextRequest, context: Context) {
  return forward(request, (await context.params).platform);
}

export async function PUT(request: NextRequest, context: Context) {
  return forward(request, (await context.params).platform);
}

/** Asked before every non-simple request, but only by a cross-origin caller. */
export async function OPTIONS(request: NextRequest) {
  const origin = resolveOrigin(request.headers.get('origin'), allowedOrigins());
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}
