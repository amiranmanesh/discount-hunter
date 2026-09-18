// The basket: products the user wants, priced at every store that sells them.
//
// An item is the product the user picked, plus any product on another platform
// they accepted as the same thing. Pricing asks each platform the way its own
// site does — Snapp Market's store switcher, Jet's and Okala's search — and
// keeps only listings that are that product: the same id on its own platform,
// or a title `match.ts` calls the same. Listings it only thinks might be are
// priced too, but used only once the user says so.
import * as snapp from '../api/snapp';
import * as jet from '../api/jet';
import * as okala from '../api/okala';
import { compare, signature, type Verdict } from './match';
import { isPoolError, pooled } from './pool';
import type { Candidate, Store } from './plan';
import type { Location, Offer, PlatformId } from './types';

export interface ProductRef {
  platform: PlatformId;
  /** The product across that platform's stores — see `Offer.catalogId`. */
  catalogId: string;
  title: string;
}

export interface BasketItem {
  id: string;
  title: string;
  image: string;
  quantity: number;
  /** The product added, then every equivalent the user accepted. */
  refs: ProductRef[];
  /** `refKey`s the user said are not this item. */
  rejected: string[];
}

export const refKey = (ref: Pick<ProductRef, 'platform' | 'catalogId'>) =>
  `${ref.platform}:${ref.catalogId}`;

export function refFromOffer(offer: Offer): ProductRef {
  return {
    platform: offer.platform,
    catalogId: offer.catalogId ?? offer.productId,
    title: offer.title,
  };
}

/** One product at one store, ready for the planner. */
export interface Line extends Candidate {
  platform: PlatformId;
  ref: ProductRef;
  title: string;
  image: string;
  url: string;
  discountPercent: number;
  /** Jet: what the product page shows before the checkout discount. */
  pagePrice?: number;
  /** How the title compared with the item when it was priced. */
  verdict: Exclude<Verdict, 'different'>;
}

export interface Gathered {
  stores: Map<string, Store>;
  lines: Line[];
  /** Platform-level failures, worded for the user. */
  errors: string[];
  /** Platforms left out, and why. */
  skipped: { platform: PlatformId; reason: string }[];
}

export interface GatherOptions {
  sources: Record<PlatformId, boolean>;
  snappPro: boolean;
  tokens: { snapp?: string | null; jet?: string | null; okala?: string | null };
  onProgress?: (done: number, total: number) => void;
}

const LABELS: Record<PlatformId, string> = {
  snapp: 'اسنپ‌مارکت',
  jet: 'دیجی‌کالا جت',
  okala: 'اوکالا',
};

/** The listing is this item: one of its own products, or a title that reads the same. */
export function judge(item: BasketItem, ref: ProductRef): Verdict {
  if (item.refs.some((own) => refKey(own) === refKey(ref))) return 'same';
  if (item.rejected.includes(refKey(ref))) return 'different';
  const theirs = signature(ref.title);
  let verdict: Verdict = 'different';
  for (const own of item.refs) {
    const result = compare(signature(own.title), theirs);
    if (result === 'same') return 'same';
    if (result === 'maybe') verdict = 'maybe';
  }
  return verdict;
}

/**
 * Whether the planner may use this line now. Kept apart from pricing so that
 * accepting or rejecting an equivalent re-plans at once, without asking any
 * platform again.
 */
export function usable(item: BasketItem, line: Line): boolean {
  const key = refKey(line.ref);
  if (item.refs.some((own) => refKey(own) === key)) return true;
  if (item.rejected.includes(key)) return false;
  return line.verdict === 'same';
}

export async function gather(
  items: BasketItem[],
  location: Location,
  options: GatherOptions,
): Promise<Gathered> {
  const stores = new Map<string, Store>();
  const lines: Line[] = [];
  const errors: string[] = [];
  const skipped: Gathered['skipped'] = [];

  const fail = (platform: PlatformId) => (error: unknown) => {
    errors.push(`${LABELS[platform]}: ${error instanceof Error ? error.message : String(error)}`);
  };

  const { sources, tokens } = options;
  const pipelines: Promise<void>[] = [];
  let done = 0;
  let total = 0;
  const tick = () => {
    done += 1;
    options.onProgress?.(done, total);
  };

  // The three platforms run side by side; within each, a few requests at a time.
  if (sources.snapp && !tokens.snapp) {
    skipped.push({ platform: 'snapp', reason: 'برای قیمت اسنپ‌مارکت باید وارد حسابش شوی.' });
  } else if (sources.snapp && tokens.snapp) {
    total += items.length;
    pipelines.push(
      snappPrices(items, location, tokens.snapp, options.snappPro, stores, lines, fail, tick),
    );
  }

  if (sources.jet) {
    total += items.length;
    pipelines.push(jetPrices(items, location, tokens.jet ?? null, stores, lines, fail, tick));
  }

  if (sources.okala && !tokens.okala) {
    skipped.push({ platform: 'okala', reason: 'برای قیمت اوکالا باید وارد حسابش شوی.' });
  } else if (sources.okala && tokens.okala) {
    total += items.length;
    pipelines.push(okalaPrices(items, location, tokens.okala, stores, lines, fail, tick));
  }

  options.onProgress?.(0, total);
  await Promise.all(pipelines);

  return { stores, lines: dedupe(lines), errors: [...new Set(errors)], skipped };
}

