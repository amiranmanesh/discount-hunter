# Installation

## Docker

```bash
docker run -d --name discount-hunter -p 4173:4173 \
  ghcr.io/amiranmanesh/discount-hunter:latest
```

Then open `http://localhost:4173`. On a phone, use the machine's LAN address and
add it to the home screen — it installs as a standalone app.

With the repo's [`compose.yaml`](https://github.com/amiranmanesh/discount-hunter/blob/main/compose.yaml):

```bash
docker compose up -d
```

Images are published for `linux/amd64` and `linux/arm64` on every push to `main`.

| Tag        | Points at                   |
| ---------- | --------------------------- |
| `latest`   | newest build of `main`      |
| `2.0.0`    | that exact released version |
| `sha-1a2b` | one specific commit         |

## From source

```bash
git clone https://github.com/amiranmanesh/discount-hunter.git
cd discount-hunter
npm ci
npm run build
npm start          # → http://localhost:4173
```

Node 22. For development, `npm run dev` gives the same thing on :5173 with hot
reload.

## Behind a reverse proxy

Terminate TLS in front and pass **everything** through, `/api/*` included — those
calls have to stay on the app's own origin, which is the whole reason the server
exists.

```nginx
location / {
  proxy_pass http://127.0.0.1:4173;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

A PWA installs only from a secure context, so use HTTPS (or `localhost`).

## Configuration

`PORT` (default `4173`) and `HOST` (default `0.0.0.0`). Nothing else, and nothing
to persist: sessions live in the browser and the proxy keeps no state.
`GET /healthz` reports on the process without touching either upstream.

## Sign in

Open **حساب‌ها** and sign in with your phone number and the SMS code, one platform
at a time.

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
