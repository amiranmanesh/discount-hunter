/**
 * Where each `/api/<platform>/*` path points, and the `Origin`/`Referer` the
 * upstream expects to see.
 *
 * This is the whole reason the app is a Next.js server rather than a static
 * bundle: none of the three platforms allows a cross-origin browser request —
 * Snapp Market echoes `Access-Control-Allow-Origin` only for
 * `https://snapp.market`, Digikala Jet sends none at all, and Okala answers the
 * preflight but omits the header from the response itself. So every call has to
 * leave from the app's own origin and be forwarded server-side, which is what
 * `app/api/[platform]/[...path]/route.ts` does with this table.
 */
export const PROXY_TARGETS = {
  snapp: { origin: 'https://svc.snapp.market', referer: 'https://snapp.market' },
  jet: { origin: 'https://api.digikalajet.ir', referer: 'https://www.digikalajet.com' },
  okala: { origin: 'https://apigateway.okala.com', referer: 'https://www.okala.com' },
} as const;

export type PlatformKey = keyof typeof PROXY_TARGETS;

export function isPlatform(value: string): value is PlatformKey {
  return Object.hasOwn(PROXY_TARGETS, value);
}
