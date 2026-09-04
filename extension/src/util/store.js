// Thin promise wrapper over chrome.storage with defaults in one place.

export const DEFAULTS = {
  location: null, // { lat, lng, label }
  sortMode: 'best-discount', // best-discount | cheapest-total | lowest-delivery
  sources: { snapp: true, jet: true },
  onlyOrange: true, // only campaign discounts (نارنجی / شگفت‌انگیز)
  onlyOpen: true,
  minDiscount: 0,
  maxVendors: 60,
  verifyTop: 6, // re-price this many leading offers against the stores' own shelves
  recentQueries: [],
};

export async function getState() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULTS));
  return { ...DEFAULTS, ...stored };
}

export async function setState(patch) {
  await chrome.storage.local.set(patch);
  return getState();
}

export async function getSession(key) {
  const { [key]: value } = await chrome.storage.local.get(key);
  return value || null;
}

export async function setSession(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

export async function rememberQuery(query) {
  const { recentQueries } = await getState();
  const next = [query, ...recentQueries.filter((q) => q !== query)].slice(0, 8);
  await chrome.storage.local.set({ recentQueries: next });
  return next;
}
