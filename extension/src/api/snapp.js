// Snapp Market (svc.snapp.market) client.
//
// Endpoints discovered from the PWA:
//   POST /oauth2/default/token                      -> anonymous bearer token
//   GET  /market-party/{lat}/{lng}?deal_type=...    -> nearby vendors running "تخفیف نارنجی"
//   GET  /market-party/{vendorCode}?page_size=100   -> that vendor's full orange-discount shelf
//   GET  /mobile/v3/search/suggest?query=           -> keyword suggestions
//   GET  /mobile/v3/product-vendors/search?query=   -> cross-vendor catalogue search
import { getSession, setSession } from '../util/store.js';
import { pooled } from '../util/pool.js';
import { normalize } from '../util/text.js';

const BASE = 'https://svc.snapp.market';
const APP_VERSION = '1.399.10';
const PAGE_SIZE = 20;
const SESSION_TOKEN_KEY = 'snappSessionToken'; // written by the content script when logged in
const UDID_KEY = 'snappUdid';

const COMMON_HEADERS = {
  accept: 'application/json, text/plain, */*',
  'content-type': 'application/json',
  origin: 'https://snapp.market',
  referer: 'https://snapp.market/',
};

async function getUdid() {
  let udid = await getSession(UDID_KEY);
  if (!udid) {
    udid = crypto.randomUUID();
    await setSession(UDID_KEY, udid);
  }
  return udid;
}

function jwtExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return (payload.exp || 0) * 1000;
  } catch {
    return 0;
  }
}

/**
 * The signed-in Snapp Market session, or nothing.
 *
 * There is deliberately no anonymous fallback. A guest session is a different
 * account with a different campaign and different eligibility, so answering with
 * it means answering a question the user did not ask. Callers surface
 * `NotSignedInError` and the popup asks the user to sign in.
 */
export class NotSignedInError extends Error {
  constructor() {
    super('برای جستجو باید در یک تب snapp.market وارد حسابت باشی');
    this.name = 'NotSignedInError';
    this.notSignedIn = true;
  }
}

export async function getToken() {
  const session = await getSession(SESSION_TOKEN_KEY);
  if (!session?.token) throw new NotSignedInError();
  if (jwtExpiry(session.token) <= Date.now() + 60_000) throw new NotSignedInError();
  return { token: session.token, authenticated: true };
}

