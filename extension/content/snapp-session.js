// Lifts the logged-in bearer token and saved addresses out of the Snapp Market
// PWA so the extension can query the API as the signed-in user (Pro pricing,
// personalised orange offers). Runs only on snapp.market.

function readSiteState() {
  try {
    const raw = localStorage.getItem('persist:siteState');
    if (!raw) return null;
    const outer = JSON.parse(raw);
    const slice = (key) => {
      const value = outer[key];
      if (!value) return null;
      try {
        return JSON.parse(typeof value === 'string' ? JSON.parse(value) : value);
      } catch {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
    };
    return { auth: slice('auth'), user: slice('user') };
  } catch {
    return null;
  }
}

function extract() {
  const state = readSiteState();
  if (!state) return null;

  const token = state.auth?.authTokens?.data?.accessToken || null;
  const user = state.user?.information?.data?.user || null;
  const addresses = (user?.addresses || [])
    .filter((a) => a?.latitude && a?.longitude)
    .map((a) => ({
      id: String(a.id),
      label: a.label || a.city?.title || 'آدرس',
      address: a.address || '',
      lat: Number(a.latitude),
      lng: Number(a.longitude),
      city: a.city?.title || '',
    }));

  return { token, addresses, capturedAt: Date.now() };
}

function sync() {
  const payload = extract();
  if (!payload?.token) return;
  chrome.runtime.sendMessage({ type: 'snapp-session', payload }).catch(() => {});
}

sync();
// The PWA writes the token slightly after boot and refreshes it periodically.
setTimeout(sync, 3000);
setInterval(sync, 60_000);
