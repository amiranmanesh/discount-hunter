import { describe, expect, it } from 'vitest';
import { plan, type Candidate, type Store } from '../src/core/plan';

const store = (key: string, extra: Partial<Store> = {}): Store => ({
  key,
  platform: 'snapp',
  name: key,
  deliveryFee: 0,
  serviceFee: 0,
  feeUnknown: false,
  minOrder: 0,
  ...extra,
});

const at = (
  itemId: string,
  storeKey: string,
  unitPrice: number,
  extra: Partial<Candidate> = {},
): Candidate => ({
  itemId,
  storeKey,
  unitPrice,
  listPrice: unitPrice,
  available: 99,
  ...extra,
});

const stores = (...list: Store[]) => new Map(list.map((entry) => [entry.key, entry]));
const keys = (result: ReturnType<typeof plan>['best']) =>
  result?.orders.map((order) => order.store.key).sort();

describe('plan', () => {
  it('keeps the basket in one store when the second delivery costs more than it saves', () => {
    const result = plan(
      [
        { id: 'milk', quantity: 1 },
        { id: 'rice', quantity: 1 },
      ],
      stores(store('a', { deliveryFee: 30000 }), store('b', { deliveryFee: 30000 })),
      [at('milk', 'a', 100000), at('rice', 'a', 200000), at('milk', 'b', 90000)],
    );

    expect(keys(result.best)).toEqual(['a']);
    expect(result.best?.total).toBe(330000);
  });

  it('splits the basket when the saving beats the extra delivery', () => {
    const result = plan(
      [
        { id: 'milk', quantity: 1 },
        { id: 'rice', quantity: 1 },
      ],
      stores(store('a', { deliveryFee: 10000 }), store('b', { deliveryFee: 10000 })),
      [
        at('milk', 'a', 100000),
        at('rice', 'a', 300000),
        at('milk', 'b', 150000),
        at('rice', 'b', 200000),
      ],
    );

    expect(keys(result.best)).toEqual(['a', 'b']);
    expect(result.best?.total).toBe(320000);
    // The one-store answer is still offered, with what it costs.
    expect(result.byOrders[1]?.total).toBe(360000);
  });

  it('counts the service charge as part of the trip', () => {
    const result = plan(
      [{ id: 'milk', quantity: 1 }],
      stores(store('okala', { serviceFee: 13000 }), store('snapp', { deliveryFee: 5000 })),
      [at('milk', 'okala', 100000), at('milk', 'snapp', 105000)],
    );
    expect(keys(result.best)).toEqual(['snapp']);
  });

  it('multiplies by the quantity and skips a store that cannot sell that many', () => {
    const result = plan([{ id: 'milk', quantity: 3 }], stores(store('a'), store('b')), [
      at('milk', 'a', 90000, { available: 2 }),
      at('milk', 'b', 100000),
    ]);
    expect(keys(result.best)).toEqual(['b']);
    expect(result.best?.itemsTotal).toBe(300000);
  });

  it('prefers a basket every store will accept over a cheaper one below a minimum', () => {
    const result = plan(
      [
        { id: 'milk', quantity: 1 },
        { id: 'rice', quantity: 1 },
      ],
      stores(store('a'), store('b', { minOrder: 150000 })),
      [
        at('milk', 'a', 120000),
        at('rice', 'a', 200000),
        at('milk', 'b', 100000), // cheaper, but alone it is short of b's minimum
      ],
    );

    expect(keys(result.best)).toEqual(['a']);
    expect(result.best?.orders[0].shortOfMinimum).toBe(0);
  });

  it('moves an equally priced item over to lift a store to its minimum', () => {
    // Two branches of one chain, after a real case: the cheap milk is only at
    // `narmak`, and it alone is short of `narmak`'s minimum. The macaroni is a
    // little cheaper at `madani`, so cheapest-first sends it there; moving it
    // over costs 500 Toman and makes both orders acceptable.
    const result = plan(
      [
        { id: 'milk', quantity: 1 },
        { id: 'macaroni', quantity: 1 },
        { id: 'paste', quantity: 1 },
        { id: 'puff', quantity: 1 },
      ],
      stores(store('madani', { minOrder: 170000 }), store('narmak', { minOrder: 170000 })),
      [
        at('milk', 'narmak', 115110),
        at('macaroni', 'madani', 59000),
        at('macaroni', 'narmak', 59500),
        at('paste', 'madani', 170019),
        at('puff', 'madani', 58500),
      ],
      2,
    );

    const narmak = result.best?.orders.find((order) => order.store.key === 'narmak');
    expect(narmak?.lines.map((line) => line.itemId).sort()).toEqual(['macaroni', 'milk']);
    expect(result.best?.orders.every((order) => order.shortOfMinimum === 0)).toBe(true);
    expect(result.best?.missing).toEqual([]);
    expect(result.best?.itemsTotal).toBe(115110 + 59500 + 170019 + 58500);
  });

  it('never moves the last item out of a store, nor leaves the donor short', () => {
    const result = plan(
      [
        { id: 'milk', quantity: 1 },
        { id: 'rice', quantity: 1 },
      ],
      stores(store('a', { minOrder: 100000 }), store('b', { minOrder: 100000 })),
      [at('milk', 'a', 60000), at('rice', 'b', 60000), at('rice', 'a', 60000)],
      2,
    );
    // Moving rice to `a` would empty `b`; the one-store plan is the answer.
    expect(keys(result.best)).toEqual(['a']);
    expect(result.best?.orders[0].shortOfMinimum).toBe(0);
  });

  it('still answers, and says by how much, when no store reaches its minimum', () => {
    const result = plan([{ id: 'milk', quantity: 1 }], stores(store('a', { minOrder: 150000 })), [
      at('milk', 'a', 100000),
    ]);
    expect(result.best?.orders[0].shortOfMinimum).toBe(50000);
  });

  it('lists an item nobody sells rather than dropping the whole basket', () => {
    const result = plan(
      [
        { id: 'milk', quantity: 1 },
        { id: 'unicorn', quantity: 1 },
      ],
      stores(store('a')),
      [at('milk', 'a', 100000)],
    );
    expect(result.best?.missing).toEqual(['unicorn']);
    expect(result.best?.itemsTotal).toBe(100000);
  });

  it('buys more of the basket before it buys it cheaper', () => {
    const result = plan(
      [
        { id: 'milk', quantity: 1 },
        { id: 'rice', quantity: 1 },
      ],
      stores(store('cheap'), store('full', { deliveryFee: 50000 })),
      [at('milk', 'cheap', 10000), at('milk', 'full', 90000), at('rice', 'full', 90000)],
      1,
    );
    expect(keys(result.best)).toEqual(['full']);
  });

  it('adds up what the discounts saved', () => {
    const result = plan([{ id: 'milk', quantity: 2 }], stores(store('a')), [
      at('milk', 'a', 80000, { listPrice: 100000 }),
    ]);
    expect(result.best?.listTotal).toBe(200000);
    expect(result.best?.itemsTotal).toBe(160000);
  });

  it('never proposes more orders than asked', () => {
    const result = plan(
      [
        { id: 'a', quantity: 1 },
        { id: 'b', quantity: 1 },
        { id: 'c', quantity: 1 },
      ],
      stores(store('x'), store('y'), store('z')),
      [at('a', 'x', 1), at('b', 'y', 1), at('c', 'z', 1)],
      2,
    );
    expect(result.best?.orders.length).toBeLessThanOrEqual(2);
    expect(result.best?.missing).toHaveLength(1);
  });

  it('keeps the only sellers of an expensive item among many cheaper stores', () => {
    // After a real case: the oil is sold by one store only and costs more than
    // anything else, and a hundred stores carry the cheap items.
    const list: Store[] = [store('oil-shop', { minOrder: 150000 })];
    const candidates: Candidate[] = [
      at('oil', 'oil-shop', 1448000),
      at('milk', 'oil-shop', 127900),
    ];
    for (let s = 0; s < 100; s += 1) {
      list.push(store(`s${s}`, { deliveryFee: 30000 }));
      candidates.push(at('milk', `s${s}`, 115000 + s), at('puff', `s${s}`, 58500 + s));
      candidates.push(at('water', `s${s}`, 35000 + s), at('paste', `s${s}`, 170000 + s));
    }
    candidates.push(at('eggs', 'egg-shop', 405000));
    list.push(store('egg-shop'));

    const result = plan(
      ['oil', 'milk', 'puff', 'water', 'paste', 'eggs'].map((id) => ({ id, quantity: 1 })),
      stores(...list),
      candidates,
      3,
    );
    expect(result.best?.missing).toEqual([]);
    expect(keys(result.best)).toContain('oil-shop');
  });

  it('finds the best three-store split among many stores quickly', () => {
    const list: Store[] = [];
    const candidates: Candidate[] = [];
    const items = Array.from({ length: 10 }, (_, index) => ({ id: `i${index}`, quantity: 1 }));
    for (let s = 0; s < 120; s += 1) {
      list.push(store(`s${s}`, { deliveryFee: 20000 }));
      for (const item of items) {
        candidates.push(
          at(item.id, `s${s}`, 50000 + ((s * 7919 + Number(item.id.slice(1)) * 104729) % 30000)),
        );
      }
    }
    const started = performance.now();
    const result = plan(items, stores(...list), candidates);
    expect(performance.now() - started).toBeLessThan(3000);
    expect(result.best?.missing).toHaveLength(0);
  });
});
