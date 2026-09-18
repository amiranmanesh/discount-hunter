import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  askMinimums,
  gather,
  judge,
  usable,
  withMinimums,
  type BasketItem,
  type Line,
} from '../src/core/basket';
import { findItem, useBasket } from '../src/store/basket';
import type { Offer } from '../src/core/types';

const LOCATION = { lat: 35.72238, lng: 51.47782, label: 'خانه' };

const milk = (overrides: Partial<BasketItem> = {}): BasketItem => ({
  id: 'milk',
  title: 'شیر کم چرب پگاه - 946 میلی لیتر',
  image: '',
  quantity: 1,
  refs: [{ platform: 'jet', catalogId: '166111885431', title: 'شیر کم چرب پگاه - 946 میلی لیتر' }],
  rejected: [],
  ...overrides,
});

describe('judge', () => {
  it('knows its own product by id, whatever the title', () => {
    expect(judge(milk(), { platform: 'jet', catalogId: '166111885431', title: 'x' })).toBe('same');
  });

  it('knows the same product on another platform by its title', () => {
    const okala = {
      platform: 'okala' as const,
      catalogId: '194695',
      title: 'شیر کم چرب 1.2% چربی پگاه 946 میلی لیتری',
    };
    expect(judge(milk(), okala)).toBe('same');
    expect(judge(milk({ rejected: ['okala:194695'] }), okala)).toBe('different');
  });
});

describe('usable', () => {
  const line = (verdict: Line['verdict'], catalogId: string): Line => ({
    itemId: 'milk',
    storeKey: 'okala:1',
    platform: 'okala',
    ref: { platform: 'okala', catalogId, title: '' },
    title: '',
    image: '',
    url: '',
    unitPrice: 1,
    listPrice: 1,
    discountPercent: 0,
    available: 9,
    verdict,
  });

  it('uses a sure match until the user rejects it', () => {
    expect(usable(milk(), line('same', '1'))).toBe(true);
    expect(usable(milk({ rejected: ['okala:1'] }), line('same', '1'))).toBe(false);
  });

  it('uses a doubtful match only once the user accepts it', () => {
    expect(usable(milk(), line('maybe', '2'))).toBe(false);
    const accepted = milk({
      refs: [...milk().refs, { platform: 'okala', catalogId: '2', title: '' }],
    });
    expect(usable(accepted, line('maybe', '2'))).toBe(true);
  });
});

