import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectOrangeOffers, searchOffers } from '../extension/src/api/snapp.js';

/** A JWT whose only job is to have an `exp` the client accepts. */
function fakeJwt(secondsFromNow = 3600) {
  const payload = { exp: Math.floor(Date.now() / 1000) + secondsFromNow };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode(payload)}.sig`;
}

const LOCATION = { lat: 35.722358, lng: 51.47813 };

const product = (overrides = {}) => ({
  productVariationId: 4087371,
  productVariationTitle: 'بستنی ویفرنا زعفرانی میهن 75 گرمی',
  price: 70000,
  discount: 19600,
  discountRatio: 28,
  stock: 70,
  is_out_of_stock: false,
  minOrder: 110000,
  main_image: 'https://static.snapp.express/x.jpg',
  menu_category_title: 'بستنی و فالوده',
  ...overrides,
});

const vendorRow = (overrides = {}) => ({
  vendor_id: 114250,
  vendor_code: '09eyeq',
  vendor_name: 'اسمارت تهران نو',
  vendor_logo: 'https://cdn.snapp.express/logo.png',
  delivery_fee: 29900,
  delivery_time: 45,
  IsPro: true,
  IsOpen: true,
  rating: 9,
  comment_count: 12,
  products: [product()],
  personalizedProducts: [],
  ...overrides,
});

/** Answers each Snapp endpoint from a small table keyed by path fragment. */
function mockSnapp(routes) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    for (const [fragment, body] of Object.entries(routes)) {
      if (url.includes(fragment)) {
        const resolved = typeof body === 'function' ? body(url) : body;
        if (resolved === null) return { ok: false, status: 500, json: async () => ({}) };
        return { ok: true, status: 200, json: async () => resolved };
      }
    }
    throw new Error(`unexpected request: ${url}`);
  });
}

beforeEach(async () => {
  await chrome.storage.local.set({
    snappSessionToken: { token: fakeJwt(), capturedAt: Date.now() },
  });
});

describe('collectOrangeOffers', () => {
  it('turns a campaign shelf into ranked-offer shape', async () => {
    mockSnapp({
      '/market-party/35.722358': { data: { total_count: 1, vendors: [vendorRow()] } },
      '/market-party/09eyeq': {
        data: { firstActivePeriodEndRFC: '2026-09-04T16:30:03Z', products: { List: [product()] } },
      },
    });

    const { offers, vendorCount, authenticated, campaignEnds } = await collectOrangeOffers({
      ...LOCATION,
      maxVendors: 5,
    });

    expect(vendorCount).toBe(1);
    expect(authenticated).toBe(true);
    expect(campaignEnds).toBe('2026-09-04T16:30:03Z');
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({
      platform: 'snapp',
      productId: '4087371',
      price: 70000,
      finalPrice: 50400, // price - discount
      discountPercent: 28,
      isCampaign: true,
      campaignLabel: 'تخفیف نارنجی',
    });
    expect(offers[0].vendor).toMatchObject({
      code: '09eyeq',
      deliveryFee: 29900,
      isPro: true,
      isOpen: true,
      minOrder: 110000,
    });
    expect(offers[0].url).toContain('/supermarket/');
    expect(offers[0].url).toMatch(/09eyeq$/);
  });

  it('falls back to the listing preview when a shelf request fails', async () => {
    mockSnapp({
      '/market-party/35.722358': { data: { total_count: 1, vendors: [vendorRow()] } },
      '/market-party/09eyeq': null,
    });

    const { offers } = await collectOrangeOffers({ ...LOCATION, maxVendors: 5 });
    expect(offers).toHaveLength(1);
    expect(offers[0].title).toContain('بستنی ویفرنا');
  });

  it('stops at maxVendors instead of paging the whole city', async () => {
    const vendors = Array.from({ length: 20 }, (_, i) =>
      vendorRow({ vendor_id: i, vendor_code: `code${i}` }),
    );
    mockSnapp({
      '/market-party/35.722358': { data: { total_count: 200, vendors } },
      '/market-party/code': { data: { products: { List: [product()] } } },
    });

    const { vendorCount } = await collectOrangeOffers({ ...LOCATION, maxVendors: 3 });
    expect(vendorCount).toBe(3);
  });

  it('drops a product listed twice by the same vendor', async () => {
    mockSnapp({
      '/market-party/35.722358': { data: { total_count: 1, vendors: [vendorRow()] } },
      '/market-party/09eyeq': {
        data: { products: { List: [product(), product()] }, personalizedProducts: [product()] },
      },
    });

    const { offers } = await collectOrangeOffers({ ...LOCATION, maxVendors: 1 });
    expect(offers).toHaveLength(1);
  });
});

describe('searchOffers', () => {
  const catalogueItem = {
    id: 15096041,
    document_id: '15096041-114250',
    title: 'پفک نمکی مینو 60 گرمی',
    price: 65000,
    discount: 6500,
    discountRatio: 10,
    images: [{ main: 'https://static.snapp.express/p.jpg' }],
    subcategory_slug: 'snacks',
  };

  const vendorsList = {
    data: {
      finalResult: [
        {
          data: {
            id: 114250,
            code: '09eyeq',
            title: 'اسمارت تهران نو',
            deliveryFee: 2000,
            deliveryTime: 45,
            is_pro: true,
            isOpen: true,
            rate: 8.6,
            minimumOrderValue: 110000,
          },
        },
      ],
    },
  };

  it('joins a catalogue hit to its vendor through document_id', async () => {
    mockSnapp({
      '/mobile/v3/product-vendors/search': { items: [catalogueItem] },
      '/express-vendor/general/vendors-list': vendorsList,
    });

    const offers = await searchOffers('پفک', { ...LOCATION, pages: 1 });
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({
      productId: '15096041',
      finalPrice: 58500,
      discountPercent: 10,
      isCampaign: false,
    });
    expect(offers[0].vendor).toMatchObject({ code: '09eyeq', deliveryFee: 2000, isPro: true });
  });

  it('skips a hit whose vendor does not deliver here', async () => {
    mockSnapp({
      '/mobile/v3/product-vendors/search': {
        items: [{ ...catalogueItem, document_id: '15096041-999999' }],
      },
      '/express-vendor/general/vendors-list': vendorsList,
    });

    expect(await searchOffers('پفک', { ...LOCATION, pages: 1 })).toEqual([]);
  });
});

describe('authentication', () => {
  it('mints an anonymous token when no session token is stored', async () => {
    await chrome.storage.local.set({ snappSessionToken: null });
    const fetchMock = mockSnapp({
      '/oauth2/default/token': { data: { access_token: fakeJwt() } },
      '/market-party/35.722358': { data: { total_count: 0, vendors: [] } },
    });

    const { authenticated } = await collectOrangeOffers({ ...LOCATION, maxVendors: 1 });
    expect(authenticated).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/oauth2/'))).toBe(true);
  });

  it('does not mint a token when the stored session token is still valid', async () => {
    const fetchMock = mockSnapp({
      '/market-party/35.722358': { data: { total_count: 0, vendors: [] } },
    });

    await collectOrangeOffers({ ...LOCATION, maxVendors: 1 });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/oauth2/'))).toBe(false);
  });
});
