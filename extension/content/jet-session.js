// Picks up the Digikala Jet session and delivery point so the extension can
// search the same neighbourhood and offer the same saved addresses.
//
// Authentication is the extension's own now, so this only reports the delivery
// point the app has picked — enough to prefill the location without typing
// coordinates.

function readStore(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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
  const location = readLocation();
  if (!location) return;
  const fingerprint = `${location.lat},${location.lng}`;
  if (fingerprint === lastSent) return;
  lastSent = fingerprint;
  chrome.runtime
    .sendMessage({ type: 'jet-session', payload: { location, capturedAt: Date.now() } })
    .catch(() => {});
}

sync();
setTimeout(sync, 3000);
setInterval(sync, 60_000);
