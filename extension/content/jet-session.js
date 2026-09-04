// Picks up the delivery point the user has already chosen in Digikala Jet so
// the extension can search the same neighbourhood without asking again.

function readLocation() {
  const candidates = ['jet:first-load', 'jet:session'];
  for (const key of candidates) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const found = findLatLng(JSON.parse(raw));
      if (found) return found;
    } catch {
      /* malformed entry, try the next key */
    }
  }
  return null;
}

function findLatLng(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 6) return null;
  const lat = node.latitude ?? node.lat;
  const lng = node.longitude ?? node.lng ?? node.long;
  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Number(lat) !== 0) {
    return {
      lat: Number(lat),
      lng: Number(lng),
      label: node.address || node.title || 'آدرس دیجی‌کالا جت',
    };
  }
  for (const value of Object.values(node)) {
    const found = findLatLng(value, depth + 1);
    if (found) return found;
  }
  return null;
}

const location = readLocation();
if (location) {
  chrome.runtime.sendMessage({ type: 'jet-location', payload: location }).catch(() => {});
}
