import { createServerFn } from '@tanstack/react-start'
import { fail, ok } from '#/lib/action-result'
import type { ActionResult } from '#/lib/action-result'
import { useAppSession } from '#/lib/session'
import { getCurrentUser } from '#/middleware/auth.middleware'
import { Auth } from './auth.server'
import { loginInputSchema } from './auth.schemas'
import type { CurrentUser, LoginResult, PublicUser } from './auth.types'

function toPublicUser({ sessionVersion: _, ...user }: CurrentUser): PublicUser {
  return user
}

// Public: no auth middleware. CSRF (src/start.ts) still applies, so a
// cross-site page can't log a victim into an attacker's account.
export const sfLogin = createServerFn({ method: 'POST' })
  .validator(loginInputSchema)
  .handler(async ({ data }): Promise<LoginResult> => {
    const user = await Auth.verifyCredentials(data.email, data.password)
    // One message for unknown email and wrong password.
    if (!user) return fail({ formError: 'Invalid email or password' })
    const session = await useAppSession()
    // Clearing first issues a new session id (no session fixation).
    await session.clear()
    await session.update({
      userId: user.id,
      sessionVersion: user.sessionVersion,
    })
    return ok(toPublicUser(user))
  })

// Revokes every session for the user, not just this cookie: a sealed cookie
// copied elsewhere would otherwise stay valid until it expires.
export const sfLogout = createServerFn({ method: 'POST' }).handler(
  async (): Promise<ActionResult<null>> => {
    const user = await getCurrentUser()
    if (user) await Auth.revokeSessions(user.id)
    const session = await useAppSession()
    await session.clear()
    return ok(null)
  },
)

// Never throws for anonymous callers; route guards use the null.
export const sfGetCurrentUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PublicUser | null> => {
    const user = await getCurrentUser()
    return user ? toPublicUser(user) : null
  },
)
