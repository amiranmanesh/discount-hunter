// Orchestrates a hunt: pull candidate offers from every enabled source,
// match them against the user's query, then rank.
import * as snapp from '../api/snapp.js';
import * as jet from '../api/jet.js';
import { rank, dedupe } from './rank.js';
import { matchScore, tokenize, normalize, hasToken, looksLikeProductCode } from '../util/text.js';

export async function hunt({ query, location, options, onProgress }) {
  const { lat, lng } = location;
  const {
    sources = { snapp: true, jet: true },
    sortMode = 'best-discount',
    onlyOrange = true,
    onlyOpen = true,
    verifyTop = 20,
    minDiscount = 0,
    maxVendors = 60,
  } = options || {};

  const byCode = looksLikeProductCode(query);
  const normalizedQuery = normalize(query);
  const queryTokens = tokenize(query);
  const errors = [];
  let vendorCount = 0;
  let authenticated = false;
  let campaignEnds = null;
  let firstOrderSkipped = 0;
  const pool = [];

  const jobs = [];

  if (sources.snapp) {
    jobs.push(
      snapp
        .collectOrangeOffers({
          lat,
          lng,
          maxVendors,
          onProgress: (p) => onProgress?.({ source: 'snapp', ...p }),
        })
        .then((result) => {
          pool.push(...result.offers);
          vendorCount += result.vendorCount;
          authenticated = result.authenticated;
          campaignEnds = result.campaignEnds;
          firstOrderSkipped = result.firstOrderSkipped || 0;
        })
        .catch((error) => errors.push(`اسنپ‌مارکت: ${error.message}`)),
    );
  }

  // Unless the user asks for campaign rows only, add Snapp's regular catalogue so
  // a product that is not in today's orange line-up still gets a real, buyable
  // price across every nearby store.
  if (sources.snapp && !onlyOrange) {
    jobs.push(
      snapp
        .searchOffers(query, { lat, lng, pages: 2 })
        .then((offers) => pool.push(...offers))
        .catch((error) => errors.push(`جستجوی اسنپ‌مارکت: ${error.message}`)),
    );
  }

  if (sources.jet) {
    jobs.push(
      jet
        .search(query, {
          lat,
          lng,
          pages: 3,
          onProgress: (p) => onProgress?.({ source: 'jet', ...p }),
        })
        .then((offers) => pool.push(...offers))
        .catch((error) => errors.push(`دیجی‌کالا جت: ${error.message}`)),
    );
  }

  await Promise.all(jobs);

  const strict = [];
  const loose = [];
  for (const offer of pool) {
    const { score, strict: isStrict } = byCode
      ? { score: offer.productId === normalizedQuery ? 120 : 0, strict: true }
      : matchScore(offer.title, queryTokens, normalizedQuery);
    if (!score) continue;
    if (onlyOrange && !offer.isCampaign) continue;
    // Segmented offers (`new_user` and friends) are real rows in the API but are
    // not purchasable by an established account — showing them as the winning
    // price is how the extension used to claim a 39,000 Toman cola the store
    // sold for 112,332. They are never shown.
    if (offer.targeted) continue;
    if (onlyOpen && offer.vendor?.isOpen === false) continue;
    if ((offer.discountPercent || 0) < minDiscount) continue;
    (isStrict ? strict : loose).push({ ...offer, matchScore: score, looseMatch: !isStrict });
  }

  // Only widen to partial matches when nothing contains the whole query, and even
  // then keep the head token (Persian product queries lead with the item, then the
  // brand: "پفک مینو", "بستنی میهن"), so a brand-only hit never stands in for it.
  const head = queryTokens[0];
  const relaxed = loose.filter(
    (offer) => !head || hasToken(normalize(offer.title).split(' '), head),
  );
  const matched = strict.length ? strict : relaxed;

  let ranked = rank(dedupe(matched), sortMode);

  // The campaign feed is a promotion, not a price list: check the offers that
  // would actually be shown first against the stores' own shelves, and drop the
  // ones the store does not list. This is what stops a segmented 39,000 Toman
  // cola from being presented as the winning price.
  let unlisted = 0;
  let unverified = 0;
  if (verifyTop > 0 && sources.snapp) {
    const head = ranked.filter((offer) => offer.platform === 'snapp').slice(0, verifyTop);
    const replacements = new Map();

    if (head.length) {
      const checked = await snapp.verifyOffers(head, { lat, lng }).catch((error) => {
        errors.push(`راستی‌آزمایی اسنپ‌مارکت: ${error.message}`);
        return head.map(() => undefined); // unchecked, not confirmed missing
      });
      head.forEach((offer, index) => replacements.set(offer, checked[index]));
      unlisted = checked.filter((offer) => offer === null).length;
    }

    // Anything from Snapp that the store's own shelf did not confirm is dropped
    // rather than shown. The campaign feed alone is not proof that this account
    // can see the row, let alone buy at that price.
    const resolved = [];
    for (const offer of ranked) {
      if (offer.platform !== 'snapp') {
        resolved.push(offer);
        continue;
      }
      const replacement = replacements.has(offer) ? replacements.get(offer) : undefined;
      if (replacement === null || replacement === undefined) {
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
      relaxed: strict.length === 0 && relaxed.length > 0,
      firstOrderSkipped,
      unlisted,
      unverified,
      bySource: countBySource(ranked),
      vendorCount,
      authenticated,
      campaignEnds,
    },
    errors,
  };
}

/** How many results each platform contributed, for the popup's status line. */
function countBySource(offers) {
  const counts = { snapp: 0, jet: 0 };
  for (const offer of offers) counts[offer.platform] = (counts[offer.platform] || 0) + 1;
  return counts;
}

export async function suggestions(query, location) {
  if (!query || query.trim().length < 2) return [];
  try {
    return await snapp.suggest(query.trim(), location);
  } catch {
    return [];
  }
}
