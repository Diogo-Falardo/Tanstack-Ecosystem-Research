import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from '#/db/schema'

export const selectUserSchema = createSelectSchema(users)

// Bounded: the password is fed to scrypt, so it can't be arbitrarily large.
export const loginInputSchema = z.object({
  email: z.email('Enter a valid email').trim().toLowerCase().max(254),
  password: z.string().min(1, 'Password is required').max(200),
})
