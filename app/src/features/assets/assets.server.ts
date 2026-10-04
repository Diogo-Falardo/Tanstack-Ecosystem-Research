import { and, asc, count, eq } from 'drizzle-orm'
import { db } from '#/db'
import { assets } from '#/db/schema'
import { fail, ok } from '#/lib/action-result'
import { selectAssetSchema } from './assets.schemas'
import type {
  Asset,
  AssetOption,
  AssetResult,
  CreateAssetInput,
  ListAssetsInput,
  ListAssetsResult,
  UpdateAssetInput,
} from './assets.types'

export class Assets {
  static async get(id: number): Promise<Asset> {
    const rows = await db
      .select()
      .from(assets)
      .where(eq(assets.id, id))
      .limit(1)
    const row = rows.at(0)
    if (!row) throw new Error('Asset not found')
    return selectAssetSchema.parse(row)
  }

  static async create(data: CreateAssetInput): Promise<AssetResult> {
    const [row] = await db.insert(assets).values(data).returning()
    return ok(selectAssetSchema.parse(row))
  }

  static async update(
    id: number,
    data: Omit<UpdateAssetInput, 'id'>,
  ): Promise<AssetResult> {
    const rows = await db
      .update(assets)
      .set(data)
      .where(eq(assets.id, id))
      .returning()
    const row = rows.at(0)
    if (!row) return fail({ formError: 'This asset no longer exists' })
    return ok(selectAssetSchema.parse(row))
  }

  // Feeds the asset <select> in the maintenance-record form. Hard cap so it
  // stays a bounded payload; a searchable combobox is Phase 7.
  static async options(): Promise<AssetOption[]> {
    return db
      .select({ id: assets.id, name: assets.name })
      .from(assets)
      .orderBy(asc(assets.name))
      .limit(1000)
  }

  static async list(filters: ListAssetsInput): Promise<ListAssetsResult> {
    const where = and(
      filters.status ? eq(assets.status, filters.status) : undefined,
      filters.category ? eq(assets.category, filters.category) : undefined,
    )

    const [rows, totalRow] = await Promise.all([
      db
        .select()
        .from(assets)
        .where(where)
        .limit(filters.pageSize)
        .offset(filters.page * filters.pageSize),
      db.select({ total: count() }).from(assets).where(where),
    ])

    return {
      rows: rows.map((row) => selectAssetSchema.parse(row)),
      total: totalRow[0]?.total ?? 0,
    }
  }
}
