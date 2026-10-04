import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { assets } from '#/db/schema'

export const selectAssetSchema = createSelectSchema(assets)
// Shared refinements: the server validator and the form schema use the same
// rules and messages.
const insertAssetSchema = createInsertSchema(assets, {
  name: (s) => s.trim().min(1, 'Name is required'),
  category: (s) => s.trim().min(1, 'Category is required'),
  location: (s) => s.trim().min(1, 'Location is required'),
})

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

// Inputs already hold the server types, so no transforms are needed.
export const assetFormSchema = z.object({
  name: createAssetSchema.shape.name,
  category: createAssetSchema.shape.category,
  location: createAssetSchema.shape.location,
  status: selectAssetSchema.shape.status,
})
