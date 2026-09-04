# Troubleshooting

## The feed or the search is empty

1. **Is the delivery point set?** The chip in the header says. Nothing runs
   without one.
2. **Are you signed in to Snapp Market?** Its results need your session, and the
   search refuses to run without it. Digikala Jet appears either way.
3. **Is حداقل تخفیف set high?** At 70% very little qualifies most days.
4. **Is فقط تخفیف کمپینی on in the search?** With it on you only see today's
   campaign rather than the whole catalogue. It is off by default.

## Digikala Jet returns nothing

Almost always **فقط تخفیف کمپینی**. Jet marks very few rows شگفت‌انگیز, so with
that filter on it contributes close to nothing. The status line under the results
breaks the count down per platform, which makes this obvious.

## A price looks too good, and the store does not have it

That was a real bug, fixed in 1.0.1 and hardened since. Every 90-99% discount in
the campaign feed belongs to the first-order shelf, which this app no longer
reads at all. If you still see one:

1. Look for **✓ قیمت از خود فروشگاه** on the card. Search results carry it;
   feed rows do not, because confirming an endless list would cost a request per
   card.
2. Check the **size** in the title — a 300ml can is not a 1.5-litre bottle.
3. If neither explains it, that is worth an issue.

See [Trust](Trust) for the measurements.

## It keeps asking me to sign in

The app holds its own refresh token, so this should be rare. It happens when the
platform revokes a session. Sign out from **حساب‌ها** and sign in again.

The browser extension this replaced had this constantly, because it could only
borrow the website's token — which expires about an hour after it is minted, with
no way to renew.

## Codes stop arriving

They are rate-limited on purpose: two minutes between codes, five per fifteen
minutes, five attempts per code. The message says how long is left. If the
platform itself pushes back, its wait is honoured rather than argued with.

Digikala Jet occasionally demands a captcha; the app says so, and signing in once
on `digikalajet.com` clears it.

## An error mentions an endpoint

Something changed shape upstream. Reload; if it persists, open an
["endpoint changed" issue](https://github.com/amiranmanesh/discount-hunter/issues/new/choose)
with the failing `/api/...` call from the network panel. **Strip the
`Authorization` header before pasting anything** — it is your account.

## The page will not install to my home screen

A PWA installs only from a secure context. Use HTTPS, or `localhost` for testing.

## A search takes a few seconds

Expected. One request lists the nearby stores, then one per store reads its full
campaign shelf — around 45 in central Tehran, six at a time — and then the leading
results are each confirmed against their store. The feed is much cheaper, which
is why it exists.
