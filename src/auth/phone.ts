import { normalize } from '../core/text';

/**
 * Returns the number as `09xxxxxxxxx`, or null when it is not a mobile number.
 * Accepts Persian and Arabic digits, `+98`/`0098` prefixes, spaces and dashes.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = normalize(input).replace(/\D/g, '');

  if (digits.startsWith('0098')) digits = digits.slice(4);
  else if (digits.startsWith('98') && digits.length === 12) digits = digits.slice(2);

  if (digits.length === 10 && digits.startsWith('9')) digits = `0${digits}`;
  return /^09\d{9}$/.test(digits) ? digits : null;
}

/** `0912***6789` — enough to recognise, not enough to leak. */
export function maskPhone(phone: string | null | undefined): string {
  const local = normalizePhone(phone);
  if (!local) return '';
  return `${local.slice(0, 4)}***${local.slice(-4)}`;
}
