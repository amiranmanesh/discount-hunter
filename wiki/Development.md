# Development

Full guide in the repository:
**[`docs/DEVELOPMENT.md`](https://github.com/amiranmanesh/discount-hunter-extension/blob/main/docs/DEVELOPMENT.md)**
· architecture:
**[`docs/ARCHITECTURE.md`](https://github.com/amiranmanesh/discount-hunter-extension/blob/main/docs/ARCHITECTURE.md)**

## Quick start

```bash
git clone https://github.com/amiranmanesh/discount-hunter-extension.git
cd discount-hunter-extension
make install        # npm install + playwright chromium
make verify         # format, lint, tests, build
make browser        # Chromium with the extension loaded and a signed-in session
```

`make help` lists every target.

## Layout

```
extension/     the unpacked extension — loadable as-is, no build step
  src/api/     one client per platform; all I/O lives here
  src/core/    hunt orchestration, ranking, de-duplication
  src/util/    Persian text matching, storage, concurrency
scripts/       build, manifest, icons, and the driven-browser tools
tests/         Vitest over core/, util/ and the API clients
docs/          architecture, development, ranking, privacy, endpoint reference
site/          the GitHub Pages site
wiki/          these pages, mirrored on merge by .github/workflows/wiki.yml
```

## Two things that will trip you up

**Chrome caches extension resources per profile.** Edit a file, reload the page,
see no change — press reload on the extension card. Every driven-browser script
deletes its profile before launching for this reason.

**The end-to-end scripts hit the live API** and are deliberately not in CI. Run
them by hand when you touch the network layer:

```bash
npm run e2e                 # anonymous, clean profile
Q='بستنی میهن' npm run e2e   # with a specific query
```

## Adding a platform

A new file in `extension/src/api/` returning normalised offers, one entry in
`core/hunt.js`, one checkbox in the popup, one host pattern in
`scripts/manifest.mjs`, and a section in `docs/api-notes.md`. Nothing in
`core/rank.js` should need to change — if it does, the offer shape is wrong.
