# Usage

## Searching

Type a product name — `پفک مینو`, `بستنی میهن`, `شیر کاله` — and press جستجو.
Suggestions come from Snapp Market's own autocomplete as you type; picking one
runs the search immediately.

**By product code.** Any input of four or more digits is treated as a product id
rather than a name, and matched exactly. Snapp Market calls it
`productVariationId`; you can read one off a result by opening the store page, or
from a capture. This is the precise way to compare one exact SKU across stores.

**How names are matched.** Matching is word-aware, not substring-based, because
`مینو` is a substring of `دومینو` — plain matching returned Domino ice cream for
`پفک مینو`. If any product title contains _every_ word you typed, only those are
shown. If none does, the list relaxes to titles containing the **first** word and
the popup says the results are approximate.

## The filters

| Control                       | Effect                                                                     |
| ----------------------------- | -------------------------------------------------------------------------- |
| **ترتیب**                     | Sort mode — see [Ranking](Ranking)                                         |
| **فقط تخفیف کمپینی**          | On: only `تخفیف نارنجی` and `شگفت‌انگیز`. Off: also the ordinary catalogue |
| **فقط فروشگاه باز**           | Hide stores that are currently closed                                      |
| **حداقل تخفیف**               | Drop anything under 20/30/50/70%                                           |
| **اسنپ‌مارکت / دیجی‌کالا جت** | Which platforms to query. Jet is off by default in 1.0.0                   |

Changing the sort mode re-runs the search; the toggles apply to the next one.

## Reading a result

```
[اسنپ‌مارکت] [تخفیف نارنجی] [۹۹٪ تخفیف]
بستنی چوبی وانیلی کلاسیک میرکس میهن ۶۰ گرمی
۵۰۰ تومان  ̶۵̶۰̶٬̶۰̶۰̶۰̶
دیلی مارکت سمنگان تهران (همواره تخفیف)
⚡ پرو · ارسال رایگان · ۴۵ دقیقه · ★ ۸٫۶
جمع با ارسال: ۵۰۰ تومان · حداقل سبد ۱۷۰٬۰۰۰ تومان
```

- **⚡ پرو** — a Snapp Market Pro store, which charges a fraction of the usual
  delivery fee.
- **جمع با ارسال** — the item plus delivery, so you can compare a deep discount
  far away against a smaller one nearby.
- **حداقل سبد** — the store's minimum basket. The ranking does _not_ account for
  it, so check it before celebrating a 500-Toman ice cream.

**باز کردن فروشگاه** opens that store in a new tab.

## Session and caching

The last result is cached, so reopening the popup shows it again instead of
re-running a search that costs about 45 requests. The status line says
`نتیجه‌ی ذخیره‌شده` when you are looking at a cached one.

`حساب اسنپ‌مارکت متصل` in the status line means the extension is using your
signed-in session. Without it, prices are the anonymous ones: no Pro fees, no
personalised campaign items.
