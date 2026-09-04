import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signIn } from './setup.js';
import { hunt } from '../extension/src/core/hunt.js';

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
 * One vendor whose campaign shelf can carry a plain offer and a first-order one,
 * plus the store's own shelf that the verification step re-prices against.
 *
 * `storeShelf` defaults to listing everything the campaign advertises at the
 * campaign price, so a test only has to describe a disagreement when it wants
 * one.
 */
function mockShelf({ general = [], firstOrder = [], storeShelf }) {
  const shelf =
    storeShelf ??
    general.map((product) => ({
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
      body = { data: { products: { List: general }, personalizedProducts: { List: firstOrder } } };
    } else {
      body = { data: { total_count: 1, vendors: [vendorRow] } };
    }
    return { ok: true, status: 200, json: async () => body };
  });
}

beforeEach(async () => {
  await signIn('snapp');
});

describe('hunt', () => {
  const options = { sources: { snapp: true, jet: false }, onlyOrange: true };

  it('ignores the first-order shelf and reports what it left out', async () => {
    // The bug this guards: a 39,072 Toman cola that only exists for a new
    // account was shown as the winning price, and the store had no such row.
    mockShelf({
      general: [cola({ price: 122100, discount: 12210, discountRatio: 10 })],
      firstOrder: [cola({ productVariationId: 5686818, segment: 'new_user' })],
    });

    const result = await hunt({ query: 'نوشابه زیرو کوکاکولا', location: LOCATION, options });

    expect(result.offers).toHaveLength(1);
    expect(result.offers[0].finalPrice).toBe(109890);
    expect(result.stats.firstOrderSkipped).toBe(1);
  });

  it('never returns a first-order offer, however good it looks', async () => {
    // There is no setting for this: an established account cannot buy these, so
    // showing them at the top of the list is always wrong.
    mockShelf({
      general: [cola({ price: 122100, discount: 12210, discountRatio: 10 })],
      firstOrder: [cola({ productVariationId: 5686818, segment: 'new_user' })],
    });

    const result = await hunt({
      query: 'نوشابه زیرو کوکاکولا',
      location: LOCATION,
      options: { ...options, includeTargeted: true }, // no such setting any more
    });

    expect(result.offers).toHaveLength(1);
    expect(result.offers.every((offer) => !offer.targeted)).toBe(true);
  });

  it('returns nothing rather than a price the account cannot use', async () => {
    mockShelf({ general: [], firstOrder: [cola({ segment: 'new_user' })] });

    const result = await hunt({ query: 'نوشابه زیرو کوکاکولا', location: LOCATION, options });

    expect(result.offers).toEqual([]);
    expect(result.stats.firstOrderSkipped).toBe(1);
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

describe('only what this account can see', () => {
  const options = { sources: { snapp: true, jet: false }, onlyOrange: false };

  it('drops a Snapp offer the shelf never confirmed', async () => {
    // Beyond `verifyTop` there is no confirmation, so the offer is not shown at
    // all rather than shown on the campaign feed's word.
    mockShelf({
      general: [
        cola({ productVariationId: 1, productVariationTitle: 'نوشابه زیرو کوکاکولا الف' }),
        cola({ productVariationId: 2, productVariationTitle: 'نوشابه زیرو کوکاکولا ب' }),
      ],
      storeShelf: [
        {
          id: 1,
          title: 'نوشابه زیرو کوکاکولا الف',
          price: 122100,
          discount: 9768,
          discountRatio: 8,
          stock: 5,
        },
      ],
    });

    const result = await hunt({
      query: 'نوشابه زیرو کوکاکولا',
      location: LOCATION,
      options: { ...options, verifyTop: 1 },
    });

    expect(result.offers).toHaveLength(1);
    expect(result.offers[0]).toMatchObject({ productId: '1', verified: true, finalPrice: 112332 });
    expect(result.stats.unverified).toBe(1);
  });

  it('marks every surviving offer as verified', async () => {
    mockShelf({ general: [cola()] });
    const result = await hunt({ query: 'نوشابه زیرو کوکاکولا', location: LOCATION, options });
    expect(result.offers.every((offer) => offer.verified)).toBe(true);
  });

  it('counts what each platform contributed', async () => {
    mockShelf({ general: [cola()] });
    const result = await hunt({ query: 'نوشابه زیرو کوکاکولا', location: LOCATION, options });
    expect(result.stats.bySource).toEqual({ snapp: 1, jet: 0 });
  });
});