/** The same product at the same store, found twice, is kept once at its lower price. */
function dedupe(lines: Line[]): Line[] {
  const kept = new Map<string, Line>();
  for (const line of lines) {
    const key = `${line.itemId}|${line.storeKey}|${refKey(line.ref)}`;
    const held = kept.get(key);
    if (!held || line.unitPrice < held.unitPrice) kept.set(key, line);
  }
  return [...kept.values()];
}

type Fail = (platform: PlatformId) => (error: unknown) => void;

/* ------------------------------------------------------------ snapp ---- */

async function snappPrices(
  items: BasketItem[],
  location: Location,
  token: string,
  pro: boolean,
  stores: Map<string, Store>,
  lines: Line[],
  fail: Fail,
  tick: () => void,
): Promise<void> {
  // Which Snapp products stand for each item, and how sure that is.
  const products = new Map<string, Map<string, Exclude<Verdict, 'different'>>>();
  const primary = new Map<string, string>();

  const collect = (item: BasketItem, found: snapp.SuggestedVendor[]) => {
    for (const { vendor, lines: shelf } of found) {
      const key = `snapp:${vendor.code}`;
      for (const line of shelf) {
        const verdict = products.get(item.id)?.get(line.catalogId);
        if (!verdict) continue;
        stores.set(key, {
          key,
          platform: 'snapp',
          name: vendor.name,
          deliveryFee: vendor.deliveryFee,
          serviceFee: 0,
          feeUnknown: false,
          minOrder: vendor.minOrder,
        });
        lines.push({
          itemId: item.id,
          storeKey: key,
          platform: 'snapp',
          ref: { platform: 'snapp', catalogId: line.catalogId, title: line.title },
          title: line.title,
          image: line.image,
          url: snapp.productUrl(vendor, line.catalogId),
          unitPrice: line.finalPrice,
          listPrice: line.price,
          discountPercent: line.discountPercent,
          available: line.available,
          verdict,
        });
      }
    }
  };

  const perItem = items.map((item) => async () => {
    const found = new Map<string, Exclude<Verdict, 'different'>>();
    for (const ref of item.refs) if (ref.platform === 'snapp') found.set(ref.catalogId, 'same');

    // An item from another platform needs its Snapp product found by name.
    if (!found.size) {
      const candidates = await snapp.findProducts(token, item.title, location);
      let maybes = 0;
      for (const candidate of candidates) {
        const verdict = judge(item, { platform: 'snapp', ...candidate });
        if (verdict === 'same') found.set(candidate.catalogId, 'same');
        else if (verdict === 'maybe' && maybes < 2) {
          found.set(candidate.catalogId, 'maybe');
          maybes += 1;
        }
      }
    }
    products.set(item.id, found);
    const first = [...found].find(([, verdict]) => verdict === 'same')?.[0];
    if (first) primary.set(item.id, first);

    for (const catalogId of found.keys()) {
      const suggested = await snapp.suggestVendors(
        token,
        location,
        [{ catalogId, quantity: item.quantity }],
        { pro },
      );
      collect(item, suggested);
    }
  });

  // Stores that carry several items at once are what a one-store plan needs,
  // and the per-item answers only list each item's cheapest five.
  const together = async () => {
    const basket = items
      .filter((item) => primary.has(item.id))
      .map((item) => ({ item, catalogId: primary.get(item.id)! }));
    if (basket.length < 2) return;
    const suggested = await snapp.suggestVendors(
      token,
      location,
      basket.map(({ item, catalogId }) => ({ catalogId, quantity: item.quantity })),
      { pro },
    );
    for (const { item } of basket) collect(item, suggested);
  };

  // The basket-wide question needs every item's answer first.
  const results = await pooled(perItem, 3, async (task) => {
    try {
      await task();
    } finally {
      tick();
    }
  });
  for (const result of results) if (isPoolError(result)) fail('snapp')(result.error);
  await together().catch(fail('snapp'));
}

