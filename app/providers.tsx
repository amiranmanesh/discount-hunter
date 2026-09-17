'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSettings } from '@/store/settings';

/**
 * Client-side setup that every page shares: the query cache, and the service
 * worker that makes the app installable.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  // Created once per browser session rather than per render, so navigating
  // between tabs keeps the results already fetched.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Prices and campaigns move by the hour, and every answer is tied
            // to the signed-in account, so nothing is cached for long and
            // nothing is shared.
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  // Stored location, filters and sessions are read here rather than while the
  // store is created, so the first render matches the server-rendered markup.
  // See the `skipHydration` note in `src/store/settings.ts`.
  useEffect(() => {
    void useSettings.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // An install that fails costs the offline shell and nothing else.
    });
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
