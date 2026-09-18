// Splitting a basket into orders.
//
// Every item can be bought at some set of stores, each at its own price, and
// every store adds its own delivery and service charge and may refuse a basket
// below its minimum. The cheapest way to buy everything is a choice of stores
// and of which item goes to which — a small facility-location problem. Baskets
// are a handful of items and a trip to more than three stores is not a trip
// anyone takes, so every combination of up to three stores is simply tried.
import type { PlatformId } from './types';

export interface Store {
  /** `<platform>:<store code>` — unique across platforms. */
  key: string;
  platform: PlatformId;
  name: string;
  /** Toman. */
  deliveryFee: number;
  /** Toman. Charged on every order on top of delivery (Okala). */
  serviceFee: number;
  /** The listing did not say what delivery costs; `deliveryFee` is a floor. */
  feeUnknown: boolean;
  /** Toman. The smallest basket the store checks out; 0 when it has none. */
  minOrder: number;
  /** The store would not say what its minimum is; `minOrder` is then 0. */
  minOrderUnknown?: boolean;
  /**
   * The minimum has not been asked for yet (Okala keeps it on a separate page).
   * Planning treats it as 0 — the most a store could hope for — so a plan that
   * passes it over would pass it over at any real minimum too; only stores a
   * plan actually picks need asking.
   */
  minOrderPending?: boolean;
}

/** One product, at one store, at one price. */
export interface Candidate {
  itemId: string;
  storeKey: string;
  /** Toman per unit, what the order is charged. */
  unitPrice: number;
  /** Toman per unit before the discount. */
  listPrice: number;
  /** Units one order can carry: stock and per-order caps. */
  available: number;
}

export interface PlanLine<C extends Candidate = Candidate> {
  itemId: string;
  quantity: number;
  candidate: C;
  /** Toman. */
  total: number;
}

export interface PlanOrder<C extends Candidate = Candidate> {
  store: Store;
  lines: PlanLine<C>[];
  /** Toman, the items alone. */
  subtotal: number;
  /** Toman, delivery plus service. */
  fees: number;
  /** Toman still missing to reach the store's minimum basket. */
  shortOfMinimum: number;
}

export interface Plan<C extends Candidate = Candidate> {
  orders: PlanOrder<C>[];
  /** Items no chosen store sells, or sells in the quantity wanted. */
  missing: string[];
  itemsTotal: number;
  feesTotal: number;
  total: number;
  /** What the same items cost at those stores before their discounts. */
  listTotal: number;
}

export interface Plans<C extends Candidate = Candidate> {
  /** The cheapest plan that buys the most items; null for an empty basket. */
  best: Plan<C> | null;
  /** The best plan with exactly `n` orders, at index `n`. */
  byOrders: (Plan<C> | null)[];
}

/** Beyond this many stores, three-store combinations keep the most promising. */
const WIDE = 60;
/** …always including each item's few cheapest sellers. */
const PER_ITEM = 4;

