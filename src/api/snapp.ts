// Snapp Market. Endpoint reference: docs/API.md
import { ApiError, NotSignedInError, SNAPP_BASE, request } from './http';
import { makeSession, type Session } from '../auth/session';
import { normalize } from '../core/text';
import { isPoolError, pooled } from '../core/pool';
import type { Location, Offer, Vendor } from '../core/types';

const APP_VERSION = '1.399.10';
const DEVICE_KEY = 'dh:snapp:udid';
const CLIENT_ID = 'snappfood_pwa';
const CLIENT_SECRET = 'snappfood_pwa_secret';
const SCOPE = 'mobile_v2 mobile_v1 webview';

export function deviceId(): string {
  let udid = localStorage.getItem(DEVICE_KEY);
  if (!udid) {
    udid = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, udid);
  }
  return udid;
}

function common(location?: Location) {
  return {
    client: 'PWA',
    deviceType: 'PWA',
    appVersion: APP_VERSION,
    UDID: deviceId(),
    ...(location ? { lat: String(location.lat), long: String(location.lng) } : {}),
  };
}

/** The API answers 200 with `status: false` for a rejected request. */
function assertOk<T extends { status?: unknown; message?: string }>(json: T): T {
  if (json?.status === false) throw new ApiError(json.message || 'درخواست پذیرفته نشد');
  return json;
}

/* -------------------------------------------------------------- auth ---- */

export async function requestCode(phone: string, location?: Location): Promise<void> {
  assertOk(
    await request<{ status: boolean; message?: string }>(
      SNAPP_BASE,
      '/mobile/v4/user/loginMobileWithNoPass',
      {
        method: 'POST',
        query: common(location),
        form: new URLSearchParams({ captcha: '', cellphone: phone, optionalLoginToken: 'true' }),
      },
    ),
  );
}

export async function verifyCode(
  phone: string,
  code: string,
  location?: Location,
): Promise<Session> {
  const json = assertOk(
    await request<{
      status: boolean;
      message?: string;
      data?: { oauth2_token?: { access_token?: string; refresh_token?: string } };
    }>(SNAPP_BASE, '/mobile/v2/user/loginMobileWithToken', {
      method: 'POST',
      query: common(location),
      form: new URLSearchParams({ cellphone: phone, code }),
    }),
  );

  const token = json.data?.oauth2_token;
  if (!token?.access_token) throw new ApiError('پاسخ ورود اسنپ‌مارکت نامعتبر بود');
  return makeSession({
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    subject: phone,
  });
}

export async function refresh(session: Session, location?: Location): Promise<Session> {
  if (!session.refreshToken) throw new ApiError('توکن تمدید موجود نیست');
  const json = assertOk(
    await request<{ status: boolean; data?: { access_token?: string; refresh_token?: string } }>(
      SNAPP_BASE,
      '/oauth2/default/token',
      {
        method: 'POST',
        query: common(location),
        body: {
          data: {
            time: new Date().toISOString(),
            device_uid: deviceId(),
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: session.refreshToken,
            scope: SCOPE,
          },
        },
      },
    ),
  );

  if (!json.data?.access_token) throw new ApiError('تمدید نشست اسنپ‌مارکت ناموفق بود');
  return makeSession({
    accessToken: json.data.access_token,
    // The grant may or may not rotate the refresh token; keep the old one if not.
    refreshToken: json.data.refresh_token ?? session.refreshToken,
    subject: session.subject,
  });
}

/* ------------------------------------------------------------ catalog ---- */

interface RawVendor {
  vendor_id: number;
  vendor_code: string;
  vendor_name: string;
  vendor_logo?: string;
  delivery_fee?: number;
  delivery_time?: number;
  IsPro?: boolean;
  IsOpen?: boolean;
  rating?: number;
  products?: RawProduct[];
  personalizedProducts?: RawProduct[];
}

interface RawProduct {
  productVariationId: number;
  productVariationTitle?: string;
  title?: string;
  price?: number;
  discount?: number;
  discountRatio?: number;
  stock?: number;
  is_out_of_stock?: boolean;
  minOrder?: number;
  main_image?: string;
  image?: string;
  menu_category_title?: string;
  segment?: string;
}

