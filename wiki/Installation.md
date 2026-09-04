# Installation

## From source

There is no compile step — the extension is plain ES modules that Chrome loads
directly.

```bash
git clone https://github.com/amiranmanesh/discount-hunter-extension.git
cd discount-hunter-extension
```

Then:

```
chrome://extensions  →  Developer mode  →  Load unpacked  →  the extension/ folder
```

Works on Chrome, Edge, Brave, Opera, Vivaldi and Arc (Chromium 111+). Firefox and
Safari are not supported yet; the manifest builder is written so a second target
is a small change, but nothing has been verified on those engines and the project
does not claim otherwise.

## From a packaged build

```bash
npm install
npm run package     # → release/discount-hunter-<version>-chrome.zip
```

Unzip it and load the resulting folder the same way, or drag the `.zip` onto
`chrome://extensions` with Developer mode on.

## Set your delivery point

Every price, delivery fee and discount depends on where you are, so nothing works
until the extension knows the address.

**The easy way.** Open `snapp.market` in a tab and sign in. The extension picks up
your saved addresses automatically; click the chip at the top of the popup to
choose between them. Signing in also unlocks Pro delivery fees and personalised
campaign prices.

**By hand.** Click the chip, enter latitude and longitude, save. To find them:
open the location in Google Maps, right-click the point, and the first menu entry
is `lat, lng`.

## Verify it works

Open the popup and search `بستنی`. You should see a status line like
`۴۵ فروشگاه اطراف · ۱۰۹ پیشنهاد` at the bottom. If it says the location is not
set, go back a step. If it finds nothing, see [Troubleshooting](Troubleshooting).
