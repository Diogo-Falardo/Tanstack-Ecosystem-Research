import { useMutation } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import {
  HeadContent,
  Link,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import { authMutations } from '#/features/auth/auth.mutations'
import { authQueries } from '#/features/auth/auth.queries'
import type { PublicUser } from '#/features/auth/auth.types'
import { isAdmin } from '#/lib/route-guards'
import appCss from '../styles.css?url'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    // Who is logged in, for guards and nav (UX only; the server re-checks).
    // Cached for 5 min; login/logout clear the cache.
    beforeLoad: async ({ context }) => ({
      user: await context.queryClient.query(authQueries.me()),
    }),
    head: () => ({
      meta: [
        {
          charSet: 'utf-8',
        },
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1',
        },
        {
          title: 'Ops Console',
        },
      ],
      links: [
        {
          rel: 'stylesheet',
          href: appCss,
        },
      ],
    }),
    shellComponent: RootDocument,
  },
)

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-neutral-50 text-neutral-900">
        <TopBar />
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}

const NAV_LINK =
  'rounded-md px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-neutral-900'

function TopBar() {
  const { user } = Route.useRouteContext()

  return (
    <nav
      aria-label="Main"
      className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur"
    >
      <div className="flex h-12 items-center gap-1 px-4 sm:px-8">
        <Link
          to="/"
          className="mr-3 rounded-md py-2 text-sm font-semibold text-neutral-900 focus-visible:outline-2 focus-visible:outline-neutral-900"
        >
          Ops Console
        </Link>
        {user && isAdmin(user) && (
          <Link
            to="/dashboard"
            className={NAV_LINK}
            activeProps={{ className: 'bg-neutral-100 text-neutral-900' }}
          >
            Dashboard
          </Link>
        )}
        {user && (
          <Link
            to="/maintenance-records"
            className={NAV_LINK}
            activeProps={{ className: 'bg-neutral-100 text-neutral-900' }}
          >
            Records
          </Link>
        )}
        {user && isAdmin(user) && (
          <Link
            to="/assets/new"
            className={NAV_LINK}
            activeProps={{ className: 'bg-neutral-100 text-neutral-900' }}
          >
            New asset
          </Link>
        )}
        {user && <UserMenu user={user} />}
      </div>
    </nav>
  )
}

function UserMenu({ user }: { user: PublicUser }) {
  const router = useRouter()
  const logout = useMutation(authMutations.logout())

  return (
    <div className="ml-auto flex items-center gap-3">
      <span className="text-sm text-neutral-600">
        {user.name}{' '}
        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-700">
          {user.role}
        </span>
      </span>
      <button
        type="button"
        disabled={logout.isPending}
        className={NAV_LINK}
        onClick={() =>
          logout.mutate(undefined, {
            onSuccess: async () => {
              // Re-runs the root beforeLoad, so `user` becomes null before
              // the guarded page could render again.
              await router.invalidate()
              await router.navigate({ to: '/login' })
            },
          })
        }
      >
        {logout.isPending ? 'Logging out…' : 'Log out'}
      </button>
    </div>
  )
}
