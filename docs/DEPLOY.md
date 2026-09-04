# Deploying

The app has to be served next to its proxy — neither shopping API allows a
cross-origin browser request, so a static host will not do
([ARCHITECTURE.md](ARCHITECTURE.md) has the measurements). What you deploy is one
small Node process that serves the bundle and forwards `/api/*`.

## Docker

```bash
docker run -d --name discount-hunter -p 4173:4173 \
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
| `2.0.0`    | that exact released version |
| `sha-1a2b` | one specific commit         |

The runtime image carries no `node_modules` at all — the server uses only Node
built-ins — so it is the bundle, the server and a Node base image.

### Configuration

| Variable | Default   | What it does      |
| -------- | --------- | ----------------- |
| `PORT`   | `4173`    | Port to listen on |
| `HOST`   | `0.0.0.0` | Interface to bind |

There is nothing else to configure and nothing to persist: sessions live in the
browser, and the proxy keeps no state. `GET /healthz` answers without touching
either upstream, so it reports on this process rather than on Snapp Market.

## Behind a reverse proxy

Terminate TLS in front of it and pass everything through, `/api/*` included —
they must stay on the same origin as the app, which is the entire point.

```nginx
location / {
  proxy_pass http://127.0.0.1:4173;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

A PWA needs a secure context to install, so it wants HTTPS (or `localhost`).

## From source, without Docker

```bash
npm ci && npm run build && npm start
```

Node 22. Behind a process manager of your choice; there is nothing to supervise
beyond the one process.

## What CI does

- **Pull requests** — `npm run verify` (format, lint, typecheck, tests, build),
  then build the Docker image, boot it and check `/healthz`. Nothing is
  published.
- **Push to `main`** — verify, then build and push the image to GHCR as
  `latest`, the package.json version, and the commit sha.
- **A version that has never been released** — the same push also tags
  `vX.Y.Z`, attaches a tarball of `dist/` and `server/` with checksums, and cuts
  a GitHub release.

So releasing is a version bump:

```bash
npm run release -- minor     # bumps package.json and dates the changelog section
npm run verify
git commit -am "chore(release): v2.2.0"
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
