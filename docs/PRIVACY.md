# Privacy

## The short version

The extension talks to Snapp Market and Digikala Jet, and to nothing else. There
is no server of ours, no analytics, no telemetry and no third-party script. What
it learns about your shopping stays in your browser.

## What is stored, and where

Everything lives in `chrome.storage.local` on your machine:

| Stored                       | Why                                                        |
| ---------------------------- | ---------------------------------------------------------- |
| Delivery point and label     | Every price and delivery fee depends on where you are      |
| Filters and sort mode        | So the popup opens the way you left it                     |
| Last search and its results  | So reopening the popup does not re-run a 45-request search |
| Recent queries               | Search box history, capped at eight                        |
| Snapp Market session token   | Sent to `svc.snapp.market` so prices reflect your account  |
| Anonymous token and UDID     | Used when you are not signed in                            |
| Saved Snapp Market addresses | So you can pick one instead of typing coordinates          |

Uninstalling the extension deletes all of it.

## What is sent, and to whom

| Destination          | What goes there                                                         |
| -------------------- | ----------------------------------------------------------------------- |
| `svc.snapp.market`   | Your coordinates, the search term, and your bearer token                |
| `api.digikalajet.ir` | Your coordinates and the search term. No token; Jet's search needs none |

These are the same requests the two websites make from your browser when you use
them normally. Nothing is sent anywhere else.

## The session token

If you have `snapp.market` open and signed in, a content script reads the bearer
token the site already keeps in its own `localStorage` and hands it to the
extension. That is what makes Pro delivery fees and personalised campaign prices
show up. The token goes to `svc.snapp.market` and nowhere else, and it is never
logged.

Without a signed-in tab the extension mints its own anonymous token through the
public grant the website uses, tied to a random identifier it generates rather
than to any account.

## Developer tooling

`npm run browser:recon` records API traffic to `probe-out/`, and the driven
browsers keep profiles in `.browser-profile/`. **Both contain live bearer
tokens.** They are git-ignored, are never part of a release, and only exist if
you run those scripts yourself.

## Permissions

`storage` for your settings, `tabs` to open the store you picked, and host
access to the four Snapp Market and Digikala Jet origins — which is also what
lets the two content scripts read your session and delivery point out of pages
you already have open. Nothing else. `SECURITY.md` explains each one.
