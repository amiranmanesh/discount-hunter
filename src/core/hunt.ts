// Searching for one product across both platforms.
import * as snapp from '../api/snapp';
import * as jet from '../api/jet';
import * as okala from '../api/okala';
import { dedupe, rank } from './rank';
import { looksLikeProductCode, matchScore, normalize, tokenize, hasToken } from './text';
import { isPoolError, pooled } from './pool';
import type { Location, Offer, PlatformId, SortMode } from './types';

export interface HuntOptions {
  sources: Record<PlatformId, boolean>;
  sortMode: SortMode;
  onlyCampaign: boolean;
  onlyOpen: boolean;
  minDiscount: number;
  maxVendors?: number;
  /** How many leading Snapp offers to confirm against the stores' own shelves. */
  verifyTop?: number;
}

export interface HuntStats {
  scanned: number;
  matched: number;
  relaxed: boolean;
  vendorCount: number;
  firstOrderSkipped: number;
  unlisted: number;
  unverified: number;
  bySource: Record<PlatformId, number>;
}

export interface HuntResult {
  query: string;
  offers: Offer[];
  stats: HuntStats;
  errors: string[];
}

export interface HuntTokens {
  /** Absent when the user has not signed in to Snapp Market. */
  snapp?: string | null;
  jet?: string | null;
  okala?: string | null;
}

export async function hunt(
  query: string,
  location: Location,
  options: HuntOptions,
  tokens: HuntTokens,
): Promise<HuntResult> {
  const { snapp: snappToken, jet: jetToken, okala: okalaToken } = tokens;
  const {
    sources,
    sortMode,
    onlyCampaign,
    onlyOpen,
    minDiscount,
    maxVendors = 60,
    verifyTop = 20,
  } = options;

  const byCode = looksLikeProductCode(query);
  const normalizedQuery = normalize(query);
  const queryTokens = tokenize(query);
  const errors: string[] = [];
  const pool: Offer[] = [];
  let vendorCount = 0;
  let firstOrderSkipped = 0;

  const jobs: Promise<void>[] = [];

  // "No guest mode" is about Snapp Market specifically: its campaign and its
  // eligibility differ per account, so it is skipped rather than searched
  // anonymously. The other platforms still answer.
  if (sources.snapp && !snappToken) {
    errors.push('برای نتایج اسنپ‌مارکت باید وارد حسابش شوی.');
  }

  if (sources.snapp && snappToken) {
    jobs.push(
      (async () => {
        const {
          vendors,
          previews,
          firstOrderSkipped: skipped,
        } = await snapp.campaignVendors(snappToken, location, maxVendors);
        vendorCount = vendors.length;
        firstOrderSkipped = skipped;

        // The listing previews ten offers per store; the shelf endpoint has the
        // rest, and that is where a specific product usually hides.
        const shelves = await pooled(vendors, 6, (vendor) =>
          snapp.vendorShelf(snappToken, vendor, location),
        );
        shelves.forEach((shelf, index) => {
          if (isPoolError(shelf)) {
            // Fall back to the preview rather than dropping the whole store.
            pool.push(...previews.filter((offer) => offer.vendor.code === vendors[index].code));
            return;
          }
          firstOrderSkipped += shelf.firstOrderSkipped;
          pool.push(...shelf.offers);
        });
      })().catch((error) => {
        errors.push(`اسنپ‌مارکت: ${error instanceof Error ? error.message : String(error)}`);
      }),
    );

    if (!onlyCampaign) {
      jobs.push(
        snapp
          .searchCatalogue(snappToken, query, location)
          .then((offers) => void pool.push(...offers))
          .catch((error) => {
            errors.push(`جستجوی اسنپ‌مارکت: ${error instanceof Error ? error.message : error}`);
          }),
      );
    }
  }

  if (sources.jet) {
    jobs.push(
      (async () => {
        for (let page = 1; page <= 3; page += 1) {
          const result = await jet.search(query, location, page, jetToken);
          pool.push(...result.offers);
          if (!result.hasMore) break;
        }
      })().catch((error) => {
        errors.push(`دیجی‌کالا جت: ${error instanceof Error ? error.message : String(error)}`);
      }),
    );
  }

  // Okala's search is the one call of its three that needs a token; without one
  // the platform simply contributes nothing rather than failing the search.
  if (sources.okala && okalaToken) {
    jobs.push(
      okala
        .search(query, location, okalaToken)
        .then((offers) => void pool.push(...offers))
        .catch((error) => {
          errors.push(`اوکالا: ${error instanceof Error ? error.message : String(error)}`);
        }),
    );
  }

  await Promise.all(jobs);

  const strict: Offer[] = [];
  const loose: Offer[] = [];
  for (const offer of pool) {
    const { score, strict: isStrict } = byCode
      ? { score: offer.productId === normalizedQuery ? 120 : 0, strict: true }
      : matchScore(offer.title, queryTokens, normalizedQuery);
    if (!score) continue;
    if (onlyCampaign && !offer.isCampaign) continue;
    if (offer.targeted) continue; // never purchasable by an established account
    if (onlyOpen && offer.vendor.isOpen === false) continue;
    if ((offer.discountPercent || 0) < minDiscount) continue;
    (isStrict ? strict : loose).push({ ...offer, matchScore: score });
  }

  // Widen to partial matches only when nothing carries the whole query, and even
  // then keep the head token: Persian product queries lead with the item and
  // follow with the brand, so a brand-only hit must not stand in for it.
  const head = queryTokens[0];
  const relaxedMatches = loose.filter(
    (offer) => !head || hasToken(normalize(offer.title).split(' '), head),
  );
  const matched = strict.length ? strict : relaxedMatches;

  let ranked = rank(dedupe(matched), sortMode);

  // Nothing from Snapp is shown on the campaign feed's word alone.
  let unlisted = 0;
  let unverified = 0;
  if (verifyTop > 0 && sources.snapp && snappToken) {
    const head = ranked.filter((offer) => offer.platform === 'snapp').slice(0, verifyTop);
    const replacements = new Map<Offer, Offer | null | undefined>();
    if (head.length) {
      const checked = await snapp
        .verifyOffers(snappToken, head, location)
        .catch(() => head.map(() => undefined));
      head.forEach((offer, index) => replacements.set(offer, checked[index]));
      unlisted = checked.filter((offer) => offer === null).length;
    }

    const resolved: Offer[] = [];
    for (const offer of ranked) {
      if (offer.platform !== 'snapp') {
        resolved.push(offer);
        continue;
      }
      const replacement = replacements.get(offer);
      if (!replacement) {
        if (replacement === undefined) unverified += 1;
        continue;
      }
      resolved.push(replacement);
    }
    ranked = rank(resolved, sortMode);
  }

  return {
    query,
    offers: ranked,
    stats: {
      scanned: pool.length,
      matched: matched.length,
      relaxed: strict.length === 0 && relaxedMatches.length > 0,
      vendorCount,
      firstOrderSkipped,
      unlisted,
      unverified,
      bySource: {
        snapp: ranked.filter((offer) => offer.platform === 'snapp').length,
        jet: ranked.filter((offer) => offer.platform === 'jet').length,
        okala: ranked.filter((offer) => offer.platform === 'okala').length,
      },
    },
    errors,
  };
}
