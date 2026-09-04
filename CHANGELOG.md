# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] — 2026-09-04

The browser extension is now an installable web app.

### Changed

- **It is a PWA, not an extension.** React 19, Vite 8 and TypeScript, installable
  to a phone's home screen, responsive from 390px to a laptop. The extension, its
  three browser packages and all of its tooling are gone.
- **It ships with a server.** Neither platform allows a cross-origin browser
  request — Snapp Market echoes `Access-Control-Allow-Origin` only for
  `https://snapp.market`, Digikala Jet sends none at all — so the app is served
  together with a pass-through proxy on its own origin. The proxy keeps nothing,
  but it is on the path; `docs/PRIVACY.md` is explicit about what that means and
  why you should host it yourself.

### Added

- **A discount feed.** The new home tab lists every campaign offer in range from
  both platforms, deepest discount first, endlessly scrollable, with no query to
  type. Pages are merged and re-sorted as a whole so the order holds as the list
  grows.
- **Bottom navigation** — four tabs on a phone, which become a top bar on a
  laptop rather than stealing a strip of screen.
- **Location from the device.** A web app can ask for GPS, which an extension
  popup could not; coordinates can still be typed, and Jet's saved addresses are
  offered when that account is linked.

### Kept

Everything that made the results trustworthy: the first-order shelf is still
never read, search results are still confirmed against the store's own shelf
before they are shown, there is still no guest mode, and the OTP flows still sit
behind the same rate-limit budget.

## [Unreleased]

### Added

- **A Docker image and a release pipeline.** `ghcr.io/amiranmanesh/discount-hunter`
  is published for amd64 and arm64 on every push to `main`, tagged `latest`, the
  package.json version and the commit sha. A version that has never been released
  is also tagged, bundled and turned into a GitHub release — so shipping is a
  version bump, nothing more.
- `GET /healthz`, answered without touching either upstream, so a container
  health check reports on this process rather than on Snapp Market.
- `compose.yaml` and [`docs/DEPLOY.md`](docs/DEPLOY.md) for self-hosting.

  The runtime image carries no `node_modules`: the server uses only Node
  built-ins, so it is the bundle, the server and a Node base image.

### Changed

- **The content scripts no longer read tokens.** They copy the delivery point and
  the saved addresses, and nothing else.
- **The first-order shelf is never read.** `personalizedProducts` — the
  "ویژه خرید اول" list — is no longer fetched into the offer pool at all, only
  counted so the popup can say what it left out. Filtering it after the fact was
  not enough; the whole bucket is off limits.
- **Every Snapp result is confirmed against the store's own shelf before it is
  shown.** An offer the shelf does not list, or that was never checked, is
  dropped instead of displayed on the campaign feed's word. The status line now
  breaks results down per platform, and the notes say how many were dropped and
  why.
- **New-user offers are gone, not optional.** The `تخفیف کاربر جدید` filter has
  been removed along with the setting behind it: an established account cannot
  buy at those prices, so there is no case where showing them is right. They are
  counted in the popup's notes and never listed.
- **The ordinary catalogue is searched by default.** A product that is not in
  today's campaign now comes back with the real price every nearby store charges
  for it, instead of an empty result. `فقط تخفیف کمپینی` still narrows it to
  campaign rows.

### Added

- **Sign in from the extension, per platform.** Phone number and SMS code, one
  panel per platform, no more borrowing the website's token. Snapp Market goes
  through `loginMobileWithNoPass` / `loginMobileWithToken`, Digikala Jet through
  `login-register` / `confirm-phone`; both payloads were captured from a real
  login rather than guessed.

  This is what fixes the constant "sign in again". The site's token lives about
  an hour and came with no way to renew it. Logging in ourselves means holding
  the refresh token, so the session renews before a request instead of failing
  after one — Snapp's through `grant_type: refresh_token`, Jet's on a token good
  for a day with a ninety-day refresh behind it.

  Snapp Market is the only account the search needs; Jet's search takes no token,
  so signing in there only adds that account's saved addresses. The accounts
  panel stays reachable from the header after the gate closes, so the second
  account can be linked, or either signed out, at any time.

  Both flows sit behind one rate-limit budget per platform: a two-minute resend
  cooldown with a live countdown, five codes per fifteen minutes, five attempts
  per code, and a server `Retry-After` honoured in either form and never
  shortened. A rejected request still counts — it is one SMS against the number.

