import { and, count, eq } from 'drizzle-orm'
import { db } from '#/db'
import { assets } from '#/db/schema'
import { selectAssetSchema } from './assets.schemas'
import type {
  Asset,
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

  static async create(data: CreateAssetInput): Promise<Asset> {
    const [row] = await db.insert(assets).values(data).returning()
    return selectAssetSchema.parse(row)
  }

  static async update(
    id: number,
    data: Omit<UpdateAssetInput, 'id'>,
  ): Promise<Asset> {
    const rows = await db
      .update(assets)
      .set(data)
      .where(eq(assets.id, id))
      .returning()
    const row = rows.at(0)
    if (!row) throw new Error('Asset not found')
    return selectAssetSchema.parse(row)
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
