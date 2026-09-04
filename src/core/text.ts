// Persian text normalisation and word-aware matching.

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** Folds Arabic/Persian letter variants, digits and spacing into one comparable form. */
export function normalize(input: string | null | undefined): string {
  if (!input) return '';
  let s = String(input);
  s = s.replace(/[ً-ْٰـ]/g, ''); // harakat + tatweel
  s = s.replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/ۀ/g, 'ه');
  s = s.replace(/[أإآ]/g, 'ا').replace(/ؤ/g, 'و').replace(/ة/g, 'ه');
  s = s.replace(/[‌‎‏]/g, ' '); // ZWNJ and bidi marks
  s = s.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
  s = s.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));
  s = s.replace(/[^\p{L}\p{N}]+/gu, ' ');
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function tokenize(input: string): string[] {
  const n = normalize(input);
  return n ? n.split(' ').filter((t) => t.length > 1 || /\d/.test(t)) : [];
}

/**
 * Word-aware containment. Plain substring matching is wrong for Persian:
 * "مینو" sits inside "دومینو", which would make "پفک مینو" match an ice cream.
 * A token counts only when it starts a word in the title.
 */
export function hasToken(words: string[], token: string): boolean {
  return words.some((word) => word === token || (token.length >= 3 && word.startsWith(token)));
}

export interface MatchResult {
  score: number;
  /** Every query token appears in the title. */
  strict: boolean;
}

export function matchScore(
  title: string,
  queryTokens: string[],
  normalizedQuery: string,
): MatchResult {
  const hay = normalize(title);
  if (!hay || !queryTokens.length) return { score: 0, strict: false };

  if (normalizedQuery && hay.includes(normalizedQuery)) {
    return { score: hay === normalizedQuery ? 120 : 100, strict: true };
  }

  const words = hay.split(' ');
  let hits = 0;
  for (const token of queryTokens) if (hasToken(words, token)) hits += 1;
  if (!hits) return { score: 0, strict: false };

  const coverage = hits / queryTokens.length;
  if (coverage < 0.5) return { score: 0, strict: false };
  return { score: Math.round(coverage * 80), strict: coverage === 1 };
}

/** `12345` style input is a product code rather than a name. */
export function looksLikeProductCode(query: string): boolean {
  return /^\s*\d{4,}\s*$/.test(String(query ?? ''));
}
