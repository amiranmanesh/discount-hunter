/**
 * Container health check. It reports on this process only — never on whether
 * Snapp Market happens to be up — so a restart loop can never be caused by an
 * upstream outage.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { allowedOrigins, corsHeaders, resolveOrigin } from '@/server/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const origin = resolveOrigin(request.headers.get('origin'), allowedOrigins());
  return NextResponse.json(
    { status: 'ok', version: process.env.APP_VERSION ?? null },
    { headers: { 'cache-control': 'no-store', ...corsHeaders(origin) } },
  );
}
