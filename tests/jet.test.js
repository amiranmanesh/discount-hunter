import { describe, expect, it, vi } from 'vitest';
import { search } from '../extension/src/api/jet.js';

const item = (overrides = {}) => ({
  id: 23437528,
  product_id: '191116822452',
  title: 'پفک نمکی مینو - 60 گرم',
  media: 'https://dkstatics-public.digikala.com/x.jpg',
  price: { price: 650000, discount: 78000, discount_percentage: 12 },
  badges: { is_amazing: false },
  stock: { has_stock: true, is_running_low: false },
  shop: {
    id: '197118504341',
    title: 'لیدو مارکت',
    delivery: { cost: 339000, estimate_time: 35 },
    working_status: { is_open: true },
    rating: { rate: 4.8 },
  },
  ...overrides,
});

function mockJet(results, pager = { total_pages: 1, total_items: results.length }) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ status: 200, data: { result: results, pager } }),
  });
}

const LOCATION = { lat: 35.72, lng: 51.47 };

describe('jet.search', () => {
  it('converts Rial prices to Toman', async () => {
    mockJet([item()]);
    const [offer] = await search('پفک', { ...LOCATION, pages: 1 });
    expect(offer.price).toBe(65000);
    expect(offer.discountAmount).toBe(7800);
    expect(offer.finalPrice).toBe(57200);
    expect(offer.vendor.deliveryFee).toBe(33900);
  });

  it('marks an amazing deal as a campaign offer', async () => {
    mockJet([item({ badges: { is_amazing: true } })]);
    const [offer] = await search('پفک', { ...LOCATION, pages: 1 });
    expect(offer.isCampaign).toBe(true);
    expect(offer.campaignLabel).toBe('شگفت‌انگیز');
  });

  it('treats an ordinary discount as a non-campaign offer', async () => {
    mockJet([item()]);
    const [offer] = await search('پفک', { ...LOCATION, pages: 1 });
    expect(offer.isCampaign).toBe(false);
  });

  it('never claims a Jet shop is Snapp Market Pro', async () => {
    mockJet([item({ shop: { ...item().shop, delivery: { cost: 0, estimate_time: 20 } } })]);
    const [offer] = await search('پفک', { ...LOCATION, pages: 1 });
    expect(offer.vendor.isPro).toBe(false);
    expect(offer.freeDelivery ?? offer.vendor.freeDelivery).toBe(true);
  });

  it('flags an out-of-stock item', async () => {
    mockJet([item({ stock: { has_stock: false } })]);
    const [offer] = await search('پفک', { ...LOCATION, pages: 1 });
    expect(offer.outOfStock).toBe(true);
    expect(offer.stock).toBe(0);
  });

  it('links to the shop-scoped search page', async () => {
    mockJet([item()]);
    const [offer] = await search('پفک مینو', { ...LOCATION, pages: 1 });
    expect(offer.url).toBe(
      'https://www.digikalajet.com/search/?q=%D9%BE%D9%81%DA%A9%20%D9%85%DB%8C%D9%86%D9%88&shopId=197118504341',
    );
  });

  it('stops paging once the API says there is one page', async () => {
    const fetchMock = mockJet([item()]);
    await search('پفک', { ...LOCATION, pages: 5 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends the location and the highest-discount sort', async () => {
    const fetchMock = mockJet([item()]);
    await search('پفک', { ...LOCATION, pages: 1 });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe('/products/search/all/');
    expect(url.searchParams.get('latitude')).toBe('35.72');
    expect(url.searchParams.get('longitude')).toBe('51.47');
    expect(url.searchParams.get('sort')).toBe('26');
  });

  it('throws with the endpoint in the message when Jet fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 503 });
    await expect(search('پفک', { ...LOCATION, pages: 1 })).rejects.toThrow('503');
  });
});
