# FAQ

### Do I need a Snapp Market account?

No. Without one the extension mints an anonymous token and searches fine. With
one, you additionally get Pro delivery fees and personalised campaign prices —
just keep a signed-in `snapp.market` tab open.

### Does it see my password?

No. It reads the bearer token the website already stores in its own
`localStorage` in a tab you signed in to yourself. It never sees credentials, and
the token goes only to `svc.snapp.market`.

### Does it order anything for me?

No. It reads catalogue data and opens store pages. Adding to a cart and paying
happens on the site, by you.

### Why is Digikala Jet off by default?

It is a second source and the ranking rules were written around Snapp Market's
Pro tier, which Jet has no equivalent of. Turn it on with the دیجی‌کالا جت
checkbox; results are converted from Rial to Toman so the two are comparable.

### Why did a 99% discount disappear?

Because it was almost certainly a `new_user` offer. Every 90-99% discount in the
campaign feed is segmented to brand-new accounts and cannot be bought by an
established one, so the extension drops them and says how many it dropped. There
is no setting to bring them back.

### What does `✓ قیمت از خود فروشگاه` mean?

That the price was confirmed against the store's own shelf rather than taken from
the campaign feed. The leading results are checked this way on every search.

### Why is the top result sometimes not the cheapest?

Because the default mode ranks by **discount depth**, then Pro, then delivery
fee. Switch to `کمترین هزینه کل (کالا + ارسال)` for the cheapest total. See
[Ranking](Ranking).

### What is `حداقل سبد`?

The store's minimum basket value. It is shown on every card but does _not_ affect
the ordering — a 500-Toman item in a store with a 170,000-Toman minimum is only
useful if you were buying that much anyway.

### Does it work outside Tehran?

Anywhere Snapp Market delivers. The extension only ever sends a coordinate pair;
the platform decides which stores serve it.

### Is Firefox supported?

Not yet. The manifest builder has a single `chrome` target and nothing has been
verified on Gecko. Adding a target is small; claiming support without testing it
would not be.

### Does it send anything to a server of yours?

There is no server of mine. Requests go to `svc.snapp.market` and
`api.digikalajet.ir` and nowhere else — the same ones the websites make. See
[PRIVACY.md](https://github.com/amiranmanesh/discount-hunter-extension/blob/main/docs/PRIVACY.md).

### Are these APIs official?

No. They are the undocumented endpoints the two web apps call from your browser,
captured with the project's own recon harness. They can change without notice,
which is what `docs/api-notes.md` and the "endpoint changed" issue template are
for.
