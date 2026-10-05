import { mutationOptions } from '@tanstack/react-query'
import { sfLogin, sfLogout } from './auth.function'
import type { LoginInput } from './auth.types'

// The client QueryClient lives for the whole tab, so a user switch must drop
// every cached query: otherwise an admin's rows (with costs) would render for
// the next user until refetched. Navigation and router.invalidate() are UI
// work and live in the caller.
export const authMutations = {
  login: () =>
    mutationOptions({
      mutationKey: ['auth', 'login'],
      mutationFn: (data: LoginInput) => sfLogin({ data }),
      onSuccess: (data, _vars, _result, { client }) => {
        if (data.ok) client.clear()
      },
    }),

  logout: () =>
    mutationOptions({
      mutationKey: ['auth', 'logout'],
      mutationFn: () => sfLogout(),
      onSuccess: (data, _vars, _result, { client }) => {
        if (data.ok) client.clear()
      },
    }),
}
