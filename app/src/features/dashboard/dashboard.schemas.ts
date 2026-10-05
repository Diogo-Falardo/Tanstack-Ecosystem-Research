import { z } from 'zod'
import { selectMaintenanceRecordSchema } from '#/features/maintenance-records/maintenance-records.schemas'

// Closed set so the URL can't ask for an arbitrary window. 36 covers the seed.
export const dashboardInputSchema = z.object({
  months: z
    .union([z.literal(3), z.literal(6), z.literal(12), z.literal(36)])
    .default(12),
})

// Aggregate row shapes. Used for types only; SQL builds these rows, so there
// is no runtime parse.
export const costByMonthRowSchema = z.object({
  month: z.string(), // 'YYYY-MM', UTC
  costCents: z.number(),
  count: z.number(),
})

export const costByStatusRowSchema = z.object({
  status: selectMaintenanceRecordSchema.shape.status,
  costCents: z.number(),
  count: z.number(),
})

export const topAssetRowSchema = z.object({
  assetId: z.number(),
  name: z.string(),
  costCents: z.number(),
  count: z.number(),
})
