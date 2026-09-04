import { describe, expect, it, vi } from 'vitest';
import * as okala from '../src/api/okala';

const LOCATION = { lat: 35.722248, lng: 51.478102, label: 'تهران' };

function mockJson(handler: (url: string, init?: RequestInit) => unknown) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const body = handler(String(input), init);
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => body ?? {},
    } as unknown as Response;
  });
}

const product = (overrides: Record<string, unknown> = {}) => ({
  id: 190926,
  name: 'پفک نمکی مینو 60 گرمی',
  imageUrl: 'https://asset.okala.com/p.png',
  price: 650000, // Rial
  okPrice: 609375,
  discountPercent: 6,
  isShowDiscount: true,
  quantity: 21,
  hasQuantity: true,
  ...overrides,
});

const store = {
  storeId: 8836,
  storeName: 'پلاتینیوم',
  logo: 'https://asset.okala.com/s.png',
  rate: 4.2,
  deliveryPrice: 250000, // Rial
  onDemandEta: '01:30:00',
};

describe('search', () => {
  it('converts Rial to Toman for prices and the delivery fee', async () => {
    mockJson(() => ({ data: { 0: { store, products: [product()] } }, success: true }));

    const [offer] = await okala.search('پفک', LOCATION, 'token');

    expect(offer.price).toBe(65000);
    expect(offer.finalPrice).toBe(60937.5);
    expect(offer.discountAmount).toBe(4062.5);
    expect(offer.discountPercent).toBe(6);
    expect(offer.vendor.deliveryFee).toBe(25000);
  });

  it('reads the delivery estimate out of its `hh:mm:ss` form', async () => {
    mockJson(() => ({ data: { 0: { store, products: [product()] } } }));
    const [offer] = await okala.search('پفک', LOCATION, 'token');
    expect(offer.vendor.deliveryTime).toBe(90);
  });

  it('keeps every store group, not just the first', async () => {
    mockJson(() => ({
      data: {
        0: { store, products: [product()] },
        1: { store: { ...store, storeId: 1, storeName: 'دوم' }, products: [product(), product()] },
      },
    }));

    const offers = await okala.search('پفک', LOCATION, 'token');
    expect(offers).toHaveLength(3);
    expect(new Set(offers.map((o) => o.vendor.name))).toEqual(new Set(['پلاتینیوم', 'دوم']));
  });

  it('sends the bearer token and the gateway headers', async () => {
    const fetchMock = mockJson(() => ({ data: {} }));
    await okala.search('پفک', LOCATION, 'token');

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer token');
    expect(headers['x-user-unique-id']).toBeTruthy();
    expect(headers['x-correlation-id']).toBeTruthy();
    // An authenticated call must not claim it skips authorization.
    expect(headers['x-skip-authorization']).toBeUndefined();
  });

  it('surfaces the API message when the search is rejected', async () => {
    mockJson(() => ({ success: false, errorMessage: 'خطای اوکالا' }));
    await expect(okala.search('پفک', LOCATION, 'token')).rejects.toThrow('خطای اوکالا');
  });

  it('marks an item with no stock as out of stock', async () => {
    mockJson(() => ({ data: { 0: { store, products: [product({ hasQuantity: false })] } } }));
    const [offer] = await okala.search('پفک', LOCATION, 'token');
    expect(offer.outOfStock).toBe(true);
  });

  it('treats a product without a discount as a plain store price', async () => {
    mockJson(() => ({
      data: {
        0: {
          store,
          products: [product({ isShowDiscount: false, okPrice: 650000, discountPercent: 0 })],
        },
      },
    }));

    const [offer] = await okala.search('پفک', LOCATION, 'token');
    expect(offer.isCampaign).toBe(false);
    expect(offer.campaignLabel).toBe('قیمت فروشگاه');
    expect(offer.finalPrice).toBe(65000);
  });
});

describe('offers', () => {
  it('flattens every carousel and keeps each product its own store', async () => {
    mockJson(() => ({
      carousels: [
        { title: 'تخفیف آخرهفته', products: [product({ storeId: 1, storeName: 'یک' })] },
        { title: 'دست‌چین', products: [product({ storeId: 2, storeName: 'دو' })] },
      ],
    }));

    const offers = await okala.offers(LOCATION, [1, 2]);
    expect(offers.map((o) => o.vendor.name)).toEqual(['یک', 'دو']);
  });

  it('asks for nothing when there are no stores in range', async () => {
    const fetchMock = mockJson(() => ({ carousels: [] }));
    expect(await okala.offers(LOCATION, [])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('repeats storeIds the way the gateway expects, and needs no token', async () => {
    const fetchMock = mockJson(() => ({ carousels: [] }));
    await okala.offers(LOCATION, [11, 22, 33]);

    const url = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost');
    expect(url.searchParams.getAll('storeIds')).toEqual(['11', '22', '33']);

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
    expect(headers['x-skip-authorization']).toBe('true');
  });
});

describe('login', () => {
  it('sends the OTP request the website sends', async () => {
    const fetchMock = mockJson(() => ({ success: true }));
    await okala.requestCode('09123456789');

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({
      mobile: '09123456789',
      deviceTypeCode: 10,
      ValidationCodeCreateReason: 5,
    });
  });

  it('rejects when the gateway refuses the number', async () => {
    mockJson(() => ({ success: false, message: 'شماره پذیرفته نشد' }));
    await expect(okala.requestCode('09123456789')).rejects.toThrow('شماره پذیرفته نشد');
  });

  it('exchanges the code form-encoded and takes the expiry from the response', async () => {
    const fetchMock = mockJson(() => ({
      access_token: 'opaque-not-a-jwt',
      refresh_token: 'r1',
      expires_in: 36000,
      UserInfo: { Id: 899433 },
    }));

    const session = await okala.verifyCode('09123456789', '12345');

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['content-type']).toBe(
      'application/x-www-form-urlencoded',
    );
    expect(String(init.body)).toContain('grant_type=customer_grant_type');
    expect(session.accessToken).toBe('opaque-not-a-jwt');
    expect(session.userId).toBe(899433);
    // The token is not a JWT, so the expiry has to come from `expires_in`.
    expect(session.expiresAt).toBeGreaterThan(Date.now() + 35_000_000);
  });

  it('has no refresh, and says so rather than retrying a dead token', async () => {
    await expect(okala.refresh()).rejects.toThrow('دوباره وارد شو');
  });
});
