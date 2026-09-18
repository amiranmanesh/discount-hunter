import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { refFromOffer, refKey, type BasketItem, type ProductRef } from '../core/basket';
import { sameProduct } from '../core/match';
import { randomUuid } from '../core/uuid';
import type { Offer } from '../core/types';

interface State {
  items: BasketItem[];
  /** At most this many orders — one trip per store is still a trip. */
  maxOrders: 1 | 2 | 3;

  add: (offer: Offer) => void;
  setQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  /** This listing is this item after all. */
  accept: (id: string, ref: ProductRef) => void;
  /** This listing is not this item, whatever its title says. */
  reject: (id: string, ref: ProductRef) => void;
  setMaxOrders: (value: 1 | 2 | 3) => void;
}

const MAX_QUANTITY = 50;

/** The item this offer already is, by id or by a title that reads the same. */
export function findItem(items: BasketItem[], offer: Offer): BasketItem | undefined {
  const key = refKey(refFromOffer(offer));
  return (
    items.find((item) => item.refs.some((ref) => refKey(ref) === key)) ??
    items.find(
      (item) =>
        !item.rejected.includes(key) &&
        item.refs.some((ref) => sameProduct(ref.title, offer.title) === 'same'),
    )
  );
}

export const useBasket = create<State>()(
  persist(
    (set) => ({
      items: [],
      maxOrders: 3,

      add: (offer) =>
        set((state) => {
          const held = findItem(state.items, offer);
          if (held) {
            // The same product again is one more of it; a new spelling of it
            // from another store is remembered as the same thing.
            const ref = refFromOffer(offer);
            const known = held.refs.some((own) => refKey(own) === refKey(ref));
            return {
              items: state.items.map((item) =>
                item.id === held.id
                  ? {
                      ...item,
                      quantity: Math.min(item.quantity + 1, MAX_QUANTITY),
                      refs: known ? item.refs : [...item.refs, ref],
                    }
                  : item,
              ),
            };
          }
          return {
            items: [
              ...state.items,
              {
                id: randomUuid(),
                title: offer.title.trim(),
                image: offer.image,
                quantity: 1,
                refs: [refFromOffer(offer)],
                rejected: [],
              },
            ],
          };
        }),

      setQuantity: (id, quantity) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? { ...item, quantity: Math.max(1, Math.min(MAX_QUANTITY, Math.round(quantity))) }
              : item,
          ),
        })),

      remove: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),

      clear: () => set({ items: [] }),

      accept: (id, ref) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id && !item.refs.some((own) => refKey(own) === refKey(ref))
              ? {
                  ...item,
                  refs: [...item.refs, ref],
                  rejected: item.rejected.filter((key) => key !== refKey(ref)),
                }
              : item,
          ),
        })),

      reject: (id, ref) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  // The product the user added can be taken back out only by
                  // removing the item; an equivalent can simply be refused.
                  refs:
                    refKey(item.refs[0]) === refKey(ref)
                      ? item.refs
                      : item.refs.filter((own) => refKey(own) !== refKey(ref)),
                  rejected: item.rejected.includes(refKey(ref))
                    ? item.rejected
                    : [...item.rejected, refKey(ref)],
                }
              : item,
          ),
        })),

      setMaxOrders: (maxOrders) => set({ maxOrders }),
    }),
    {
      name: 'discount-hunter-basket',
      version: 1,
      // Read after mount, like the settings, so the first render matches the
      // server's. `Providers` rehydrates both.
      skipHydration: true,
    },
  ),
);