async function call(path, params, { token }) {
  const udid = await getUdid();
  const query = new URLSearchParams({
    client: 'PWA',
    deviceType: 'PWA',
    appVersion: APP_VERSION,
    UDID: udid,
    ...params,
  });
  const response = await fetch(`${BASE}${path}?${query}`, {
    headers: { ...COMMON_HEADERS, authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`اسنپ‌مارکت ${path} → ${response.status}`);
  return response.json();
}

/** Keyword suggestions for the search box. */
export async function suggest(query, { lat, lng }) {
  const { token } = await getToken();
  const json = await call(
    '/mobile/v3/search/suggest',
    {
      query,
      source: '2',
      lat: String(lat),
      long: String(lng),
    },
    { token },
  );
  return json?.suggested_keywords || [];
}

/** All nearby vendors currently running the orange-discount campaign. */
export async function listOrangeVendors({ lat, lng, maxVendors = 60, onProgress }) {
  const { token, authenticated } = await getToken();
  const vendors = [];
  let page = 0;
  let total = Infinity;

  while (vendors.length < Math.min(maxVendors, total)) {
    const json = await call(
      `/market-party/${lat}/${lng}`,
      {
        deal_type: 'supermarket',
        isPro: 'false',
        page: String(page),
        page_size: String(PAGE_SIZE),
        lat: String(lat),
        long: String(lng),
      },
      { token },
    );

    const data = json?.data;
    if (!data) break;
    total = Number(data.total_count ?? 0) || vendors.length;
    const batch = data.vendors || [];
    if (!batch.length) break;

    vendors.push(...batch.map(mapVendor));
    onProgress?.({ loaded: vendors.length, total: Math.min(total, maxVendors) });
    page += 1;
    if (page > 20) break; // hard stop, the API caps out well before this
  }

  return { vendors: vendors.slice(0, maxVendors), authenticated };
}

function mapVendor(raw) {
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
    commentCount: Number(raw.comment_count ?? 0),
    // `personalizedProducts` is the "ویژه خرید اول" list: offers the API will
    // happily describe but an established account cannot see or buy. It is never
    // read — not filtered later, not read at all.
    previewProducts: (raw.products || []).map((product) => ({ product, personalized: false })),
  };
}

/** The vendor's complete orange-discount shelf (listing preview caps at 10 items). */
export async function vendorOrangeShelf(vendor, { lat, lng }) {
  const { token } = await getToken();
  const json = await call(
    `/market-party/${vendor.code}`,
    {
      variable: vendor.code,
      page_size: '100',
      lat: String(lat),
      long: String(lng),
    },
    { token },
  );

  const data = json?.data || {};
  const asList = (value) => (Array.isArray(value) ? value : value?.List || []);
  return {
    endsAt: data.firstActivePeriodEndRFC || null,
    // Only the general shelf. `data.personalizedProducts` is the first-order
    // list and is deliberately ignored — see `mapVendor`. It is counted, though,
    // so the popup can say what it left out.
    firstOrderSkipped: asList(data.personalizedProducts).length,
    products: asList(data.products).map((product) => ({ product, personalized: false })),
  };
}

/** Fetch every nearby vendor's shelf, bounded concurrency. */
export async function collectOrangeOffers({ lat, lng, maxVendors, onProgress }) {
  const { vendors, authenticated } = await listOrangeVendors({ lat, lng, maxVendors, onProgress });

  let done = 0;
  const shelves = await pooled(vendors, 6, async (vendor) => {
    const shelf = await vendorOrangeShelf(vendor, { lat, lng });
    done += 1;
    onProgress?.({ phase: 'shelves', loaded: done, total: vendors.length });
    return shelf;
  });

  const offers = [];
  const campaignEnds = shelves.find((s) => s && !s.__error && s.endsAt)?.endsAt || null;
  const firstOrderSkipped = shelves.reduce(
    (total, shelf) => total + (shelf && !shelf.__error ? shelf.firstOrderSkipped || 0 : 0),
    0,
  );

  vendors.forEach((vendor, index) => {
    const shelf = shelves[index];
    const products =
      shelf && !shelf.__error && shelf.products?.length ? shelf.products : vendor.previewProducts;
    const seen = new Set();
    for (const entry of products) {
      const product = entry.product ?? entry;
      if (seen.has(product.productVariationId)) continue;
      seen.add(product.productVariationId);
      offers.push(toOffer(product, vendor, entry.personalized === true));
    }
  });

  return { offers, vendorCount: vendors.length, authenticated, campaignEnds, firstOrderSkipped };
}

/**
 * `segment` decides who can actually buy at this price.
 *
 * Measured against a live campaign: `products.List` is 100% `general` and tops
 * out around 44% off, while `personalizedProducts` mixes `general` with
 * `new_user` — and every 90-99% offer is `new_user`. Those prices do not exist
 * for an established account, so an offer that is not `general` is marked
 * `targeted` and filtered out unless the user asks for them.
 */
function toOffer(product, vendor, personalized = false) {
  const price = Number(product.price ?? 0); // pre-discount price, Toman
  const discount = Number(product.discount ?? 0); // absolute amount off, Toman
  const finalPrice = Math.max(price - discount, 0);
  const slug = encodeURIComponent((vendor.name || 'store').replace(/\s+/g, '-'));
  const segment = product.segment || 'general';
  const targeted = segment !== 'general';

  return {
    platform: 'snapp',
    platformLabel: 'اسنپ‌مارکت',
    productId: String(product.productVariationId ?? ''),
    title: product.productVariationTitle || product.title || '',
    image: product.main_image || product.image || '',
    category: product.menu_category_title || '',
    price,
    finalPrice,
    discountAmount: discount,
    discountPercent: Number(product.discountRatio ?? 0),
    isCampaign: true, // everything on this shelf is تخفیف نارنجی
    campaignLabel: targeted ? 'تخفیف کاربر جدید' : 'تخفیف نارنجی',
    segment,
    targeted,
    personalized,
    stock: Number(product.stock ?? 0),
    outOfStock: Boolean(product.is_out_of_stock),
    vendor: {
      id: vendor.id,
      code: vendor.code,
      name: vendor.name,
      logo: vendor.logo,
      deliveryFee: vendor.deliveryFee,
      deliveryTime: vendor.deliveryTime,
      isPro: vendor.isPro,
      isOpen: vendor.isOpen,
      rating: vendor.rating,
      minOrder: Number(product.minOrder ?? 0),
    },
    url: `https://snapp.market/supermarket/${slug}/${vendor.code}`,
  };
}

const PRO_DISCOUNT = '18000'; // the PWA's own delivery-discount hint for Pro members

/**
 * Every supermarket that delivers to the point, campaign or not.
 * Returned fees already account for the Pro delivery discount.
 */
export async function listNearbyVendors({ lat, lng, pageSize = 50 }) {
  const { token } = await getToken();
  const json = await call(
    '/express-vendor/general/vendors-list',
    {
      page: '0',
      page_size: String(pageSize),
      is_home: 'false',
      page_type: 'vendor_list',
      pro_discount: PRO_DISCOUNT,
      pro_client: 'snapp',
      lat: String(lat),
      long: String(lng),
    },
    { token },
  );

  const rows = json?.data?.finalResult || [];
  const index = new Map();
  for (const row of rows) {
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
      rating: Number(v.rate ?? v.rating ?? 0),
      minOrder: Number(v.minimumOrderValue ?? 0),
    });
  }
  return index;
}

