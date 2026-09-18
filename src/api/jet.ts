// Digikala Jet. Endpoint reference: docs/API.md
//
// Jet quotes every price in Rial; everything below converts to Toman so the two
// platforms compare. Its search takes no token — signing in only unlocks the
// account's own endpoints, such as its saved addresses.
import { ApiError, JET_BASE, request } from './http';
import { makeSession, type Session } from '../auth/session';
import type { Address, Location, Offer, Vendor } from '../core/types';

const RIAL_TO_TOMAN = 10;

interface RawJetShop {
  id?: string;
  title?: string;
  media?: string;
  /** Rial. The smallest basket the shop checks out. */
  cart_close_limit?: number;
  /** `cost` is missing from the شگفت‌انگیز and galaxy listings. */
  delivery?: { cost?: number; estimate_time?: number; is_free_by_plus?: boolean };
  working_status?: { is_open?: boolean };
  rating?: { rate?: number };
}

interface RawJetProduct {
  id: number;
  product_id?: string;
  title: string;
  media?: string;
  price?: {
    price?: number;
    /** Rial, the whole discount — including any part only taken off at checkout. */
    discount?: number;
    /** Rial. The store's and the brand's shares: what the product page shows. */
    vendor_discount?: number;
    brand_discount?: number;
    discount_percentage?: number;
  };
  badges?: { is_amazing?: boolean; is_special_sale?: boolean };
  is_best_deal?: boolean;
  stock?: { has_stock?: boolean; is_running_low?: boolean };
  /** The galaxy listing sends `{ id }` and nothing else. */
  shop?: RawJetShop;
}

function toVendor(shop: RawJetShop): Vendor {
  const delivery = shop.delivery ?? {};
  return {
    id: shop.id ?? '',
    code: String(shop.id ?? ''),
    name: shop.title || 'فروشگاه جت',
    logo: shop.media || '',
    deliveryFee: Number(delivery.cost ?? 0) / RIAL_TO_TOMAN,
    // Measured: the شگفت‌انگیز row and the galaxy listing leave `cost` out,
    // while the shop's own page charges 30,000–45,000 Toman for the same trip.
    // Reading the gap as 0 is what showed "ارسال رایگان" on every one of them.
    ...(delivery.cost === undefined ? { deliveryFeeUnknown: true } : {}),
    deliveryTime: Number(delivery.estimate_time ?? 0),
    isPro: false, // "پرو" is a Snapp Market tier; Jet's equivalent perk is free shipping
    isOpen: shop.working_status?.is_open !== false,
    rating: Number(shop.rating?.rate ?? 0),
    minOrder: Number(shop.cart_close_limit ?? 0) / RIAL_TO_TOMAN,
  };
}

/**
 * Jet's product page, inside the shop that lists it. It takes the listing row's
 * `id`; the `product_id` next to it is the catalogue id and 404s here.
 */
export function productUrl(shopId: string | number, id: string | number): string {
  return `https://www.digikalajet.com/shop/product/${shopId}/${id}/`;
}

function toOffer(item: RawJetProduct): Offer {
  const price = Number(item.price?.price ?? 0) / RIAL_TO_TOMAN;
  const discountAmount = Number(item.price?.discount ?? 0) / RIAL_TO_TOMAN;
  const shop = item.shop ?? {};
  const isAmazing = Boolean(
    item.badges?.is_amazing || item.badges?.is_special_sale || item.is_best_deal,
  );

  // The product page shows only the store's and the brand's share of the
  // discount; the شگفت‌انگیز share comes off at checkout, as «استفاده از تخفیف
  // شگفت‌انگیز». Measured on every galaxy row: page discount = vendor + brand.
  const pageDiscount =
    (Number(item.price?.vendor_discount ?? 0) + Number(item.price?.brand_discount ?? 0)) /
    RIAL_TO_TOMAN;
  const takenAtCheckout = discountAmount - pageDiscount > 0;

  return {
    platform: 'jet',
    platformLabel: 'دیجی‌کالا جت',
    productId: String(item.product_id ?? item.id ?? ''),
    catalogId: String(item.product_id ?? item.id ?? ''),
    title: item.title || '',
    image: item.media || '',
    category: '',
    price,
    finalPrice: Math.max(price - discountAmount, 0),
    discountAmount,
    discountPercent: Number(item.price?.discount_percentage ?? 0),
    isCampaign: isAmazing,
    campaignLabel: isAmazing ? 'شگفت‌انگیز' : 'تخفیف فروشگاه',
    segment: 'general', // Jet does not segment its results
    targeted: false,
    stock: item.stock?.has_stock === false ? 0 : item.stock?.is_running_low ? 1 : 99,
    outOfStock: item.stock?.has_stock === false,
    vendor: toVendor(shop),
    url: productUrl(shop.id ?? '', item.id),
    ...(takenAtCheckout ? { pagePrice: Math.max(price - pageDiscount, 0) } : {}),
    // This row came from the same search the Jet site runs, so it needs no
    // separate confirmation step.
    verified: true,
    verifiedBy: 'search',
  };
}