/* -------------------------------------------------------------- jet ---- */

async function jetPrices(
  items: BasketItem[],
  location: Location,
  token: string | null,
  stores: Map<string, Store>,
  lines: Line[],
  fail: Fail,
  tick: () => void,
): Promise<void> {
  await pooled(items, 3, async (item) => {
    try {
      const found: Offer[] = [];
      for (let page = 1; page <= 2; page += 1) {
        const result = await jet.search(item.title, location, page, token, '22');
        found.push(...result.offers);
        if (!result.hasMore) break;
      }
      const matching = found.filter(
        (offer) =>
          !offer.outOfStock &&
          offer.vendor.isOpen !== false &&
          judge(item, refFromOffer(offer)) !== 'different',
      );
      const priced = await jet.withShops(matching, location, token);
      for (const offer of priced) addOffer(item, offer, stores, lines);
    } catch (error) {
      fail('jet')(error);
    } finally {
      tick();
    }
  });
}

/* ------------------------------------------------------------ okala ---- */

async function okalaPrices(
  items: BasketItem[],
  location: Location,
  token: string,
  stores: Map<string, Store>,
  lines: Line[],
  fail: Fail,
  tick: () => void,
): Promise<void> {
  await pooled(items, 3, async (item) => {
    try {
      const found = await okala.search(item.title, location, token);
      for (const offer of found) {
        if (offer.outOfStock) continue;
        if (judge(item, refFromOffer(offer)) === 'different') continue;
        addOffer(item, offer, stores, lines);
      }
    } catch (error) {
      fail('okala')(error);
    } finally {
      tick();
    }
  });
}

/**
 * Okala's search does not carry a store's minimum basket — only the store's own
 * page does, one request per store, and a point has fifty of them. So the
 * planner starts with every Okala minimum pending, and asks only for the stores
 * its plans pick, until the plans stop changing. A plan that sends one bottle
 * of water to a store with a 350,000 Toman minimum is one the store refuses.
 */
export async function askMinimums(
  keys: string[],
  location: Location,
): Promise<Map<string, number | null>> {
  const answers = await pooled(keys, 6, (key) =>
    okala.storeMinimum(key.slice('okala:'.length), location),
  );
  return new Map(
    keys.map((key, index) => [key, isPoolError(answers[index]) ? null : answers[index]]),
  );
}

/** Stores with the minimums known so far filled in. */
export function withMinimums(
  stores: Map<string, Store>,
  minimums: Map<string, number | null>,
): Map<string, Store> {
  const out = new Map(stores);
  for (const [key, minimum] of minimums) {
    const store = out.get(key);
    if (!store) continue;
    out.set(
      key,
      minimum === null
        ? { ...store, minOrderPending: false, minOrderUnknown: true }
        : { ...store, minOrder: minimum, minOrderPending: false, minOrderUnknown: false },
    );
  }
  return out;
}

function addOffer(item: BasketItem, offer: Offer, stores: Map<string, Store>, lines: Line[]) {
  const ref = refFromOffer(offer);
  const verdict = judge(item, ref);
  if (verdict === 'different') return;
  const key = `${offer.platform}:${offer.vendor.code}`;
  if (!stores.has(key)) {
    stores.set(key, {
      key,
      platform: offer.platform,
      name: offer.vendor.name,
      deliveryFee: offer.vendor.deliveryFee,
      serviceFee: offer.vendor.serviceFee ?? 0,
      feeUnknown: Boolean(offer.vendor.deliveryFeeUnknown),
      minOrder: offer.vendor.minOrder,
      ...(offer.platform === 'okala' ? { minOrderPending: true } : {}),
    });
  }
  lines.push({
    itemId: item.id,
    storeKey: key,
    platform: offer.platform,
    ref,
    title: offer.title,
    image: offer.image,
    url: offer.url,
    unitPrice: offer.finalPrice,
    listPrice: offer.price,
    discountPercent: offer.discountPercent,
    available: Math.min(
      offer.maxPerOrder ?? Infinity,
      // Jet reports stock as in, low or out, not a count.
      offer.platform === 'okala' ? offer.stock : Infinity,
    ),
    ...(offer.pagePrice !== undefined ? { pagePrice: offer.pagePrice } : {}),
    verdict,
  });
}
