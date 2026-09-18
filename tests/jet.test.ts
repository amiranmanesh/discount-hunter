import { describe, expect, it, vi } from 'vitest';
import * as jet from '../src/api/jet';

const LOCATION = { lat: 35.72238, lng: 51.47782, label: 'خانه' };

function mockJson(handler: (url: string) => unknown) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const body = handler(String(input));
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => body ?? {},
    } as unknown as Response;
  });
}

// Shaped after a live galaxy row: the shop is a bare id, and the whole discount
// is the شگفت‌انگیز share — the store and the brand contribute nothing.
const galaxyRow = (overrides: Record<string, unknown> = {}) => ({
  id: 55003523,
  product_id: '105113831527',
  title: 'کره حیوانی پاستوریزه شکلی 50 گرم',
  media: 'https://dkstatics-public.digikala.com/p.jpg',
  shop: { id: '184114142711' },
  badges: { is_amazing: true },
  price: {
    price: 630000,
    discount: 561100,
    vendor_discount: 0,
    brand_discount: 0,
    discount_percentage: 89,
  },
  stock: { has_stock: true },
  ...overrides,
});

const header = {
  id: '184114142711',
  title: 'فروشگاه یاران دریان کرمان | کرمان شمالی',
  cart_close_limit: 1500000,
  delivery: { estimate_time: 60, cost: 350000, is_free_by_plus: true },
  working_status: { is_open: true },
  rating: { rate: 4.7 },
};

describe('amazingPage', () => {
  it('reads the rows from `result`, where the galaxy listing now puts them', async () => {
    mockJson(() => ({
      data: { result: [galaxyRow()], pager: { total_pages: 3178, total_items: 15889 } },
    }));

    const page = await jet.amazingPage(LOCATION, 1);
    expect(page.offers).toHaveLength(1);
    expect(page.hasMore).toBe(true);
  });

  it('marks a delivery cost the listing left out as unknown, not free', async () => {
    mockJson(() => ({ data: { result: [galaxyRow()], pager: { total_pages: 1 } } }));

    const [offer] = (await jet.amazingPage(LOCATION, 1)).offers;
    expect(offer.vendor.deliveryFeeUnknown).toBe(true);
  });

  it('keeps the price the product page shows when the rest comes off at checkout', async () => {
    mockJson(() => ({ data: { result: [galaxyRow()], pager: { total_pages: 1 } } }));

    const [offer] = (await jet.amazingPage(LOCATION, 1)).offers;
    expect(offer.finalPrice).toBe(6890);
    expect(offer.pagePrice).toBe(63000);
  });

  it('shows the page price as the price when the discount is the store’s own', async () => {
    const row = galaxyRow({
      badges: { is_amazing: false },
      price: {
        price: 780000,
        discount: 62400,
        vendor_discount: 62400,
        brand_discount: 0,
        discount_percentage: 8,
      },
    });
    mockJson(() => ({ data: { result: [row], pager: { total_pages: 1 } } }));

    const [offer] = (await jet.amazingPage(LOCATION, 1)).offers;
    expect(offer.pagePrice).toBeUndefined();
  });

  it('links to the product page by the row id, inside its shop', async () => {
    mockJson(() => ({ data: { result: [galaxyRow()], pager: { total_pages: 1 } } }));

    const [offer] = (await jet.amazingPage(LOCATION, 1)).offers;
    expect(offer.url).toBe('https://www.digikalajet.com/shop/product/184114142711/55003523/');
  });
});

describe('withShops', () => {
  it('fills the shop from its header: name, delivery cost, minimum basket', async () => {
    mockJson((url) =>
      url.includes('/header/')
        ? { data: { shop: header } }
        : { data: { result: [galaxyRow()], pager: { total_pages: 1 } } },
    );

    const { offers } = await jet.amazingPage({ ...LOCATION, lat: 35.1 }, 1);
    const [offer] = await jet.withShops(offers, { ...LOCATION, lat: 35.1 });

    expect(offer.vendor.name).toBe(header.title);
    expect(offer.vendor.deliveryFee).toBe(35000);
    expect(offer.vendor.deliveryFeeUnknown).toBeUndefined();
    expect(offer.vendor.minOrder).toBe(150000);
  });

  it('asks once per shop, not once per offer', async () => {
    const fetchMock = mockJson((url) =>
      url.includes('/header/')
        ? { data: { shop: header } }
        : { data: { result: [galaxyRow(), galaxyRow({ id: 2 })], pager: { total_pages: 1 } } },
    );

    const where = { ...LOCATION, lat: 35.2 };
    const { offers } = await jet.amazingPage(where, 1);
    await jet.withShops(offers, where);

    const headerCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes('/header/'),
    );
    expect(headerCalls).toHaveLength(1);
  });

  it('leaves an offer marked unknown when its shop cannot be read', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).includes('/header/')) throw new TypeError('network');
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ data: { result: [galaxyRow()], pager: { total_pages: 1 } } }),
      } as unknown as Response;
    });

    const where = { ...LOCATION, lat: 35.3 };
    const { offers } = await jet.amazingPage(where, 1);
    const [offer] = await jet.withShops(offers, where);
    expect(offer.vendor.deliveryFeeUnknown).toBe(true);
  });

  it('asks nothing when every offer already has its cost', async () => {
    const withCost = galaxyRow({ shop: header });
    const fetchMock = mockJson(() => ({ data: { result: [withCost], pager: { total_pages: 1 } } }));

    const { offers } = await jet.amazingPage(LOCATION, 1);
    await jet.withShops(offers, LOCATION);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(offers[0].vendor.deliveryFee).toBe(35000);
  });
});
