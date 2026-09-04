# Contributing

Thanks for helping. The most valuable contributions are reports that an endpoint
changed shape — these are undocumented APIs and they move without notice — and
the parser fixes that follow.

## Reporting a broken endpoint

Open the browser's network panel while the app misbehaves, find the failing
`/api/snapp/...` or `/api/jet/...` call, and open an issue with the endpoint, the
new payload shape and what the app expected. **Strip the `Authorization` header
before pasting anything** — that token is your account.

[`docs/API.md`](docs/API.md) is the record of what every endpoint returns. Update
it in the same pull request as the fix.

## Working on the code

```bash
npm install
npm run dev        # Vite on :5173, with the /api proxy
npm run verify     # what CI runs: format, lint, typecheck, tests, build
npm run preview:ui # render every route at phone and laptop size
```

[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) covers the commands and how to add a
platform; [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains why there is a
server at all.

## Ground rules

- **Keep the dependency list short.** Everything here ships to a phone over a
  mobile connection.
- **The network layer stays in `src/api/`.** Ranking, matching and the feed must
  not know which platform an offer came from.
- **Every offer normalises to the same shape** — Toman,
  `finalPrice = price - discountAmount`, a `vendor` with
  `deliveryFee`/`isPro`/`isOpen`. A platform that quotes Rial converts in its own
  client, never downstream.
- **Never show a price the account cannot pay.** The three rules in the README
  are not negotiable; if a change makes one of them harder to keep, it is the
  wrong change.
- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `build:`,
  `ci:`), one logical change per commit.
- Add or update tests for anything in `src/core/` or `src/auth/`.
