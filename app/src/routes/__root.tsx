import type { QueryClient } from '@tanstack/react-query'
import {
  HeadContent,
  Link,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import appCss from '../styles.css?url'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
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
        <Link
          to="/maintenance-records"
          className={NAV_LINK}
          activeProps={{ className: 'bg-neutral-100 text-neutral-900' }}
        >
          Records
        </Link>
        <Link
          to="/assets/new"
          className={NAV_LINK}
          activeProps={{ className: 'bg-neutral-100 text-neutral-900' }}
        >
          New asset
        </Link>
      </div>
    </nav>
  )
}
