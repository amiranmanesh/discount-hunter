# Ranking

How the extension decides which store to put first.

The default mode is `بیشترین تخفیف ← پرو ← کمترین ارسال`, and it applies four
rules in order.

## Before the comparator

Two things sink to the bottom regardless of how good the price is:

1. out-of-stock items
2. closed stores

An unavailable 99% discount is not a result, it is a distraction.

## The default comparator

| #   | Rule                          | Why                                                                               |
| --- | ----------------------------- | --------------------------------------------------------------------------------- |
| 1   | Discount percent, in 5% steps | The headline reason to use the extension — but bucketed, so 41% does not beat 40% |
| 2   | Pro vendors first             | Pro charges a fraction of the normal delivery fee                                 |
| 3   | Cheaper delivery              | Among equals, the cheaper trip wins                                               |
| 4   | Cheaper final price           | Last tiebreak                                                                     |

The bucket in rule 1 is what makes rules 2 and 3 matter. Comparing raw
percentages would mean a store 40 minutes away at 41% permanently outranks a Pro
store at 40% with free delivery — which is the wrong answer for almost every
basket.

A worked example, searching `بستنی میهن`:

```
۹۹٪  ۵۰۰ تومان   دیلی مارکت سمنگان     ⚡ پرو · ارسال رایگان   → جمع ۵۰۰
۹۹٪  ۵۰۰ تومان   فروشگاه راکت سمنگان   ⚡ پرو · ارسال ۱٬۸۰۰    → جمع ۲٬۳۰۰
۹۹٪  ۵۰۰ تومان   سوپر.مارکت ونو        ⚡ پرو · ارسال ۲٬۰۰۰    → جمع ۲٬۵۰۰
```

Same discount bucket, all Pro, so rule 3 decides: delivery fee, ascending.

## The other two modes

**`کمترین هزینه کل (کالا + ارسال)`** sorts by `finalPrice + deliveryFee`. This is
the honest answer when you are buying one item and nothing else — a 78% discount
with a 30,500 delivery fee loses to a 46% discount with a 500 fee.

**`کمترین هزینه ارسال`** ignores the discount entirely. Useful when you already
know which basket you want and only need the cheapest way to have it delivered.

Neither considers `minOrder`, which is shown on every card. A store's minimum
basket can make the cheapest-looking row the wrong one if you are buying a single
item.

## De-duplication

The same product in the same store can arrive twice — once from the campaign
shelf and once from the ordinary catalogue. The campaign listing always wins,
because it carries the discount. Between two listings of the same kind, the
cheaper one wins. The same product in two _different_ stores is never merged;
that comparison is the whole point.

## See also

- [Usage](Usage) — what each filter does
- [Troubleshooting](Troubleshooting) — when the order looks wrong
