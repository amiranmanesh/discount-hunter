import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Location, PlatformId, SortMode } from '../core/types';
import type { RateLimitState } from '../auth/backoff';
import { emptyLimit } from '../auth/backoff';
import type { Session } from '../auth/session';

export interface Settings {
  /**
   * The one phone number all three sign-ins use. Kept here so it is typed once
   * rather than three times — the accounts are separate, the number is not.
   * It stays on this device, exactly like the sessions below.
   */
  phone: string;
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
      phone: '',
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
      // 3 adds the shared phone number; the migration below fills it in for a
      // state written before it existed.
      version: 3,
      // The server renders this page with the empty state above, because it has
      // no access to the browser's storage. Reading the stored state during the
      // first client render would therefore produce different markup than the
      // server sent, which React refuses to reconcile. So hydration is deferred
      // to an effect — `Providers` calls `rehydrate()` right after mount — and
      // the first paint matches the server exactly.
      skipHydration: true,
      // A stored state from before a platform existed has no entry for it, and
      // an absent flag must not read as "off".
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<State>;
        return {
          ...state,
          // Stored before there was a shared number: start empty rather than
          // undefined, which a controlled input would read as uncontrolled.
          phone: state.phone ?? '',
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
        phone: state.phone,
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
