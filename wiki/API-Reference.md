# API Reference

Every Snapp Market and Digikala Jet endpoint the extension uses is documented in
the repository, in Persian, with the payload shapes recorded field by field:

**→ [`docs/api-notes.md`](https://github.com/amiranmanesh/discount-hunter-extension/blob/main/docs/api-notes.md)**

It is kept there rather than copied here so it cannot drift from the code that
depends on it.

## What it covers

**Snapp Market** (`https://svc.snapp.market`, bearer token required)

| Endpoint                                   | Used for                                            |
| ------------------------------------------ | --------------------------------------------------- |
| `POST /oauth2/default/token`               | Anonymous token, when there is no signed-in tab     |
| `GET /market-party/{lat}/{lng}`            | Nearby stores running the orange-discount campaign  |
| `GET /market-party/{vendorCode}`           | One store's full campaign shelf                     |
| `GET /express-vendor/general/vendors-list` | Every nearby store, with Pro-adjusted delivery fees |
| `GET /mobile/v3/product-vendors/search`    | Ordinary catalogue search                           |
| `GET /mobile/v3/search/suggest`            | Keyword suggestions for the search box              |

**Digikala Jet** (`https://api.digikalajet.ir`, no authentication)

| Endpoint                              | Used for                   |
| ------------------------------------- | -------------------------- |
| `GET /products/search/all/`           | Search every shop in range |
| `GET /products/search/shop/{shopId}/` | Search inside one shop     |

## Things worth knowing before you read it

- **Snapp Market quotes Toman, Digikala Jet quotes Rial.** Jet's client divides
  by ten so both platforms compare.
- `finalPrice = price - discount` on both. `price` is the pre-discount figure.
- `GET /market-party/{lat}/{lng}` changes shape depending on pagination: without
  `page` it returns `data.products.List`, with `page` it returns `data.vendors[]`.
- The nearby-stores response previews at most **ten** campaign items per store,
  which is why the extension fetches each shelf separately.
- `jet.digikala.com` does not exist. The site is `www.digikalajet.com` and the API
  is on a `.ir` domain.

## Capturing it yourself

```bash
npm run browser:recon
```

Writes every request and response to `probe-out/net-<timestamp>.jsonl`. See
[Development](Development). **Every line contains your bearer token** — strip the
`authorization` header before sharing anything.
