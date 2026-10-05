import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

// Pathless layout: every route under routes/_authed/ requires a logged-in
// user by default. Role checks per route live in each child's beforeLoad.
export const Route = createFileRoute('/_authed')({
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    // Narrowed to non-null for every child route's context.
    return { user: context.user }
  },
  component: Outlet,
})