- **Firefox and Safari packages.** One source tree, three targets:
  `npm run build` produces `dist/chrome` and `dist/firefox`, and
  `npm run build:safari` wraps the Chromium package in an Xcode project with
  Apple's converter. Firefox runs the background as an event page from a bundled
  classic script, because its support for module background scripts is too recent
  to depend on; everything else is byte-identical. CI runs `web-ext lint` and the
  release workflow can sign through AMO. Only Chromium has been verified on a
  live session — see `docs/BROWSER-SUPPORT.md`.

- **Digikala Jet saved addresses.** They appear in the location picker beside the
  Snapp Market ones, labelled by platform. Jet is queried by default again.

## [1.0.1] — 2026-09-04

### Fixed

- **Prices that did not exist in the store.** The campaign feed's
  `personalizedProducts` bucket mixes ordinary offers with segmented ones, and
  every 90-99% discount in it is `segment: new_user`. Those prices are not
  purchasable by an established account, so the extension was reporting a
  Coca-Cola Zero at 39,072 Toman that the store actually lists at 112,332.
  Segmented offers are now excluded by default, labelled `تخفیف کاربر جدید` when
  the new **تخفیف کاربر جدید** filter turns them back on, and the popup says how
  many were skipped.
- **Silent downgrade to an anonymous session.** The content script only looked
  for the token in the persisted redux slice, which is empty for part of the
  session's life — the current site build keeps it under a bare `JWT` key. It now
  scans every `localStorage` entry, accepts only a live, account-bound JWT, and
  reports the signed-out state instead of letting the extension quietly fall back
  to anonymous pricing (which is served the new-user campaign, the very offers
  above).

### Added

- **Verification against the store's own shelf.** The leading offers are
  re-priced through `/mobile/v2/product-variation/search`, the endpoint the store
  page itself calls. The store's price wins, offers the store does not list are
  dropped, and a verified row is marked `✓ قیمت از خود فروشگاه`.
- `npm run verify-offer` — a ground-truth tool that runs one query the way the
  extension does, then opens the winning store and compares.

## [1.0.0] — 2026-09-04

First working release.

### Added

- **Snapp Market orange-discount hunt.** Lists every supermarket that delivers to
  your address, reads each one's full `تخفیف نارنجی` shelf, and matches your
  product against all of them. The listing endpoint only previews ten items per
  store, so each shelf is fetched separately.
- **Ranking** by discount depth (bucketed to 5%), then Snapp Market Pro vendors,
  then delivery fee, then final price — with `کمترین هزینه کل` and
  `کمترین هزینه ارسال` as alternative orderings.
- **Digikala Jet** as a second source, searching every shop in range. Prices are
  reported in Rial and converted to Toman. Off by default in 1.0.0.
- **Search by product code** as well as by name, with keyword suggestions from
  Snapp Market's own autocomplete.
- **Session capture.** With a signed-in `snapp.market` tab open the extension
  uses your token, which unlocks Pro delivery fees and personalised campaign
  prices; without one it mints an anonymous token and still works.
- **Delivery point** picked from your saved Snapp Market addresses, or entered as
  coordinates.
- **Open store** button on every result.
- Persian RTL interface that follows the browser's light and dark theme.
- Two permissions, `storage` and `tabs`. Reading the Snapp Market session needs
  neither `scripting` nor a background alarm.
- `docs/api-notes.md`: a full record of every endpoint and payload shape, captured
  from live traffic.

### Fixed

- Persian product matching is word-aware. Substring matching made `مینو` match
  inside `دومینو`, so a search for `پفک مینو` returned Domino ice cream.
