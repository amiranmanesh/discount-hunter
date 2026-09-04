// Digikala Jet. Endpoint reference: docs/API.md
//
// Jet quotes every price in Rial; everything below converts to Toman so the two
// platforms compare. Its search takes no token — signing in only unlocks the
// account's own endpoints, such as its saved addresses.
import { ApiError, JET_BASE, request } from './http';
import { makeSession, type Session } from '../auth/session';
import type { Address, Location, Offer } from '../core/types';

const RIAL_TO_TOMAN = 10;

interface RawJetProduct {
  id: number;
  product_id?: string;
  title: string;
  media?: string;
  price?: {
    price?: number;
    discount?: number;
    discount_percentage?: number;
  };
  badges?: { is_amazing?: boolean; is_special_sale?: boolean };
  is_best_deal?: boolean;
  stock?: { has_stock?: boolean; is_running_low?: boolean };
  shop?: {
    id?: string;
    title?: string;
    media?: string;
    delivery?: { cost?: number; estimate_time?: number; is_free_by_plus?: boolean };
    working_status?: { is_open?: boolean };
    rating?: { rate?: number };
  };
}

function toOffer(item: RawJetProduct, linkQuery: string): Offer {
  const price = Number(item.price?.price ?? 0) / RIAL_TO_TOMAN;
  const discountAmount = Number(item.price?.discount ?? 0) / RIAL_TO_TOMAN;
  const shop = item.shop ?? {};
  const delivery = shop.delivery ?? {};
  const isAmazing = Boolean(
    item.badges?.is_amazing || item.badges?.is_special_sale || item.is_best_deal,
  );

  return {
    platform: 'jet',
    platformLabel: 'دیجی‌کالا جت',
    productId: String(item.product_id ?? item.id ?? ''),
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
    vendor: {
      id: shop.id ?? '',
      code: String(shop.id ?? ''),
      name: shop.title || 'فروشگاه جت',
      logo: shop.media || '',
      deliveryFee: Number(delivery.cost ?? 0) / RIAL_TO_TOMAN,
      deliveryTime: Number(delivery.estimate_time ?? 0),
      isPro: false, // "پرو" is a Snapp Market tier; Jet's equivalent perk is free shipping
      isOpen: shop.working_status?.is_open !== false,
      rating: Number(shop.rating?.rate ?? 0),
      minOrder: 0,
    },
    url: `https://www.digikalajet.com/search/?q=${encodeURIComponent(linkQuery)}&shopId=${shop.id ?? ''}`,
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

/** Search every shop that delivers to the point. `sort=26` is "بیشترین تخفیف". */
export async function search(
  query: string,
  location: Location,
  page = 1,
  token?: string | null,
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
      sort: '26',
      page: String(page),
      ch: 'jj',
    },
  });

  const rows = json.data?.result ?? [];
  const totalPages = Number(json.data?.pager?.total_pages ?? 1);
  return {
    offers: rows.map((item) => toOffer(item, query)),
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
  return (json.data?.products ?? []).map((item) => toOffer(item, item.title));
}

/** The full campaign listing behind that row. Five per page, and it says so. */
export async function amazingPage(
  location: Location,
  page = 1,
  token?: string | null,
): Promise<JetPage> {
  const json = await request<{
    data?: { products?: RawJetProduct[]; pager?: { total_items?: number; total_pages?: number } };
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

  const rows = json.data?.products ?? [];
  const totalPages = Number(json.data?.pager?.total_pages ?? 1);
  return {
    offers: rows.map((item) => toOffer(item, item.title)),
    total: Number(json.data?.pager?.total_items ?? rows.length),
    totalPages,
    hasMore: page < totalPages && rows.length > 0,
  };
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
