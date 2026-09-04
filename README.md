<div align="center">
  <img src="public/icons/icon-128.png" width="88" height="88" alt="" />
  <h1>Discount Hunter · شکارچی تخفیف</h1>
  <p><strong>Find the deepest Snapp Market orange discount (<code>تخفیف نارنجی</code>) for a product across every store that delivers to you.</strong></p>
  <p>
    <strong>English</strong> · <a href="README.fa.md">فارسی</a>
  </p>
  <p>
    <a href="https://amiranmanesh.github.io/discount-hunter-extension">Website</a> ·
    <a href="https://github.com/amiranmanesh/discount-hunter-extension/wiki">Wiki</a> ·
    <a href="#install">Install</a> ·
    <a href="docs/ARCHITECTURE.md">Architecture</a> ·
    <a href="docs/api-notes.md">Endpoints</a> ·
    <a href="docs/PRIVACY.md">Privacy</a>
  </p>
  <p>
    <a href="https://github.com/amiranmanesh/discount-hunter-extension/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/amiranmanesh/discount-hunter-extension/actions/workflows/ci.yml/badge.svg" /></a>
    <a href="https://github.com/amiranmanesh/discount-hunter-extension/actions/workflows/pages.yml"><img alt="Pages" src="https://github.com/amiranmanesh/discount-hunter-extension/actions/workflows/pages.yml/badge.svg" /></a>
    <img alt="Manifest V3" src="https://img.shields.io/badge/manifest-v3-ff5f00" />
    <img alt="No runtime dependencies" src="https://img.shields.io/badge/runtime%20deps-none-16a34a" />
    <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-blue" /></a>
  </p>
</div>

<p align="center">
  <img src="docs/popup.png" width="380"
       alt="The extension popup listing ice-cream offers at 99% off, the Pro store with free delivery first." />
</p>
<p align="center"><sub>One search, 45 nearby stores, ordered by what you would actually pay.</sub></p>

---

Snapp Market's `تخفیف نارنجی` campaign runs across dozens of stores at once, and
the same product is discounted differently in each of them. Finding the best one
by hand means opening store after store. This extension does it in one search,
and orders the results so the store you should actually order from is first.

It is an independent, open-source project. It is **not** affiliated with,
endorsed by, or connected to Snapp or Digikala.

## What it does

|                                     |                                                                                                                                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Reads the whole shelf**           | Lists every store that delivers to your address and is running the campaign — about 45 in central Tehran — then reads each one's **full** campaign catalogue, not the ten-item preview the listing endpoint returns.                       |
| **Ranks the way you'd shop**        | Deepest discount (in 5% steps), then Snapp Market **Pro** stores, then cheapest delivery, then cheapest price. Two other orderings are one click away.                                                                                     |
| **Only prices you can pay**         | The campaign feed mixes in `new_user` offers — every 90-99% discount is one — that an established account cannot buy. Those are dropped outright, and the leading results are re-priced against the store's own shelf before you see them. |
| **Uses your prices**                | With a signed-in `snapp.market` tab open it borrows that session, so Pro delivery fees and the campaign line-up that applies to your account are the ones you see. Without one it mints an anonymous token, says so, and still works.      |
| **Name or product code**            | Type a product name with suggestions from Snapp Market's own autocomplete, or paste a product id to compare one exact SKU across stores.                                                                                                   |
| **Persian text that works**         | Arabic and Persian letter forms folded, digits normalised, and word-aware matching — searching `پفک مینو` does not return Domino ice cream.                                                                                                |
| **Digikala Jet as a second source** | Searches every Jet shop in range, converting Rial to Toman so the platforms compare. Off by default in 1.0.0.                                                                                                                              |
| **Opens the store**                 | Every result has a button that opens that store's page.                                                                                                                                                                                    |
| **Nothing phones home**             | Requests go to Snapp Market and Digikala Jet and nowhere else. No analytics, no server of ours, no runtime dependencies. See [docs/PRIVACY.md](docs/PRIVACY.md).                                                                           |

## Install

