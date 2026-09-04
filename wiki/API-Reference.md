# API Reference

Every Snapp Market and Digikala Jet endpoint the app uses is documented in the
repository, in Persian, field by field:

**→ [`docs/API.md`](https://github.com/amiranmanesh/discount-hunter/blob/main/docs/API.md)**

Kept there rather than copied here so it cannot drift from the code that depends
on it.

## What it covers

**Snapp Market** (`/api/snapp/*` → `https://svc.snapp.market`, bearer token)

| Endpoint                                     | Used for                                          |
| -------------------------------------------- | ------------------------------------------------- |
| `POST /mobile/v4/user/loginMobileWithNoPass` | Send the SMS code                                 |
| `POST /mobile/v2/user/loginMobileWithToken`  | Exchange it for a session                         |
| `POST /oauth2/default/token`                 | Refresh the access token                          |
| `GET /market-party/{lat}/{lng}`              | Nearby stores in the campaign — the feed's source |
| `GET /market-party/{vendorCode}`             | One store's full campaign shelf                   |
| `GET /mobile/v2/product-variation/search`    | **The price of record** — what the store lists    |
| `GET /mobile/v3/product-vendors/search`      | Ordinary catalogue search                         |
| `GET /express-vendor/general/vendors-list`   | Every nearby store, with Pro-adjusted fees        |
| `GET /mobile/v3/search/suggest`              | Search suggestions                                |

**Digikala Jet** (`/api/jet/*` → `https://api.digikalajet.ir`)

| Endpoint                                             | Used for                            |
| ---------------------------------------------------- | ----------------------------------- |
| `POST /user/login-register/`                         | Send the code, returns a flow token |
| `POST /user/confirm-phone/`                          | Exchange code + flow token          |
| `GET /products/search/all/`                          | Search every shop in range          |
| `GET /post-process/amazing-widget-on-other-lines/1/` | The شگفت‌انگیز row                  |
| `GET /v2/products/galaxy/`                           | The paginated campaign listing      |
| `GET /address/`                                      | The account's saved addresses       |

## Things worth knowing before you read it

- **Snapp Market quotes Toman, Digikala Jet quotes Rial.** Jet's client divides
  by ten at the boundary.
- `finalPrice = price - discount` on both; `price` is the pre-discount figure.
- `GET /market-party/{lat}/{lng}` changes shape with pagination: without `page`
  it returns `data.products.List`, with `page` it returns `data.vendors[]`.
- The campaign feed and the store shelf give the same product **different**
  `productVariationId`s, so confirmation matches on the title.
- Jet's `/v2/products/galaxy/` is fixed at five rows per page and returns nothing
  at all if you add an unknown parameter trying to ask for more.
- Neither API sends CORS headers for a third-party origin, which is why every
  call goes through this app's own `/api/*` proxy.

## Capturing traffic yourself

Open the browser's network panel and use the app; every upstream call appears as
`/api/snapp/...` or `/api/jet/...`. **Every one carries your token** — strip the
`Authorization` header before sharing anything.
