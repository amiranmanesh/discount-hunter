// Digikala Jet (api.digikalajet.ir) client.
//
// Endpoints discovered from the web app:
//   GET /products/search/all/?q=&latitude=&longitude=&page=   -> search across nearby shops
//   GET /products/search/shop/{shopId}/?q=                    -> search inside one shop
//
// Jet needs no authentication for search, but every price is in Rial.
const BASE = 'https://api.digikalajet.ir';
const RIAL_TO_TOMAN = 10;
const HEADERS = {
  accept: 'application/json, text/plain, */*',
  origin: 'https://www.digikalajet.com',
  referer: 'https://www.digikalajet.com/',
};

async function call(path, params) {
  const query = new URLSearchParams({ ch: 'jj', ...params });
  const response = await fetch(`${BASE}${path}?${query}`, { headers: HEADERS });
  if (!response.ok) throw new Error(`دیجی‌کالا جت ${path} → ${response.status}`);
  return response.json();
}

/**
 * Search every shop that delivers to the given point.
 * `sort=26` is the site's "بیشترین تخفیف" ordering, so the first pages already
 * carry the deepest discounts.
 */
export async function search(query, { lat, lng, pages = 3, onProgress }) {
  const offers = [];
  let totalPages = 1;

  for (let page = 1; page <= Math.min(pages, totalPages); page += 1) {
    const json = await call('/products/search/all/', {
      q: query,
      shopId: '',
      latitude: String(lat),
      longitude: String(lng),
      sort: '26',
      page: String(page),
    });

    const data = json?.data || {};
    totalPages = Number(data.pager?.total_pages ?? 1);
    const results = data.result || [];
    offers.push(...results.map((item) => toOffer(item, query)));
    onProgress?.({
      phase: 'jet',
      loaded: offers.length,
      total: Number(data.pager?.total_items ?? offers.length),
    });
    if (!results.length) break;
  }

  return offers;
}

function toOffer(item, query) {
  const price = Number(item.price?.price ?? 0) / RIAL_TO_TOMAN;
  const discountAmount = Number(item.price?.discount ?? 0) / RIAL_TO_TOMAN;
  const shop = item.shop || {};
  const delivery = shop.delivery || {};
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
    segment: 'general', // Jet does not segment its search results
    targeted: false,
    personalized: false,
    stock: item.stock?.has_stock === false ? 0 : item.stock?.is_running_low ? 1 : 99,
    outOfStock: item.stock?.has_stock === false,
    vendor: {
      id: shop.id,
      code: String(shop.id ?? ''),
      name: shop.title || 'فروشگاه جت',
      logo: shop.media || '',
      deliveryFee: Number(delivery.cost ?? 0) / RIAL_TO_TOMAN,
      deliveryTime: Number(delivery.estimate_time ?? 0),
      isPro: false, // "پرو" is a Snapp Market tier; Jet's equivalent perk is free shipping
      freeDelivery: Number(delivery.cost ?? 0) === 0 || Boolean(delivery.is_free_by_plus),
      isOpen: shop.working_status?.is_open !== false,
      rating: Number(shop.rating?.rate ?? 0),
      minOrder: 0,
    },
    url: `https://www.digikalajet.com/search/?q=${encodeURIComponent(query)}&shopId=${shop.id ?? ''}`,
  };
}
