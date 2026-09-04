# Development

## Requirements

- Node 22 (`.nvmrc`)
- Chrome, Edge, Brave or another Chromium browser
- `zip` and `unzip` on `PATH` for `npm run package` (both ship with macOS and
  most Linux distributions)

```bash
npm install
npx playwright install chromium   # only needed for the driven-browser scripts
```

`make install` does both.

> npm 10.9.x crashes while resolving Vitest 4's peer graph
> (`Cannot read properties of null (reading 'edgesOut')`). `.npmrc` sets
> `legacy-peer-deps=true` so plain `npm install` works; do not remove it without
> checking that a clean install still succeeds.

## Commands

| Command                 | What it does                                                    |
| ----------------------- | --------------------------------------------------------------- |
| `npm run build`         | `extension/` → `dist/chrome/` with a version-stamped manifest   |
| `npm run dev`           | the same, rebuilding on every change under `extension/`         |
| `npm run package`       | build and zip into `release/`, refusing a store-invalid archive |
| `npm run manifest`      | regenerate `extension/manifest.json`                            |
| `npm run icons`         | regenerate every icon, pure Node, byte-reproducible             |
| `npm test`              | Vitest over `core/`, `util/` and the API clients                |
| `npm run verify`        | what CI runs: format check, lint, tests, build                  |
| `npm run browser`       | Chromium with the extension loaded and a signed-in session      |
| `npm run browser:recon` | Chromium that logs every API call to `probe-out/`               |
| `npm run e2e`           | drive the popup against the live API, anonymous                 |
| `npm run shot`          | refresh `docs/popup.png`                                        |

`make <target>` wraps each of these; `make help` lists them.

## Loading the unpacked build

`extension/` is directly loadable — the manifest is committed and there is no
compile step:

```
chrome://extensions  →  Developer mode  →  Load unpacked  →  extension/
```

Use `dist/chrome` instead when you want to confirm exactly what ships.

After editing anything, press the reload button on the extension card. Chrome
caches extension resources per profile, which is also why every driven-browser
script deletes its profile before launching — without that you test yesterday's
code and spend an hour confused.

## The driven browser

`npm run browser` copies the signed-in profile from `.browser-profile/session`,
launches Chromium with the extension loaded, opens `snapp.market` so the content
script can hand over the token, then opens the popup in a second tab. It prints
the extension id, whether the session was captured and which address was picked,
and stays up until you close the window.

The first time, there is no signed-in profile to copy. Run `npm run browser:recon`,
sign in by hand, close the window, and copy the profile it made:

```bash
cp -R .browser-profile/recon .browser-profile/session
```

Both directories are git-ignored. They contain a live bearer token — treat them
like a password file.

## Capturing API traffic

`npm run browser:recon` writes one JSON object per request to
`probe-out/net-<timestamp>.jsonl`, skipping images, fonts and analytics. To read
it back:

```bash
# every distinct endpoint that was hit
jq -r '"\(.status) \(.method) \(.url)"' probe-out/net-*.jsonl | sed 's/?.*//' | sort -u

# one response body in full
jq -r 'select(.url|test("market-party")) | .respBody' probe-out/net-*.jsonl | head -1 | jq .
```

**Every captured line contains your `authorization` header.** `probe-out/` is
git-ignored; strip the header before pasting anything anywhere.

## Testing conventions

- Tests live in `tests/`, one file per module under test.
- `tests/setup.js` provides an in-memory `chrome.storage.local`; nothing else
  about the browser is stubbed.
- API clients are tested by mocking `fetch` with a table keyed by URL fragment
  (see `tests/snapp.test.js`), never by hitting the network.
- Anything that fixes a matching or ranking bug gets a test named after the bug.
  `tests/text.test.js` has the `دومینو`/`مینو` case as a worked example.
- End-to-end scripts hit the live API and are deliberately **not** in CI; run
  them by hand when changing the network layer.

## Adding a platform

1. Write `extension/src/api/<platform>.js` exporting a function that returns
   normalised offers — Toman, `finalPrice = price - discountAmount`, a `vendor`
   with `deliveryFee`/`isPro`/`isOpen`, `isCampaign` for the platform's headline
   discount, and a `url` that opens the store.
2. Add it to the `jobs` array in `core/hunt.js` behind a `sources` flag.
3. Add the checkbox to `popup/popup.html` and wire it in `popup/popup.js`.
4. Add the host pattern to `scripts/manifest.mjs`, then `npm run manifest`.
5. Record the endpoints and payload shapes in `docs/api-notes.md`.

Nothing in `core/rank.js` should need to change. If it does, the offer shape is
wrong.

## Releasing

1. Update `CHANGELOG.md` under a new version heading.
2. Bump `version` in `package.json`, then `npm run manifest`.
3. `npm run verify && npm run package` — or `make release-check`.
4. Commit, tag `vX.Y.Z`, push the tag. The release workflow verifies that the tag
   matches `package.json`, builds, attaches the archive to a GitHub release, and
   publishes to the Chrome Web Store only once the store secrets exist.
