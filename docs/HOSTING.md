# Hosting

There is one constraint everything else follows from, and it is worth stating
before the options: **a static host cannot call these APIs.**

Measured against all three, from an arbitrary origin, with a real `GET`:

| Platform     | `Access-Control-Allow-Origin` on the response                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Snapp Market | only `https://snapp.market`                                                                                                        |
| Digikala Jet | none at all                                                                                                                        |
| Okala        | none — its _preflight_ answers permissively, but the response omits the header, which the browser treats as a refusal all the same |

No client-side code changes that. The request has to leave from a server, which
is why this app is a Next.js server and not a bundle you can drop on a CDN.

## The default: one server, and nothing to configure

```bash
docker run -d -p 3000:3000 ghcr.io/amiranmanesh/discount-hunter:latest
```

The page and the proxy are the same process on the same origin. The browser only
ever calls `/api/...` on the host it is already on, so:

- there is no CORS anywhere — not to configure, not to get wrong;
- the app works identically on `localhost:3000`, on `discount.example.ir` and
  behind any reverse proxy, with no rebuild;
- moving it to a new domain is a DNS change, not a deploy.

This is what [DEPLOY.md](DEPLOY.md) describes, and what you want in essentially
every case, including your own domain.

## The exception: the UI and the proxy on different origins

Only worth doing when the app is served by something that is not this server —
another front-end, a browser extension, a second deployment kept for testing.
Then two variables come into play, and they have to agree:

| Side      | Variable                           | Value                                                  |
| --------- | ---------------------------------- | ------------------------------------------------------ |
| the UI    | `NEXT_PUBLIC_API_BASE` (**build**) | `https://proxy.example.ir/api`                         |
| the proxy | `ALLOWED_ORIGINS` (runtime)        | `https://app.example.ir` — exactly the UI's own origin |

```bash
# the proxy: the same image, reached from somewhere else
docker run -d -p 3000:3000 \
  -e ALLOWED_ORIGINS="https://app.example.ir" \
  ghcr.io/amiranmanesh/discount-hunter:latest

# the UI: built once with the proxy's address baked in
NEXT_PUBLIC_API_BASE=https://proxy.example.ir/api npm run build
```

`NEXT_PUBLIC_API_BASE` is inlined into the bundle at build time — a restart will
not change it, only a rebuild will.

`ALLOWED_ORIGINS` is a comma-separated list and is never `*`. The proxy forwards
whatever `Authorization` header it is handed, so any origin it echoes back is an
origin that can spend the user's platform session.

If the app is ever deployed with nothing behind its API base, the first request
says so in as many words rather than failing on a parse error.

## What a proxy sees

Whichever way you run it, the proxy sits between you and the platforms, and the
request it forwards carries **your session token**.
`app/api/[platform]/[...path]/route.ts` does not read it, store it or log it — it
sets the `Origin` the upstream expects and streams the answer back — but that is
a promise in code, which is only worth as much as your trust in whoever runs it.

Run your own. That is the whole reason the proxy is a single readable file, and
the reason there is no hosted instance to point you at.

## Reachability

The three APIs are Iranian and generally expect Iranian traffic. A server outside
the country may be slower, or refused outright. If a deployed instance answers
`502` while the same request works from your own machine, that is the thing to
suspect first — a host in-country sidesteps it entirely.

This is also why CI never calls the real upstreams: a GitHub runner cannot tell a
blocked request from a broken one.
