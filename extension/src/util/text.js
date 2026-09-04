// Persian text normalisation + fuzzy matching used for product-name search.

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** Fold Arabic/Persian variants, digits and spacing into one comparable form. */
export function normalize(input) {
  if (!input) return '';
  let s = String(input);
  s = s.replace(/[ً-ْٰـ]/g, ''); // harakat + tatweel
  s = s.replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/ۀ/g, 'ه');
  s = s.replace(/[أإآ]/g, 'ا').replace(/ؤ/g, 'و').replace(/ة/g, 'ه');
  s = s.replace(/[‌‏‎]/g, ' '); // ZWNJ and bidi marks
  s = s.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
  s = s.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));
  s = s.replace(/[^\p{L}\p{N}]+/gu, ' ');
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function tokenize(input) {
  const n = normalize(input);
  return n ? n.split(' ').filter((t) => t.length > 1 || /\d/.test(t)) : [];
}

/**
 * Score how well `title` answers `query`.
 *
 * Returns `{ score, strict }`. `strict` means every query token appears in the
 * title — the caller prefers those and only falls back to partial matches when
 * nothing strict exists, so "پفک مینو" never surfaces a plain "شکلات مینو".
 */
export function matchScore(title, queryTokens, normalizedQuery) {
  const hay = normalize(title);
  if (!hay || !queryTokens.length) return { score: 0, strict: false };

  if (normalizedQuery && hay.includes(normalizedQuery)) {
    return { score: hay === normalizedQuery ? 120 : 100, strict: true };
  }

  const words = hay.split(' ');
  let hits = 0;
  for (const token of queryTokens) {
    if (hasToken(words, token)) hits += 1;
  }
  if (!hits) return { score: 0, strict: false };

  const coverage = hits / queryTokens.length;
  if (coverage < 0.5) return { score: 0, strict: false };
  return { score: Math.round(coverage * 80), strict: coverage === 1 };
}

/**
 * Word-aware containment. Plain substring matching is wrong for Persian:
 * "مینو" sits inside "دومینو", which would make "پفک مینو" match an ice cream.
 * A token counts only when it starts a word in the title.
 */
export function hasToken(words, token) {
  return words.some((word) => word === token || (token.length >= 3 && word.startsWith(token)));
}

/** `12345` style input is treated as a product code rather than a name. */
export function looksLikeProductCode(query) {
  return /^\s*\d{4,}\s*$/.test(String(query || ''));
}

export function toEnglishDigits(input) {
  return normalize(input);
}
