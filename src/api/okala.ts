// Okala. Endpoint reference: docs/API.md
//
// Okala quotes every price in Rial; everything below converts to Toman so the
// three platforms compare. Its gateway wants a per-device id and a per-request
// correlation id on every call, and marks unauthenticated calls explicitly —
// stores and offers need no token, search does.
import { ApiError, OKALA_BASE, request } from './http';
import { makeSession, type Session } from '../auth/session';
import { randomUuid } from '../core/uuid';
import type { Location, Offer, Vendor } from '../core/types';

const RIAL_TO_TOMAN = 10;
const DEVICE_KEY = 'dh:okala:device';

/** Stable per-device id, the way the site keeps one in its own storage. */
export function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = randomUuid();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function gatewayHeaders(authenticated: boolean): Record<string, string> {
  return {
    'x-user-unique-id': deviceId(),
    'x-correlation-id': randomUuid(),
    ...(authenticated ? {} : { 'x-skip-authorization': 'true' }),
  };
}

export interface RawStore {
  storeId: number;
  storeName: string;
  logo?: string;
  rate?: number;
  distance?: number;
  /** Rial. */
  deliveryPrice?: number;
  /** Rial. «هزینه خدمات» on the checkout page, charged on every order. */
  operationPrice?: number;
  /** Rial. The packaging charge, likewise on every order. */
  packagingPrice?: number;
  onDemandEta?: string | null;
  storeCategoryName?: string;
}

interface RawProduct {
  id: number;
  name: string;
  imageUrl?: string;
  /** Rial, before the discount. */
  price?: number;
  /** Rial, what you pay. */
  okPrice?: number;
  discountPercent?: number;
  isShowDiscount?: boolean;
  quantity?: number;
  hasQuantity?: boolean;
  maxOrderLimit?: number;
  storeId?: number;
  storeName?: string;
}

/** `"01:00:00"` → 60 minutes. */
function etaMinutes(eta: string | null | undefined): number {
  if (!eta) return 0;
  const [hours = '0', minutes = '0'] = eta.split(':');
  return Number(hours) * 60 + Number(minutes);
}

function toVendor(store: RawStore | undefined, fallbackName = 'فروشگاه اوکالا'): Vendor {
  // Okala's delivery is usually free, but its checkout adds a service and a
  // packaging charge to every order — together about 13,000 Toman, measured —
  // so a "free" delivery is not a free trip. Only `stores/nearby` reports them.
  const serviceFee =
    (Number(store?.operationPrice ?? 0) + Number(store?.packagingPrice ?? 0)) / RIAL_TO_TOMAN;
  return {
    id: store?.storeId ?? '',
    code: String(store?.storeId ?? ''),
    name: store?.storeName || fallbackName,
    logo: store?.logo || '',
    deliveryFee: Number(store?.deliveryPrice ?? 0) / RIAL_TO_TOMAN,
    ...(serviceFee > 0 ? { serviceFee } : {}),
    deliveryTime: etaMinutes(store?.onDemandEta),
    // "پرو" is a Snapp Market tier and Okala has no equivalent.
    isPro: false,
    isOpen: true,
    rating: Number(store?.rate ?? 0),
    minOrder: 0,
  };
}

/**
 * The product page inside one store — the route the site itself links a store's
 * product to. The bare `/product/<id>` has no store, so it opens at whichever
 * store the visitor last picked, or as «تمام شد» with none. The name is
 * decorative.
 */
export function productUrl(storeId: string | number, id: string | number, name = ''): string {
  const slug = encodeURIComponent(name.trim().replace(/\s+/g, '-'));
  return `https://www.okala.com/store/${storeId}/product/${id}/${slug}`;
}

function toOffer(product: RawProduct, vendor: Vendor): Offer {
  const price = Number(product.price ?? 0) / RIAL_TO_TOMAN;
  const okPrice = Number(product.okPrice ?? product.price ?? 0) / RIAL_TO_TOMAN;
  const discountAmount = Math.max(price - okPrice, 0);
  const percent = Number(product.discountPercent ?? 0);
  const discounted = Boolean(product.isShowDiscount) && discountAmount > 0;

  return {
    platform: 'okala',
    platformLabel: 'اوکالا',
    productId: String(product.id ?? ''),
    title: product.name || '',
    image: product.imageUrl || '',
    category: '',
    price,
    finalPrice: okPrice,
    discountAmount,
    discountPercent: percent,
    isCampaign: discounted,
    campaignLabel: discounted ? 'تخفیف اوکالا' : 'قیمت فروشگاه',
    segment: 'general', // Okala does not segment its results
    targeted: false,
    stock: product.hasQuantity === false ? 0 : Number(product.quantity ?? 99),
    outOfStock: product.hasQuantity === false || Number(product.quantity ?? 1) <= 0,
    vendor,
    url: productUrl(product.storeId ?? vendor.code, product.id, product.name),
    // These rows come from the same calls the Okala site makes for the user, so
    // they need no separate confirmation step.
    verified: true,
    verifiedBy: 'search',
  };
}

/* -------------------------------------------------------------- auth ---- */

/**
 * Asks Okala to text a code.
 *
 * `ValidationCodeCreateReason: 5` is the login reason the website sends;
 * `deviceTypeCode: 10` is its web client.
 */