export function plan<C extends Candidate>(
  items: { id: string; quantity: number }[],
  stores: Map<string, Store>,
  candidates: C[],
  maxOrders = 3,
): Plans<C> {
  const wanted = items.filter((item) => item.quantity > 0);
  const byOrders: (Plan<C> | null)[] = Array.from({ length: maxOrders + 1 }, () => null);
  if (!wanted.length) return { best: null, byOrders };

  // The cheapest usable listing of each item at each store.
  const offer = new Map<string, Map<string, C>>(); // store → item → candidate
  for (const candidate of candidates) {
    const item = wanted.find((entry) => entry.id === candidate.itemId);
    if (!item || !stores.has(candidate.storeKey)) continue;
    if (candidate.available < item.quantity) continue;
    const shelf = offer.get(candidate.storeKey) ?? new Map<string, C>();
    const held = shelf.get(item.id);
    if (!held || candidate.unitPrice < held.unitPrice) shelf.set(item.id, candidate);
    offer.set(candidate.storeKey, shelf);
  }

  let keys = [...offer.keys()];
  if (!keys.length) {
    const empty = evaluate([], wanted, stores, offer);
    return { best: empty, byOrders };
  }

  const consider = (combination: string[]) => {
    const result = evaluate(combination, wanted, stores, offer);
    // A store that ends up with nothing makes this a smaller combination,
    // which is tried on its own.
    if (!result || result.orders.length !== combination.length) return;
    const slot = combination.length;
    if (!byOrders[slot] || better(result, byOrders[slot]!)) byOrders[slot] = result;
  };

  for (const a of keys) consider([a]);
  if (maxOrders >= 2) {
    for (let i = 0; i < keys.length; i += 1) {
      for (let j = i + 1; j < keys.length; j += 1) consider([keys[i], keys[j]]);
    }
  }
  if (maxOrders >= 3) {
    if (keys.length > WIDE) keys = promising(keys, wanted, stores, offer);
    for (let i = 0; i < keys.length; i += 1) {
      for (let j = i + 1; j < keys.length; j += 1) {
        for (let k = j + 1; k < keys.length; k += 1) consider([keys[i], keys[j], keys[k]]);
      }
    }
  }

  const best = byOrders.reduce<Plan<C> | null>(
    (held, candidate) => (candidate && (!held || better(candidate, held)) ? candidate : held),
    null,
  );
  return { best, byOrders };
}

/**
 * More items first — a plan that leaves something out is not a cheaper way to
 * buy the basket — then one that every store will accept, then the lower total,
 * then fewer orders.
 */
export function better(a: Plan, b: Plan): boolean {
  if (a.missing.length !== b.missing.length) return a.missing.length < b.missing.length;
  const shortA = a.orders.some((order) => order.shortOfMinimum > 0);
  const shortB = b.orders.some((order) => order.shortOfMinimum > 0);
  if (shortA !== shortB) return !shortA;
  if (a.total !== b.total) return a.total < b.total;
  return a.orders.length < b.orders.length;
}

function evaluate<C extends Candidate>(
  combination: string[],
  items: { id: string; quantity: number }[],
  stores: Map<string, Store>,
  offer: Map<string, Map<string, C>>,
): Plan<C> {
  const assigned = new Map<string, string>(); // item → store
  const missing: string[] = [];
  const quantity = new Map(items.map((item) => [item.id, item.quantity]));
  const cost = (key: string, itemId: string) =>
    offer.get(key)!.get(itemId)!.unitPrice * quantity.get(itemId)!;

  // Each item where it is cheapest among the chosen stores.
  for (const item of items) {
    let chosen: string | null = null;
    for (const key of combination) {
      if (!offer.get(key)?.has(item.id)) continue;
      if (!chosen || cost(key, item.id) < cost(chosen, item.id)) chosen = key;
    }
    if (chosen) assigned.set(item.id, chosen);
    else missing.push(item.id);
  }

  repairMinimums(assigned, combination, stores, offer, cost);

  const lines = new Map<string, PlanLine<C>[]>();
  for (const item of items) {
    const key = assigned.get(item.id);
    if (!key) continue;
    const list = lines.get(key) ?? [];
    list.push({
      itemId: item.id,
      quantity: item.quantity,
      candidate: offer.get(key)!.get(item.id)!,
      total: cost(key, item.id),
    });
    lines.set(key, list);
  }

  const orders: PlanOrder<C>[] = [...lines].map(([key, list]) => {
    const store = stores.get(key)!;
    const subtotal = list.reduce((sum, line) => sum + line.total, 0);
    return {
      store,
      lines: list,
      subtotal,
      fees: store.deliveryFee + store.serviceFee,
      shortOfMinimum: Math.max(store.minOrder - subtotal, 0),
    };
  });

  const itemsTotal = orders.reduce((sum, order) => sum + order.subtotal, 0);
  const feesTotal = orders.reduce((sum, order) => sum + order.fees, 0);
  const listTotal = orders.reduce(
    (sum, order) =>
      sum + order.lines.reduce((acc, line) => acc + line.candidate.listPrice * line.quantity, 0),
    0,
  );
  return { orders, missing, itemsTotal, feesTotal, total: itemsTotal + feesTotal, listTotal };
}

