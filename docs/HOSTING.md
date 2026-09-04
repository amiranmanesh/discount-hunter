# Hosting

There is one constraint everything else follows from, and it is worth stating
before the options: **a static host cannot call these APIs.**

Measured against all three, from an arbitrary origin, with a real `GET`:

| Platform     | `Access-Control-Allow-Origin` on the response                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Snapp Market | only `https://snapp.market`                                                                                                        |
| Digikala Jet | none at all                                                                                                                        |
| Okala        | none — its _preflight_ answers permissively, but the response omits the header, which the browser treats as a refusal all the same |

No client-side code changes that. So the app always talks to a proxy it controls,
and the only question is where that proxy lives.

`VITE_API_BASE` answers it at build time:

| Value           | Meaning                                                                      |
| --------------- | ---------------------------------------------------------------------------- |
| unset           | `/api` on the app's own origin — what `npm start` and the Docker image serve |
| an absolute URL | a proxy somewhere else, for a static host                                    |

---

## 1. One server (simplest, and the default)

```bash
docker run -d -p 4173:4173 ghcr.io/amiranmanesh/discount-hunter:latest
```

The app and the proxy are one process on one origin. Nothing to configure, no
CORS anywhere, and the token never leaves your machine except to the platform it
came from. [`docs/DEPLOY.md`](DEPLOY.md) covers it.

## 2. GitHub Pages + a Worker on the same domain (no CORS)

The nicest of the static options: the browser never makes a cross-origin request
at all, because `/api/*` is the same host as the app.

```
yourdomain.ir/*        → GitHub Pages (this app)
yourdomain.ir/api/*    → Cloudflare Worker (worker/)
```

1. Point the domain at Pages and set it as the custom domain in the repository's
   Pages settings.
2. Deploy the Worker with a route on that domain:

   ```bash
   cd worker
   npx wrangler deploy          # after setting [[routes]] in wrangler.toml
   ```

3. Leave `ALLOWED_ORIGINS` empty — with same-origin routing there is no CORS to
   allow — and leave the `PAGES_API_BASE` repository variable unset, so the app
   keeps calling `/api`.

This needs the domain's DNS to sit behind a provider that can route one path to a
Worker and the rest to Pages. Cloudflare does it directly. Another CDN can too,
if it supports per-path origins.

## 3. GitHub Pages + a Worker on its own origin (CORS, but yours)

When the domain cannot split paths, the Worker lives at its own address and is
told which origin may talk to it.

1. Deploy the Worker and set `ALLOWED_ORIGINS` to exactly the app's origin —
   `https://you.github.io` or your custom domain. Not `*`: this Worker forwards
   whatever `Authorization` header it is given.
2. Set the repository variable `PAGES_API_BASE` to the Worker's base, including
   `/api`:

   ```bash
   gh variable set PAGES_API_BASE --body "https://discount-hunter-api.you.workers.dev/api"
   ```

3. Push, or run the Pages workflow by hand.

## What a proxy sees

Whichever option you pick, the proxy is on the path between you and the
platforms, and the request it forwards carries **your session token**. Neither
`server/index.mjs` nor `worker/index.mjs` reads it, stores it or logs it — they
set the `Origin` the upstream expects and stream the answer back — but that is a
promise in code, which is only worth as much as your trust in whoever runs it.

Run your own. That is the whole reason both are a single readable file, and the
reason there is no hosted instance to point you at.

## Reachability

The three APIs are Iranian and generally expect Iranian traffic. A proxy on a
global edge network may be slower, or refused, depending on where its nodes sit
and where you are. If the deployed Worker answers `502` while the same request
works from your own machine, that is the thing to suspect first — a small server
in-country (option 1) sidesteps it.

## Building for a static host yourself

```bash
VITE_BASE=/discount-hunter/ VITE_API_BASE=https://your-proxy/api npm run build
```

`VITE_BASE` has to match the path the site is served from — a project page is
`/<repo>/`, a custom domain is `/`. The bundle, the service worker and the router
all key off it, and a mismatch shows up as a blank page with 404s for the assets.

If the app is deployed with no proxy behind its API base, the first request says
so in as many words rather than failing with a parse error.
