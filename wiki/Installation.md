# Installation

## Docker

```bash
docker run -d --name discount-hunter -p 3000:3000 \
  ghcr.io/amiranmanesh/discount-hunter:latest
```

Then open `http://localhost:3000`. On a phone, use the machine's LAN address and
add it to the home screen — it installs as a standalone app.

With the repo's [`compose.yaml`](https://github.com/amiranmanesh/discount-hunter/blob/main/compose.yaml):

```bash
docker compose up -d
```

Images are published for `linux/amd64` and `linux/arm64` on every push to `main`.

| Tag        | Points at                   |
| ---------- | --------------------------- |
| `latest`   | newest build of `main`      |
| `3.0.0`    | that exact released version |
| `sha-1a2b` | one specific commit         |

## From source

```bash
git clone https://github.com/amiranmanesh/discount-hunter.git
cd discount-hunter
npm ci
npm run build
npm start          # → http://localhost:3000
```

Node 22. For development, `npm run dev` gives the same app on the same port with
hot reload.

## Behind a reverse proxy

Terminate TLS in front and pass **everything** through, `/api/*` included — those
calls have to stay on the app's own origin, which is the whole reason the server
exists.

```nginx
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

Caddy is one line: `reverse_proxy 127.0.0.1:3000`. Either way there is no origin
or base path to set anywhere — the page and its proxy are the same server, so
your own domain works as soon as it points here.

A PWA installs only from a secure context, so use HTTPS (or `localhost`).

## Configuration

Every variable is optional: `PORT` (default `3000`), `HOSTNAME` (default
`0.0.0.0`), and `ALLOWED_ORIGINS` only if some _other_ origin has to call this
proxy. Nothing to persist either — sessions live in the browser and the proxy
keeps no state. `GET /api/health` reports on the process without touching any
upstream. Full table:
[`docs/DEPLOY.md`](https://github.com/amiranmanesh/discount-hunter/blob/main/docs/DEPLOY.md).

## Sign in

Open **حساب‌ها**, type your phone number once at the top of the page, then enter
the SMS code for each platform you want. The accounts are separate; the number is
shared, so you type it once.

Both fields accept Latin digits only — a number typed on a Persian or Arabic
keyboard is converted as you type.

| Platform         | Sign-in                | What the token is for             |
| ---------------- | ---------------------- | --------------------------------- |
| **Snapp Market** | needed for its results | everything                        |
| **Digikala Jet** | optional               | only its saved addresses          |
| **Okala**        | optional               | search; its discount feed is open |

A platform whose token is missing is skipped, and the interface says so — a
search still runs on whatever is signed in.

## Set your delivery point

**تنظیمات** → **استفاده از موقعیت فعلی** for GPS, or type coordinates. Every price,
delivery fee and store list depends on this point.
