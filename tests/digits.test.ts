import { describe, expect, it } from 'vitest';
import { digitsOnly, toAsciiDigits } from '../src/core/digits';
import { normalizePhone } from '../src/auth/phone';

describe('toAsciiDigits', () => {
  it('rewrites Persian digits', () => {
    expect(toAsciiDigits('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789');
  });

  it('rewrites Arabic-Indic digits', () => {
    expect(toAsciiDigits('٠٩١٢٣٤٥٦٧٨٩')).toBe('09123456789');
  });

  it('leaves everything else alone', () => {
    expect(toAsciiDigits('کد ۱۲۳۴')).toBe('کد 1234');
  });
});

describe('digitsOnly', () => {
  // The field this guards can only ever hold ASCII digits: a number typed on a
  // Persian keyboard is otherwise refused upstream as invalid, which reads as
  // the app being broken rather than the keyboard being the wrong one.
  it('keeps a Persian-typed number usable', () => {
    const typed = digitsOnly('۰۹۱۲۳۴۵۶۷۸۹');
    expect(typed).toBe('09123456789');
    expect(normalizePhone(typed)).toBe('09123456789');
  });

  it('drops spaces, dashes and letters', () => {
    expect(digitsOnly('0912 345-6789')).toBe('09123456789');
    expect(digitsOnly('phone: 0912')).toBe('0912');
    expect(digitsOnly('؟!ـ')).toBe('');
  });

  it('keeps a pasted +98 number readable by normalizePhone', () => {
    const typed = digitsOnly('+98 912 345 6789');
    expect(typed).toBe('989123456789');
    expect(normalizePhone(typed)).toBe('09123456789');
  });

  it('honours a maximum length', () => {
    expect(digitsOnly('123456789', 4)).toBe('1234');
    expect(digitsOnly('۱۲۳۴۵۶', 3)).toBe('123');
  });
});