/* -------------------------------------------------------------- auth ---- */

const PENDING_KEY = 'dh:jet:pending';

export async function requestCode(phone: string): Promise<{ resendAfter: number }> {
  const json = await request<{
    data?: { token?: string; sms_ttl?: number; needs_captcha?: boolean };
  }>(JET_BASE, '/user/login-register/', {
    method: 'POST',
    query: { ch: 'jj' },
    body: { phone },
  });

  const data = json.data;
  if (!data?.token) throw new ApiError('پاسخ ورود دیجی‌کالا جت نامعتبر بود');
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ phone, token: data.token }));

  if (data.needs_captcha) {
    throw new ApiError('دیجی‌کالا جت کپچا خواست؛ یک بار در سایت وارد شو و دوباره امتحان کن');
  }
  return { resendAfter: Number(data.sms_ttl) || 120 };
}

export async function verifyCode(phone: string, code: string): Promise<Session> {
  const raw = sessionStorage.getItem(PENDING_KEY);
  const pending = raw ? (JSON.parse(raw) as { phone: string; token: string }) : null;
  if (!pending?.token || pending.phone !== phone) throw new ApiError('اول کد را درخواست کن');

  const json = await request<{
    data?: { token?: string; refresh_token?: string; user_id?: number };
  }>(JET_BASE, '/user/confirm-phone/', {
    method: 'POST',
    query: { ch: 'jj' },
    body: { token: pending.token, code, phone },
  });

  if (!json.data?.token) throw new ApiError('کد پذیرفته نشد');
  sessionStorage.removeItem(PENDING_KEY);
  return makeSession({
    accessToken: json.data.token,
    refreshToken: json.data.refresh_token ?? null,
    subject: phone,
    userId: json.data.user_id ?? null,
  });
}

/**
 * Jet's web app has no refresh call — it carries a token good for about a day.
 * Failing here is what tells the session store to ask for a new sign-in rather
 * than retry a dead token forever.
 */
export async function refresh(): Promise<Session> {
  throw new ApiError('نشست دیجی‌کالا جت منقضی شده؛ دوباره وارد شو');
}

/* ------------------------------------------------------------ catalog ---- */

