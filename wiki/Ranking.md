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
