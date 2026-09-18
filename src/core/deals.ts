// The discount feed: everything on offer near you, deepest discount first.
//
// One Snapp Market request brings twenty stores with ten campaign offers each,
// which is what makes an endless feed affordable. Digikala Jet contributes its
// شگفت‌انگیز row on the first page and then its paginated listing, five at a
// time — the size the endpoint enforces. Okala's offer carousels are a single
// unpaginated call worth roughly two hundred discounted products, so they seed
// the first page and do not extend it.
import * as snapp from '../api/snapp';
import * as jet from '../api/jet';
import * as okala from '../api/okala';
import { dedupe, orderFees } from './rank';
import type { Location, Offer, PlatformId } from './types';

export interface DealsPage {
  offers: Offer[];
  page: number;
  /** Epoch ms. When this page was asked for, so the feed can say how old it is. */
  fetchedAt: number;
  hasMore: boolean;
  firstOrderSkipped: number;
  errors: string[];
}

export interface DealsOptions {
  sources: Record<PlatformId, boolean>;
  minDiscount: number;
  onlyOpen: boolean;
  /** The Snapp Market account has Snapp Pro, so Pro stores' discounted fees apply. */
  snappPro?: boolean;
}

/** Jet pages are five rows deep, so several are pulled per feed page. */
const JET_PAGES_PER_FEED_PAGE = 4;

export interface DealsTokens {
  snapp?: string | null;
  jet?: string | null;
  okala?: string | null;
}

export async function dealsPage(
  page: number,
  location: Location,
  options: DealsOptions,
  tokens: DealsTokens = {},
): Promise<DealsPage> {
  const { snapp: snappToken, jet: jetToken } = tokens;
  const fetchedAt = Date.now();
  const errors: string[] = [];
  const collected: Offer[] = [];
  let firstOrderSkipped = 0;
  let snappHasMore = false;
  let jetHasMore = false;

  const jobs: Promise<void>[] = [];

  if (options.sources.snapp && snappToken) {
    jobs.push(
      snapp
        .campaignPage(snappToken, location, page, 20, { pro: options.snappPro })
        .then((result) => {
          collected.push(...result.offers);
          firstOrderSkipped += result.firstOrderSkipped;
          snappHasMore = result.hasMore;
        })
        .catch((error) => {
          errors.push(`اسنپ‌مارکت: ${error instanceof Error ? error.message : String(error)}`);
        }),
    );
  }

  if (options.sources.jet) {
    jobs.push(
      (async () => {
        const found: Offer[] = [];
        if (page === 0) found.push(...(await jet.amazingHighlights(location, jetToken)));
        const first = page * JET_PAGES_PER_FEED_PAGE + 1;
        for (let p = first; p < first + JET_PAGES_PER_FEED_PAGE; p += 1) {
          const result = await jet.amazingPage(location, p, jetToken);
          found.push(...result.offers);
          jetHasMore = result.hasMore;
          if (!result.hasMore) break;
        }
        // Neither listing says what delivery costs; the shops' own pages do.
        collected.push(...(await jet.withShops(found, location, jetToken)));
      })().catch((error) => {
        errors.push(`دیجی‌کالا جت: ${error instanceof Error ? error.message : String(error)}`);
      }),
    );
  }

  // Okala needs no token for either call, and neither is paginated, so it
  // contributes to the first page only.
  if (options.sources.okala && page === 0) {
    jobs.push(
      (async () => {
        const stores = await okala.storesNearby(location);
        collected.push(
          ...(await okala.offers(
            location,
            stores.filter((store) => store.storeId),
          )),
        );
      })().catch((error) => {
        errors.push(`اوکالا: ${error instanceof Error ? error.message : String(error)}`);
      }),
    );
  }

  await Promise.all(jobs);

  const offers = dedupe(collected).filter(
    (offer) =>
      !offer.targeted &&
      offer.discountPercent >= Math.max(options.minDiscount, 1) &&
      !offer.outOfStock &&
      (!options.onlyOpen || offer.vendor.isOpen !== false),
  );

  return {
    offers,
    page,
    fetchedAt,
    hasMore: snappHasMore || jetHasMore,
    firstOrderSkipped,
    errors,
  };
}

/** Deepest discount first, then the cheaper trip, then the cheaper item. */
export function sortByDiscount(offers: Offer[]): Offer[] {
  return [...offers].sort(
    (a, b) =>
      b.discountPercent - a.discountPercent ||
      orderFees(a.vendor) - orderFees(b.vendor) ||
      a.finalPrice - b.finalPrice,
  );
}