/**
 * Cheapest-first can leave a store just short of its minimum while another
 * store in the same trip sells the same thing for the same price or a little
 * more. Moving those items over — cheapest move first, and never leaving the
 * store they came from short or empty — turns a basket the store would refuse
 * into one it takes. Measured on a real basket: two branches of one chain
 * priced three items identically, and the move saved 12,790 Toman over the
 * best plan that did not make it.
 */
function repairMinimums<C extends Candidate>(
  assigned: Map<string, string>,
  combination: string[],
  stores: Map<string, Store>,
  offer: Map<string, Map<string, C>>,
  cost: (key: string, itemId: string) => number,
) {
  const subtotal = (key: string) => {
    let sum = 0;
    for (const [itemId, at] of assigned) if (at === key) sum += cost(key, itemId);
    return sum;
  };
  const count = (key: string) => [...assigned.values()].filter((at) => at === key).length;

  for (let guard = 0; guard < assigned.size * combination.length; guard += 1) {
    const short = combination.find((key) => {
      const sum = subtotal(key);
      return sum > 0 && sum < stores.get(key)!.minOrder;
    });
    if (!short) return;

    let move: { itemId: string; from: string; extra: number } | null = null;
    for (const [itemId, from] of assigned) {
      if (from === short || !offer.get(short)!.has(itemId)) continue;
      const leaving = cost(from, itemId);
      const left = subtotal(from) - leaving;
      if (count(from) < 2 || left < stores.get(from)!.minOrder) continue;
      const extra = cost(short, itemId) - leaving;
      if (!move || extra < move.extra) move = { itemId, from, extra };
    }
    if (!move) return;
    assigned.set(move.itemId, short);
  }
}

/**
 * The stores worth trying in threes when there are too many to try them all.
 *
 * Every item keeps its few cheapest sellers, so a product only three stores
 * carry is never dropped for being expensive everywhere. The rest are ranked by
 * how much of the basket they carry and how far above each item's cheapest
 * price they sell it — not by what they would charge in total, which would
 * sink every store that happens to sell the one expensive item.
 */
function promising<C extends Candidate>(
  keys: string[],
  items: { id: string; quantity: number }[],
  stores: Map<string, Store>,
  offer: Map<string, Map<string, C>>,
): string[] {
  const cheapest = new Map<string, number>();
  for (const key of keys) {
    for (const [itemId, candidate] of offer.get(key)!) {
      const held = cheapest.get(itemId);
      if (held === undefined || candidate.unitPrice < held)
        cheapest.set(itemId, candidate.unitPrice);
    }
  }

  const kept = new Set<string>();
  for (const item of items) {
    keys
      .filter((key) => offer.get(key)!.has(item.id))
      .sort((a, b) => offer.get(a)!.get(item.id)!.unitPrice - offer.get(b)!.get(item.id)!.unitPrice)
      .slice(0, PER_ITEM)
      .forEach((key) => kept.add(key));
  }

  const ranked = keys
    .map((key) => {
      const shelf = offer.get(key)!;
      const store = stores.get(key)!;
      let above = store.deliveryFee + store.serviceFee;
      for (const item of items) {
        const candidate = shelf.get(item.id);
        if (candidate) above += (candidate.unitPrice - cheapest.get(item.id)!) * item.quantity;
      }
      return { key, covered: shelf.size, above };
    })
    .sort((a, b) => b.covered - a.covered || a.above - b.above);

  for (const { key } of ranked) {
    if (kept.size >= WIDE) break;
    kept.add(key);
  }
  return [...kept];
}
