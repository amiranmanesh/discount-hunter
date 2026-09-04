import { describe, expect, it } from 'vitest';
import {
  hasToken,
  looksLikeProductCode,
  matchScore,
  normalize,
  tokenize,
} from '../extension/src/util/text.js';

const score = (title, query) => matchScore(title, tokenize(query), normalize(query));

describe('normalize', () => {
  it('folds Arabic letter forms onto Persian ones', () => {
    expect(normalize('پفك نمكي مينو')).toBe('پفک نمکی مینو');
  });

  it('converts Persian and Arabic digits to Latin', () => {
    expect(normalize('۱۷۰ گرمی')).toBe('170 گرمی');
    expect(normalize('١٧٠')).toBe('170');
  });

  it('collapses ZWNJ and punctuation into single spaces', () => {
    expect(normalize('شیر‌ پرچرب،  کاله')).toBe('شیر پرچرب کاله');
  });
});

describe('tokenize', () => {
  it('drops single letters but keeps numbers', () => {
    expect(tokenize('پفک و مینو 60')).toEqual(['پفک', 'مینو', '60']);
  });
});

describe('matchScore', () => {
  it('scores an exact phrase highest', () => {
    expect(score('پفک نمکی مینو 60 گرمی', 'پفک نمکی مینو').score).toBe(100);
  });

  it('marks a title carrying every query token as strict', () => {
    expect(score('پفک نمکی مینو 60 گرمی', 'پفک مینو')).toMatchObject({ strict: true });
  });

  it('does not match a brand hidden inside a longer word', () => {
    // Regression: "مینو" is a substring of "دومینو", so plain `includes`
    // matched an ice cream for the query "پفک مینو".
    expect(score('بستنی حصیری زعفرانی دومینو 75 گرمی', 'پفک مینو').score).toBe(0);
  });

  it('returns a weak, non-strict score for a partial match', () => {
    const result = score('شکلات با مغز ویفر تک تک مینو 38 گرمی', 'پفک مینو');
    expect(result.strict).toBe(false);
    expect(result.score).toBeGreaterThan(0);
  });

  it('rejects a title that shares less than half the query', () => {
    expect(score('ماست کم چرب کاله 900 گرمی', 'پفک نمکی مینو').score).toBe(0);
  });
});

describe('hasToken', () => {
  it('matches a word prefix but not a mid-word substring', () => {
    expect(hasToken(['بستنی', 'دومینو'], 'مینو')).toBe(false);
    expect(hasToken(['بستنی', 'مینویی'], 'مینو')).toBe(true);
  });
});

describe('looksLikeProductCode', () => {
  it('treats four or more digits as a product code', () => {
    expect(looksLikeProductCode('7905501')).toBe(true);
    expect(looksLikeProductCode('  4088680 ')).toBe(true);
    expect(looksLikeProductCode('60')).toBe(false);
    expect(looksLikeProductCode('پفک 170')).toBe(false);
  });
});
