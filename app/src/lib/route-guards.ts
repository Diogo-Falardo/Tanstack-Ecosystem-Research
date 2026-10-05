import { redirect } from '@tanstack/react-router'
import type { PublicUser, Role } from '#/features/auth/auth.types'

// Route guards are UX only: beforeLoad runs in the browser on client
// navigation. The server functions behind each page re-check the role.
export function requireRouteRole(user: PublicUser, roles: Role[]) {
  if (!roles.includes(user.role)) throw redirect({ to: '/' })
}

// Same lists as the server middleware, for hiding links and columns.
export const canEditRecords = (user: PublicUser) => user.role !== 'viewer'
export const isAdmin = (user: PublicUser) => user.role === 'admin'

// Only same-app paths: `//evil.com` and `/\evil.com` are protocol-relative
// URLs in browsers, so they'd turn the login redirect into an open redirect.
export function safeRedirect(value: string | undefined): string {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.startsWith('/\\')
  ) {
    return '/'
  }
  return value
}
