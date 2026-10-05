import { mutationOptions } from '@tanstack/react-query'
import { cleanupAssetsCollection } from '#/features/assets/assets.collection'
import { sfLogin, sfLogout } from './auth.function'
import type { LoginInput } from './auth.types'

// The client QueryClient lives for the whole tab, so a user switch must drop
// every cached query: otherwise an admin's rows (with costs) would render for
// the next user until refetched. TanStack DB collections keep their own store
// on top of the Query cache, so login cleans them up separately. Navigation and
// router.invalidate() are UI work and live in the caller.
export const authMutations = {
  login: () =>
    mutationOptions({
      mutationKey: ['auth', 'login'],
      mutationFn: (data: LoginInput) => sfLogin({ data }),
      onSuccess: async (data, _vars, _result, { client }) => {
        if (!data.ok) return
        await cleanupAssetsCollection(client)
        client.clear()
      },
    }),

  // No collection cleanup here: this runs before the caller navigates away,
  // so /assets/live would still be mounted and its live queries would lose
  // their source mid-render. The previous user's rows can't render after
  // logout anyway (every route but /login is guarded), and login cleans up
  // before the next user sees anything.
  logout: () =>
    mutationOptions({
      mutationKey: ['auth', 'logout'],
      mutationFn: () => sfLogout(),
      onSuccess: (data, _vars, _result, { client }) => {
        if (data.ok) client.clear()
      },
    }),
}
