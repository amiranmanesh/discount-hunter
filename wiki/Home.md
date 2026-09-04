# Discount Hunter

**شکارچی تخفیف** — a Chrome extension that finds the deepest
**Snapp Market orange discount** (`تخفیف نارنجی`) for a product across every
store that delivers to your address, ordered so the store you should actually
order from is first.

Persian documentation: [README.fa.md](https://github.com/amiranmanesh/discount-hunter-extension/blob/main/README.fa.md)
· [صفحهٔ فارسی سایت](https://amiranmanesh.github.io/discount-hunter-extension/fa/)

## Pages

- **[Installation](Installation)** — load the extension and set your delivery point
- **[Usage](Usage)** — searching by name or product code, and what each filter does
- **[Ranking](Ranking)** — why the top result is the top result
- **[Troubleshooting](Troubleshooting)** — a search returned nothing, prices look wrong, results look unrelated
- **[FAQ](FAQ)**
- **[API Reference](API-Reference)** — the endpoints behind all of it
- **[Development](Development)** — building, testing, capturing traffic

## What it does, in one pass

1. Takes your delivery point — automatically from a signed-in `snapp.market` tab,
   or entered by hand.
2. Lists every supermarket that delivers there and is running the orange-discount
   campaign. Around 45 stores in central Tehran.
3. Reads **each store's full campaign shelf**. The nearby-stores endpoint previews
   only ten items per store, which is why this takes a few seconds rather than
   one request.
4. Matches your product against all of it, ranks by discount → Pro → delivery fee,
   and gives every result a button that opens that store.

## What it is not

It does not place orders, touch your cart or change prices. It reads the same
public APIs the websites use, with your own account and your own address. It is
an independent project with no connection to Snapp or Digikala.
