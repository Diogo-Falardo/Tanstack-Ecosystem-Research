import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  lt,
  lte,
  or,
  sql,
} from 'drizzle-orm'
import { db } from '#/db'
import { assets, maintenanceRecords } from '#/db/schema'
import { fail, ok } from '#/lib/action-result'
import {
  maintenanceRecordRowSchema,
  selectMaintenanceRecordSchema,
} from './maintenance-records.schemas'
import type {
  BulkSetMaintenanceRecordStatusInput,
  BulkSetMaintenanceRecordStatusResult,
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

// Escapes LIKE wildcards so a typed `%` or `_` matches itself, not every row.
// Paired with `ESCAPE '\'` in matchesText; drizzle's like() can't express it.
function containsPattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
}

// UTC start of a 'YYYY-MM' month, shifted by `offset` months — the same
// buckets the dashboard groups by (strftime(..., 'unixepoch')).
function monthStart(month: string, offset = 0): Date {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber - 1 + offset, 1))
}

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

// A leading-wildcard LIKE can't use an index, so this scans whatever rows the
// other filters leave. Fine at seed volume; FTS5 would be the next step.
function matchesText(q: string) {
  const pattern = containsPattern(q)
  return or(
    sql`${maintenanceRecords.description} LIKE ${pattern} ESCAPE '\\'`,
    sql`${maintenanceRecords.technician} LIKE ${pattern} ESCAPE '\\'`,
  )
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

  // One UPDATE ... WHERE id IN (...), not one update() per id. Ids that no
  // longer exist are skipped; the caller sees the real count.
  static async setStatusMany(
    ids: BulkSetMaintenanceRecordStatusInput['ids'],
    status: BulkSetMaintenanceRecordStatusInput['status'],
  ): Promise<BulkSetMaintenanceRecordStatusResult> {
    const rows = await db
      .update(maintenanceRecords)
      .set({ status })
      .where(inArray(maintenanceRecords.id, [...new Set(ids)]))
      .returning({ id: maintenanceRecords.id })
    if (rows.length === 0) {
      return fail({ formError: 'None of the selected records exist anymore' })
    }
    return ok({ updated: rows.length })
  }

  // `includeCost` comes from the caller's role (decided in the function
  // layer); without it the cost column is replaced by NULL in the SELECT, so
  // the value never leaves SQLite.
  static async list(
    filters: ListMaintenanceRecordsInput,
    { includeCost }: { includeCost: boolean },
  ): Promise<ListMaintenanceRecordsResult> {
    const where = and(
      filters.status
        ? eq(maintenanceRecords.status, filters.status)
        : undefined,
      filters.assetId
        ? eq(maintenanceRecords.assetId, filters.assetId)
        : undefined,
      filters.q ? matchesText(filters.q) : undefined,
      // No index on cost_cents: the cost range filters whatever rows the
      // other conditions leave. performed_at is indexed
      // (idx_maintenance_performed_at), so the month range can seek.
      filters.costMin !== undefined
        ? gte(maintenanceRecords.costCents, filters.costMin)
        : undefined,
      filters.costMax !== undefined
        ? lte(maintenanceRecords.costCents, filters.costMax)
        : undefined,
      filters.fromMonth
        ? gte(maintenanceRecords.performedAt, monthStart(filters.fromMonth))
        : undefined,
      filters.toMonth
        ? lt(maintenanceRecords.performedAt, monthStart(filters.toMonth, 1))
        : undefined,
    )

    const sortColumn = sortColumns[filters.sortBy ?? 'performedAt']
    const orderBy =
      filters.sortDir === 'desc' ? desc(sortColumn) : asc(sortColumn)

    const [rows, totalRow] = await Promise.all([
      db
        .select({
          id: maintenanceRecords.id,
          assetId: maintenanceRecords.assetId,
          description: maintenanceRecords.description,
          technician: maintenanceRecords.technician,
          costCents: includeCost
            ? maintenanceRecords.costCents
            : sql<null>`null`,
          status: maintenanceRecords.status,
          performedAt: maintenanceRecords.performedAt,
          createdAt: maintenanceRecords.createdAt,
        })
        .from(maintenanceRecords)
        .where(where)
        .orderBy(orderBy)
        .limit(filters.pageSize)
        .offset(filters.page * filters.pageSize),
      db.select({ total: count() }).from(maintenanceRecords).where(where),
    ])

    return {
      rows: rows.map((row) => maintenanceRecordRowSchema.parse(row)),
      total: totalRow[0]?.total ?? 0,
    }
  }
}
