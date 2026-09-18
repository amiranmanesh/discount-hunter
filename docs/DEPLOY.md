# Deploying

What you deploy is one Next.js server. The same process renders the app and
forwards `/api/*` to Snapp Market, Digikala Jet and Okala, because none of the
three allows a cross-origin browser request ([ARCHITECTURE.md](ARCHITECTURE.md)
has the measurements). A static host cannot run this app.

The useful consequence: **there is no origin, base path or callback URL to
configure.** The page and its proxy are the same server, so `/api` is always
same-origin — on `localhost`, on `example.ir`, on `discount.example.ir/`, behind
any reverse proxy. Bring it up on your own domain and it works as-is.

There is nothing to persist: no database, no volume, no secret. Sessions live in
the user's browser and the proxy keeps no state.

## Docker

```bash
docker run -d --name discount-hunter -p 3000:3000 \
  ghcr.io/amiranmanesh/discount-hunter:latest
```

Or with the compose file in this repo:

```bash
docker compose up -d
```

The image is published for `linux/amd64` and `linux/arm64` on every push to
`main`. Tags:

| Tag        | Points at                   |
| ---------- | --------------------------- |
| `latest`   | the newest build of `main`  |
| `3.0.0`    | that exact released version |
| `sha-1a2b` | one specific commit         |

The runtime stage carries no `node_modules` of its own: `output: 'standalone'`
traces the modules the server actually needs into the bundle, so the image is
that bundle, the static assets and a Node base image.

### Configuration

Every variable is optional. A deploy with none of them set is the normal case.

| Variable               | When it is read | Default          | What it does                                                                                                                                                                                                    |
| ---------------------- | --------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                 | runtime         | `3000`           | Port the server listens on inside the container.                                                                                                                                                                |
| `HOSTNAME`             | runtime         | `0.0.0.0`        | Interface to bind. The image pins it, because Docker sets `HOSTNAME` to the container id and the server would bind to that name and become unreachable.                                                         |
| `ALLOWED_ORIGINS`      | runtime         | empty            | Origins allowed to call `/api/*` from **another** host, comma-separated, no trailing slash. Empty means same-origin hosting, where no CORS rule applies at all. Never `*` — see below. [HOSTING.md](HOSTING.md) |
| `APP_VERSION`          | runtime         | unset            | Echoed by `GET /api/health`. Useful for telling two deploys apart.                                                                                                                                              |
| `NEXT_PUBLIC_API_BASE` | **build**       | `/api`           | Where the browser sends its API calls. Inlined into the bundle at build time, so a restart cannot change it. Set it only when the UI is hosted apart from its proxy.                                            |
| `NODE_IMAGE`           | **build**       | `node:22-alpine` | Base image, so a build on a restricted network can pull from a mirror.                                                                                                                                          |
| `NPM_REGISTRY`         | **build**       | npmjs.org        | Registry `npm ci` uses, for the same reason.                                                                                                                                                                    |

`.env.example` in the repo root is the same table as a file; copy it to `.env`
only if you want to change a default.

**Why `ALLOWED_ORIGINS` is never `*`:** the proxy forwards whatever
`Authorization` header it is handed. Any origin echoed back is therefore an
origin that can spend a user's platform session. A wildcard would hand that to
every page on the internet.

`GET /api/health` answers without touching any upstream, so it reports on this
process rather than on whether Snapp Market happens to be up. That is what the
container healthcheck uses, and it is why an upstream outage cannot cause a
restart loop.

## On your own domain

Terminate TLS in front of the container and pass **everything** through, `/api/*`
included. A PWA needs a secure context to install, so it wants real HTTPS —
`localhost` is the only exception.

**nginx**

```nginx
server {
  listen 443 ssl;
  server_name discount.example.ir;

  ssl_certificate     /etc/letsencrypt/live/discount.example.ir/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/discount.example.ir/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Search fans out across every nearby store; a slow upstream must not be
    # cut off mid-answer.
    proxy_read_timeout 120s;
  }
}
```

