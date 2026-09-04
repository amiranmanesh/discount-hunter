# Contributing

Thanks for helping. The most valuable contributions are reports that an endpoint
changed shape — these are undocumented APIs and they move without notice — and
the parser fixes that follow.

## Reporting a broken endpoint

1. Run `npm run browser:recon`. It opens a real Chromium and writes every API
   request and response to `probe-out/net-*.jsonl`.
2. Reproduce the flow that broke (search, open a store, whatever it was).
3. Find the relevant lines: `jq -r 'select(.url|test("market-party")) | .url' probe-out/net-*.jsonl`
4. Open an issue with the endpoint, the new payload shape and what the extension
   expected. **Strip the `authorization` header before pasting anything** — that
   bearer token is your account.

`docs/api-notes.md` is the record of what every endpoint returns. Update it in
the same pull request as the fix.

## Working on the code

```bash
npm install
npm run browser    # Chromium with the extension loaded and a signed-in session
npm run verify     # what CI runs: format, lint, tests, build
```

`docs/DEVELOPMENT.md` covers loading the unpacked build, the driven-browser
scripts and how to add a platform.

## Ground rules

- **No runtime dependencies.** Everything ships to users' browsers; keep it
  auditable. Dev dependencies are fine.
- **No new permissions** without a discussion first. Four permissions and two
  host patterns is a budget, not an accident.
- **The network layer stays in `extension/src/api/`.** Ranking and matching must
  not know which platform an offer came from.
- **Every offer normalises to the same shape** — Toman, `finalPrice = price - discountAmount`,
  a `vendor` with `deliveryFee`/`isPro`/`isOpen`. A platform that reports Rial
  converts in its own client, never downstream.
- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `build:`,
  `ci:`), one logical change per commit.
- Add or update tests for anything in `extension/src/`.

## Adding a platform

See `docs/ARCHITECTURE.md`. In short: a new file in `extension/src/api/` that
exports a function returning normalised offers, one entry in `hunt.js`, one
checkbox in the popup, and a section in `docs/api-notes.md` recording the payload
shapes you observed.
