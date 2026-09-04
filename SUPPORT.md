# Getting help

**Start here:** [README](README.md) · [فارسی](README.fa.md) ·
[Development](docs/DEVELOPMENT.md) · [Architecture](docs/ARCHITECTURE.md)

**The feed or the search is empty.** Check the delivery point in **تنظیمات**, and
that you are signed in to Snapp Market in **حساب‌ها** — its results need your
session, and the search refuses to run without one. Digikala Jet appears either
way.

**A discount looks too good.** Every 90-99% discount in Snapp Market's campaign
belongs to the first-order shelf, which this app never reads. If you see one,
that is a bug worth reporting.

**It asks me to sign in again.** The app holds its own refresh token, so this
should be rare. Sign out from **حساب‌ها** and back in; that clears a session whose
refresh the platform has revoked.

**Codes stop arriving.** They are rate-limited on purpose — two minutes between
codes, five per fifteen minutes. The message tells you how long is left.

**Something else?** [Open an issue](https://github.com/amiranmanesh/discount-hunter/issues/new/choose).
Never paste an `Authorization` header.

**Found a vulnerability?** Report it privately — see [SECURITY.md](SECURITY.md).
