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
 * One vendor whose campaign shelf can carry a plain offer and a `new_user` one,
 * plus the store's own shelf that the verification step re-prices against.
 *
 * `storeShelf` defaults to listing everything the campaign advertises at the
 * campaign price, so a test only has to describe a disagreement when it wants
 * one.
 */
function mockShelf({ general = [], targeted = [], storeShelf }) {
  const shelf =
    storeShelf ??
    [...general, ...targeted].map((product) => ({
      id: product.productVariationId,
      title: product.productVariationTitle,
      price: product.price,
      discount: product.discount,
      discountRatio: product.discountRatio,
      stock: product.stock ?? 10,
    }));

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    let body;
    if (url.includes('/mobile/v2/product-variation/search')) {
      body = { data: { result: shelf, total: shelf.length } };
    } else if (url.includes('/market-party/3kj44n')) {
      body = { data: { products: { List: general }, personalizedProducts: { List: targeted } } };
    } else {
      body = { data: { total_count: 1, vendors: [vendorRow] } };
    }
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

describe('verification against the store shelf', () => {
  const options = { sources: { snapp: true, jet: false }, onlyOrange: true };

  it('replaces the campaign price with the price the store lists', async () => {
    // Measured case: the campaign feed advertised 39,072 while the store's own
    // shelf had the same product at 8% off, 112,332.
    mockShelf({
      general: [cola({ discount: 83028, discountRatio: 68 })],
      storeShelf: [
        {
          id: 5686817,
          title: 'نوشابه کولا زیرو کوکاکولا 1.5 لیتری',
          price: 122100,
          discount: 9768,
          discountRatio: 8,
          stock: 8,
        },
      ],
    });

    const result = await hunt({ query: 'نوشابه زیرو کوکاکولا', location: LOCATION, options });

    expect(result.offers[0]).toMatchObject({
      verified: true,
      finalPrice: 112332,
      discountPercent: 8,
      campaignPrice: 39072, // what the campaign feed had claimed
    });
  });

  it('matches on the title when the two endpoints disagree about the id', async () => {
    mockShelf({
      general: [cola()],
      storeShelf: [
        {
          id: 4085636, // the shelf uses a different product id for the same item
          title: 'نوشابه کولا زیرو کوکاکولا 1.5 لیتری',
          price: 122100,
          discount: 9768,
          discountRatio: 8,
          stock: 8,
        },
      ],
    });

    const result = await hunt({ query: 'نوشابه زیرو کوکاکولا', location: LOCATION, options });
    expect(result.offers[0]).toMatchObject({ verified: true, finalPrice: 112332 });
  });

  it('drops an offer the store does not list at all', async () => {
    mockShelf({ general: [cola()], storeShelf: [] });

    const result = await hunt({ query: 'نوشابه زیرو کوکاکولا', location: LOCATION, options });

    expect(result.offers).toEqual([]);
    expect(result.stats.unlisted).toBe(1);
  });

  it('can be turned off', async () => {
    mockShelf({ general: [cola()], storeShelf: [] });

    const result = await hunt({
      query: 'نوشابه زیرو کوکاکولا',
      location: LOCATION,
      options: { ...options, verifyTop: 0 },
    });

    expect(result.offers).toHaveLength(1);
    expect(result.offers[0].verified).toBeUndefined();
    expect(result.stats.unlisted).toBe(0);
  });
});
