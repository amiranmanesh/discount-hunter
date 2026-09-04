import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hunt } from '../extension/src/core/hunt.js';

function fakeJwt(secondsFromNow = 3600) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode({ exp: Math.floor(Date.now() / 1000) + secondsFromNow })}.sig`;
}

const LOCATION = { lat: 35.722358, lng: 51.47813 };

const cola = (overrides = {}) => ({
  productVariationId: 5686817,
  productVariationTitle: 'نوشابه کولا زیرو کوکاکولا 1.5 لیتری',
  price: 122100,
  discount: 83028,
  discountRatio: 68,
  stock: 40,
  ...overrides,
});

const vendorRow = {
  vendor_id: 116592,
  vendor_code: '3kj44n',
  vendor_name: 'سوپر مارکت لیا',
  delivery_fee: 2000,
  delivery_time: 45,
  IsPro: true,
  IsOpen: true,
  products: [],
  personalizedProducts: [],
};

/**
 * One vendor whose shelf carries the same product twice: once as a plain
 * campaign offer and once as a `new_user` one at a much lower price.
 */
function mockShelf({ general, targeted }) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    const body = url.includes('/market-party/3kj44n')
      ? {
          data: {
            products: { List: general },
            personalizedProducts: { List: targeted },
          },
        }
      : { data: { total_count: 1, vendors: [vendorRow] } };
    return { ok: true, status: 200, json: async () => body };
  });
}

beforeEach(async () => {
  await chrome.storage.local.set({ snappSessionToken: { token: fakeJwt() } });
});

describe('hunt', () => {
  const options = { sources: { snapp: true, jet: false }, onlyOrange: true };

  it('hides new-user prices by default', async () => {
    // The bug this guards: a 39,072 Toman cola that only exists for a new
    // account was shown as the winning price, and the store had no such row.
    mockShelf({
      general: [cola({ price: 122100, discount: 12210, discountRatio: 10 })],
      targeted: [cola({ productVariationId: 5686818, segment: 'new_user' })],
    });

    const result = await hunt({ query: 'نوشابه زیرو کوکاکولا', location: LOCATION, options });

    expect(result.offers).toHaveLength(1);
    expect(result.offers[0].finalPrice).toBe(109890);
    expect(result.offers[0].targeted).toBe(false);
    expect(result.stats.targetedSkipped).toBe(1);
  });

  it('includes them, labelled, when the user asks for them', async () => {
    mockShelf({
      general: [cola({ price: 122100, discount: 12210, discountRatio: 10 })],
      targeted: [cola({ productVariationId: 5686818, segment: 'new_user' })],
    });

    const result = await hunt({
      query: 'نوشابه زیرو کوکاکولا',
      location: LOCATION,
      options: { ...options, includeTargeted: true },
    });

    expect(result.offers).toHaveLength(2);
    expect(result.offers[0]).toMatchObject({
      targeted: true,
      finalPrice: 39072,
      campaignLabel: 'تخفیف کاربر جدید',
    });
    expect(result.stats.targetedSkipped).toBe(0);
  });

  it('returns nothing rather than a price the account cannot use', async () => {
    mockShelf({ general: [], targeted: [cola({ segment: 'new_user' })] });

    const result = await hunt({ query: 'نوشابه زیرو کوکاکولا', location: LOCATION, options });

    expect(result.offers).toEqual([]);
    expect(result.stats.targetedSkipped).toBe(1);
  });

  it('prefers the generally available row when both buckets list one product', async () => {
    mockShelf({
      general: [cola({ price: 122100, discount: 12210, discountRatio: 10 })],
      targeted: [cola({ segment: 'new_user' })], // same productVariationId
    });

    const result = await hunt({
      query: 'نوشابه زیرو کوکاکولا',
      location: LOCATION,
      options: { ...options, includeTargeted: true },
    });

    expect(result.offers).toHaveLength(1);
    expect(result.offers[0]).toMatchObject({ targeted: false, finalPrice: 109890 });
  });

  it('reports whether the search ran as the signed-in account', async () => {
    mockShelf({ general: [cola()], targeted: [] });
    const result = await hunt({ query: 'کوکاکولا', location: LOCATION, options });
    expect(result.stats.authenticated).toBe(true);
  });
});
