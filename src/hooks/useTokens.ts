import { useQuery } from '@tanstack/react-query';
import { accessToken } from '../store/auth';
import { useSettings } from '../store/settings';

/**
 * Live tokens for both platforms, refreshed when they can be.
 *
 * The query key includes the stored session ids so a sign-in or sign-out
 * immediately invalidates whatever was fetched with the previous account.
 */
export function useTokens() {
  const sessions = useSettings((state) => state.sessions);
  const fingerprint = `${sessions.snapp?.createdAt ?? 0}:${sessions.jet?.createdAt ?? 0}`;

  return useQuery({
    queryKey: ['tokens', fingerprint],
    queryFn: async () => ({
      snapp: await accessToken('snapp'),
      jet: await accessToken('jet'),
    }),
    staleTime: 30_000,
  });
}
