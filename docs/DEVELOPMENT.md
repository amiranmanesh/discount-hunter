# Development

## Requirements

Node 22 (`.nvmrc`). Nothing else.

```bash
npm install
npx playwright install chromium   # only for `npm run preview:ui`
```

> npm 10.9.x can crash resolving Vitest's peer graph
> (`Cannot read properties of null (reading 'edgesOut')`). `.npmrc` sets
> `legacy-peer-deps=true` so a plain `npm install` works.

## Commands

| Command              | What it does                                                  |
| -------------------- | ------------------------------------------------------------- |
| `npm run dev`        | Next.js dev server on :3000, app and `/api` proxy together    |
| `npm run build`      | typecheck, then the production build (`.next/`, standalone)   |
| `npm start`          | serve that build on :3000 — production, one process           |
| `npm run preview:ui` | render every route at phone and laptop size, fail on overflow |
| `npm test`           | Vitest over `core/` and `auth/`                               |
| `npm run typecheck`  | `tsc --noEmit`                                                |
| `npm run lint`       | ESLint                                                        |
| `npm run icons`      | regenerate the icon set, pure Node, byte-reproducible         |
| `npm run verify`     | what CI runs: format, lint, typecheck, test, build            |

## Why there is a server

All three shopping APIs refuse cross-origin browser requests, so the app cannot
be hosted as static files on a domain that is not also proxying them. See
[ARCHITECTURE.md](ARCHITECTURE.md) for the measurements. In practice:

- `npm run dev` and `npm start` both serve the app _and_
  `app/api/[platform]/[...path]/route.ts`, on one port.
- That handler reads `src/server/targets.ts`, so there is one table and nothing
  to keep in sync.
- Nothing is origin-specific, so the URL you develop on and the domain you deploy
  to need no configuration of their own.

Deploying means running `npm ci && npm run build && npm start` behind TLS, or the
published image. There is no database and no state on the server —
[DEPLOY.md](DEPLOY.md) has the details.

## Testing conventions

- Tests live in `tests/`, one file per module under test.
- `core/` and `auth/` are pure and are tested directly. Network clients are
  tested by mocking `fetch`, never by hitting the platforms.
- Anything that fixes a matching or ranking bug gets a test named after the bug.
  `tests/text.test.ts` has the `دومینو`/`مینو` case as a worked example.
- `npm run preview:ui` is a smoke check, not an assertion suite: it renders the
  real app against the live APIs, so it stays out of CI.

## Adding a platform

1. Write `src/api/<platform>.ts` returning normalised `Offer`s — Toman,
   `finalPrice = price - discountAmount`, a `vendor` with
   `deliveryFee`/`isPro`/`isOpen`, and a `url` that opens the store.
2. Add its key and upstream to `src/server/targets.ts`.
3. Add it to `core/deals.ts` and `core/hunt.ts` behind a `sources` flag.
4. Add it to `PLATFORMS` in `src/store/auth.ts` if it needs a sign-in.
5. Record the endpoints in [API.md](API.md).

Nothing in `core/rank.ts` should need to change. If it does, the offer shape is
wrong.
