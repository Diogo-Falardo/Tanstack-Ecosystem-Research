import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { maintenanceRecords } from '#/db/schema'

export const selectMaintenanceRecordSchema =
  createSelectSchema(maintenanceRecords)
const insertMaintenanceRecordSchema = createInsertSchema(maintenanceRecords)

export const createMaintenanceRecordSchema = insertMaintenanceRecordSchema.omit(
  {
    id: true,
    createdAt: true,
  },
)

export const updateMaintenanceRecordSchema = createMaintenanceRecordSchema
  .partial()
  .extend({
    id: selectMaintenanceRecordSchema.shape.id,
  })

export const listMaintenanceRecordsInputSchema = z.object({
  page: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(100).default(25),
  status: selectMaintenanceRecordSchema.shape.status.optional(),
  assetId: z.number().int().positive().optional(),
})
