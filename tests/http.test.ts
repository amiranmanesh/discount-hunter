import { describe, expect, it, vi } from 'vitest';
import { request } from '../src/api/http';

function respond(body: unknown, init: { status?: number; contentType?: string } = {}) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'content-type' ? (init.contentType ?? 'application/json') : null,
    },
    json: async () => body,
  } as unknown as Response);
}

describe('request', () => {
  it('returns the parsed body', async () => {
    respond({ ok: true });
    expect(await request('/api/x', '/thing')).toEqual({ ok: true });
  });

  it('explains a missing proxy instead of failing on its HTML', async () => {
    // A static host with nothing behind /api answers with its own 404 page, so
    // the JSON parse throws and the real problem would be invisible.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => 'text/html' },
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    } as unknown as Response);

    await expect(request('/api/snapp', '/anything')).rejects.toThrow('پروکسی');
    await expect(request('/api/snapp', '/anything')).rejects.toThrow('HOSTING');
  });

  it('surfaces the upstream message on an error status', async () => {
    respond({ message: 'کد نادرست است' }, { status: 400 });
    await expect(request('/api/snapp', '/x')).rejects.toThrow('کد نادرست است');
  });

  it('reports a throttle with its Retry-After', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: (n: string) => (n.toLowerCase() === 'retry-after' ? '120' : null) },
      json: async () => ({}),
    } as unknown as Response);

    await expect(request('/api/snapp', '/x')).rejects.toMatchObject({
      status: 429,
      retryAfter: 120,
    });
  });
});