function toVendor(raw: RawVendor): Vendor {
  return {
    id: raw.vendor_id,
    code: raw.vendor_code,
    name: raw.vendor_name,
    logo: raw.vendor_logo || '',
    deliveryFee: Number(raw.delivery_fee ?? 0),
    deliveryTime: Number(raw.delivery_time ?? 0),
    isPro: Boolean(raw.IsPro),
    isOpen: raw.IsOpen !== false,
    rating: Number(raw.rating ?? 0),
    minOrder: 0,
  };
}

/**
 * `segment` decides who can actually buy at this price. Measured against a live
 * campaign: `products` is 100% `general` and tops out near 44% off, while
 * `personalizedProducts` — the "ویژه خرید اول" shelf — mixes in `new_user` rows
 * carrying every 90-99% discount. Those prices do not exist for an established
 * account, so that bucket is never read; this guard is the second line.
 */
export function toOffer(product: RawProduct, vendor: Vendor): Offer {
  const price = Number(product.price ?? 0);
  const discount = Number(product.discount ?? 0);
  const segment = product.segment || 'general';
  const slug = encodeURIComponent((vendor.name || 'store').replace(/\s+/g, '-'));

  return {
    platform: 'snapp',
    platformLabel: 'اسنپ‌مارکت',
    productId: String(product.productVariationId ?? ''),
    title: product.productVariationTitle || product.title || '',
    image: product.main_image || product.image || '',
    category: product.menu_category_title || '',
    price,
    finalPrice: Math.max(price - discount, 0),
    discountAmount: discount,
    discountPercent: Number(product.discountRatio ?? 0),
    isCampaign: true,
    campaignLabel: 'تخفیف نارنجی',
    segment,
    targeted: segment !== 'general',
    stock: Number(product.stock ?? 0),
    outOfStock: Boolean(product.is_out_of_stock),
    vendor: { ...vendor, minOrder: Number(product.minOrder ?? vendor.minOrder ?? 0) },
    url: `https://snapp.market/supermarket/${slug}/${vendor.code}`,
  };
}

export interface CampaignPage {
  offers: Offer[];
  vendorCount: number;
  totalVendors: number;
  firstOrderSkipped: number;
  hasMore: boolean;
}

/**
 * One page of the campaign, straight from the nearby-vendors listing.
 *
 * Twenty vendors with ten offers each is a single request, which is what makes
 * an endless discount feed affordable. The per-vendor shelf endpoint returns
 * far more per store, but at one request per store.
 */
export async function campaignPage(
  token: string,
  location: Location,
  page: number,
  pageSize = 20,
): Promise<CampaignPage> {
  const json = await request<{ data?: { total_count?: number; vendors?: RawVendor[] } }>(
    SNAPP_BASE,
    `/market-party/${location.lat}/${location.lng}`,
    {
      token,
      query: {
        deal_type: 'supermarket',
        isPro: 'false',
        page: String(page),
        page_size: String(pageSize),
        ...common(location),
      },
    },
  );

  const vendors = json.data?.vendors ?? [];
  const total = Number(json.data?.total_count ?? 0);
  const offers: Offer[] = [];
  let firstOrderSkipped = 0;

  for (const raw of vendors) {
    firstOrderSkipped += raw.personalizedProducts?.length ?? 0;
    const vendor = toVendor(raw);
    for (const product of raw.products ?? []) {
      const offer = toOffer(product, vendor);
      if (!offer.targeted) offers.push(offer);
    }
  }

  return {
    offers,
    vendorCount: vendors.length,
    totalVendors: total,
    firstOrderSkipped,
    hasMore: vendors.length > 0 && (page + 1) * pageSize < total,
  };
}

