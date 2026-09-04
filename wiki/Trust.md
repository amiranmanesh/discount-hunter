# Trust

Three rules decide whether a price is shown. Each exists because the app once got
it wrong, and each cost a round of "this is still broken" to find.

## 1. The first-order shelf is never read

Snapp Market's campaign response has two buckets. Measured against a live
campaign, across six stores:

| Bucket                 | Rows | Segments                      | Deepest discount |
| ---------------------- | ---- | ----------------------------- | ---------------- |
| `products`             | 310  | 100% `general`                | 44%              |
| `personalizedProducts` | 428  | 309 `general`, 119 `new_user` | **99%**          |

Every 90-99% discount is `segment: new_user` — the **ویژه خرید اول** list, a
promotion for a brand-new account. Those prices do not exist for an established
one.

Filtering them out afterwards was not enough. The whole bucket is now off limits:
it is not fetched into the offer pool at all, only counted so the interface can
say what it ignored.

## 2. Nothing from Snapp is shown on the campaign feed's word

A search re-prices its leading offers through
`/mobile/v2/product-variation/search` — the request the store page itself makes,
answered with your token. The store's price wins. An offer the shelf does not
list is dropped; one that was never checked is dropped too.

The measured case that forced this:

```
campaign feed :  39,072  نوشابه کولا زیرو کوکاکولا ۱.۵ لیتری   (68% off)
store shelf   : 112,332  the same product, same store          (8% off)
```

A row confirmed this way is marked **✓ قیمت از خود فروشگاه**.

The feed is looser by necessity — confirming every row of an endless list would
be one request per card — so it shows campaign rows as reported, with the
first-order shelf still excluded. The search is where confirmation happens.

## 3. There is no guest mode

A guest session sees a different campaign with different eligibility, so an
answer built from it answers a question you did not ask. Without a Snapp Market
session the search refuses to run rather than showing somebody else's prices.

## What is still on you

- **حداقل سبد** — the store's minimum basket is shown but does not affect the
  ordering.
- **Size** — a search matches every size. `نوشابه زیرو کوکاکولا ۳۰۰ میلی‌لیتر` at
  48,400 is not the 1.5-litre bottle at 112,700.
- **Time** — campaigns are hourly. A result is a snapshot, not a promise.
