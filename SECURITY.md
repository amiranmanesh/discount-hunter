# Security policy

## Reporting a vulnerability

Please report security issues privately by opening a GitHub security advisory on
this repository rather than a public issue. Expect an acknowledgement within a
week.

## What the app holds

Session tokens for Snapp Market and Digikala Jet, in `localStorage`, obtained by
signing in with a phone number and an SMS code. They are sent to the platform
they came from and nowhere else. There is no account with this project and no
server-side state.

## The proxy is the interesting boundary

Both platforms refuse cross-origin browser requests, so calls pass through this
app's own server ([docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) has the
measurements). `server/index.mjs` forwards the request and streams the answer
back: it stores nothing, logs no bodies, and does not read the `Authorization`
header.

It is still on the path. Whoever runs the server could see tokens travelling
through it, which is a real difference from the browser extension this replaced.
**Run your own deployment**, and treat any hosted instance as something you are
trusting with your session.

## Rate limiting

OTP endpoints are the easiest way to get a phone number throttled, so the client
enforces its own budget before a request leaves: two minutes between codes, five
codes per fifteen minutes, five verification attempts per code, and a server
`Retry-After` is honoured and never shortened.

## Out of scope

The app compares public catalogue prices using your own account and address. It
does not place orders, does not touch your cart, and cannot reach anything an
attacker with your browser profile could not already read.
