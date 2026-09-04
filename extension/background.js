// Service worker: owns the network calls, session capture and result cache.
import { hunt, suggestions } from './src/core/hunt.js';
import * as jet from './src/api/jet.js';
import * as auth from './src/auth/index.js';
import { getState, setState, setSession, getSession, rememberQuery } from './src/util/store.js';

const LAST_RESULT_KEY = 'lastResult';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handle(message)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) =>
      sendResponse({
        ok: false,
        error: error?.message || String(error),
        notSignedIn: Boolean(error?.notSignedIn),
      }),
    );
  return true; // keep the channel open for the async reply
});

async function handle(message) {
  switch (message?.type) {
    case 'snapp-session':
      return storeSnappSession(message.payload);
    case 'jet-session':
      return storeJetSession(message.payload);
    case 'auth-status':
      return auth.status();
    case 'auth-request-code':
      return auth.requestCode({ ...message, location: (await getState()).location });
    case 'auth-verify-code': {
      const result = await auth.verifyCode({
        ...message,
        location: (await getState()).location,
      });
      // A fresh Jet session unlocks its saved addresses.
      if (message.platform === 'jet') await setSession('jetAddresses', await jet.savedAddresses());
      return result;
    }
    case 'auth-signout':
      return auth.signOut(message.platform);
    case 'get-state':
      return {
        ...(await getState()),
        addresses: [
          ...((await getSession('snappAddresses')) || []).map((a) => ({
            ...a,
            source: a.source || 'snapp',
          })),
          ...((await getSession('jetAddresses')) || []),
        ],
        session: await auth.status(),
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

  // Authentication is the extension's own now; the content script is here only
  // to save the user retyping an address they already have on the site.
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

async function storeJetSession(payload) {
  if (!payload) return false;

  await setSession('jetSessionToken', payload.session || null);
  if (payload.location?.lat) {
    await setSession('jetLocation', payload.location);
    const { location } = await getState();
    if (!location) {
      await setState({
        location: {
          lat: payload.location.lat,
          lng: payload.location.lng,
          label: payload.location.label,
        },
      });
    }
  }

  // Saved Jet addresses need the token, so refresh them whenever it changes.
  await setSession('jetAddresses', payload.session?.token ? await jet.savedAddresses() : []);
  return true;
}

async function runHunt({ query, location, options }) {
  if (!query?.trim()) throw new Error('نام یا کد کالا را وارد کن');
  if (!location?.lat || !location?.lng) throw new Error('اول موقعیت مکانی را مشخص کن');

  // No guest mode. A guest session sees a different campaign and different
  // eligibility, so its prices answer a question the user did not ask.
  const { snapp } = await auth.status();
  if (!snapp?.linked) {
    const error = new Error('برای جستجو باید در یک تب snapp.market وارد حسابت باشی');
    error.notSignedIn = true;
    throw error;
  }

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
