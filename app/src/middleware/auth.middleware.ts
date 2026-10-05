import { createMiddleware, createServerOnlyFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'
import { Auth } from '#/features/auth/auth.server'
import type { CurrentUser, Role } from '#/features/auth/auth.types'
import { useAppSession } from '#/lib/session'

export type { CurrentUser, Role }

// The session only says who the user is; role and revocation come from the
// DB row, so a demoted or logged-out user loses access on the next call.
// Server-only: this file is imported by client code (via *.function.ts), and
// the wrapper keeps the session/DB imports out of the client bundle.
export const getCurrentUser = createServerOnlyFn(
  async (): Promise<CurrentUser | null> => {
    const session = await useAppSession()
    const { userId, sessionVersion } = session.data
    if (userId === undefined || sessionVersion === undefined) return null
    return Auth.getSessionUser(userId, sessionVersion)
  },
)

export const authMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const user = await getCurrentUser()
    if (!user) {
      setResponseStatus(401)
      throw new Error('Unauthorized')
    }
    return next({ context: { user } })
  },
)

export function requireRole(roles: Role[]) {
  return createMiddleware({ type: 'function' })
    .middleware([authMiddleware])
    .server(async ({ next, context }) => {
      if (!roles.includes(context.user.role)) {
        setResponseStatus(403)
        throw new Error('Forbidden')
      }
      return next()
    })
}

export const anyRole = requireRole(['admin', 'technician', 'viewer'])
export const technicianOrAdmin = requireRole(['admin', 'technician'])
export const adminOnly = requireRole(['admin'])
