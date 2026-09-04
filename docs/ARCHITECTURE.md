# Architecture

## Goals that shaped the design

**One offer shape, whatever the platform.** Snapp Market quotes Toman and
Digikala Jet quotes Rial; Snapp has a Pro tier and Jet does not; one groups
products under vendors and the other returns flat rows. All of that is absorbed
in `src/api/`, and everything downstream sees the same object. Adding a platform
should not touch the ranking code, and it does not.

**The campaign shelf is the product, not a filter.** The whole point is
`تخفیف نارنجی`. Snapp's nearby-vendor listing previews only ten campaign items
per store, which is nowhere near the shelf — so the extension pays for one extra
request per vendor to read the real thing. That is the single most important
decision in the codebase and the reason a search takes a few seconds.

**Work with the user's own session.** Pro delivery fees and personalised campaign
prices exist only for a signed-in account. Rather than asking for credentials,
the extension borrows the token the website already holds, and falls back to an
anonymous one when there is no tab to borrow from.

## Module map

```
extension/
  background.js          service worker: the only place that talks to the network
  src/
    api/snapp.js         tokens, nearby vendors, campaign shelves, catalogue search
    api/jet.js           Digikala Jet search
    core/hunt.js         collect → match → rank
    core/rank.js         ordering rules and de-duplication
    util/text.js         Persian normalisation and word-aware matching
    util/store.js        chrome.storage with the defaults in one place
    util/pool.js         bounded concurrency
  content/               session and location capture, one file per site
  popup/                 the entire user interface
```

Only `background.js` and the `api/` modules perform I/O. `core/` and `util/` are
pure functions, which is why they are the parts with tests.

## Data flow

```
popup  ──"hunt"──▶  background.js  ──▶  hunt()
                                          │
                            ┌─────────────┴─────────────┐
                            ▼                           ▼
                    snapp.collectOrangeOffers    jet.search
                            │                           │
                            └─────────────┬─────────────┘
                                          ▼
                                  match against query        util/text.js
                                          ▼
                                  dedupe + rank              core/rank.js
                                          ▼
popup  ◀──result──  background.js  ◀──────┘
```

Progress is pushed the other way as `hunt-progress` messages while the shelves
load, so the popup can show which vendor it is on.

## Collecting Snapp offers

1. `GET /market-party/{lat}/{lng}` paginated — every vendor running the campaign,
   with `delivery_fee`, `IsPro`, `IsOpen`.
2. For each vendor, `GET /market-party/{vendorCode}?page_size=100` — the full
   shelf. Six requests run at a time (`util/pool.js`); a shelf that fails falls
   back to the ten-item preview from step 1 rather than dropping the vendor.
3. Each product becomes an offer: `finalPrice = price - discount`, both in Toman,
   plus the vendor fields and a deep link to the store.

### Segments: who can actually buy at this price

`personalizedProducts` mixes ordinary offers with segmented ones. Measured on a
live campaign: `products.List` is 100% `segment: general` and tops out near 44%
off, while `personalizedProducts` carries 119 `new_user` rows among 309 `general`
ones — and **every** 90-99% discount is `new_user`. Those prices do not exist for
an established account.

Any offer whose segment is not `general` is marked `targeted` and dropped. There
is no setting for it: an established account cannot buy at those prices, so there
is no case where showing them is right. Before the filter existed, the extension
reported a Coca-Cola Zero at 39,072 Toman that the store lists at 112,332.

### Verification

The campaign feed is a promotion, not a price list, so `hunt()` re-prices the
leading offers (six by default) through `/mobile/v2/product-variation/search` —
the endpoint the store page itself calls. The store's price wins, an offer the
store does not list is dropped and counted in `stats.unlisted`, and the survivors
are re-ranked. Offers below the verified head keep their campaign price and are
not marked verified.

Matching is by title, not id: the campaign feed and the shelf give the same
product different `productVariationId`s.

With `فقط تخفیف کمپینی` turned off, `searchOffers()` also runs the ordinary
catalogue search. Those hits carry a `document_id` of `"<productId>-<vendorId>"`
and no vendor detail, so they are joined against an index built from
`/express-vendor/general/vendors-list`; a hit whose vendor does not deliver to
the address is dropped.

## Matching a Persian product name

`util/text.js` folds Arabic letter forms onto Persian ones, converts Persian and
Arabic digits to Latin, and strips ZWNJ and punctuation. Matching is then
**word-aware, not substring-based**: `hasToken()` accepts a token only when it
starts a word.

That rule exists because of a real bug. `مینو` is a substring of `دومینو`, so
searching `پفک مینو` used to return Domino ice cream at the top of the list.

Results come in two tiers. A title carrying every query token is _strict_.
If any strict match exists, only strict matches are shown. Otherwise the list
relaxes to titles containing the **first** token — Persian product queries lead
with the item and follow with the brand (`پفک مینو`, `بستنی میهن`), so the head
token is the one that must survive — and the popup says the results are
approximate.

## Ranking

`core/rank.js` holds one comparator per sort mode. The default:

1. discount percent, bucketed to 5% — so a 41% offer does not outrank a Pro
   vendor at 40%
2. Pro vendors first
3. cheaper delivery
4. cheaper final price

Closed stores and out-of-stock items are pushed below everything else before the
comparator runs. `dedupe()` collapses the same product in the same store, keeping
the campaign listing over the plain catalogue one.

## Tokens

`getToken()` prefers, in order: the session token a content script lifted from an
open `snapp.market` tab, a cached anonymous token, then a freshly minted one. Both
kinds are JWTs and are checked for expiry with a minute of slack before use. The
anonymous grant needs `origin` and `referer` headers or the endpoint refuses.

## Build

There is nothing to bundle: the extension is plain ES modules that Chrome loads
directly, so `extension/` is loadable unpacked as-is. `scripts/build.mjs` copies
it to `dist/chrome/`, writes the manifest with the version from `package.json`,
and can zip a store-ready archive. `extension/manifest.json` is generated from
`scripts/manifest.mjs` and committed so the unpacked directory stays loadable; CI
regenerates it and fails on a diff.
