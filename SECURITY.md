# Security policy

## Reporting a vulnerability

Please report security issues privately by opening a GitHub security advisory on
this repository rather than a public issue. Expect an acknowledgement within a
week.

## What the extension can reach

Two permissions and four host patterns:

- `storage` — the delivery point, the filters and the cached last result.
- `tabs` — opening the store you picked, and nothing else.
- `https://svc.snapp.market/*`, `https://api.digikalajet.ir/*` and the two site
  origins — the APIs it queries, plus the two content scripts that read the
  session and the delivery point out of pages you already have open.

Reading the Snapp Market session needs no `scripting` permission: the content
script is declared in the manifest and hands the token back over
`runtime.sendMessage`.

There is no analytics, no telemetry and no server of ours anywhere in the path.

## The credential boundary

This is the part worth reviewing.

- The extension reads the Snapp Market **bearer token** from
  `localStorage['persist:siteState']` in a `snapp.market` tab you are already
  signed in to, and stores it in `chrome.storage.local`. It is sent to
  `svc.snapp.market` and to nowhere else.
- Without a signed-in tab it mints its own **anonymous token** through the same
  public `client_credentials` grant the website uses. That token is tied to a
  random UDID the extension generates, not to any account.
- Tokens are short-lived (about an hour for a session token, about three days
  for an anonymous one) and are refreshed, never logged.
- **Captured traffic contains tokens.** `probe-out/` and `.browser-profile/` are
  git-ignored for that reason. Strip the `authorization` header before attaching
  anything to an issue.

## What is out of scope

The extension compares public catalogue prices with your own account and your own
address. It does not place orders, does not touch your cart, and cannot recover
anything an attacker with access to your browser profile could not already read.
