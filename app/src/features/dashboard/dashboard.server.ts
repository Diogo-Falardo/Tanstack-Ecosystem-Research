import { and, count, desc, eq, gte, lt, sql } from 'drizzle-orm'
import { db } from '#/db'
import { assets, maintenanceRecords } from '#/db/schema'
import type {
  CostByMonthRow,
  CostByStatusRow,
  DashboardInput,
  TopAssetRow,
} from './dashboard.types'

const costSum = sql<number>`sum(${maintenanceRecords.costCents})`.mapWith(
  Number,
)
const monthBucket = sql<string>`strftime('%Y-%m', ${maintenanceRecords.performedAt}, 'unixepoch')`

// [start of the month (months - 1) ago, start of next month), both UTC and
// computed in SQL. The lower bound is what lets SQLite use
// idx_maintenance_performed_at instead of scanning the table.
function inWindow(months: number) {
  const startOffset = `-${months - 1} months`
  return and(
    gte(
      maintenanceRecords.performedAt,
      sql`unixepoch('now', 'start of month', ${startOffset})`,
    ),
    lt(
      maintenanceRecords.performedAt,
      sql`unixepoch('now', 'start of month', '+1 month')`,
    ),
  )
}

// 'YYYY-MM' keys, oldest → current month, in UTC to match strftime.
function monthKeys(months: number): string[] {
  const now = new Date()
  return Array.from({ length: months }, (_, i) => {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1 - i), 1),
    )
    return date.toISOString().slice(0, 7)
  })
}

// Every number here is a GROUP BY in SQL; only aggregate rows leave the DB.
export class Dashboard {
  // Buckets by UTC month (strftime 'unixepoch').
  static async costByMonth({
    months,
  }: DashboardInput): Promise<CostByMonthRow[]> {
    const rows = await db
      .select({ month: monthBucket, costCents: costSum, count: count() })
      .from(maintenanceRecords)
      .where(inWindow(months))
      .groupBy(monthBucket)
      .orderBy(monthBucket)

    // Merge over at most 36 aggregate rows, so empty months show as 0.
    const byMonth = new Map(rows.map((row) => [row.month, row]))
    return monthKeys(months).map(
      (month) => byMonth.get(month) ?? { month, costCents: 0, count: 0 },
    )
  }

  static async costByStatus({
    months,
  }: DashboardInput): Promise<CostByStatusRow[]> {
    return db
      .select({
        status: maintenanceRecords.status,
        costCents: costSum,
        count: count(),
      })
      .from(maintenanceRecords)
      .where(inWindow(months))
      .groupBy(maintenanceRecords.status)
      .orderBy(desc(costSum))
  }

  static async topAssets(
    { months }: DashboardInput,
    limit = 10,
  ): Promise<TopAssetRow[]> {
    return db
      .select({
        assetId: maintenanceRecords.assetId,
        name: assets.name,
        costCents: costSum,
        count: count(),
      })
      .from(maintenanceRecords)
      .innerJoin(assets, eq(assets.id, maintenanceRecords.assetId))
      .where(inWindow(months))
      .groupBy(maintenanceRecords.assetId)
      .orderBy(desc(costSum))
      .limit(limit)
  }
}
