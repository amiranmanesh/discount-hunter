# Development

Full guide in the repository:
**[`docs/DEVELOPMENT.md`](https://github.com/amiranmanesh/discount-hunter/blob/main/docs/DEVELOPMENT.md)**
· architecture:
**[`docs/ARCHITECTURE.md`](https://github.com/amiranmanesh/discount-hunter/blob/main/docs/ARCHITECTURE.md)**
· deploying:
**[`docs/DEPLOY.md`](https://github.com/amiranmanesh/discount-hunter/blob/main/docs/DEPLOY.md)**

## Quick start

```bash
git clone https://github.com/amiranmanesh/discount-hunter.git
cd discount-hunter
npm install
npm run dev          # Vite on :5173, with the /api proxy
npm run verify       # format, lint, typecheck, tests, build
npm run preview:ui   # render every route at phone and laptop size
```

Node 22.

## Layout

```
src/api/        one client per platform; everything that touches the network
src/core/       the feed, the search, ranking, Persian matching — all pure
src/auth/       sessions, OTP rate limiting, phone normalisation
src/store/      persisted settings and sessions, and the sign-in flow
src/routes/     one file per tab
server/         the production server and the shared proxy table
tests/          Vitest over core/ and auth/
docs/           architecture, endpoints, privacy, development, deploy
wiki/           these pages, mirrored on merge
```

React 19, Vite 8, TypeScript, TanStack Query, zustand, `vite-plugin-pwa`. No UI
framework — around 700 lines of CSS with design tokens.

## Two things that will trip you up

**There is a server because there has to be.** Neither shopping API allows a
cross-origin browser request, so `npm run dev` and `npm start` both proxy `/api/*`
from the same table (`server/targets.mjs`). A static host cannot run this app.

**The end-to-end checks hit the live APIs** and are deliberately not in CI.
`npm run preview:ui` renders the real thing and fails if the page scrolls
horizontally; run it after touching layout.

## Releasing

Bump `version` in `package.json` and push to `main`. The workflow verifies,
builds and publishes the image to GHCR, then tags `vX.Y.Z`, attaches a tarball
and cuts the release. Push without bumping and only `latest` and the sha tag
move.

## Adding a platform

A new client in `src/api/` returning normalised offers, its prefix in
`server/targets.mjs`, an entry in `core/deals.ts` and `core/hunt.ts`, and a
section in `docs/API.md`. Nothing in `core/rank.ts` should need to change — if it
does, the offer shape is wrong.
