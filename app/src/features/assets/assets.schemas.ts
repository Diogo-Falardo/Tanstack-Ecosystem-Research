import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { assets } from '#/db/schema'

export const selectAssetSchema = createSelectSchema(assets)
const insertAssetSchema = createInsertSchema(assets)

export const createAssetSchema = insertAssetSchema.omit({
  id: true,
  createdAt: true,
})

export const updateAssetSchema = createAssetSchema.partial().extend({
  id: selectAssetSchema.shape.id,
})

export const listAssetsInputSchema = z.object({
  page: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(100).default(25),
  status: selectAssetSchema.shape.status.optional(),
  category: z.string().min(1).optional(),
})
