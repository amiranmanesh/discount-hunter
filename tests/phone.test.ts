import { describe, expect, it } from 'vitest';
import { maskPhone, normalizePhone } from '../src/auth/phone';

describe('normalizePhone', () => {
  it('passes through the plain local form', () => {
    expect(normalizePhone('09123456789')).toBe('09123456789');
  });

  it('accepts Persian and Arabic digits', () => {
    expect(normalizePhone('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789');
    expect(normalizePhone('٠٩١٢٣٤٥٦٧٨٩')).toBe('09123456789');
  });

  it('accepts the international prefixes', () => {
    expect(normalizePhone('+989123456789')).toBe('09123456789');
    expect(normalizePhone('00989123456789')).toBe('09123456789');
    expect(normalizePhone('989123456789')).toBe('09123456789');
  });

  it('ignores spacing and dashes', () => {
    expect(normalizePhone(' 0912 345 6789 ')).toBe('09123456789');
    expect(normalizePhone('0912-345-6789')).toBe('09123456789');
  });

  it('rejects anything that is not a mobile number', () => {
    expect(normalizePhone('02112345678')).toBeNull();
    expect(normalizePhone('0912345678')).toBeNull();
    expect(normalizePhone('091234567890')).toBeNull();
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

describe('maskPhone', () => {
  it('keeps enough to recognise and hides the rest', () => {
    expect(maskPhone('09123456789')).toBe('0912***6789');
  });

  it('returns an empty string for an invalid number', () => {
    expect(maskPhone('nope')).toBe('');
  });
});
