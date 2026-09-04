# Privacy

## What the app knows

Everything is kept in your browser's `localStorage`, on your device:

| Stored                  | Why                                                      |
| ----------------------- | -------------------------------------------------------- |
| Delivery point          | Every price and delivery fee depends on where you are    |
| Filters and sort mode   | So the app opens the way you left it                     |
| Recent searches         | Search history, capped at eight                          |
| Session tokens          | Sent to the platform they came from, so prices are yours |
| OTP rate-limit counters | So the app cannot get your number throttled              |

Clearing site data removes all of it. There is no account with us, because there
is no us — no analytics, no telemetry, no third-party script.

## What leaves your device, and where it goes

| Destination          | What goes there                                                      |
| -------------------- | -------------------------------------------------------------------- |
| `svc.snapp.market`   | Your coordinates, the search term, your Snapp token                  |
| `api.digikalajet.ir` | Your coordinates and the search term; the Jet token if you signed in |

These are the same requests the two websites make from your browser when you use
them normally.

## The proxy, and why it matters

Both APIs refuse cross-origin browser requests, so those calls cannot go straight
from the page — they pass through this app's own server first
([ARCHITECTURE.md](ARCHITECTURE.md) has the measurements). The proxy forwards the
request and streams the answer back. It stores nothing, logs no bodies, and reads
nothing out of the `Authorization` header.

**But it is on the path.** Whoever runs the server could, in principle, see the
tokens travelling through it. That is a real difference from the browser
extension this replaces, where requests went straight from your browser to the
platform. The honest answer is to run it yourself:

```bash
npm ci && npm run build && npm start
```

If you use someone else's deployment, you are trusting them with the same session
your browser holds.

## Permissions the app asks for

Only geolocation, and only when you press **استفاده از موقعیت فعلی**. Decline it
and type coordinates instead; nothing else changes.
