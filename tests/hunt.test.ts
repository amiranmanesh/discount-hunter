import { describe, expect, it, vi } from 'vitest';
import { hunt } from '../src/core/hunt';

const LOCATION = { lat: 35.722248, lng: 51.478102, label: 'تهران' };
const OPTIONS = {
  sources: { snapp: true, jet: false, okala: true },
  sortMode: 'best-discount' as const,
  onlyCampaign: false,
  onlyOpen: true,
  minDiscount: 0,
};

const okalaProduct = {
  id: 1,
  name: 'پفک نمکی مینو 60 گرمی',
  price: 650000,
  okPrice: 585000,
  discountPercent: 10,
  isShowDiscount: true,
  quantity: 5,
  hasQuantity: true,
};

function mockOkalaOnly() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    const body = url.includes('/api/okala/api/unicorn/v2/cumulative/search/nearby')
      ? {
          data: {
            0: {
              store: { storeId: 7, storeName: 'پلاتینیوم', deliveryPrice: 0 },
              products: [okalaProduct],
            },
          },
        }
      : {};
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => body,
    } as unknown as Response;
  });
}

describe('hunt without a Snapp session', () => {
  it('still answers from the platforms that can, and says why Snapp is missing', async () => {
    // "No guest mode" is about Snapp Market specifically: searching it
    // anonymously would price a different account's campaign. The rest answer.
    mockOkalaOnly();

    const result = await hunt('پفک مینو', LOCATION, OPTIONS, { snapp: null, okala: 'token' });

    expect(result.offers).toHaveLength(1);
    expect(result.offers[0].platform).toBe('okala');
    expect(result.offers[0].finalPrice).toBe(58500);
    expect(result.stats.bySource).toEqual({ snapp: 0, jet: 0, okala: 1 });
    expect(result.errors.join(' ')).toContain('اسنپ‌مارکت');
  });

  it('never calls Snapp at all when there is no token for it', async () => {
    const fetchMock = mockOkalaOnly();
    await hunt('پفک مینو', LOCATION, OPTIONS, { snapp: null, okala: 'token' });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/snapp/'))).toBe(false);
  });

  it('skips Okala too when its own token is missing', async () => {
    const fetchMock = mockOkalaOnly();
    const result = await hunt('پفک مینو', LOCATION, OPTIONS, { snapp: null, okala: null });
    expect(result.offers).toEqual([]);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/okala/'))).toBe(false);
  });
});
