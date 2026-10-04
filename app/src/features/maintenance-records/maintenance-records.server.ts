import { and, asc, count, desc, eq } from 'drizzle-orm'
import { db } from '#/db'
import { assets, maintenanceRecords } from '#/db/schema'
import { fail, ok } from '#/lib/action-result'
import { selectMaintenanceRecordSchema } from './maintenance-records.schemas'
import type {
  CreateMaintenanceRecordInput,
  ListMaintenanceRecordsInput,
  ListMaintenanceRecordsResult,
  MaintenanceRecord,
  MaintenanceRecordResult,
  UpdateMaintenanceRecordInput,
} from './maintenance-records.types'

const sortColumns = {
  status: maintenanceRecords.status,
  performedAt: maintenanceRecords.performedAt,
  id: maintenanceRecords.id,
} as const

// SQLite foreign keys aren't enforced here (no `PRAGMA foreign_keys`), so the
// asset reference is checked explicitly before every write.
async function assetExists(assetId: number): Promise<boolean> {
  const rows = await db
    .select({ id: assets.id })
    .from(assets)
    .where(eq(assets.id, assetId))
    .limit(1)
  return rows.length > 0
}

export class MaintenanceRecords {
  static async get(id: number): Promise<MaintenanceRecord> {
    const rows = await db
      .select()
      .from(maintenanceRecords)
      .where(eq(maintenanceRecords.id, id))
      .limit(1)
    const row = rows.at(0)
    if (!row) throw new Error('Maintenance record not found')
    return selectMaintenanceRecordSchema.parse(row)
  }

  // Domain failures are returned (ActionResult) so they reach the form as
  // field errors; get/list still throw.
  static async create(
    data: CreateMaintenanceRecordInput,
  ): Promise<MaintenanceRecordResult> {
    if (!(await assetExists(data.assetId))) {
      return fail({ fieldErrors: { assetId: 'Asset not found' } })
    }
    const [row] = await db.insert(maintenanceRecords).values(data).returning()
    return ok(selectMaintenanceRecordSchema.parse(row))
  }

  static async update(
    id: number,
    data: Omit<UpdateMaintenanceRecordInput, 'id'>,
  ): Promise<MaintenanceRecordResult> {
    if (data.assetId !== undefined && !(await assetExists(data.assetId))) {
      return fail({ fieldErrors: { assetId: 'Asset not found' } })
    }
    const rows = await db
      .update(maintenanceRecords)
      .set(data)
      .where(eq(maintenanceRecords.id, id))
      .returning()
    const row = rows.at(0)
    if (!row) return fail({ formError: 'This record no longer exists' })
    return ok(selectMaintenanceRecordSchema.parse(row))
  }

  static async list(
    filters: ListMaintenanceRecordsInput,
  ): Promise<ListMaintenanceRecordsResult> {
    const where = and(
      filters.status
        ? eq(maintenanceRecords.status, filters.status)
        : undefined,
      filters.assetId
        ? eq(maintenanceRecords.assetId, filters.assetId)
        : undefined,
    )

    const sortColumn = sortColumns[filters.sortBy ?? 'performedAt']
    const orderBy =
      filters.sortDir === 'desc' ? desc(sortColumn) : asc(sortColumn)

    const [rows, totalRow] = await Promise.all([
      db
        .select()
        .from(maintenanceRecords)
        .where(where)
        .orderBy(orderBy)
        .limit(filters.pageSize)
        .offset(filters.page * filters.pageSize),
      db.select({ total: count() }).from(maintenanceRecords).where(where),
    ])

    return {
      rows: rows.map((row) => selectMaintenanceRecordSchema.parse(row)),
      total: totalRow[0]?.total ?? 0,
    }
  }
}