export interface JetPage {
  offers: Offer[];
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/** Jet's sort orders: 26 is «بیشترین تخفیف», 22 its default relevance. */
export type JetSort = '26' | '22';

/** Search every shop that delivers to the point, deepest discount first by default. */
export async function search(
  query: string,
  location: Location,
  page = 1,
  token?: string | null,
  sort: JetSort = '26',
): Promise<JetPage> {
  const json = await request<{
    data?: {
      result?: RawJetProduct[];
      pager?: { total_items?: number; total_pages?: number };
    };
  }>(JET_BASE, '/products/search/all/', {
    token,
    tokenScheme: 'raw',
    query: {
      q: query,
      shopId: '',
      latitude: String(location.lat),
      longitude: String(location.lng),
      sort,
      page: String(page),
      ch: 'jj',
    },
  });

  const rows = json.data?.result ?? [];
  const totalPages = Number(json.data?.pager?.total_pages ?? 1);
  return {
    offers: rows.map(toOffer),
    total: Number(json.data?.pager?.total_items ?? rows.length),
    totalPages,
    hasMore: page < totalPages && rows.length > 0,
  };
}

/**
 * The "شگفت‌انگیز" row from the home page: a short list of the deepest
 * discounts in range, in one request. Not paginated, so it seeds the feed.
 */
export async function amazingHighlights(
  location: Location,
  token?: string | null,
): Promise<Offer[]> {
  const json = await request<{ data?: { products?: RawJetProduct[] } }>(
    JET_BASE,
    '/post-process/amazing-widget-on-other-lines/1/',
    {
      token,
      tokenScheme: 'raw',
      query: {
        sourcePage: 'home',
        latitude: String(location.lat),
        longitude: String(location.lng),
        ch: 'jj',
      },
    },
  );
  return (json.data?.products ?? []).map(toOffer);
}

/**
 * The full campaign listing behind that row ("کهکشانی‌ها"). Five per page, and
 * it says so. Its rows carry the shop as a bare `{ id }` — see `withShops`.
 */
export async function amazingPage(
  location: Location,
  page = 1,
  token?: string | null,
): Promise<JetPage> {
  const json = await request<{
    data?: {
      result?: RawJetProduct[];
      products?: RawJetProduct[];
      pager?: { total_items?: number; total_pages?: number };
    };
  }>(JET_BASE, '/v2/products/galaxy/', {
    token,
    tokenScheme: 'raw',
    query: {
      pageName: 'home',
      latitude: String(location.lat),
      longitude: String(location.lng),
      page: String(page),
      ch: 'jj',
    },
  });

  // The rows moved from `products` to `result`; reading only the old key left
  // the feed with the شگفت‌انگیز row and nothing after it.
  const rows = json.data?.result ?? json.data?.products ?? [];
  const totalPages = Number(json.data?.pager?.total_pages ?? 1);
  return {
    offers: rows.map(toOffer),
    total: Number(json.data?.pager?.total_items ?? rows.length),
    totalPages,
    hasMore: page < totalPages && rows.length > 0,
  };
}

/* ------------------------------------------------------------- shops ---- */

/** Shop headers are per point and change slowly; one lookup serves a scroll. */
const SHOP_TTL = 5 * 60_000;
const shopCache = new Map<string, { at: number; shop: Promise<RawJetShop | null> }>();

/** The header the shop's own page shows: name, delivery cost, minimum basket. */
export function shopHeader(
  shopId: string,
  location: Location,
  token?: string | null,
): Promise<RawJetShop | null> {
  const key = `${shopId}@${location.lat},${location.lng}`;
  const hit = shopCache.get(key);
  if (hit && Date.now() - hit.at < SHOP_TTL) return hit.shop;

  const shop = request<{ data?: { shop?: RawJetShop } }>(JET_BASE, `/shop/${shopId}/header/`, {
    token,
    tokenScheme: 'raw',
    query: { latitude: String(location.lat), longitude: String(location.lng), ch: 'jj' },
  })
    .then((json) => json.data?.shop ?? null)
    // A shop that cannot be read keeps its offers, marked as of unknown cost,
    // and is asked again next time rather than remembered as missing.
    .catch(() => {
      shopCache.delete(key);
      return null;
    });
  shopCache.set(key, { at: Date.now(), shop });
  return shop;
}

/**
 * Fills in the shop for every offer whose listing left the delivery cost out.
 * One request per distinct shop, not per offer.
 */
export async function withShops(
  offers: Offer[],
  location: Location,
  token?: string | null,
): Promise<Offer[]> {
  const ids = [
    ...new Set(
      offers.filter((offer) => offer.vendor.deliveryFeeUnknown).map((offer) => offer.vendor.code),
    ),
  ].filter(Boolean);
  if (!ids.length) return offers;

  const shops = new Map(
    await Promise.all(ids.map(async (id) => [id, await shopHeader(id, location, token)] as const)),
  );
  return offers.map((offer) => {
    const shop = offer.vendor.deliveryFeeUnknown ? shops.get(offer.vendor.code) : null;
    if (!shop) return offer;
    const vendor = toVendor({ ...shop, id: shop.id ?? offer.vendor.code });
    return { ...offer, vendor };
  });
}

/** The addresses saved on the Jet account. Needs the token. */
export async function savedAddresses(token: string): Promise<Address[]> {
  const json = await request<{
    data?: {
      addresses?: {
        id: number;
        name?: string | null;
        short_address?: string;
        address?: string;
        latitude: string;
        longitude: string;
      }[];
    };
  }>(JET_BASE, '/address/', { token, tokenScheme: 'raw', query: { ch: 'jj' } });

  return (json.data?.addresses ?? [])
    .filter((entry) => Number(entry.latitude) && Number(entry.longitude))
    .map((entry) => ({
      id: `jet-${entry.id}`,
      label: entry.name || entry.short_address || 'آدرس جت',
      address: entry.address || '',
      lat: Number(entry.latitude),
      lng: Number(entry.longitude),
      source: 'jet' as const,
    }));
}
