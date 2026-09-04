// Iranian mobile numbers, in every form a person types them.
import { normalize } from '../util/text.js';

/**
 * Returns the number as `09xxxxxxxxx`, or null when it is not a mobile number.
 * Accepts Persian and Arabic digits, `+98`/`0098` prefixes, and any spacing or
 * dashes in between.
 */
export function normalizePhone(input) {
  if (!input) return null;
  let digits = normalize(input).replace(/\D/g, '');

  if (digits.startsWith('0098')) digits = digits.slice(4);
  else if (digits.startsWith('98') && digits.length === 12) digits = digits.slice(2);

  if (digits.length === 10 && digits.startsWith('9')) digits = `0${digits}`;
  return /^09\d{9}$/.test(digits) ? digits : null;
}

/** The `+989xxxxxxxxx` form some endpoints echo back. */
export function toInternational(phone) {
  const local = normalizePhone(phone);
  return local ? `+98${local.slice(1)}` : null;
}

/** `0912***4567` — enough to recognise, not enough to leak. */
export function maskPhone(phone) {
  const local = normalizePhone(phone);
  if (!local) return '';
  return `${local.slice(0, 4)}***${local.slice(-4)}`;
}