export async function requestCode(phone: string): Promise<void> {
  const json = await request<{ success?: boolean; message?: string }>(
    OKALA_BASE,
    '/api/voyager/C/CustomerAccount/OTPRegister',
    {
      method: 'POST',
      headers: gatewayHeaders(false),
      body: {
        mobile: phone,
        deviceTypeCode: 10,
        confirmTerms: true,
        notRobot: false,
        otpType: 0,
        ValidationCodeCreateReason: 5,
        OtpApp: 0,
        IsAppOnly: false,
      },
    },
  );
  if (json?.success === false) throw new ApiError(json.message || 'درخواست کد پذیرفته نشد');
}

export async function verifyCode(phone: string, code: string): Promise<Session> {
  const json = await request<{
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    message?: string;
    UserInfo?: { Id?: number };
  }>(OKALA_BASE, '/api/v1/accounts/tokens', {
    method: 'POST',
    headers: { ...gatewayHeaders(false) },
    form: new URLSearchParams({
      mobile_number: phone,
      otp_code: code,
      grant_type: 'customer_grant_type',
      client_id: 'customer_client_id',
      client_secret: "u_M{'57j!%LI21#",
      client_name: 'customer_client_name',
      device_type_code: '10',
      scope: 'offline_access',
    }),
  });

  if (!json?.access_token) throw new ApiError(json?.message || 'کد پذیرفته نشد');
  return makeSession({
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    subject: phone,
    userId: json.UserInfo?.Id ?? null,
    // Okala's token is not a JWT, so its expiry comes from the response.
    expiresAt: Date.now() + (Number(json.expires_in) || 36000) * 1000,
  });
}

/**
 * Okala's web app never refreshes — its token is good for ten hours and it signs
 * in again afterwards. Failing here is what tells the session store to ask for a
 * new sign-in rather than retry a dead token forever.
 */
export async function refresh(): Promise<Session> {
  throw new ApiError('نشست اوکالا منقضی شده؛ دوباره وارد شو');
}

/* ------------------------------------------------------------ catalog ---- */

/** Every Okala store that delivers to the point. No token needed. */
export async function storesNearby(location: Location): Promise<RawStore[]> {
  const json = await request<{ data?: { stores?: RawStore[] } }>(
    OKALA_BASE,
    '/api/opex/v4/stores/nearby',
    {
      headers: gatewayHeaders(false),
      query: { latitude: String(location.lat), longitude: String(location.lng) },
    },
  );
  return json.data?.stores ?? [];
}

/**
 * The home page's offer carousels — around two hundred discounted products in
 * one call, which is what Okala contributes to the feed. It is not paginated, so
 * it seeds the list rather than extending it.
 *
 * A carousel row names its store and nothing else, so the stores it was asked
 * about supply the delivery and service charges, the rating and the estimate.
 */
export async function offers(location: Location, stores: RawStore[]): Promise<Offer[]> {
  if (!stores.length) return [];

  const query = new URLSearchParams({
    pageType: 'HomePage',
    lat: String(location.lat),
    lon: String(location.lng),
  });
  for (const store of stores) query.append('storeIds', String(store.storeId));
  const byId = new Map(stores.map((store) => [store.storeId, store]));

  const json = await request<{
    carousels?: { title?: string; products?: RawProduct[] }[];
  }>(OKALA_BASE, `/api/carousel/v4/offers?${query}`, { headers: gatewayHeaders(false) });

  const out: Offer[] = [];
  for (const carousel of json.carousels ?? []) {
    for (const product of carousel.products ?? []) {
      const store = byId.get(product.storeId ?? 0) ?? {
        storeId: product.storeId ?? 0,
        storeName: product.storeName ?? '',
      };
      out.push(toOffer(product, toVendor(store, product.storeName || 'فروشگاه اوکالا')));
    }
  }
  return out;
}

/**
 * Search across every nearby store. Results arrive grouped by store, with the
 * delivery fee but without the service and packaging charges, which come from
 * the same `stores/nearby` listing the feed uses.
 */
export async function search(query: string, location: Location, token: string): Promise<Offer[]> {
  // Started first so the search is the first request out; the store listing
  // only adds charges, and a search without them is still a search.
  const found = request<{
    data?: Record<string, { store?: RawStore; products?: RawProduct[] }>;
    success?: boolean;
    errorMessage?: string;
  }>(OKALA_BASE, '/api/unicorn/v2/cumulative/search/nearby', {
    token,
    headers: gatewayHeaders(true),
    query: { q: query, lat: String(location.lat), lon: String(location.lng), v4Stores: 'true' },
  });
  const nearby = storesNearby(location).catch((): RawStore[] => []);
  const [json, stores] = await Promise.all([found, nearby]);

  if (json?.success === false) throw new ApiError(json.errorMessage || 'جستجوی اوکالا ناموفق بود');

  const charges = new Map(stores.map((store) => [store.storeId, store]));
  const groups = Object.values(json.data ?? {});
  const out: Offer[] = [];
  for (const group of groups) {
    const listed = group.store ? charges.get(group.store.storeId) : undefined;
    const vendor = toVendor(
      group.store && {
        ...group.store,
        operationPrice: listed?.operationPrice,
        packagingPrice: listed?.packagingPrice,
      },
    );
    for (const product of group.products ?? []) out.push(toOffer(product, vendor));
  }
  return out;
}
