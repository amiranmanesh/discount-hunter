<div align="center">
  <img src="public/icons/icon-192.png" width="84" height="84" alt="" />
  <h1>Discount Hunter · شکارچی تخفیف</h1>
  <p><strong>Every Snapp Market, Digikala Jet and Okala discount near you, deepest first — as an installable web app.</strong></p>
  <p><strong>English</strong> · <a href="README.fa.md">فارسی</a></p>
  <p>
    <a href="https://amiranmanesh.github.io/discount-hunter/">Website</a> ·
    <a href="https://github.com/amiranmanesh/discount-hunter/wiki">Wiki</a> ·
    <a href="#run-it">Run it</a> ·
    <a href="docs/ARCHITECTURE.md">Architecture</a> ·
    <a href="docs/API.md">Endpoints</a> ·
    <a href="docs/PRIVACY.md">Privacy</a> ·
    <a href="docs/DEVELOPMENT.md">Development</a>
  </p>
  <p>
    <a href="https://github.com/amiranmanesh/discount-hunter/actions/workflows/release.yml"><img alt="Release" src="https://github.com/amiranmanesh/discount-hunter/actions/workflows/release.yml/badge.svg" /></a>
    <a href="https://github.com/amiranmanesh/discount-hunter/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/amiranmanesh/discount-hunter/actions/workflows/ci.yml/badge.svg" /></a>
    <a href="https://github.com/amiranmanesh/discount-hunter/pkgs/container/discount-hunter"><img alt="Container image" src="https://img.shields.io/badge/ghcr.io-discount--hunter-2496ed?logo=docker&logoColor=white" /></a>
    <img alt="React 19" src="https://img.shields.io/badge/react-19-149eca" />
    <img alt="PWA" src="https://img.shields.io/badge/PWA-installable-ff5f00" />
    <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-blue" /></a>
  </p>
</div>

---

Snapp Market's `تخفیف نارنجی` campaign, Digikala Jet's `شگفت‌انگیز` line-up and
Okala's offer carousels all run across dozens of stores at once, and the same
product is discounted differently in each. This app reads all three, from your
own accounts, and sorts everything by how deep the discount actually is.

Two ways to use it:

- **تخفیف‌ها** — an endless feed of every campaign offer in range, deepest
  discount first, mixed across all three platforms. Nothing to type.
- **جستجو** — one product, priced across every store that delivers to you, ranked
  by discount, then Snapp Market **Pro**, then delivery fee.

It is an independent, open-source project, not affiliated with Snapp or Digikala.

## Only prices you can actually pay

Three rules, each of which exists because the app once got it wrong:

- **The first-order shelf is never read.** Every 90-99% discount in Snapp
  Market's campaign feed is segmented to brand-new accounts. Those prices do not
  exist for an established one, so that bucket is not fetched at all — only
  counted, so the app can tell you what it ignored.
- **Search results are confirmed against the store's own shelf** before they are
  shown, with your token, through the request the store page itself makes. An
  offer the store does not list is dropped rather than displayed.
- **There is no guest mode.** A guest sees a different campaign at different
  prices, so Snapp Market is skipped rather than searched anonymously, and the
  app says so. Okala's search needs its own token too; Digikala Jet's does not.

## Run it

**Docker, one command:**

```bash
docker run -p 4173:4173 ghcr.io/amiranmanesh/discount-hunter:latest
```

or `docker compose up -d` with the [`compose.yaml`](compose.yaml) in this repo.

**From source:**

```bash
git clone https://github.com/amiranmanesh/discount-hunter.git
cd discount-hunter
npm ci
npm run build
npm start          # → http://localhost:4173
```

Open it on your phone on the same network and add it to the home screen; it
installs as a standalone app.

For development, `npm run dev` gives you the same thing on :5173 with hot reload.

**On a static host?** The app can be deployed to GitHub Pages, but not on its
own: none of the three APIs allows a cross-origin browser request, so a static
build needs a proxy it is allowed to reach. `worker/` is that proxy as a
Cloudflare Worker — route `yourdomain/api/*` to it and no CORS is involved at
all. [`docs/HOSTING.md`](docs/HOSTING.md) has the measurements and the three
topologies.

### Why it needs a server

Neither platform allows a cross-origin browser request — Snapp Market sends
`Access-Control-Allow-Origin` only for its own site, Digikala Jet sends none at
all — so the page cannot call them directly, whatever the code does. The app is
therefore served together with a small pass-through proxy on the same origin.
The proxy keeps nothing, but it is on the path, so run your own:
[docs/PRIVACY.md](docs/PRIVACY.md) is explicit about the trade.

## Sign in

**حساب‌ها** → phone number → SMS code, one platform at a time.

| Platform         | Sign-in                  | What it needs a token for         |
| ---------------- | ------------------------ | --------------------------------- |
| **Snapp Market** | required for its results | everything                        |
| **Digikala Jet** | optional                 | only its saved addresses          |
| **Okala**        | optional                 | search; its discount feed is open |

The app holds Snapp Market's refresh token, so that session renews itself rather
than expiring in an hour. Okala's token lasts ten hours and is not renewable —
its own site signs in again, and so does this.

Codes are rate-limited on purpose: two minutes between codes, five per fifteen
minutes, five attempts per code, and a server `Retry-After` is honoured.

## Set your delivery point

**تنظیمات** → **استفاده از موقعیت فعلی** for GPS, or type coordinates. If you are
signed in to Jet, its saved addresses are listed there too.

## How it is built

```
src/api/        one client per platform; everything that touches the network
src/core/       the feed, the search, ranking, Persian matching — all pure
src/auth/       sessions, OTP rate limiting, phone normalisation
src/routes/     one file per tab
server/         the production server and the shared proxy table
docs/           architecture, endpoints, privacy, development
```

React 19, Vite 8, TypeScript, TanStack Query, zustand, `vite-plugin-pwa`. No UI
framework: about 700 lines of CSS with design tokens, RTL, light and dark from
the system, and a bottom bar on phones that becomes a top bar on laptops.

## Contributing

The most useful reports are endpoints that changed shape — these are undocumented
APIs and they move without notice. See [CONTRIBUTING.md](CONTRIBUTING.md), and
**never paste an `Authorization` header**: that token is your account.

## Licence

[MIT](LICENSE).
