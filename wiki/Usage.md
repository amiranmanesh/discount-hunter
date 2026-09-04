# Usage

## تخفیف‌ها — the discount feed

The home tab. Every campaign offer near you from both platforms, deepest discount
first, loading more as you scroll. There is no query: this is the tab for finding
out what happens to be cheap right now.

| Control             | Effect                                            |
| ------------------- | ------------------------------------------------- |
| **حداقل تخفیف**     | Hide anything under 20/30/50/70%                  |
| **اسنپ‌مارکت**      | Include Snapp Market (needs a session)            |
| **دیجی‌کالا جت**    | Include Digikala Jet (works signed out)           |
| **فقط فروشگاه باز** | Hide stores that are currently closed             |
| **اوکالا**          | Include Okala (feed open, search needs a session) |

Pages accumulate and the whole list is re-sorted as it grows, so the order holds
instead of restarting per page.

## جستجو — one product, every store

Type a product name — `پفک مینو`, `بستنی میهن` — and press جستجو. Any input of
four or more digits is treated as a product code and matched exactly. Suggestions
come from Snapp Market's own autocomplete.

| Control              | Effect                                                     |
| -------------------- | ---------------------------------------------------------- |
| **ترتیب**            | Sort mode — see [Ranking](Ranking)                         |
| **فقط تخفیف کمپینی** | Campaign rows only; off by default so ordinary prices show |
| **فقط فروشگاه باز**  | Hide closed stores                                         |
| **دیجی‌کالا جت**     | Include Jet in the search                                  |
| **اوکالا**           | Include Okala in the search (needs its token)              |

**How names are matched.** Matching is word-aware, not substring-based, because
`مینو` sits inside `دومینو` — plain matching returned Domino ice cream for
`پفک مینو`. If any title contains _every_ word you typed, only those are shown;
otherwise the list relaxes to titles containing the **first** word and says the
results are approximate.

## Reading a result

```
[اسنپ‌مارکت] [تخفیف نارنجی] [۴۰٪ تخفیف]
بسته ۶ عددی آب معدنی میوا ۱.۵ لیتری
۱۲۶٬۰۰۰ تومان  ̶۲̶۱̶۰̶٬̶۰̶۰̶۰̶
اسمارت تهران نو
⚡ پرو · ارسال ۲٬۰۰۰ تومان · ۴۵ دقیقه · ★ ۸٫۶
جمع با ارسال: ۱۲۸٬۰۰۰ تومان · ✓ قیمت از خود فروشگاه · حداقل سبد ۱۱۰٬۰۰۰ تومان
```

- **⚡ پرو** — a Snapp Market Pro store, which charges a fraction of the usual
  delivery fee.
- **جمع با ارسال** — item plus delivery, so a deep discount far away can be
  compared with a smaller one nearby.
- **✓ قیمت از خود فروشگاه** — this price was confirmed against the store's own
  shelf, not taken from the campaign feed. See [Trust](Trust).
- **حداقل سبد** — the store's minimum basket. The ranking does _not_ account for
  it, so check it before celebrating something very cheap.

**باز کردن** opens that store's page in a new tab.

## حساب‌ها and تنظیمات

Sign-in per platform, and the delivery point. Both are covered in
[Installation](Installation).
