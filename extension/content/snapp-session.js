// Copies the addresses you have already saved on snapp.market into the
// extension, so you can pick one instead of typing coordinates.
//
// It used to lift the site's bearer token too. That token lives about an hour
// and comes with no way to renew it, which is why the extension kept asking you
// to sign in again — so authentication moved into the extension itself and this
// script is back to doing one small thing.

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
        source: 'snapp',
      }));
  } catch {
    return [];
  }
}

let lastSent = null;

function sync() {
  const addresses = readAddresses();
  if (!addresses.length) return;
  const fingerprint = addresses.map((a) => a.id).join(',');
  if (fingerprint === lastSent) return;
  lastSent = fingerprint;
  chrome.runtime.sendMessage({ type: 'snapp-session', payload: { addresses } }).catch(() => {});
}

sync();
setTimeout(sync, 3000);
setInterval(sync, 60_000);
