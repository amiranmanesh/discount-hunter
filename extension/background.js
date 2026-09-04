// Service worker: owns the network calls, session capture and result cache.
import { hunt, suggestions } from './src/core/hunt.js';
import { getState, setState, setSession, getSession, rememberQuery } from './src/util/store.js';

const LAST_RESULT_KEY = 'lastResult';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handle(message)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
  return true; // keep the channel open for the async reply
});

async function handle(message) {
  switch (message?.type) {
    case 'snapp-session':
      return storeSnappSession(message.payload);
    case 'jet-location':
      return storeJetLocation(message.payload);
    case 'get-state':
      return {
        ...(await getState()),
        addresses: (await getSession('snappAddresses')) || [],
        session: await sessionSummary(),
        lastResult: await getSession(LAST_RESULT_KEY),
      };
    case 'set-state':
      return setState(message.patch);
    case 'suggest':
      return suggestions(message.query, message.location);
    case 'hunt':
      return runHunt(message);
    case 'open-url':
      await chrome.tabs.create({ url: message.url, active: true });
      return true;
    case 'clear-result':
      await setSession(LAST_RESULT_KEY, null);
      return true;
    default:
      throw new Error(`پیام ناشناخته: ${message?.type}`);
  }
}

async function storeSnappSession(payload) {
  if (!payload) return false;

  // A signed-out tab reports `token: null`; clear the stale one rather than
  // keeping a token the account no longer has.
  await setSession(
    'snappSessionToken',
    payload.token
      ? {
          token: payload.token,
          subject: payload.subject,
          expiresAt: payload.expiresAt,
          capturedAt: payload.capturedAt,
        }
      : null,
  );

  if (payload.addresses?.length) {
    await setSession('snappAddresses', payload.addresses);
    const { location } = await getState();
    if (!location) {
      const preferred = payload.addresses[payload.addresses.length - 1];
      await setState({
        location: { lat: preferred.lat, lng: preferred.lng, label: preferred.label },
      });
    }
  }
  return true;
}

async function storeJetLocation(payload) {
  if (!payload?.lat) return false;
  await setSession('jetLocation', payload);
  const { location } = await getState();
  if (!location)
    await setState({ location: { lat: payload.lat, lng: payload.lng, label: payload.label } });
  return true;
}

async function sessionSummary() {
  const session = await getSession('snappSessionToken');
  if (!session?.token) return { snappLoggedIn: false };
  const expired = session.expiresAt && session.expiresAt < Date.now();
  return { snappLoggedIn: !expired, expired: Boolean(expired), capturedAt: session.capturedAt };
}

async function runHunt({ query, location, options }) {
  if (!query?.trim()) throw new Error('نام یا کد کالا را وارد کن');
  if (!location?.lat || !location?.lng) throw new Error('اول موقعیت مکانی را مشخص کن');

  const state = await getState();
  const merged = { ...state, ...options };

  const result = await hunt({
    query: query.trim(),
    location,
    options: merged,
    onProgress: (progress) => {
      chrome.runtime.sendMessage({ type: 'hunt-progress', progress }).catch(() => {});
    },
  });

  await rememberQuery(query.trim());
  await setSession(LAST_RESULT_KEY, {
    ...result,
    offers: result.offers.slice(0, 60), // keep the cache small
    location,
    finishedAt: Date.now(),
  });
  return result;
}
