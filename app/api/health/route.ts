/**
 * Container health check. It reports on this process only — never on whether
 * Snapp Market happens to be up — so a restart loop can never be caused by an
 * upstream outage.
 *
 * The Android/iOS shell's picker page (origin `https://localhost` /
 * `capacitor://localhost`) probes this endpoint before entering the app, so
 * the shell origins are allowed here even with `ALLOWED_ORIGINS` unset. Only
 * this endpoint: it answers `{status:'ok'}` and nothing a session can spend.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { allowedOrigins, corsHeaders, resolveOrigin } from '@/server/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SHELL_ORIGINS = ['https://localhost', 'http://localhost', 'capacitor://localhost'];

export async function GET(request: NextRequest) {
  const origin = resolveOrigin(request.headers.get('origin'), [
    ...SHELL_ORIGINS,
    ...allowedOrigins(),
  ]);
  return NextResponse.json(
    { status: 'ok', version: process.env.APP_VERSION ?? null },
    { headers: { 'cache-control': 'no-store', ...corsHeaders(origin) } },
  );
}
