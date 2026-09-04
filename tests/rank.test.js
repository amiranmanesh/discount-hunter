import { describe, expect, it } from 'vitest';
import { dedupe, rank, totalCost, SORT_MODES } from '../extension/src/core/rank.js';

const offer = (overrides = {}) => ({
  platform: 'snapp',
  productId: '1',
  title: 'کالا',
  price: 100000,
  finalPrice: 50000,
  discountAmount: 50000,
  discountPercent: 50,
  isCampaign: true,
  outOfStock: false,
  vendor: { code: 'a', name: 'فروشگاه', deliveryFee: 20000, isPro: false, isOpen: true },
  ...overrides,
});

const names = (list) => list.map((o) => o.vendor.code);

describe('best-discount ordering', () => {
  it('puts the deeper discount first', () => {
    const list = [
      offer({ discountPercent: 40, vendor: { ...offer().vendor, code: 'low' } }),
      offer({ discountPercent: 80, vendor: { ...offer().vendor, code: 'high' } }),
    ];
    expect(names(rank(list))).toEqual(['high', 'low']);
  });

  it('prefers a Pro vendor when the discounts land in the same 5% bucket', () => {
    const list = [
      offer({ discountPercent: 41, vendor: { ...offer().vendor, code: 'plain', isPro: false } }),
      offer({ discountPercent: 40, vendor: { ...offer().vendor, code: 'pro', isPro: true } }),
    ];
    expect(names(rank(list))[0]).toBe('pro');
  });

  it('falls back to the cheaper delivery between two equal vendors', () => {
    const list = [
      offer({ vendor: { ...offer().vendor, code: 'far', deliveryFee: 30000 } }),
      offer({ vendor: { ...offer().vendor, code: 'near', deliveryFee: 2000 } }),
    ];
    expect(names(rank(list))).toEqual(['near', 'far']);
  });

  it('sinks closed stores and out-of-stock items below everything else', () => {
    const list = [
      offer({ discountPercent: 99, outOfStock: true, vendor: { ...offer().vendor, code: 'gone' } }),
      offer({
        discountPercent: 95,
        vendor: { ...offer().vendor, code: 'closed', isOpen: false },
      }),
      offer({ discountPercent: 10, vendor: { ...offer().vendor, code: 'open' } }),
    ];
    expect(names(rank(list))).toEqual(['open', 'closed', 'gone']);
  });
});

describe('other sort modes', () => {
  it('cheapest-total adds the delivery fee to the price', () => {
    const list = [
      offer({
        finalPrice: 30000,
        vendor: { ...offer().vendor, code: 'cheap-item', deliveryFee: 40000 },
      }),
      offer({
        finalPrice: 50000,
        vendor: { ...offer().vendor, code: 'cheap-total', deliveryFee: 2000 },
      }),
    ];
    expect(names(rank(list, 'cheapest-total'))).toEqual(['cheap-total', 'cheap-item']);
  });

  it('lowest-delivery ignores the discount', () => {
    const list = [
      offer({
        discountPercent: 90,
        vendor: { ...offer().vendor, code: 'far', deliveryFee: 50000 },
      }),
      offer({ discountPercent: 5, vendor: { ...offer().vendor, code: 'near', deliveryFee: 0 } }),
    ];
    expect(names(rank(list, 'lowest-delivery'))).toEqual(['near', 'far']);
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
    const list = [
      offer({ vendor: { ...offer().vendor, code: 'a' } }),
      offer({ vendor: { ...offer().vendor, code: 'b' } }),
    ];
    expect(dedupe(list)).toHaveLength(2);
  });
});