> **فارسی:** راهنمای کامل فارسی در [README.fa.md](README.fa.md) و در
> [صفحهٔ فارسی سایت](https://amiranmanesh.github.io/discount-hunter-extension/fa/) هست.

There is no compile step — the extension is plain ES modules the browser loads
directly.

```bash
git clone https://github.com/amiranmanesh/discount-hunter-extension.git
cd discount-hunter-extension
```

```
chrome://extensions  →  Developer mode  →  Load unpacked  →  the extension/ folder
```

### Which browsers

| Browser                                         | Package                                                 |
| ----------------------------------------------- | ------------------------------------------------------- |
| Chrome, Edge, Brave, Opera, Vivaldi, Arc (111+) | `…-chrome.zip` — one package for every Chromium browser |
| Firefox 121+, Firefox for Android               | `…-firefox.zip`                                         |
| Safari 16.4+ on macOS                           | built with `npm run build:safari`; needs Xcode          |

Only Chromium has been verified on a live session. What that means for the other
two, and how to build each: [docs/BROWSER-SUPPORT.md](docs/BROWSER-SUPPORT.md).

To build store-ready archives instead: `npm install && npm run package`, then
load or upload `release/discount-hunter-<version>-<target>.zip`.

### Set your delivery point

Every price and delivery fee depends on where you are.

- **Easy:** open `snapp.market` in a tab and sign in. Your saved addresses appear
  in the popup automatically; click the chip at the top to choose between them.
- **By hand:** click the chip and enter latitude and longitude. Right-clicking a
  point in Google Maps puts them on your clipboard.

## Using it

Type a product name — `پفک مینو`, `بستنی میهن` — and press **جستجو**. Any input
of four or more digits is treated as a product code and matched exactly.

| Control                       | Effect                                                                     |
| ----------------------------- | -------------------------------------------------------------------------- |
| **ترتیب**                     | Sort mode — see [docs/RANKING.md](docs/RANKING.md)                         |
| **فقط تخفیف کمپینی**          | On: campaign discounts only. Off (the default): the ordinary catalogue too |
| **فقط فروشگاه باز**           | Hide closed stores                                                         |
| **حداقل تخفیف**               | Drop anything under 20/30/50/70%                                           |
| **اسنپ‌مارکت / دیجی‌کالا جت** | Which platforms to query                                                   |

Each card shows the total with delivery and the store's minimum basket
(`حداقل سبد`) — the ranking does not account for the minimum, so check it before
celebrating a 500-Toman ice cream.

A worked example, searching `بستنی میهن`:

```
۹۹٪  ۵۰۰ تومان   دیلی مارکت سمنگان     ⚡ پرو · ارسال رایگان   → جمع ۵۰۰
۹۹٪  ۵۰۰ تومان   فروشگاه راکت سمنگان   ⚡ پرو · ارسال ۱٬۸۰۰    → جمع ۲٬۳۰۰
۹۹٪  ۵۰۰ تومان   سوپر.مارکت ونو        ⚡ پرو · ارسال ۲٬۰۰۰    → جمع ۲٬۵۰۰
```

Same discount bucket, all Pro, so the delivery fee decides.

## How it is built

```
extension/     the unpacked extension — loadable as-is, no build step
  src/api/     one client per platform; all network I/O lives here
  src/core/    hunt orchestration, ranking, de-duplication
  src/util/    Persian text matching, storage, bounded concurrency
  content/     session and delivery-point capture, one file per site
  popup/       the entire interface, RTL, follows the browser theme
scripts/       build, manifest, icons, and the driven-browser tools
tests/         Vitest over core/, util/ and the API clients
docs/          architecture, development, ranking, privacy, endpoint reference
site/          the GitHub Pages site
wiki/          the wiki pages, mirrored on merge
```

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains the design;
[docs/api-notes.md](docs/api-notes.md) documents every endpoint and payload shape,
captured from live traffic.

## Development

```bash
make install     # npm install + the Playwright browser
make verify      # what CI runs: format, lint, tests, build
make browser     # Chromium with the extension loaded and a signed-in session
make recon       # a browser that logs every API call to probe-out/
make help        # every target
```

Each `make` target wraps the matching npm script, so both work.
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) covers the driven-browser scripts,
capturing traffic and adding a platform.

Two things worth knowing before you start: Chrome caches extension resources per
profile (reload the extension card after editing, and note that every
driven-browser script deletes its profile for this reason), and the end-to-end
scripts hit the live API so they are deliberately not in CI.

## Contributing

Bug reports about endpoints that changed shape are the most useful thing you can
send — these are undocumented APIs and they move without notice. See
[CONTRIBUTING.md](CONTRIBUTING.md), and **strip the `authorization` header from
anything you paste**: that bearer token is your account.

## Licence

[MIT](LICENSE).
