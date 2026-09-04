import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Location, PlatformId, SortMode } from '../core/types';
import type { RateLimitState } from '../auth/backoff';
import { emptyLimit } from '../auth/backoff';
import type { Session } from '../auth/session';

export interface Settings {
  location: Location | null;
  sortMode: SortMode;
  sources: Record<PlatformId, boolean>;
  onlyCampaign: boolean;
  onlyOpen: boolean;
  minDiscount: number;
  recentQueries: string[];
}

interface State extends Settings {
  sessions: Partial<Record<PlatformId, Session | null>>;
  limits: Record<PlatformId, RateLimitState>;

  setLocation: (location: Location | null) => void;
  patch: (settings: Partial<Settings>) => void;
  rememberQuery: (query: string) => void;
  setSession: (platform: PlatformId, session: Session | null) => void;
  setLimit: (platform: PlatformId, limit: RateLimitState) => void;
}

export const useSettings = create<State>()(
  persist(
    (set) => ({
      location: null,
      sortMode: 'best-discount',
      sources: { snapp: true, jet: true },
      onlyCampaign: false,
      onlyOpen: true,
      minDiscount: 0,
      recentQueries: [],
      sessions: { snapp: null, jet: null },
      limits: { snapp: emptyLimit(), jet: emptyLimit() },

      setLocation: (location) => set({ location }),
      patch: (settings) => set(settings),
      rememberQuery: (query) =>
        set((state) => ({
          recentQueries: [query, ...state.recentQueries.filter((q) => q !== query)].slice(0, 8),
        })),
      setSession: (platform, session) =>
        set((state) => ({ sessions: { ...state.sessions, [platform]: session } })),
      setLimit: (platform, limit) =>
        set((state) => ({ limits: { ...state.limits, [platform]: limit } })),
    }),
    {
      name: 'discount-hunter',
      version: 1,
      // Tokens live here because that is the only place they can live in a
      // browser app; they are the user's own session and never leave the device
      // except to the platform they came from.
      partialize: (state) => ({
        location: state.location,
        sortMode: state.sortMode,
        sources: state.sources,
        onlyCampaign: state.onlyCampaign,
        onlyOpen: state.onlyOpen,
        minDiscount: state.minDiscount,
        recentQueries: state.recentQueries,
        sessions: state.sessions,
        limits: state.limits,
      }),
    },
  ),
);
