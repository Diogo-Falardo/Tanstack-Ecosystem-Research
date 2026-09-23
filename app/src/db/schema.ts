import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core'
import { relations, sql } from 'drizzle-orm'

export const assets = sqliteTable(
  'assets',
  {
    id: integer({ mode: 'number' }).primaryKey({ autoIncrement: true }),
    name: text().notNull(),
    category: text().notNull(),
    location: text().notNull(),
    status: text({
      enum: ['operational', 'in_repair', 'broken', 'retired'],
    })
      .notNull()
      .default('operational'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(
      sql`(unixepoch())`,
    ),
  },
  (table) => [
    index('idx_assets_status').on(table.status),
    index('idx_assets_category').on(table.category),
  ],
)

export const maintenanceRecords = sqliteTable(
  'maintenance_records',
  {
    id: integer({ mode: 'number' }).primaryKey({ autoIncrement: true }),
    assetId: integer('asset_id')
      .notNull()
      .references(() => assets.id),
    description: text().notNull(),
    technician: text().notNull(),
    // Cents, not dollars — avoids float rounding errors on aggregation.
    costCents: integer('cost_cents', { mode: 'number' }).notNull(),
    status: text({
      enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
    })
      .notNull()
      .default('scheduled'),
    performedAt: integer('performed_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(
      sql`(unixepoch())`,
    ),
  },
  (table) => [
    index('idx_maintenance_asset_id').on(table.assetId),
    index('idx_maintenance_performed_at').on(table.performedAt),
    index('idx_maintenance_status').on(table.status),
  ],
)

export const assetsRelations = relations(assets, ({ many }) => ({
  maintenanceRecords: many(maintenanceRecords),
}))

export const maintenanceRecordsRelations = relations(
  maintenanceRecords,
  ({ one }) => ({
    asset: one(assets, {
      fields: [maintenanceRecords.assetId],
      references: [assets.id],
    }),
  }),
)
