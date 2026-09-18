export type PlatformId = 'snapp' | 'jet' | 'okala';

export interface Vendor {
  id: string | number;
  code: string;
  name: string;
  logo: string;
  /** Toman. Already reflects the Pro discount where the platform applies one. */
  deliveryFee: number;
  /**
   * True when the listing did not say what delivery costs and nothing filled it
   * in since. `deliveryFee` is then a placeholder 0, never "free".
   */
  deliveryFeeUnknown?: boolean;
  /**
   * Toman. What the platform adds to every order on top of delivery — Okala's
   * service and packaging charges. Absent where there is no such charge.
   */
  serviceFee?: number;
  deliveryTime: number;
  isPro: boolean;
  isOpen: boolean;
  rating: number;
  minOrder: number;
}

export interface Offer {
  platform: PlatformId;
  platformLabel: string;
  productId: string;
  /**
   * The product's id across every store of its platform — Snapp Market's
   * product variation, Digikala Jet's `product_id`, Okala's `masterProductId`.
   * Two offers with the same one are the same product in two stores.
   */
  catalogId?: string;
  title: string;
  image: string;
  category: string;
  /** Toman, before the discount. */
  price: number;
  /** Toman, what you pay: `price - discountAmount`. */
  finalPrice: number;
  discountAmount: number;
  discountPercent: number;
  /** True for the platform's headline campaign (تخفیف نارنجی / شگفت‌انگیز). */
  isCampaign: boolean;
  campaignLabel: string;
  /** Snapp Market segments some offers to new accounts; those are never shown. */
  segment: string;
  targeted: boolean;
  stock: number;
  outOfStock: boolean;
  /** Units one order may carry, when the platform caps it (Okala). */
  maxPerOrder?: number;
  vendor: Vendor;
  /** Deep link to the product, inside the store that sells it at this price. */
  url: string;
  /**
   * Toman. The price the product page itself shows, when the platform takes the
   * rest of the discount off only at checkout — Digikala Jet's شگفت‌انگیز.
   * Absent when the product page already shows `finalPrice`.
   */
  pagePrice?: number;
  /** Confirmed against the store's own shelf, not just the campaign feed. */
  verified?: boolean;
  verifiedBy?: 'shelf' | 'search';
  /** What the campaign feed claimed before verification corrected it. */
  campaignPrice?: number;
  matchScore?: number;
}

export interface Location {
  lat: number;
  lng: number;
  label: string;
}

export interface Address extends Location {
  id: string;
  address: string;
  city?: string;
  source: PlatformId;
}

export type SortMode = 'best-discount' | 'cheapest-total' | 'lowest-delivery';
