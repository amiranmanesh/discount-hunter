# Browser support

One source tree, three packages. The engines differ in exactly two places, both
handled by the build.

| Browser                                         | Package                                                 | Verified                                        |
| ----------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| Chrome, Edge, Brave, Opera, Vivaldi, Arc (111+) | `…-chrome.zip` — one package for every Chromium browser | Yes, on Chrome for Testing 151                  |
| Firefox 121+, Firefox for Android               | `…-firefox.zip`                                         | **Not yet** — builds and lints, but no live run |
| Safari 16.4+ on macOS                           | built from the same source with `npm run build:safari`  | **Not yet** — needs Xcode                       |

Chromium browsers do not need separate builds, only separate store listings.

## What differs between the packages

**The background.** Chrome runs it as a module service worker and loads the
`src/` tree directly. Firefox runs it as an event page, and its support for
module background scripts is too recent to depend on — so `scripts/build.mjs`
bundles the worker into a single classic script for that target with esbuild.
Everything else, content scripts and popup included, is byte-identical.

**The metadata.** Chrome gets `minimum_chrome_version`; Firefox gets
`browser_specific_settings.gecko` with a stable add-on id, `strict_min_version`,
an Android entry, and the `data_collection_permissions` declaration AMO requires.
Both come out of `scripts/manifest.mjs`, which is the single source of truth.

## Building each one

```bash
npm run build            # dist/chrome and dist/firefox
npm run build:chrome
npm run build:firefox
npm run package          # both, zipped into release/
npm run build:safari     # macOS + Xcode: generates safari/
```

`npm run package` refuses an archive a store would reject — manifest not at the
root, or dotfiles inside.

## Firefox

The package installs from `about:debugging` → **This Firefox** → **Load Temporary
Add-on** → pick `dist/firefox/manifest.json`. A permanent install needs a signed
build; the release workflow signs one through `web-ext sign` once
`AMO_JWT_ISSUER` and `AMO_JWT_SECRET` exist.

CI runs `web-ext lint` on every push, advisory only — AMO's linter is stricter
than its own review bar and its warnings change between releases.

Nothing has been exercised on Gecko yet. The manifest is right and the bundle
loads in principle, but until someone runs a search in Firefox and reports back,
treat it as untested. The two things most likely to need work are the popup's
`chrome.*` calls (Firefox provides them, but promisified differently in places)
and the content scripts' `localStorage` access on `snapp.market`.

## Safari

Safari cannot install a zip: an extension has to be embedded in a macOS app and
shipped through the App Store. `npm run build:safari` runs Apple's
`safari-web-extension-converter` over `dist/chrome`, producing an Xcode project
under `safari/` — a build artifact, regenerated on demand and kept out of git.

```bash
npm run build && npm run build:safari
node scripts/safari.mjs --build    # compile, unsigned
node scripts/safari.mjs --open     # open in Xcode
```

Publishing needs an Apple Developer Program membership. Safari also enforces its
own host-permission prompt, so the first search will ask for access to
`snapp.market` and `digikalajet.com`.
