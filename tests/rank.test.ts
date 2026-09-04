import { describe, expect, it } from 'vitest';
import { SORT_MODES, dedupe, rank, totalCost } from '../src/core/rank';
import type { Offer } from '../src/core/types';

const offer = (overrides: Partial<Offer> = {}): Offer => ({
  platform: 'snapp',
  platformLabel: 'اسنپ‌مارکت',
  productId: '1',
  title: 'کالا',
  image: '',
  category: '',
  price: 100000,
  finalPrice: 50000,
  discountAmount: 50000,
  discountPercent: 50,
  isCampaign: true,
  campaignLabel: 'تخفیف نارنجی',
  segment: 'general',
  targeted: false,
  stock: 10,
  outOfStock: false,
  url: '',
  vendor: {
    id: 1,
    code: 'a',
    name: 'فروشگاه',
    logo: '',
    deliveryFee: 20000,
    deliveryTime: 45,
    isPro: false,
    isOpen: true,
    rating: 8,
    minOrder: 0,
  },
  ...overrides,
});

const withVendor = (
  code: string,
  extra: Partial<Offer['vendor']> = {},
  rest: Partial<Offer> = {},
) => offer({ ...rest, vendor: { ...offer().vendor, code, ...extra } });

const codes = (list: Offer[]) => list.map((o) => o.vendor.code);

describe('best-discount ordering', () => {
  it('puts the deeper discount first', () => {
    const list = [
      withVendor('low', {}, { discountPercent: 40 }),
      withVendor('high', {}, { discountPercent: 80 }),
    ];
    expect(codes(rank(list))).toEqual(['high', 'low']);
  });

  it('prefers a Pro vendor when the discounts land in the same 5% bucket', () => {
    const list = [
      withVendor('plain', { isPro: false }, { discountPercent: 41 }),
      withVendor('pro', { isPro: true }, { discountPercent: 40 }),
    ];
    expect(codes(rank(list))[0]).toBe('pro');
  });

  it('falls back to the cheaper delivery between two equal vendors', () => {
    const list = [
      withVendor('far', { deliveryFee: 30000 }),
      withVendor('near', { deliveryFee: 2000 }),
    ];
    expect(codes(rank(list))).toEqual(['near', 'far']);
  });

  it('sinks closed stores and out-of-stock items below everything else', () => {
    const list = [
      withVendor('gone', {}, { discountPercent: 99, outOfStock: true }),
      withVendor('closed', { isOpen: false }, { discountPercent: 95 }),
      withVendor('open', {}, { discountPercent: 10 }),
    ];
    expect(codes(rank(list))).toEqual(['open', 'closed', 'gone']);
  });
});

describe('other sort modes', () => {
  it('cheapest-total adds the delivery fee to the price', () => {
    const list = [
      withVendor('cheap-item', { deliveryFee: 40000 }, { finalPrice: 30000 }),
      withVendor('cheap-total', { deliveryFee: 2000 }, { finalPrice: 50000 }),
    ];
    expect(codes(rank(list, 'cheapest-total'))).toEqual(['cheap-total', 'cheap-item']);
  });

  it('lowest-delivery ignores the discount', () => {
    const list = [
      withVendor('far', { deliveryFee: 50000 }, { discountPercent: 90 }),
      withVendor('near', { deliveryFee: 0 }, { discountPercent: 5 }),
    ];
    expect(codes(rank(list, 'lowest-delivery'))).toEqual(['near', 'far']);
  });

  it('exposes every mode it can sort by', () => {
    expect(Object.keys(SORT_MODES)).toEqual(['best-discount', 'cheapest-total', 'lowest-delivery']);
  });
});

describe('totalCost', () => {
  it('is the item price plus delivery', () => {
    expect(totalCost(offer({ finalPrice: 15400 }))).toBe(35400);
  });
});

describe('dedupe', () => {
  it('keeps the campaign listing over the plain catalogue one', () => {
    const list = [
      offer({ isCampaign: false, finalPrice: 40000, campaignLabel: 'catalogue' }),
      offer({ isCampaign: true, finalPrice: 50000, campaignLabel: 'campaign' }),
    ];
    expect(dedupe(list)).toHaveLength(1);
    expect(dedupe(list)[0].campaignLabel).toBe('campaign');
  });

  it('keeps the cheaper of two listings of the same kind', () => {
    const list = [offer({ finalPrice: 50000 }), offer({ finalPrice: 30000 })];
    expect(dedupe(list).map((o) => o.finalPrice)).toEqual([30000]);
  });

  it('does not merge the same product across two stores', () => {
    expect(dedupe([withVendor('a'), withVendor('b')])).toHaveLength(2);
  });
});
