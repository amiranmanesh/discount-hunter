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
      sources: { snapp: true, jet: true, okala: true },
      onlyCampaign: false,
      onlyOpen: true,
      minDiscount: 0,
      recentQueries: [],
      sessions: { snapp: null, jet: null, okala: null },
      limits: { snapp: emptyLimit(), jet: emptyLimit(), okala: emptyLimit() },

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
      version: 2,
      // A stored state from before a platform existed has no entry for it, and
      // an absent flag must not read as "off".
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<State>;
        return {
          ...state,
          sources: { snapp: true, jet: true, okala: true, ...(state.sources ?? {}) },
          limits: {
            snapp: emptyLimit(),
            jet: emptyLimit(),
            okala: emptyLimit(),
            ...(state.limits ?? {}),
          },
          sessions: { snapp: null, jet: null, okala: null, ...(state.sessions ?? {}) },
        } as State;
      },
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