/** Every nearby vendor running the campaign, for a search that needs them all. */
export async function campaignVendors(
  token: string,
  location: Location,
  maxVendors = 60,
): Promise<{ vendors: Vendor[]; previews: Offer[]; firstOrderSkipped: number }> {
  const vendors: Vendor[] = [];
  const previews: Offer[] = [];
  let firstOrderSkipped = 0;
  let total = Infinity;

  for (let page = 0; vendors.length < Math.min(maxVendors, total) && page < 20; page += 1) {
    const json = await request<{ data?: { total_count?: number; vendors?: RawVendor[] } }>(
      SNAPP_BASE,
      `/market-party/${location.lat}/${location.lng}`,
      {
        token,
        query: {
          deal_type: 'supermarket',
          isPro: 'false',
          page: String(page),
          page_size: '20',
          ...common(location),
        },
      },
    );
    const batch = json.data?.vendors ?? [];
    if (!batch.length) break;
    total = Number(json.data?.total_count ?? vendors.length);

    for (const raw of batch) {
      firstOrderSkipped += raw.personalizedProducts?.length ?? 0;
      const vendor = toVendor(raw);
      vendors.push(vendor);
      for (const product of raw.products ?? []) {
        const offer = toOffer(product, vendor);
        if (!offer.targeted) previews.push(offer);
      }
    }
  }

  return { vendors: vendors.slice(0, maxVendors), previews, firstOrderSkipped };
}

/** One vendor's full campaign shelf. The listing above previews only ten. */
export async function vendorShelf(
  token: string,
  vendor: Vendor,
  location: Location,
): Promise<{ offers: Offer[]; firstOrderSkipped: number; endsAt: string | null }> {
  const json = await request<{
    data?: {
      firstActivePeriodEndRFC?: string;
      products?: { List?: RawProduct[] } | RawProduct[];
      personalizedProducts?: { List?: RawProduct[] } | RawProduct[];
    };
  }>(SNAPP_BASE, `/market-party/${vendor.code}`, {
    token,
    query: { variable: vendor.code, page_size: '100', ...common(location) },
  });

  const asList = (value: { List?: RawProduct[] } | RawProduct[] | undefined): RawProduct[] =>
    Array.isArray(value) ? value : (value?.List ?? []);

  const offers = asList(json.data?.products)
    .map((product) => toOffer(product, vendor))
    .filter((offer) => !offer.targeted);

  return {
    offers,
    firstOrderSkipped: asList(json.data?.personalizedProducts).length,
    endsAt: json.data?.firstActivePeriodEndRFC ?? null,
  };
}

/**
 * Re-prices an offer against the vendor's own shelf — the request the store page
 * itself makes. The campaign feed is a promotion, not a price list, so nothing
 * from it is shown until this confirms it. Returns null when the store does not
 * list the product.
 */
export async function verifyOffer(
  token: string,
  offer: Offer,
  location: Location,
): Promise<Offer | null> {
  const json = await request<{
    data?: {
      result?: {
        id: number;
        title: string;
        price: number;
        discount?: number;
        discountRatio?: number;
        stock?: number;
      }[];
    };
  }>(SNAPP_BASE, '/mobile/v2/product-variation/search', {
    token,
    query: {
      query: offer.title,
      vendorCode: offer.vendor.code,
      firstPage: 'true',
      page: '0',
      page_size: '10',
      size: '10',
      origin: 'vp-search',
      source: '2',
      latitude: String(location.lat),
      longitude: String(location.lng),
      ...common(location),
    },
  });

  const rows = json.data?.result ?? [];
  // The two endpoints do not always agree on a product id, so fall back to the
  // canonical title, which both spell the same way.
  const wanted = normalize(offer.title);
  const match =
    rows.find((row) => String(row.id) === offer.productId) ??
    rows.find((row) => normalize(row.title) === wanted);
  if (!match) return null;

  const price = Number(match.price ?? 0);
  const discount = Number(match.discount ?? 0);
  return {
    ...offer,
    verified: true,
    verifiedBy: 'shelf',
    price,
    finalPrice: Math.max(price - discount, 0),
    discountAmount: discount,
    discountPercent: Number(match.discountRatio ?? 0),
    stock: Number(match.stock ?? offer.stock),
    outOfStock: Number(match.stock ?? 1) <= 0,
    campaignPrice: offer.finalPrice,
  };
}

export async function verifyOffers(
  token: string,
  offers: Offer[],
  location: Location,
  concurrency = 4,
): Promise<(Offer | null)[]> {
  const checked = await pooled(offers, concurrency, (offer) => verifyOffer(token, offer, location));
  return checked.map((result) => (isPoolError(result) ? null : result));
}

