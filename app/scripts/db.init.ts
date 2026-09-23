import { config } from 'dotenv'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import { assets, maintenanceRecords } from '../src/db/schema.ts'

config({ path: ['.env.local', '.env'] })

const NUM_ASSETS = 500
const NUM_RECORDS = 80_000
const BATCH_SIZE = 2_000

const sqlite = new Database(process.env.DATABASE_URL!)
const db = drizzle(sqlite, { schema: { assets, maintenanceRecords } })

const CATEGORIES = [
  'Vehicle',
  'HVAC',
  'Forklift',
  'Generator',
  'Machinery',
  'IT Equipment',
  'Conveyor',
] as const

const LOCATIONS = [
  'Warehouse A',
  'Warehouse B',
  'HQ Office',
  'Plant 1',
  'Plant 2',
  'Distribution Center',
  'Remote Site',
] as const

const ASSET_STATUSES = [
  'operational',
  'operational',
  'operational',
  'operational',
  'in_repair',
  'broken',
  'retired',
] as const

const MAINTENANCE_STATUSES = [
  'completed',
  'completed',
  'completed',
  'completed',
  'scheduled',
  'in_progress',
  'cancelled',
] as const

const TECHNICIANS = [
  'Alex Rivera',
  'Jordan Lee',
  'Sam Patel',
  'Casey Nguyen',
  'Morgan Diaz',
  'Taylor Kim',
  'Riley Brooks',
  'Jamie Chen',
  'Drew Sanders',
  'Quinn Osei',
]

const VERBS = [
  'Replaced',
  'Repaired',
  'Inspected',
  'Serviced',
  'Calibrated',
  'Cleaned',
  'Diagnosed fault in',
]

const PARTS = [
  'brake pads',
  'oil filter',
  'drive belt',
  'compressor',
  'wiring harness',
  'bearings',
  'hydraulic hose',
  'control panel',
  'battery',
  'coolant system',
  'air filter',
  'sensor array',
]

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomChoice<T>(arr: readonly T[]): T {
  return arr[randomInt(0, arr.length - 1)]!
}

function randomDateWithinDays(daysBack: number) {
  const now = Date.now()
  const offsetMs = randomInt(0, daysBack) * 24 * 60 * 60 * 1000
  return new Date(now - offsetMs)
}

console.log(`Seeding ${process.env.DATABASE_URL}...`)
console.time('seed')

sqlite.exec('DELETE FROM maintenance_records')
sqlite.exec('DELETE FROM assets')

const assetRows = Array.from({ length: NUM_ASSETS }, (_, i) => ({
  name: `${randomChoice(CATEGORIES)} #${i + 1}`,
  category: randomChoice(CATEGORIES),
  location: randomChoice(LOCATIONS),
  status: randomChoice(ASSET_STATUSES),
}))

const insertedAssets = db
  .insert(assets)
  .values(assetRows)
  .returning({ id: assets.id })
  .all()

const assetIds = insertedAssets.map((a) => a.id)

// sqlite.transaction (not db.transaction) — this returns a reusable function
// we call once per batch. db.transaction() runs its callback immediately.
const insertBatch = sqlite.transaction(
  (rows: (typeof maintenanceRecords.$inferInsert)[]) => {
    db.insert(maintenanceRecords).values(rows).run()
  },
)

let batch: (typeof maintenanceRecords.$inferInsert)[] = []
let inserted = 0

for (let i = 0; i < NUM_RECORDS; i++) {
  batch.push({
    assetId: randomChoice(assetIds),
    description: `${randomChoice(VERBS)} ${randomChoice(PARTS)}`,
    technician: randomChoice(TECHNICIANS),
    costCents: randomInt(5_000, 500_000),
    status: randomChoice(MAINTENANCE_STATUSES),
    performedAt: randomDateWithinDays(3 * 365),
  })

  if (batch.length >= BATCH_SIZE) {
    insertBatch(batch)
    inserted += batch.length
    process.stdout.write(`\r  inserted ${inserted}/${NUM_RECORDS}`)
    batch = []
  }
}

if (batch.length > 0) {
  insertBatch(batch)
  inserted += batch.length
  process.stdout.write(`\r  inserted ${inserted}/${NUM_RECORDS}`)
}

console.log()
console.log(`assets: ${assetIds.length}, maintenance_records: ${inserted}`)
console.timeEnd('seed')

sqlite.close()
