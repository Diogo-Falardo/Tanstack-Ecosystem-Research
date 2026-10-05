import { queryOptions } from '@tanstack/react-query'
import { sfGetCurrentUser } from './auth.function'

export const authQueries = {
  // Drives route guards and nav visibility only (UX). Every server function
  // re-checks the session itself.
  me: () =>
    queryOptions({
      queryKey: ['auth', 'me'] as const,
      queryFn: () => sfGetCurrentUser(),
      staleTime: 5 * 60_000,
    }),
}
