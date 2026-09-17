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
npm run dev          # Next.js on :3000, app and /api proxy together
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
src/routes/     the component behind each tab
src/server/     the proxy target table and the CORS rules
app/            the App Router: the shell, one folder per tab
app/api/        the pass-through proxy and the health check
tests/          Vitest over core/ and auth/
docs/           architecture, endpoints, privacy, development, deploy
wiki/           these pages, mirrored on merge
```

Next.js 16 (App Router, standalone output), React 19, TypeScript, TanStack Query,
zustand, and a hand-written service worker. No UI framework — around 700 lines of
CSS with design tokens.

## Two things that will trip you up

**There is a server because there has to be.** None of the three shopping APIs
allows a cross-origin browser request, so the app renders the page and answers
`/api/<platform>/*` from one process, over one table
(`src/server/targets.ts`). A static host cannot run this app — and because the
two are always the same origin, nothing has to be configured per domain.

**The end-to-end checks hit the live APIs** and are deliberately not in CI.
`npm run preview:ui` renders the real thing and fails if the page scrolls
horizontally; run it after touching layout.

## Releasing

Bump `version` in `package.json` and push to `main`. The workflow verifies,
builds and publishes the image to GHCR, then tags `vX.Y.Z`, attaches the
standalone bundle and cuts the release. Push without bumping and only `latest` and the sha tag
move.

## Adding a platform

A new client in `src/api/` returning normalised offers, its key in
`src/server/targets.ts`, an entry in `core/deals.ts` and `core/hunt.ts`, and a
section in `docs/API.md`. Nothing in `core/rank.ts` should need to change — if it
does, the offer shape is wrong.
