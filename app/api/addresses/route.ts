/**
 * The address other devices on the network should use to reach this server.
 *
 * The Android shell runs the same standalone build on the phone, and the user
 * needs the phone's LAN URL to open the app from a laptop or another phone.
 * The WebView cannot read interfaces, so the server answers for it. Only RFC1918
 * / CGNAT ranges are reported and the reply is `no-store`: an address list that
 * was cached across a network change is worse than none.
 */
import os from 'node:os';
import { NextResponse, type NextRequest } from 'next/server';
import { allowedOrigins, corsHeaders, resolveOrigin } from '@/server/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isPrivate(v4: string): boolean {
  const p = v4.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return false;
  return (
    p[0] === 10 ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127)
  );
}

export async function GET(request: NextRequest) {
  const origin = resolveOrigin(request.headers.get('origin'), allowedOrigins());
  const port = process.env.PORT ?? '3000';
  const lan: string[] = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal && isPrivate(a.address)) {
        // Wi-Fi first where the name says anything; order is stable per boot.
        lan.push(`http://${a.address}:${port}/`);
        void name;
      }
    }
  }
  return NextResponse.json(
    { lan },
    { headers: { 'cache-control': 'no-store', ...corsHeaders(origin) } },
  );
}
