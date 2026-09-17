/**
 * A UUID, on any origin.
 *
 * `crypto.randomUUID` exists only in a secure context — HTTPS or `localhost`.
 * On a plain-HTTP deployment it is not merely unavailable, it is `undefined`,
 * so calling it throws `TypeError: crypto.randomUUID is not a function` and
 * takes down every request that needed a device id: measured on a real
 * deployment, Snapp Market and Okala failed entirely while Digikala Jet, which
 * asks for no id, kept working.
 *
 * `crypto.getRandomValues` has no such restriction, so a v4 UUID can be built
 * from it wherever the page happens to be served. The last fallback is there
 * only so a very old browser degrades to a weak id rather than to an exception —
 * these ids identify a device to the platform, they are not a secret.
 *
 * None of this makes HTTPS optional: geolocation and the service worker are
 * secure-context features too, and they cannot be filled in from here.
 */
export function randomUuid(): string {
  const webCrypto = globalThis.crypto;

  if (typeof webCrypto?.randomUUID === 'function') return webCrypto.randomUUID();

  if (typeof webCrypto?.getRandomValues === 'function') {
    const bytes = webCrypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}
