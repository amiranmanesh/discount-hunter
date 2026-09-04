# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
