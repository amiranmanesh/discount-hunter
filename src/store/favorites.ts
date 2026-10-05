import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Offer, PlatformId } from '../core/types';

export interface FavoriteItem {
  id: string; // unique favorite key e.g. "snapp:12345" or "jet:6789"
  platform: PlatformId;
  platformLabel: string;
  productId: string;
  catalogId?: string;
  title: string;
  image: string;
  price: number;
  finalPrice: number;
  discountPercent: number;
  discountAmount: number;
  vendorName: string;
  url: string;
  addedAt: number;
  /** Keep full offer object for basket/card rendering where possible */
  offer: Offer;
}

interface State {
  favorites: FavoriteItem[];
  toggleFavorite: (offer: Offer) => void;
  removeFavorite: (id: string) => void;
  isFavorite: (offer: Offer) => boolean;
  clearFavorites: () => void;
}

export function favKey(platform: PlatformId, productId: string, catalogId?: string): string {
  return `${platform}:${catalogId || productId}`;
}

export const useFavorites = create<State>()(
  persist(
    (set, get) => ({
      favorites: [],

      toggleFavorite: (offer) =>
        set((state) => {
          const key = favKey(offer.platform, offer.productId, offer.catalogId);
          const exists = state.favorites.some((item) => item.id === key);
          if (exists) {
            return { favorites: state.favorites.filter((item) => item.id !== key) };
          }
          const newItem: FavoriteItem = {
            id: key,
            platform: offer.platform,
            platformLabel: offer.platformLabel,
            productId: offer.productId,
            catalogId: offer.catalogId,
            title: offer.title,
            image: offer.image,
            price: offer.price,
            finalPrice: offer.finalPrice,
            discountPercent: offer.discountPercent,
            discountAmount: offer.discountAmount,
            vendorName: offer.vendor?.name ?? '',
            url: offer.url,
            addedAt: Date.now(),
            offer,
          };
          return { favorites: [newItem, ...state.favorites] };
        }),

      removeFavorite: (id) =>
        set((state) => ({ favorites: state.favorites.filter((item) => item.id !== id) })),

      isFavorite: (offer) => {
        const key = favKey(offer.platform, offer.productId, offer.catalogId);
        return get().favorites.some((item) => item.id === key);
      },

      clearFavorites: () => set({ favorites: [] }),
    }),
    {
      name: 'discount-hunter-favorites',
      version: 1,
      skipHydration: true,
    },
  ),
);