export async function suggest(token: string, query: string, location: Location): Promise<string[]> {
  const json = await request<{ suggested_keywords?: string[] }>(
    SNAPP_BASE,
    '/mobile/v3/search/suggest',
    { token, query: { query, source: '2', ...common(location) } },
  );
  return json.suggested_keywords ?? [];
}

/** Ordinary catalogue search, joined to the vendors that deliver here. */
export async function searchCatalogue(
  token: string,
  query: string,
  location: Location,
  pages = 2,
): Promise<Offer[]> {
  const [items, vendors] = await Promise.all([
    (async () => {
      const all: {
        id: number;
        document_id: string;
        title: string;
        price: number;
        discount?: number;
        discountRatio?: number;
        images?: { main?: string; thumb?: string }[];
        subcategory_slug?: string;
      }[] = [];
      for (let page = 0; page < pages; page += 1) {
        const json = await request<{ items?: typeof all }>(
          SNAPP_BASE,
          '/mobile/v3/product-vendors/search',
          {
            token,
            query: {
              page: String(page),
              query,
              new_search: '1',
              new_design: '0',
              'superType[]': '4',
              size: '30',
              origin: 'sl-search',
              source: '2',
              personalize: 'true',
              ...common(location),
            },
          },
        );
        const batch = json.items ?? [];
        all.push(...batch);
        if (batch.length < 30) break;
      }
      return all;
    })(),
    nearbyVendors(token, location),
  ]);

  const offers: Offer[] = [];
  for (const item of items) {
    const vendorId = String(item.document_id ?? '').split('-')[1];
    const vendor = vendors.get(vendorId);
    if (!vendor) continue; // this vendor does not deliver here
    const price = Number(item.price ?? 0);
    const discount = Number(item.discount ?? 0);
    const slug = encodeURIComponent((vendor.name || 'store').replace(/\s+/g, '-'));

    offers.push({
      platform: 'snapp',
      platformLabel: 'اسنپ‌مارکت',
      productId: String(item.id ?? ''),
      title: item.title || '',
      image: item.images?.[0]?.main || item.images?.[0]?.thumb || '',
      category: item.subcategory_slug || '',
      price,
      finalPrice: Math.max(price - discount, 0),
      discountAmount: discount,
      discountPercent: Number(item.discountRatio ?? 0),
      isCampaign: false,
      campaignLabel: 'تخفیف فروشگاه',
      segment: 'general',
      targeted: false,
      stock: 99,
      outOfStock: false,
      vendor,
      url: `https://snapp.market/supermarket/${slug}/${vendor.code}`,
    });
  }
  return offers;
}

const PRO_DISCOUNT = '18000'; // the site's own delivery-discount hint for Pro members

/** Every supermarket that delivers here, keyed by vendor id. */
export async function nearbyVendors(
  token: string,
  location: Location,
  pageSize = 50,
): Promise<Map<string, Vendor>> {
  const json = await request<{
    data?: {
      finalResult?: {
        data: {
          id: number;
          code: string;
          title: string;
          logo?: string;
          deliveryFee?: number;
          deliveryTime?: number;
          is_pro?: boolean;
          isOpen?: boolean;
          rate?: number;
          minimumOrderValue?: number;
        };
      }[];
    };
  }>(SNAPP_BASE, '/express-vendor/general/vendors-list', {
    token,
    query: {
      page: '0',
      page_size: String(pageSize),
      is_home: 'false',
      page_type: 'vendor_list',
      pro_discount: PRO_DISCOUNT,
      pro_client: 'snapp',
      ...common(location),
    },
  });

  const index = new Map<string, Vendor>();
  for (const row of json.data?.finalResult ?? []) {
    const v = row?.data;
    if (!v?.id) continue;
    index.set(String(v.id), {
      id: v.id,
      code: v.code,
      name: v.title,
      logo: v.logo || '',
      deliveryFee: Number(v.deliveryFee ?? 0),
      deliveryTime: Number(v.deliveryTime ?? 0),
      isPro: Boolean(v.is_pro),
      isOpen: v.isOpen !== false,
      rating: Number(v.rate ?? 0),
      minOrder: Number(v.minimumOrderValue ?? 0),
    });
  }
  return index;
}

export { NotSignedInError };
