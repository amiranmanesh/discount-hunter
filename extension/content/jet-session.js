// Picks up the Digikala Jet session and delivery point so the extension can
// search the same neighbourhood and offer the same saved addresses.
//
// Jet keeps its token in the persisted `persist:DKNow` store and sends it as a
// bare `authorization` header — no `Bearer` prefix. Search results are identical
// with or without it, so the token is a convenience (saved addresses), not a
// requirement.

function readStore(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readSession() {
  const store = readStore('persist:DKNow');
  if (!store) return null;
  let user = store.user;
  if (typeof user === 'string') {
    try {
      user = JSON.parse(user);
    } catch {
      return null;
    }
  }
  if (!user?.token) return null;

  let expiresAt = null;
  try {
    const claims = JSON.parse(atob(user.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    expiresAt = (claims.expire_time || 0) * 1000;
  } catch {
    /* unparsable token: still usable, just unknown expiry */
  }

  return { token: user.token, userId: user.userId ?? null, expiresAt };
}

/** Falls back to whatever delivery point the app has picked for a signed-out visitor. */
function findLatLng(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 6) return null;
  const lat = Number(node.latitude ?? node.lat);
  const lng = Number(node.longitude ?? node.lng ?? node.long);
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0) {
    return { lat, lng, label: node.address || node.title || 'آدرس دیجی‌کالا جت' };
  }
  for (const value of Object.values(node)) {
    const found = findLatLng(value, depth + 1);
    if (found) return found;
  }
  return null;
}

function readLocation() {
  for (const key of ['jet:first-load', 'jet:session']) {
    const parsed = readStore(key);
    const found = parsed && findLatLng(parsed);
    if (found) return found;
  }
  return null;
}

let lastSent = null;

function sync() {
  const session = readSession();
  const location = readLocation();
  const fingerprint = `${session?.token || ''}|${location?.lat || ''}`;
  if (fingerprint === lastSent) return;
  lastSent = fingerprint;
  chrome.runtime
    .sendMessage({ type: 'jet-session', payload: { session, location, capturedAt: Date.now() } })
    .catch(() => {});
}

sync();
setTimeout(sync, 3000);
setInterval(sync, 60_000);
