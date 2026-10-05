import type { z } from 'zod'
import type { ActionResult } from '#/lib/action-result'
import type { loginInputSchema, selectUserSchema } from './auth.schemas'

type User = z.infer<typeof selectUserSchema>

export type Role = User['role']

// Server-side identity: what the middleware puts on `context.user`.
export type CurrentUser = Pick<
  User,
  'id' | 'name' | 'email' | 'role' | 'sessionVersion'
>

// What the client sees. `sessionVersion` stays on the server.
export type PublicUser = Omit<CurrentUser, 'sessionVersion'>

export type LoginInput = z.infer<typeof loginInputSchema>

export type LoginResult = ActionResult<PublicUser>
