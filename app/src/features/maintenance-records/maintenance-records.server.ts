import { and, count, eq } from 'drizzle-orm'
import { db } from '#/db'
import { maintenanceRecords } from '#/db/schema'
import { selectMaintenanceRecordSchema } from './maintenance-records.schemas'
import type {
  CreateMaintenanceRecordInput,
  ListMaintenanceRecordsInput,
  ListMaintenanceRecordsResult,
  MaintenanceRecord,
  UpdateMaintenanceRecordInput,
} from './maintenance-records.types'

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

  static async create(
    data: CreateMaintenanceRecordInput,
  ): Promise<MaintenanceRecord> {
    const [row] = await db.insert(maintenanceRecords).values(data).returning()
    return selectMaintenanceRecordSchema.parse(row)
  }

  static async update(
    id: number,
    data: Omit<UpdateMaintenanceRecordInput, 'id'>,
  ): Promise<MaintenanceRecord> {
    const rows = await db
      .update(maintenanceRecords)
      .set(data)
      .where(eq(maintenanceRecords.id, id))
      .returning()
    const row = rows.at(0)
    if (!row) throw new Error('Maintenance record not found')
    return selectMaintenanceRecordSchema.parse(row)
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

    const [rows, totalRow] = await Promise.all([
      db
        .select()
        .from(maintenanceRecords)
        .where(where)
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
