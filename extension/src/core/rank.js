// Ranking rules.
//
// Default ordering, straight from the product brief:
//   1. deepest campaign discount first
//   2. then Snapp Market Pro vendors (they charge less to deliver)
//   3. then the cheapest delivery fee
//   4. then the cheapest final price
export const SORT_MODES = {
  'best-discount': 'بیشترین تخفیف ← پرو ← کمترین ارسال',
  'cheapest-total': 'کمترین هزینه کل (کالا + ارسال)',
  'lowest-delivery': 'کمترین هزینه ارسال',
};

export function totalCost(offer) {
  return offer.finalPrice + (offer.vendor?.deliveryFee ?? 0);
}

/** Group discounts into 5%% buckets so a 1%% edge never beats a Pro vendor. */
function discountBucket(offer) {
  return Math.floor((offer.discountPercent || 0) / 5);
}

const COMPARATORS = {
  'best-discount': (a, b) =>
    discountBucket(b) - discountBucket(a) ||
    Number(b.vendor?.isPro) - Number(a.vendor?.isPro) ||
    (a.vendor?.deliveryFee ?? 0) - (b.vendor?.deliveryFee ?? 0) ||
    (b.discountPercent || 0) - (a.discountPercent || 0) ||
    a.finalPrice - b.finalPrice,

  'cheapest-total': (a, b) =>
    totalCost(a) - totalCost(b) ||
    (b.discountPercent || 0) - (a.discountPercent || 0) ||
    Number(b.vendor?.isPro) - Number(a.vendor?.isPro),

  'lowest-delivery': (a, b) =>
    (a.vendor?.deliveryFee ?? 0) - (b.vendor?.deliveryFee ?? 0) ||
    Number(b.vendor?.isPro) - Number(a.vendor?.isPro) ||
    (b.discountPercent || 0) - (a.discountPercent || 0) ||
    a.finalPrice - b.finalPrice,
};

export function rank(offers, mode = 'best-discount') {
  const compare = COMPARATORS[mode] || COMPARATORS['best-discount'];
  // Closed shops and out-of-stock items always sink to the bottom.
  return [...offers].sort((a, b) => {
    const availability =
      Number(Boolean(a.outOfStock)) - Number(Boolean(b.outOfStock)) ||
      Number(a.vendor?.isOpen === false) - Number(b.vendor?.isOpen === false);
    return availability || compare(a, b);
  });
}

/**
 * Collapse duplicates of the same product in the same store.
 * A campaign listing always wins over the plain catalogue entry for the same
 * item, since it carries the discount the user is hunting for.
 */
export function dedupe(offers) {
  const seen = new Map();
  for (const offer of offers) {
    const key = `${offer.platform}:${offer.vendor?.code}:${offer.productId}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, offer);
      continue;
    }
    const better =
      Number(offer.isCampaign) - Number(existing.isCampaign) ||
      existing.finalPrice - offer.finalPrice;
    if (better > 0) seen.set(key, offer);
  }
  return [...seen.values()];
}