**Caddy** — one line, and it gets the certificate itself:

```caddy
discount.example.ir {
  reverse_proxy 127.0.0.1:3000
}
```

**Traefik**, as compose labels on the `app` service:

```yaml
labels:
  - traefik.enable=true
  - traefik.http.routers.hunter.rule=Host(`discount.example.ir`)
  - traefik.http.routers.hunter.entrypoints=websecure
  - traefik.http.routers.hunter.tls.certresolver=letsencrypt
  - traefik.http.services.hunter.loadbalancer.server.port=3000
```

Do not strip or rewrite `/api` on the way through. It is not an external service:
it is this app's own route, and rewriting it breaks every call.

### Behind a CDN

The app is safe behind a CDN (ArvanCloud, Cloudflare and the like) as long as
the CDN respects the app's own `Cache-Control` headers:

| Path                                          | Header the app sends                                      | At the edge  |
| --------------------------------------------- | --------------------------------------------------------- | ------------ |
| `/`, `/search`, `/basket`, …                  | `private, no-cache, no-store, max-age=0, must-revalidate` | never cached |
| `/_next/static/*`                             | `public, max-age=31536000, immutable`                     | forever      |
| `/api/*`                                      | `no-store`                                                | never cached |
| `/sw.js`, `/manifest.webmanifest`, `/icons/*` | `public, max-age=0` (revalidate)                          | revalidated  |

The pages are rendered per request on purpose. The HTML is only a shell, but it
names the build's hashed script files and a new deploy deletes the old ones, so a
CDN still serving yesterday's HTML would serve an app that cannot load. Do not add
an edge rule that caches HTML, and do not let the CDN strip the `rsc` header or
the `_rsc` query parameter (Next.js uses them for client-side navigation).

TLS has to terminate at the CDN with a certificate for your domain. Without it,
browsers refuse the site on `https://`, and on plain `http://` the app still
works but cannot be installed, cannot use GPS and gets no offline shell — all
three need a secure context.

### A sub-path is not supported

The app is served from the root of whatever host it is on. If you need it under
`example.ir/hunter/`, give it a subdomain instead — a sub-path would need
`basePath` at build time, which the published image does not carry.

## From source, without Docker

```bash
npm ci
npm run build
npm start          # → http://localhost:3000
```

Node 22 or newer. `npm start` runs `next start`; put it behind a process manager
of your choice — there is nothing to supervise beyond the one process.

For a host with no toolchain, a release tarball carries the standalone build:
unpack it and run `node server.js`. No install, no build step.

## What CI does

- **Pull requests** — `npm run verify` (format, lint, typecheck, tests, build),
  then build the Docker image, boot it, and check that the page renders and the
  proxy route is mounted. Nothing is published. The upstreams themselves are not
  called: they refuse traffic from outside Iran, so a runner cannot tell a
  blocked request from a broken one.
- **Push to `main`** — verify, then build and push the image to GHCR as
  `latest`, the package.json version, and the commit sha.
- **A version that has never been released** — the same push also tags
  `vX.Y.Z`, attaches the standalone bundle with checksums, and cuts a GitHub
  release.

So releasing is a version bump:

```bash
npm run release -- minor     # bumps package.json and dates the changelog section
npm run verify
git commit -am "chore(release): v3.1.0"
git push origin main         # this is what publishes
```

`npm run release` refuses to go if the working tree is dirty, if you are not on
`main`, if the tag already exists, or if `## [Unreleased]` in the changelog is
empty — a release with no notes is a release nobody can read. It changes nothing
on GitHub; the push does that.

Push without bumping and only `latest` and the sha tag move; no duplicate release
is cut.

The tag itself is created through the release API rather than pushed with git.
A `GITHUB_TOKEN` push of a tag is rejected outright when the commit being tagged
touches `.github/workflows/`, which a dependency bump does regularly — that
failure is why it works this way.
