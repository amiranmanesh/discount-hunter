# FAQ

### Do I need to sign in to both platforms?

No. **Snapp Market is required** — a guest sees a different campaign at different
prices, so the search refuses to run without it. **Digikala Jet is optional**: its
search takes no token, and signing in only adds that account's saved addresses.

### Does it see my password?

No. It signs in the way the websites do: your phone number, then the SMS code.
What it holds afterwards is a session token, kept in your browser and sent only
to the platform it came from.

### Why does it need a server? Isn't it a web app?

It is, but neither platform allows a cross-origin browser request — Snapp Market
sends `Access-Control-Allow-Origin` only for its own site, Digikala Jet sends
none at all. A page on any other origin cannot read their responses, whatever its
code does. So the app is served together with a proxy on the same origin. The
browser extension it replaces was exempt because host permissions bypass CORS;
a web page has no such exemption.

### Can I use someone else's hosted copy?

You can, but the proxy is on the path, so you would be trusting whoever runs it
with the same session your browser holds. Running your own is one command:
`docker run -p 4173:4173 ghcr.io/amiranmanesh/discount-hunter:latest`.

### Why did a 99% discount disappear?

It was a first-order offer, segmented to brand-new accounts. Every 90-99%
discount in the campaign feed is one, and none of them can be bought by an
established account. See [Trust](Trust).

### Why is the top result sometimes not the cheapest?

The default ranks by discount depth, then Pro, then delivery fee. Switch to
**کمترین هزینه کل** for the cheapest total. See [Ranking](Ranking).

### Does it order anything for me?

No. It reads catalogue data and opens store pages. Adding to a cart and paying
happens on the site, by you.

### Does it work outside Tehran?

Anywhere the platforms deliver. The app only ever sends a coordinate pair; they
decide which stores serve it.

### Are these APIs official?

No. They are the undocumented endpoints the two web apps call from your browser,
captured with the project's own tooling. They can change without notice, which is
what [API Reference](API-Reference) and the issue templates are for.

### Where does my data go?

To Snapp Market and Digikala Jet, through your own proxy. There is no analytics,
no telemetry and no server of this project's. See
[PRIVACY.md](https://github.com/amiranmanesh/discount-hunter/blob/main/docs/PRIVACY.md).
