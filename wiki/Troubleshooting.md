# Troubleshooting

## The search found nothing

**Check that **فقط تخفیف کمپینی** is off** — it is off by default, and with it on
you only see today's campaign rather than the whole catalogue.

Then check, in order:

1. **Is the delivery point right?** The chip at the top of the popup shows it.
   A point outside any store's range returns zero vendors.
2. **Is the query too specific?** `پفک نمکی مینو ۱۷۰ گرمی` needs every word to
   appear. Try `پفک مینو`.
3. **Is `حداقل تخفیف` set high?** At 70% almost nothing qualifies most days.

## Results look unrelated to what I searched

The popup will say `نتیجه‌ی دقیق پیدا نشد؛ نزدیک‌ترین موارد نمایش داده شده` when
no title contained every word you typed. Those results only share the first word
of your query. Shorten the query or search by product code instead.

If the results share _no_ word with the query, that is a bug — please
[open an issue](https://github.com/amiranmanesh/discount-hunter-extension/issues/new/choose)
with the query and a couple of the titles you got.

## A price looked too good, and the store did not have it

This was a real bug, fixed in 1.0.1. The campaign feed advertises `new_user`
offers — a Coca-Cola Zero at 39,072 Toman that the store actually lists at
112,332 — and the extension used to show them as ordinary results.

They are now excluded by default and the leading results are verified against the
store's own shelf. If you still see a price the store does not have:

1. Check for `✓ قیمت از خود فروشگاه` under the result. Only the leading results
   are verified; the ones further down still carry the campaign's own price.
2. Check the size in the title. `نوشابه زیرو کوکاکولا ۳۰۰ میلی‌لیتر` at 48,400 is
   not the 1.5-litre bottle at 112,700 — the search matches every size.
3. `npm run verify-offer` compares one query against the store directly, if you
   want the raw numbers.

## Prices or delivery fees do not match the app

Sign in to `snapp.market` in another tab and search again. The status line should
end with `حساب اسنپ‌مارکت متصل`.

Pro delivery fees and personalised campaign prices only exist for a signed-in
account. Some campaign items are also segmented — `segment: new_user` offers
appear in the API but may not apply to your account. Prices change during the day,
too; the campaign period end is part of every response.

## The popup says the location is not set

Either open `snapp.market` signed in and reopen the popup, or click the chip and
enter coordinates by hand. Nothing runs without a delivery point.

## An error banner mentions an endpoint

Something changed shape on the platform's side, or your token expired.

- Reload `snapp.market` in its tab and search again — that refreshes the token.
- If it persists, capture the traffic (`npm run browser:recon`) and
  [open an "endpoint changed" issue](https://github.com/amiranmanesh/discount-hunter-extension/issues/new/choose).
  **Strip the `authorization` header first** — it is your account.

## My changes to the code do nothing

Chrome caches extension resources per profile. Press reload on the extension card
in `chrome://extensions`. For the driven-browser scripts this is handled for you:
each one deletes its profile before launching, for exactly this reason.

## A search takes several seconds

Expected. One request lists the nearby stores, then one request per store reads
its full campaign shelf — about 45 in central Tehran, six at a time. The
alternative is the ten-item preview the listing endpoint returns, which misses
most of the shelf.
