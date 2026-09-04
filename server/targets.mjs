/**
 * Where each `/api/*` prefix points, and the `Origin`/`Referer` the upstream
 * expects to see. Shared by the dev server and the production one so the two
 * cannot drift.
 */
export const PROXY_TARGETS = {
  '/api/snapp': { origin: 'https://svc.snapp.market', referer: 'https://snapp.market' },
  '/api/jet': { origin: 'https://api.digikalajet.ir', referer: 'https://www.digikalajet.com' },
};
