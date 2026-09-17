/**
 * Digit handling for the two fields where a wrong character is fatal: the phone
 * number and the SMS code.
 *
 * A Persian keyboard types `۰۹۱۲…`, and an Arabic one `٠٩١٢…`. Those are not the
 * ASCII digits any of the three platforms accept, so a number typed that way is
 * refused upstream with a message about the number being invalid — which reads
 * as the app being broken rather than the keyboard being the wrong one.
 *
 * The rule here is that the field can only ever hold ASCII digits. A Persian or
 * Arabic digit is converted as it is typed, so the user sees their number
 * appear correctly instead of nothing happening, and anything that is not a
 * digit at all is dropped.
 */
const PERSIAN_ZERO = 0x06f0; // ۰
const ARABIC_ZERO = 0x0660; // ٠

/** Persian and Arabic-Indic digits rewritten as `0`-`9`; other text untouched. */
export function toAsciiDigits(input: string): string {
  let out = '';
  for (const char of input) {
    const code = char.codePointAt(0)!;
    if (code >= PERSIAN_ZERO && code <= PERSIAN_ZERO + 9) out += String(code - PERSIAN_ZERO);
    else if (code >= ARABIC_ZERO && code <= ARABIC_ZERO + 9) out += String(code - ARABIC_ZERO);
    else out += char;
  }
  return out;
}

/**
 * What a numeric field is allowed to contain: ASCII digits and nothing else.
 * Spaces, dashes and a pasted `+98` are dropped rather than rejected, because
 * `normalizePhone` reads `989…` as a `+98` number anyway.
 */
export function digitsOnly(input: string, maxLength?: number): string {
  const digits = toAsciiDigits(input).replace(/\D/g, '');
  return maxLength === undefined ? digits : digits.slice(0, maxLength);
}
