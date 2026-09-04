# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
