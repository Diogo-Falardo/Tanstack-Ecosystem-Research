import { createMiddleware } from '@tanstack/react-start'

export type Role = 'admin' | 'technician' | 'viewer'

export type CurrentUser = {
  id: number
  role: Role
}

// TODO(Phase 9): read the session cookie and look the user up in the DB.
// Change `role` here to test that forbidden calls are actually rejected.
async function getCurrentUser(): Promise<CurrentUser | null> {
  return { id: 1, role: 'admin' }
}

export const authMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized')
    return next({ context: { user } })
  },
)

export function requireRole(roles: Role[]) {
  return createMiddleware({ type: 'function' })
    .middleware([authMiddleware])
    .server(async ({ next, context }) => {
      if (!roles.includes(context.user.role)) throw new Error('Forbidden')
      return next()
    })
}

export const anyRole = requireRole(['admin', 'technician', 'viewer'])
export const technicianOrAdmin = requireRole(['admin', 'technician'])
export const adminOnly = requireRole(['admin'])
