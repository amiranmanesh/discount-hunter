/**
 * Where each `/api/*` prefix points, the `Origin`/`Referer` the upstream expects
 * to see, and any header the client needs passed through beyond the defaults.
 * Shared by the dev server and the production one so the two cannot drift.
 */
export const PROXY_TARGETS = {
  '/api/snapp': { origin: 'https://svc.snapp.market', referer: 'https://snapp.market' },
  '/api/jet': { origin: 'https://api.digikalajet.ir', referer: 'https://www.digikalajet.com' },
  '/api/okala': { origin: 'https://apigateway.okala.com', referer: 'https://www.okala.com' },
};
