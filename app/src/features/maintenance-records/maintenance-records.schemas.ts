import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { maintenanceRecords } from '#/db/schema'

export const selectMaintenanceRecordSchema =
  createSelectSchema(maintenanceRecords)
// Refinements live in the drizzle-zod callback so the server validator and
// the form schema below share the same rules and messages.
const insertMaintenanceRecordSchema = createInsertSchema(maintenanceRecords, {
  assetId: (s) => s.int().positive('Choose an asset'),
  description: (s) => s.trim().min(1, 'Description is required'),
  technician: (s) => s.trim().min(1, 'Technician is required'),
  costCents: (s) => s.int().nonnegative('Cost cannot be negative'),
})

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
  pageSize: z.number().int().min(1).max(2000).default(500),
  status: selectMaintenanceRecordSchema.shape.status.optional(),
  assetId: z.number().int().positive().optional(),
  // Bounded: this ends up inside a LIKE pattern on the server.
  q: z.string().trim().min(1).max(100).optional(),
  sortBy: z.enum(['status', 'performedAt', 'id']).optional(),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
})

const DATE_INPUT = /^\d{4}-\d{2}-\d{2}$/

// The form's *input* type is what the inputs hold (asset select can be empty,
// date input is a string, users type dollars); its *output* is the server
// shape. TanStack Form v1 validates against the input only, so call
// `.parse()` in submit to get the output.
export const maintenanceRecordFormSchema = z
  .object({
    assetId: z
      .number()
      .nullable()
      .transform((value, ctx) => {
        if (value === null) {
          ctx.addIssue({ code: 'custom', message: 'Choose an asset' })
          return z.NEVER
        }
        return value
      })
      .pipe(createMaintenanceRecordSchema.shape.assetId),
    description: createMaintenanceRecordSchema.shape.description,
    technician: createMaintenanceRecordSchema.shape.technician,
    status: selectMaintenanceRecordSchema.shape.status,
    performedAt: z
      .string()
      .regex(DATE_INPUT, 'Enter a date')
      .transform((value) => new Date(`${value}T00:00:00`))
      .refine((date) => !Number.isNaN(date.getTime()), 'Enter a valid date'),
    cost: z
      .number({ error: 'Enter a cost' })
      .nullable()
      .transform((value, ctx) => {
        if (value === null) {
          ctx.addIssue({ code: 'custom', message: 'Enter a cost' })
          return z.NEVER
        }
        return value
      })
      .pipe(
        z
          .number()
          .nonnegative('Cost cannot be negative')
          .refine(
            (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
            'Use at most 2 decimal places',
          ),
      ),
  })
  .transform(({ cost, ...rest }) => ({
    ...rest,
    costCents: Math.round(cost * 100),
  }))
