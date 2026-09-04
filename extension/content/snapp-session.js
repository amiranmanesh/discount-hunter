// Lifts the signed-in session and the saved addresses out of the Snapp Market
// PWA so the extension can query the API as the signed-in user (Pro pricing,
// the campaign line-up that actually applies to the account). Runs only on
// snapp.market.
//
// The token has lived in two places across site builds — the persisted redux
// slice and a bare `JWT` key — and the slice is empty for part of the session's
// life. Scanning every key and picking a live, account-bound JWT is what keeps
// this working; anything less silently downgrades the extension to an anonymous
// session, which is served a different (new-user) campaign.

function decodeClaims(jwt) {
  try {
    return JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

const JWT_PATTERN = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

/** Every end-user JWT in localStorage, newest-usable first. */
function findTokens() {
  const found = [];
  for (const key of Object.keys(localStorage)) {
    const value = localStorage.getItem(key) || '';
    for (const jwt of value.match(JWT_PATTERN) || []) {
      const claims = decodeClaims(jwt);
      if (claims?.aud !== 'end_user_api') continue;
      found.push({
        token: jwt,
        subject: claims.sub || '',
        userCode: claims.userCode || null,
        expiresAt: (claims.exp || 0) * 1000,
      });
    }
  }
  // A token with a `sub` belongs to the account; one without is the site's own
  // anonymous grant, which the extension can mint for itself anyway.
  return found
    .filter((entry) => entry.expiresAt > Date.now() + 60_000)
    .sort(
      (a, b) =>
        Number(Boolean(b.subject)) - Number(Boolean(a.subject)) || b.expiresAt - a.expiresAt,
    );
}

function readAddresses() {
  try {
    const raw = localStorage.getItem('persist:siteState');
    if (!raw) return [];
    const outer = JSON.parse(raw);
    const user = JSON.parse(JSON.parse(outer.user))?.information?.data?.user;
    return (user?.addresses || [])
      .filter((address) => address?.latitude && address?.longitude)
      .map((address) => ({
        id: String(address.id),
        label: address.label || address.city?.title || 'آدرس',
        address: address.address || '',
        lat: Number(address.latitude),
        lng: Number(address.longitude),
        city: address.city?.title || '',
      }));
  } catch {
    return [];
  }
}

let lastSent = null;

function sync() {
  const [best] = findTokens();
  const addresses = readAddresses();

  // Report the signed-out state too: the popup needs to say so rather than
  // quietly serving anonymous prices.
  const payload = {
    token: best?.subject ? best.token : null,
    subject: best?.subject || null,
    expiresAt: best?.expiresAt || null,
    addresses,
    capturedAt: Date.now(),
  };

  const fingerprint = `${payload.token}|${addresses.length}`;
  if (fingerprint === lastSent) return;
  lastSent = fingerprint;
  chrome.runtime.sendMessage({ type: 'snapp-session', payload }).catch(() => {});
}

sync();
// The PWA writes the token shortly after boot and refreshes it periodically.
setTimeout(sync, 3000);
setInterval(sync, 30_000);
