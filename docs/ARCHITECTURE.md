# Architecture

## The constraint everything else follows from

Neither platform lets a browser call it from another origin.

```
$ curl -sI 'https://svc.snapp.market/mobile/v3/search/suggest?query=x' \
    -H 'Origin: http://localhost:5173' | grep -i allow-origin
  (nothing)

$ curl -sI 'https://svc.snapp.market/mobile/v3/search/suggest?query=x' \
    -H 'Origin: https://snapp.market'  | grep -i allow-origin
access-control-allow-origin: https://snapp.market

$ curl -sI 'https://api.digikalajet.ir/products/search/all/?q=x&...' \
    -H 'Origin: http://localhost:5173' | grep -i allow-origin
  (nothing)
```

Snapp Market echoes `Access-Control-Allow-Origin` for its own site and nobody
else; Digikala Jet sends the header at all. A page on any other origin cannot
read either response, whatever its code does. The browser extension this app
replaces was exempt because host permissions bypass CORS; a web page has no such
exemption.

So the app is **served with a proxy on its own origin**, not published as static
files. `server/index.mjs` serves `dist/` and forwards `/api/snapp/*` and
`/api/jet/*` to the two upstreams with the `Origin`/`Referer` each expects. The
Vite dev server carries the same proxy, from the same table
(`server/targets.mjs`), so development and production cannot drift.

The proxy is a pass-through. It stores nothing, logs no bodies, and does not read
the `Authorization` header it forwards — but it is on the path, so host it
yourself. `docs/PRIVACY.md` is explicit about what that means.

## Module map

```
src/
  api/http.ts        one fetch wrapper: query building, tokens, typed errors
  api/snapp.ts       Snapp Market — auth, campaign, catalogue, verification
  api/jet.ts         Digikala Jet — auth, search, شگفت‌انگیز listing
  core/deals.ts      the discount feed
  core/hunt.ts       search across both platforms
  core/rank.ts       ordering rules and de-duplication
  core/text.ts       Persian normalisation and word-aware matching
  auth/              session, OTP rate limiting, phone normalisation
  store/settings.ts  persisted settings and sessions (zustand)
  store/auth.ts      sign-in, sign-out, "give me a live token"
  routes/            one file per tab
  components/        offer card, bottom navigation, prompts
server/              the production server and the shared proxy table
```

`core/` and `auth/` are pure; they are the parts with tests. Everything that
touches the network lives in `api/`.

## Prices you can actually pay

Three rules, each of which exists because the app once broke them.

**The first-order shelf is never read.** Snapp Market's campaign response has two
buckets. `products` is entirely `segment: general` and tops out near 44% off.
`personalizedProducts` — the "ویژه خرید اول" list — mixes `general` with
`new_user`, and _every_ 90-99% discount lives there. Those prices do not exist
for an established account. The bucket is not filtered after the fact; it is not
read at all, only counted so the interface can say what it ignored.

**Nothing from Snapp is shown on the campaign feed's word.** A search re-prices
its leading offers through `/mobile/v2/product-variation/search` — the request
the store page itself makes, answered with the user's token. An offer the shelf
does not list is dropped; one that was never checked is dropped too. Measured
case: the campaign advertised a Coca-Cola Zero at 39,072 Toman in a store whose
own shelf listed it at 112,332.

**There is no guest mode.** A guest session sees a different campaign with
different eligibility, so an answer built from it answers a question the user did
not ask. Without a Snapp Market session the search refuses to run.

The feed is looser by necessity — verifying every row of an endless list would be
one request per card — so it shows campaign rows as the campaign reports them,
with the first-order shelf still excluded. Search is the place that confirms.

## The discount feed

`core/deals.ts` pages both platforms and merges them:

- **Snapp Market**: one request to `/market-party/{lat}/{lng}?page=N&page_size=20`
  returns twenty stores with ten campaign offers each. That ratio is what makes
  an endless feed affordable; the per-store shelf endpoint returns far more, at
  one request per store.
- **Digikala Jet**: the شگفت‌انگیز row (`/post-process/amazing-widget-on-other-lines/1/`)
  on the first page — around nineteen of the deepest discounts in one call — then
  `/v2/products/galaxy/`, five per page because the endpoint ignores any attempt
  to ask for more.

Pages accumulate and the whole list is re-sorted on every render, so it stays in
descending order as it grows rather than resetting per page.

## Matching a Persian product name

`core/text.ts` folds Arabic letter forms onto Persian ones, converts Persian and
Arabic digits, and strips ZWNJ and punctuation. Matching is then **word-aware,
not substring-based**: a token counts only when it starts a word.

That rule exists because of a real bug. `مینو` is a substring of `دومینو`, so
searching `پفک مینو` used to return Domino ice cream at the top of the list.

Results come in two tiers. A title carrying every query token is _strict_; if any
strict match exists, only strict matches are shown. Otherwise the list relaxes to
titles containing the **first** token — Persian product queries lead with the
item and follow with the brand — and the interface says the results are
approximate.

## Sessions

The app signs in itself, with a phone number and an SMS code, per platform. It
holds the refresh token, so a session renews before a request rather than failing
after one. The extension it replaces could only borrow the website's token, which
expires about an hour after it is minted with no way to renew — which is why it
kept asking the user to sign in again.

Tokens live in `localStorage`, which is where a browser app can keep them. They
are sent to the platform they came from and nowhere else.