describe('gather', () => {
  function route(handlers: Record<string, (url: URL) => unknown>) {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input), 'http://localhost');
      const handler = Object.entries(handlers).find(([part]) => url.pathname.includes(part));
      const body = handler ? handler[1](url) : {};
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => body,
      } as unknown as Response;
    });
  }

  const jetRow = {
    id: 57675474,
    product_id: '166111885431',
    title: 'شیر کم چرب پگاه - 946 میلی لیتر ',
    price: { price: 1279000, discount: 0, vendor_discount: 0, brand_discount: 0 },
    stock: { has_stock: true },
    shop: {
      id: '79711579735',
      title: 'جانبو',
      cart_close_limit: 900000,
      delivery: { cost: 378000 },
      working_status: { is_open: true },
    },
  };

  beforeEach(() => {
    route({
      '/mobile/v3/product-vendors/search': () => ({
        items: [
          { id: 5979228, title: 'شیر کم چرب تازه پگاه 946 میلی لیتری' },
          { id: 111, title: 'شیر کاکائو کم چرب تازه پگاه 946 میلی لیتری' },
        ],
      }),
      '/vendor-switch/suggestions': () => [
        {
          id: 117602,
          code: '09e876',
          title: 'راکت نارمک',
          deliveryFee: 34000,
          minimumOrderValue: 170000,
          isOpen: true,
          products: [
            {
              id: 5979228,
              title: 'شیر کم چرب تازه پگاه 946 میلی لیتری',
              price: 127900,
              discount: 12790,
              stock: 13,
              quantity: 1,
            },
          ],
        },
      ],
      '/products/search/all/': () => ({ data: { result: [jetRow], pager: { total_pages: 1 } } }),
      '/stores/nearby': () => ({
        data: {
          stores: [
            { storeId: 53393, storeName: 'لیا', operationPrice: 62000, packagingPrice: 20000 },
          ],
        },
      }),
      '/stores/details': () => ({ data: { minimumOrder: 1500000 } }),
      '/cumulative/search/nearby': () => ({
        success: true,
        data: {
          0: {
            store: { storeId: 53393, storeName: 'لیا', deliveryPrice: 0 },
            products: [
              {
                id: 185412,
                masterProductId: 194695,
                name: 'شیر کم چرب 1.2% چربی پگاه 946 میلی لیتری',
                price: 1279000,
                okPrice: 1279000,
                quantity: 5,
                hasQuantity: true,
                maxOrderLimit: 3,
                storeId: 53393,
              },
            ],
          },
        },
      }),
    });
  });

  const options = {
    sources: { snapp: true, jet: true, okala: true },
    snappPro: false,
    tokens: { snapp: 's', jet: null, okala: 'o' },
  };

  it('prices the item on all three platforms, each at the store that sells it', async () => {
    const result = await gather([milk()], { ...LOCATION, lat: 35.01 }, options);

    const byPlatform = Object.fromEntries(result.lines.map((line) => [line.platform, line]));
    expect(byPlatform.jet.unitPrice).toBe(127900);
    expect(byPlatform.snapp.unitPrice).toBe(115110);
    expect(byPlatform.okala.unitPrice).toBe(127900);
    expect(Object.values(byPlatform).every((line) => line.verdict === 'same')).toBe(true);
    // The chocolate milk Snapp also found is neither used nor offered.
    expect(result.lines.some((line) => line.ref.catalogId === '111')).toBe(false);
  });

  it('carries each store’s real charges and minimum basket', async () => {
    const { stores } = await gather([milk()], { ...LOCATION, lat: 35.02 }, options);

    expect(stores.get('snapp:09e876')).toMatchObject({ deliveryFee: 34000, minOrder: 170000 });
    expect(stores.get('jet:79711579735')).toMatchObject({ deliveryFee: 37800, minOrder: 90000 });
    expect(stores.get('okala:53393')).toMatchObject({
      deliveryFee: 0,
      serviceFee: 8200,
      minOrderPending: true,
    });
  });

  it('learns an Okala minimum only when asked, for the stores asked about', async () => {
    const where = { ...LOCATION, lat: 35.05 };
    const { stores } = await gather([milk()], where, options);
    const minimums = await askMinimums(['okala:53393'], where);
    expect(withMinimums(stores, minimums).get('okala:53393')).toMatchObject({
      minOrder: 150000,
      minOrderPending: false,
    });
  });

  it('caps what an Okala store can sell by its per-order limit', async () => {
    const { lines } = await gather([milk()], { ...LOCATION, lat: 35.03 }, options);
    expect(lines.find((line) => line.platform === 'okala')?.available).toBe(3);
  });

  it('says which platforms it left out for want of a sign-in', async () => {
    const result = await gather(
      [milk()],
      { ...LOCATION, lat: 35.04 },
      {
        ...options,
        tokens: { snapp: null, jet: null, okala: null },
      },
    );
    expect(result.skipped.map((entry) => entry.platform).sort()).toEqual(['okala', 'snapp']);
    expect(result.lines.every((line) => line.platform === 'jet')).toBe(true);
  });
});

describe('basket store', () => {
  const offer = (overrides: Partial<Offer> = {}): Offer =>
    ({
      platform: 'jet',
      platformLabel: 'دیجی‌کالا جت',
      productId: '166111885431',
      catalogId: '166111885431',
      title: 'شیر کم چرب پگاه - 946 میلی لیتر',
      image: '',
      category: '',
      price: 127900,
      finalPrice: 127900,
      discountAmount: 0,
      discountPercent: 0,
      isCampaign: false,
      campaignLabel: '',
      segment: 'general',
      targeted: false,
      stock: 99,
      outOfStock: false,
      vendor: {} as Offer['vendor'],
      url: '',
      ...overrides,
    }) as Offer;

  beforeEach(() => useBasket.setState({ items: [] }));

  it('counts the same product twice as two of it', () => {
    useBasket.getState().add(offer());
    useBasket.getState().add(offer());
    expect(useBasket.getState().items).toHaveLength(1);
    expect(useBasket.getState().items[0].quantity).toBe(2);
  });

  it('recognises the same product from another platform and remembers it', () => {
    useBasket.getState().add(offer());
    useBasket.getState().add(
      offer({
        platform: 'okala',
        catalogId: '194695',
        title: 'شیر کم چرب 1.2% چربی پگاه 946 میلی لیتری',
      }),
    );
    const [item] = useBasket.getState().items;
    expect(item.quantity).toBe(2);
    expect(item.refs.map((ref) => ref.platform)).toEqual(['jet', 'okala']);
  });

  it('keeps a different product apart', () => {
    useBasket.getState().add(offer());
    useBasket
      .getState()
      .add(offer({ catalogId: '1', title: 'شیر کاکائو کم چرب پگاه - 946 میلی لیتر' }));
    expect(useBasket.getState().items).toHaveLength(2);
  });

  it('never lets the product the user added be rejected out of its own item', () => {
    useBasket.getState().add(offer());
    const [item] = useBasket.getState().items;
    useBasket.getState().reject(item.id, item.refs[0]);
    expect(findItem(useBasket.getState().items, offer())).toBeDefined();
    expect(useBasket.getState().items[0].refs).toHaveLength(1);
  });
});
