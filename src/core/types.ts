export type PlatformId = 'snapp' | 'jet' | 'okala';

export interface Vendor {
  id: string | number;
  code: string;
  name: string;
  logo: string;
  /** Toman. Already reflects the Pro discount where the platform applies one. */
  deliveryFee: number;
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
  vendor: Vendor;
  /** Deep link to the product's store. */
  url: string;
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
