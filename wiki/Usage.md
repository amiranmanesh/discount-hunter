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

## سبد — the cheapest way to buy a basket

Tap **+ سبد** on any card in the feed or a search to add that product; tapping
it again adds one more. The **سبد** tab then prices every item at every store on
all three platforms and shows the cheapest way to buy the lot.

- **یک سفارش / تا ۲ سفارش / تا ۳ سفارش** — the best plan that needs no more
  orders than that, each with what it costs against the cheapest overall, or how
  many items it leaves out.
- Each order is one store: its delivery fee, service charge and minimum basket,
  then every product at that store's own price, linked to its page there.
- **معادل** marks a product from another platform that the app takes to be the
  same thing — same size, same words once packaging and fat percentages are set
  aside. A different size, brand, pack or flavour never counts. **این نیست**
  refuses a match; **کالای شبیه** under an item lists titles the app was not sure
  about, and **همین است** accepts one.
- Changing a quantity, a match or the number of orders re-plans at once without
  asking any platform again; prices are asked for again after five minutes, or on
  **تازه‌سازی**.

A plan never sends a store less than its minimum basket if any other way exists,
and says by how much it falls short when none does. How the plan is chosen is in
[Ranking](Ranking).

## Installing it as an app

- **Android, Chrome or Edge on a laptop** — **تنظیمات → نصب برنامه** installs it
  directly; the browser's own install icon does the same.
- **iPhone and iPad** — Safari has no install button a site can offer. In Safari:
  the share button, then **Add to Home Screen**.

Installed, it opens full screen from its own icon, offers **جستجو** and **سبد** on
a long press, keeps working as a shell when the connection drops (it says when it
is offline), and offers **بارگذاری دوباره** when a new version is out. Installing
needs HTTPS — see [Troubleshooting](Troubleshooting).

## حساب‌ها and تنظیمات

Sign-in per platform, and the delivery point. Both are covered in
[Installation](Installation).
