import { config } from 'dotenv'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { sql } from 'drizzle-orm'

import { users } from '../src/db/schema.ts'

config({ path: ['.env.local', '.env'] })

// Imported after config(): auth.server pulls in src/db, which reads
// DATABASE_URL when the module is evaluated.
const { hashPassword } = await import('../src/features/auth/auth.server.ts')

// Fixed dev logins for a research DB. Separate from db.init.ts so seeding
// users doesn't wipe and regenerate the 80k maintenance records.
const PASSWORD = process.env.SEED_USER_PASSWORD ?? 'password123'

const SEED_USERS = [
  { email: 'admin@example.com', name: 'Ada Admin', role: 'admin' },
  { email: 'tech@example.com', name: 'Theo Technician', role: 'technician' },
  { email: 'viewer@example.com', name: 'Vera Viewer', role: 'viewer' },
] as const

const sqlite = new Database(process.env.DATABASE_URL)
const db = drizzle(sqlite, { schema: { users } })

for (const user of SEED_USERS) {
  const passwordHash = await hashPassword(PASSWORD)
  db.insert(users)
    .values({ ...user, passwordHash })
    .onConflictDoUpdate({
      target: users.email,
      // Bumping the version also signs out any session from a previous seed.
      set: {
        name: user.name,
        role: user.role,
        passwordHash,
        sessionVersion: sql`${users.sessionVersion} + 1`,
      },
    })
    .run()
}

console.log(`users seeded (password: ${PASSWORD})`)
for (const user of SEED_USERS) {
  console.log(`  ${user.role.padEnd(10)} ${user.email}`)
}

sqlite.close()
