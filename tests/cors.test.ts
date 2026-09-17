import { corsHeaders, parseAllowedOrigins, resolveOrigin } from '../src/server/cors';
import { describe, expect, it } from 'vitest';

describe('parseAllowedOrigins', () => {
  it('reads a comma-separated list and drops trailing slashes', () => {
    expect(parseAllowedOrigins('https://a.ir/, https://b.ir')).toEqual([
      'https://a.ir',
      'https://b.ir',
    ]);
  });

  it('treats absent or empty as no list at all', () => {
    expect(parseAllowedOrigins(undefined)).toEqual([]);
    expect(parseAllowedOrigins('')).toEqual([]);
    expect(parseAllowedOrigins('  ,  ')).toEqual([]);
  });
});

describe('resolveOrigin', () => {
  const allowed = ['https://hunter.example.ir'];

  it('echoes an origin that is on the list', () => {
    expect(resolveOrigin('https://hunter.example.ir', allowed)).toBe('https://hunter.example.ir');
  });

  it('ignores one that is not', () => {
    expect(resolveOrigin('https://evil.example', allowed)).toBeNull();
  });

  it('never answers when the list is empty', () => {
    // An empty list means same-origin hosting, where CORS does not arise. It
    // must not be read as "allow everything".
    expect(resolveOrigin('https://anything.example', [])).toBeNull();
  });

  it('ignores a request with no Origin at all', () => {
    expect(resolveOrigin(undefined, allowed)).toBeNull();
  });

  it('matches regardless of a trailing slash', () => {
    expect(resolveOrigin('https://hunter.example.ir/', allowed)).toBe('https://hunter.example.ir');
  });
});

describe('corsHeaders', () => {
  it('is empty when there is no origin to echo', () => {
    expect(corsHeaders(null)).toEqual({});
  });

  it('echoes exactly one origin and varies on it', () => {
    const headers = corsHeaders('https://a.ir');
    expect(headers['access-control-allow-origin']).toBe('https://a.ir');
    expect(headers.vary).toBe('Origin');
    // The origin is never `*`: this proxy forwards whatever Authorization
    // header it is given, so a wildcard would let any page spend the session.
    // Allowing any request *header* is fine and is what lets Authorization
    // through in the first place.
    expect(headers['access-control-allow-origin']).not.toBe('*');
    expect(headers['access-control-allow-headers']).toBe('*');
  });
});
