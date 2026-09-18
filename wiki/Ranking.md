# Ranking

## Before the comparator

Two things sink to the bottom regardless of price: **out-of-stock items** and
**closed stores**. An unavailable 90% discount is not a result, it is a
distraction.

## The default: بیشترین تخفیف ← پرو ← کمترین ارسال

| #   | Rule                          | Why                                                                |
| --- | ----------------------------- | ------------------------------------------------------------------ |
| 1   | Discount percent, in 5% steps | The headline reason to use it — bucketed, so 41% does not beat 40% |
| 2   | Snapp Market Pro stores first | Pro charges a fraction of the usual delivery fee                   |
| 3   | Cheaper delivery              | Among equals, the cheaper trip wins                                |
| 4   | Cheaper final price           | Last tiebreak                                                      |

The bucket in rule 1 is what makes rules 2 and 3 matter. Comparing raw
percentages would let a store forty minutes away at 41% permanently outrank a Pro
store at 40% with near-free delivery — the wrong answer for almost every basket.

A worked example, searching `بستنی میهن`:

```
۹۹٪  ۵۰۰ تومان   دیلی مارکت سمنگان     ⚡ پرو · ارسال رایگان   → جمع ۵۰۰
۹۹٪  ۵۰۰ تومان   فروشگاه راکت سمنگان   ⚡ پرو · ارسال ۱٬۸۰۰    → جمع ۲٬۳۰۰
۹۹٪  ۵۰۰ تومان   سوپر.مارکت ونو        ⚡ پرو · ارسال ۲٬۰۰۰    → جمع ۲٬۵۰۰
```

Same bucket, all Pro, so rule 3 decides.

## The other two modes

**کمترین هزینه کل (کالا + ارسال)** sorts by `finalPrice + deliveryFee`. This is
the honest answer when you are buying one item and nothing else — a 78% discount
with a 30,500 delivery fee loses to a 46% discount with a 500 fee.

**کمترین هزینه ارسال** ignores the discount entirely. Useful when you already
know the basket and only need the cheapest way to have it delivered.

Neither considers **حداقل سبد**, which is shown on every card. A store's minimum
basket can make the cheapest-looking row the wrong one for a single item.

## The feed

**تخفیف‌ها** sorts purely by discount percent, then delivery fee, then price. It
is a browsing surface, not a buying decision — the search is where the four-rule
ordering and the price confirmation live.

## De-duplication

The same product in the same store can arrive twice — once from the campaign
shelf, once from the ordinary catalogue. The campaign listing wins, because it
carries the discount. Between two listings of the same kind, the cheaper wins.
The same product in two _different_ stores is never merged; that comparison is
the entire point.

## The basket

The basket is not ranked, it is planned. Every item can be bought at some set of
stores, each at its own price, and each store adds its delivery fee and service
charge and refuses a basket below its minimum. The planner tries every
combination of up to three stores (with more than sixty candidate stores, the
three-store combinations keep each item's four cheapest sellers and the stores
that carry most of the basket closest to its cheapest prices) and prefers, in
order:

1. the plan that buys **more of the basket** — leaving an item out is not a
   cheaper way to buy it;
2. a plan **every store will accept** — each order at or above its minimum;
3. the **lower total**, items plus every order's fees;
4. **fewer orders**.

Items go to the cheapest store in the combination; when that leaves a store short
of its minimum, items it also sells are moved over from the other stores in the
same trip, cheapest move first, as long as that leaves them above their own
minimums. Okala keeps its minimum on a separate page per store, so only stores a
plan picks are asked, and planning repeats until none is left unasked — the same
answer as asking every store first.
