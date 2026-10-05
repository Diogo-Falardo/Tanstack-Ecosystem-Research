import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { eq, sql } from 'drizzle-orm'
import { db } from '#/db'
import { users } from '#/db/schema'
import type { CurrentUser } from './auth.types'

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>

const KEY_LENGTH = 64

// Stored as `scrypt$<saltHex>$<hashHex>` (node's default cost parameters).
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, KEY_LENGTH)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = await scryptAsync(
    password,
    Buffer.from(saltHex, 'hex'),
    expected.length,
  )
  return timingSafeEqual(actual, expected)
}

// Hashed once, then checked against when the email doesn't exist, so an
// unknown email costs the same scrypt as a wrong password.
let dummyHash: Promise<string> | undefined

const currentUserColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  sessionVersion: users.sessionVersion,
}

export class Auth {
  static async verifyCredentials(
    email: string,
    password: string,
  ): Promise<CurrentUser | null> {
    const rows = await db
      .select({ ...currentUserColumns, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1)
    const row = rows.at(0)

    dummyHash ??= hashPassword('not-a-real-password')
    const valid = await verifyPassword(
      password,
      row?.passwordHash ?? (await dummyHash),
    )
    if (!row || !valid) return null

    const { passwordHash: _, ...user } = row
    return user
  }

  // Runs on every authenticated server-function call (primary-key lookup),
  // so a role change or revocation applies on the next request.
  static async getSessionUser(
    userId: number,
    sessionVersion: number,
  ): Promise<CurrentUser | null> {
    const rows = await db
      .select(currentUserColumns)
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    const row = rows.at(0)
    if (!row || row.sessionVersion !== sessionVersion) return null
    return row
  }

  static async revokeSessions(userId: number): Promise<void> {
    await db
      .update(users)
      .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, userId))
  }
}
