# Discount Hunter · شکارچی تخفیف

An installable web app that reads the **تخفیف نارنجی** campaign on Snapp Market,
the **شگفت‌انگیز** line-up on Digikala Jet and Okala's offer carousels — with your
own accounts — and sorts everything by how deep the discount actually is.

Persian documentation: [README.fa.md](https://github.com/amiranmanesh/discount-hunter/blob/main/README.fa.md)
· [Website](https://amiranmanesh.github.io/discount-hunter/)

## Pages

- **[Installation](Installation)** — Docker, compose, or from source
- **[Usage](Usage)** — the feed, the search, and what each filter does
- **[Ranking](Ranking)** — why the top result is the top result
- **[Trust](Trust)** — the three rules that keep a price honest
- **[Troubleshooting](Troubleshooting)**
- **[FAQ](FAQ)**
- **[API Reference](API-Reference)** — the endpoints behind all of it
- **[Development](Development)**

## Two ways to use it

**تخفیف‌ها** is an endless feed of every campaign offer in range, deepest discount
first, mixed across all three platforms. Nothing to type — scroll until something
catches your eye.

**جستجو** takes one product and prices it across every store that delivers to
you, ranked by discount, then Snapp Market **Pro** stores, then delivery fee.

## Why it needs a server

Neither platform allows a cross-origin browser request — Snapp Market sends
`Access-Control-Allow-Origin` only for its own site, Digikala Jet sends none at
all — so a web page cannot call them directly, whatever its code does. The app is
served together with a small pass-through proxy on the same origin. See
[Installation](Installation) and
[ARCHITECTURE.md](https://github.com/amiranmanesh/discount-hunter/blob/main/docs/ARCHITECTURE.md).

## What it is not

It does not place orders, touch your cart or change prices. It reads catalogue
data and opens store pages. Independent project, no connection to Snapp or
Digikala.