/**
 * Regular catalogue search across nearby vendors. Results carry a
 * `productId-vendorId` document id, so they are joined against the vendor index
 * to recover delivery fee / Pro status.
 */
export async function searchOffers(query, { lat, lng, pages = 2 }) {
  const [items, vendors] = await Promise.all([
    searchCatalogue(query, { lat, lng, pages }),
    listNearbyVendors({ lat, lng }),
  ]);

  const offers = [];
  for (const item of items) {
    const vendorId = String(item.document_id || '').split('-')[1];
    const vendor = vendors.get(vendorId);
    if (!vendor) continue; // vendor does not deliver here
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
      personalized: false,
      stock: 99,
      outOfStock: false,
      vendor: { ...vendor },
      url: `https://snapp.market/supermarket/${slug}/${vendor.code}`,
    });
  }
  return offers;
}

/**
 * Re-prices an offer against the vendor's own shelf.
 *
 * The campaign feed and the store page can disagree — a segmented row quotes a
 * price the account cannot actually pay — so the winning offers are checked
 * against `/mobile/v2/product-variation/search`, which is what the store page
 * itself calls. Returns the offer with the store's numbers, or `null` when the
 * store does not list the product at all.
 */
export async function verifyOffer(offer, { lat, lng }) {
  const { token } = await getToken();
  const json = await call(
    '/mobile/v2/product-variation/search',
    {
      query: offer.title,
      vendorCode: offer.vendor.code,
      firstPage: 'true',
      page: '0',
      page_size: '10',
      size: '10',
      origin: 'vp-search',
      source: '2',
      latitude: String(lat),
      longitude: String(lng),
      lat: String(lat),
      long: String(lng),
    },
    { token },
  );

  const rows = json?.data?.result || [];
  // Campaign rows and shelf rows do not always share a product id, so fall back
  // to the canonical title, which both endpoints spell the same way.
  const wanted = normalize(offer.title);
  const match =
    rows.find((row) => String(row.id) === offer.productId) ||
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
    campaignPrice: offer.finalPrice, // what the campaign feed had claimed
  };
}

/** Verifies several offers at once, dropping the ones the stores do not list. */
export async function verifyOffers(offers, { lat, lng, concurrency = 4 }) {
  const checked = await pooled(offers, concurrency, (offer) => verifyOffer(offer, { lat, lng }));
  return checked.map((result, index) =>
    result?.__error ? { ...offers[index], verified: false } : result,
  );
}

/** Raw catalogue search hits (product@vendor pairs). */
export async function searchCatalogue(query, { lat, lng, pages = 2 }) {
  const { token } = await getToken();
  const items = [];
  for (let page = 0; page < pages; page += 1) {
    const json = await call(
      '/mobile/v3/product-vendors/search',
      {
        page: String(page),
        query,
        new_search: '1',
        new_design: '0',
        'superType[]': '4',
        size: '30',
        origin: 'sl-search',
        source: '2',
        personalize: 'true',
        lat: String(lat),
        long: String(lng),
      },
      { token },
    );
    const batch = json?.items || [];
    items.push(...batch);
    if (batch.length < 30) break;
  }
  return items;
}
