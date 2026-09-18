<div align="center">
  <img src="public/icons/icon-192.png" width="84" height="84" alt="" />
  <h1>Discount Hunter · شکارچی تخفیف</h1>
  <p><strong>Every Snapp Market, Digikala Jet and Okala discount near you, deepest first — as an installable web app.</strong></p>
  <p><strong>English</strong> · <a href="README.fa.md">فارسی</a></p>
  <p>
    <a href="https://github.com/amiranmanesh/discount-hunter/wiki">Wiki</a> ·
    <a href="#run-it">Run it</a> ·
    <a href="docs/DEPLOY.md">Deploy</a> ·
    <a href="docs/ARCHITECTURE.md">Architecture</a> ·
    <a href="docs/API.md">Endpoints</a> ·
    <a href="docs/PRIVACY.md">Privacy</a> ·
    <a href="docs/DEVELOPMENT.md">Development</a>
  </p>
  <p>
    <a href="https://github.com/amiranmanesh/discount-hunter/actions/workflows/release.yml"><img alt="Release" src="https://github.com/amiranmanesh/discount-hunter/actions/workflows/release.yml/badge.svg" /></a>
    <a href="https://github.com/amiranmanesh/discount-hunter/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/amiranmanesh/discount-hunter/actions/workflows/ci.yml/badge.svg" /></a>
    <a href="https://github.com/amiranmanesh/discount-hunter/pkgs/container/discount-hunter"><img alt="Container image" src="https://img.shields.io/badge/ghcr.io-discount--hunter-2496ed?logo=docker&logoColor=white" /></a>
    <img alt="Next.js 16" src="https://img.shields.io/badge/next.js-16-000000?logo=nextdotjs" />
    <img alt="PWA" src="https://img.shields.io/badge/PWA-installable-ff5f00" />
    <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-blue" /></a>
  </p>
</div>

---

Snapp Market's `تخفیف نارنجی` campaign, Digikala Jet's `شگفت‌انگیز` line-up and
Okala's offer carousels all run across dozens of stores at once, and the same
product is discounted differently in each. This app reads all three, from your
own accounts, and sorts everything by how deep the discount actually is.

Three ways to use it:

- **تخفیف‌ها** — an endless feed of every campaign offer in range, deepest
  discount first, mixed across all three platforms. Nothing to type.
- **جستجو** — one product, priced across every store that delivers to you, ranked
  by discount, then Snapp Market **Pro**, then delivery fee.
- **سبد** — the things you want to buy, and the cheapest way to buy all of them:
  which store on which platform for each item, split into at most one, two or
  three orders, with every store's delivery, service charge and minimum basket
  counted. The same product is recognised across platforms by its title and
  size, strictly, and every match can be refused with one tap.

It is an independent, open-source project, not affiliated with Snapp or Digikala.

## Only prices you can actually pay

Four rules, each of which exists because the app once got it wrong:

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
- **A fee is the fee you pay.** Snapp Market's Pro stores deliver cheaply only to
  Snapp Pro subscribers, so without the subscription (a switch in **تنظیمات**)
  the full fee is used; Okala's service and packaging charges count; a delivery
  cost a listing leaves out is looked up, never read as free.

## Run it

**Docker, one command:**

```bash
docker run -p 3000:3000 ghcr.io/amiranmanesh/discount-hunter:latest
```

or `docker compose up -d` with the [`compose.yaml`](compose.yaml) in this repo.

**From source:**

```bash
git clone https://github.com/amiranmanesh/discount-hunter.git
cd discount-hunter
npm ci
npm run build
npm start          # → http://localhost:3000
```

`npm run dev` gives you the same app on the same port with hot reload.

Open it on your phone on the same network and add it to the home screen; it
installs as a standalone app.

**On your own domain**, put it behind a reverse proxy that terminates TLS and
forwards everything — including `/api/*` — to the container. There is no origin,
base path or callback URL to configure, because the page and its proxy are the
same server. [`docs/DEPLOY.md`](docs/DEPLOY.md) has nginx, Caddy and Traefik
blocks, and the full list of variables (all of which are optional).

### Why it needs a server

None of the three platforms allows a cross-origin browser request — Snapp Market
sends `Access-Control-Allow-Origin` only for its own site, Digikala Jet sends
none at all, Okala omits it from the response — so a page cannot call them
directly, whatever the code does. So the app is a Next.js server: the same
process renders the page and forwards `/api/*` upstream, from the server side,
where no cross-origin rule applies. That is why it works on `localhost`, on a
personal domain and behind a reverse proxy without a single setting.

The proxy keeps nothing, but it is on the path, so run your own:
[docs/PRIVACY.md](docs/PRIVACY.md) is explicit about the trade.

## Sign in

**حساب‌ها** → your phone number once, at the top of the page → then an SMS code
per platform. The accounts are separate; the number is not, so it is asked for
once and every card signs in with it.

Both fields take Latin digits only. A number typed on a Persian or Arabic
keyboard (`۰۹۱۲…`) is converted as you type, rather than being sent upstream and
refused as invalid.

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

## Install it

On Android and on a laptop: **تنظیمات → نصب برنامه**, or the browser's own install
icon. On iPhone and iPad: in Safari, the share button, then **Add to Home Screen**.
Installed, it opens full screen, keeps a working shell offline and says when a new
version is ready. Installing needs HTTPS with a trusted certificate — see
[docs/DEPLOY.md](docs/DEPLOY.md).

## Set your delivery point

**تنظیمات** → **استفاده از موقعیت فعلی** for GPS, or type coordinates. If you are
signed in to Jet, its saved addresses are listed there too.

## How it is built

```
app/            the App Router: the shell, one folder per tab
app/api/        the pass-through proxy and the health check — the server side
src/api/        one client per platform; everything that touches the network
src/core/       the feed, the search, ranking, Persian matching — all pure
src/auth/       sessions, OTP rate limiting, phone normalisation
src/routes/     the component behind each tab
src/server/     the proxy target table and the CORS rules
public/sw.js    the service worker: shell and images only, never a price
docs/           architecture, endpoints, deployment, privacy, development
```

Next.js 16 (App Router, standalone output), React 19, TypeScript, TanStack
Query, zustand. No UI framework: about 700 lines of CSS with design tokens, RTL,
light and dark from the system, and a bottom bar on phones that becomes a top
bar on laptops. No database, no accounts of its own, no secrets to set.

## Contributing

The most useful reports are endpoints that changed shape — these are undocumented
APIs and they move without notice. See [CONTRIBUTING.md](CONTRIBUTING.md), and
**never paste an `Authorization` header**: that token is your account.

## Licence

[MIT](LICENSE).
