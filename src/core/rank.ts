import type { Offer, SortMode } from './types';

export const SORT_MODES: Record<SortMode, string> = {
  'best-discount': 'بیشترین تخفیف ← پرو ← کمترین ارسال',
  'cheapest-total': 'کمترین هزینه کل (کالا + ارسال)',
  'lowest-delivery': 'کمترین هزینه ارسال',
};

export function totalCost(offer: Offer): number {
  return offer.finalPrice + (offer.vendor?.deliveryFee ?? 0);
}

/** Groups discounts into 5% buckets so a 1% edge never beats a Pro vendor. */
function discountBucket(offer: Offer): number {
  return Math.floor((offer.discountPercent || 0) / 5);
}

const COMPARATORS: Record<SortMode, (a: Offer, b: Offer) => number> = {
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

export function rank(offers: Offer[], mode: SortMode = 'best-discount'): Offer[] {
  const compare = COMPARATORS[mode] ?? COMPARATORS['best-discount'];
  // Closed stores and out-of-stock items always sink to the bottom.
  return [...offers].sort((a, b) => {
    const availability =
      Number(Boolean(a.outOfStock)) - Number(Boolean(b.outOfStock)) ||
      Number(a.vendor?.isOpen === false) - Number(b.vendor?.isOpen === false);
    return availability || compare(a, b);
  });
}

/**
 * Collapses duplicates of the same product in the same store. A campaign
 * listing wins over the plain catalogue entry, since it carries the discount.
 */
export function dedupe(offers: Offer[]): Offer[] {
  const seen = new Map<string, Offer>();
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
