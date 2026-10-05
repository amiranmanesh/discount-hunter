import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Location, PlatformId, SortMode } from '../core/types';
import type { RateLimitState } from '../auth/backoff';
import { emptyLimit } from '../auth/backoff';
import type { Session } from '../auth/session';
import { randomUuid } from '../core/uuid';

export type ViewMode = 'grid' | 'compact';

export interface Settings {
  /**
   * The one phone number all three sign-ins use. Kept here so it is typed once
   * rather than three times — the accounts are separate, the number is not.
   * It stays on this device, exactly like the sessions below.
   */
  phone: string;
  location: Location | null;
  savedLocations: Location[];
  viewMode: ViewMode;
  sortMode: SortMode;
  sources: Record<PlatformId, boolean>;
  onlyCampaign: boolean;
  onlyOpen: boolean;
  minDiscount: number;
  recentQueries: string[];
  /**
   * The Snapp Market account has a Snapp Pro subscription. Pro stores deliver
   * at a discounted fee only to those who have one, so without it every fee is
   * quoted in full.
   */
  snappPro: boolean;
}

interface State extends Settings {
  sessions: Partial<Record<PlatformId, Session | null>>;
  limits: Record<PlatformId, RateLimitState>;

  setLocation: (location: Location | null) => void;
  selectLocation: (location: Location) => void;
  addSavedLocation: (location: Omit<Location, 'id'> & { id?: string }) => Location;
  removeSavedLocation: (id: string) => void;
  updateSavedLocationLabel: (id: string, label: string) => void;
  setViewMode: (mode: ViewMode) => void;
  patch: (settings: Partial<Settings>) => void;
  rememberQuery: (query: string) => void;
  setSession: (platform: PlatformId, session: Session | null) => void;
  setLimit: (platform: PlatformId, limit: RateLimitState) => void;
}

function sameLocation(a: Location | null, b: Location | null): boolean {
  if (!a || !b) return false;
  if (a.id && b.id && a.id === b.id) return true;
  return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6 && a.label === b.label;
}

export const useSettings = create<State>()(
  persist(
    (set) => ({
      phone: '',
      location: null,
      savedLocations: [],
      viewMode: 'grid',
      sortMode: 'best-discount',
      sources: { snapp: true, jet: true, okala: true },
      onlyCampaign: false,
      onlyOpen: true,
      minDiscount: 0,
      recentQueries: [],
      snappPro: false,
      sessions: { snapp: null, jet: null, okala: null },
      limits: { snapp: emptyLimit(), jet: emptyLimit(), okala: emptyLimit() },

      setLocation: (location) =>
        set((state) => {
          if (!location) return { location: null };
          const id = location.id || randomUuid();
          const normalized = { ...location, id };
          const exists = state.savedLocations.some((loc) => sameLocation(loc, normalized));
          const savedLocations = exists
            ? state.savedLocations.map((loc) => (sameLocation(loc, normalized) ? normalized : loc))
            : [...state.savedLocations, normalized];
          return { location: normalized, savedLocations };
        }),

      selectLocation: (location) => set({ location }),

      addSavedLocation: (rawLoc) => {
        const id = rawLoc.id || randomUuid();
        const newLoc: Location = { ...rawLoc, id };
        set((state) => {
          const existsIndex = state.savedLocations.findIndex((loc) => sameLocation(loc, newLoc));
          let updated: Location[];
          if (existsIndex >= 0) {
            updated = [...state.savedLocations];
            updated[existsIndex] = newLoc;
          } else {
            updated = [...state.savedLocations, newLoc];
          }
          return { savedLocations: updated, location: newLoc };
        });
        return newLoc;
      },

      removeSavedLocation: (id) =>
        set((state) => {
          const filtered = state.savedLocations.filter((loc) => loc.id !== id);
          const activeRemoved = state.location?.id === id;
          return {
            savedLocations: filtered,
            location: activeRemoved ? (filtered[0] ?? null) : state.location,
          };
        }),

      updateSavedLocationLabel: (id, label) =>
        set((state) => {
          const updated = state.savedLocations.map((loc) =>
            loc.id === id ? { ...loc, label } : loc,
          );
          const activeUpdated =
            state.location?.id === id ? { ...state.location, label } : state.location;
          return { savedLocations: updated, location: activeUpdated };
        }),

      setViewMode: (viewMode) => set({ viewMode }),

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
      version: 5,
      skipHydration: true,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<State>;
        let savedLocations: Location[] = Array.isArray(state.savedLocations)
          ? state.savedLocations
          : [];
        let location = state.location ?? null;

        if (location && !location.id) {
          location = { ...location, id: 'loc-default' };
        }

        if (location && !savedLocations.some((l) => sameLocation(l, location))) {
          savedLocations = [location, ...savedLocations];
        }

        return {
          ...state,
          phone: state.phone ?? '',
          location,
          savedLocations,
          viewMode: state.viewMode ?? 'grid',
          snappPro: state.snappPro ?? false,
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
      partialize: (state) => ({
        phone: state.phone,
        location: state.location,
        savedLocations: state.savedLocations,
        viewMode: state.viewMode,
        sortMode: state.sortMode,
        sources: state.sources,
        onlyCampaign: state.onlyCampaign,
        onlyOpen: state.onlyOpen,
        minDiscount: state.minDiscount,
        recentQueries: state.recentQueries,
        snappPro: state.snappPro,
        sessions: state.sessions,
        limits: state.limits,
      }),
    },
  ),
);
