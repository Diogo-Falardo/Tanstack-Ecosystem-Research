import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { maintenanceRecords } from '#/db/schema'

export const selectMaintenanceRecordSchema =
  createSelectSchema(maintenanceRecords)

// A list row as the caller's role is allowed to see it: viewers get
// `costCents: null` (never selected from the DB for them).
export const maintenanceRecordRowSchema = selectMaintenanceRecordSchema.extend({
  costCents: z.number().int().nullable(),
})
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

const MONTH_PARAM = /^\d{4}-(0[1-9]|1[0-2])$/

export const listMaintenanceRecordsInputSchema = z
  .object({
    page: z.number().int().min(0).default(0),
    pageSize: z.number().int().min(1).max(2000).default(500),
    status: selectMaintenanceRecordSchema.shape.status.optional(),
    assetId: z.number().int().positive().optional(),
    // Bounded: this ends up inside a LIKE pattern on the server.
    q: z.string().trim().min(1).max(100).optional(),
    // Cents, like costCents. Viewers can't send these (sfListMaintenanceRecords).
    costMin: z.number().int().nonnegative().max(100_000_000).optional(),
    costMax: z.number().int().nonnegative().max(100_000_000).optional(),
    // 'YYYY-MM', UTC months — the same buckets as the dashboard.
    fromMonth: z.string().regex(MONTH_PARAM).optional(),
    toMonth: z.string().regex(MONTH_PARAM).optional(),
    sortBy: z.enum(['status', 'performedAt', 'id']).optional(),
    sortDir: z.enum(['asc', 'desc']).default('asc'),
  })
  .refine(
    (input) =>
      input.costMin === undefined ||
      input.costMax === undefined ||
      input.costMin <= input.costMax,
    { message: 'costMin must not exceed costMax', path: ['costMin'] },
  )
  .refine(
    (input) =>
      input.fromMonth === undefined ||
      input.toMonth === undefined ||
      input.fromMonth <= input.toMonth,
    { message: 'fromMonth must not be after toMonth', path: ['fromMonth'] },
  )

// The selection store caps at this too; the server enforces it whatever the
// client allowed.
export const MAX_BULK_IDS = 1000

export const bulkSetMaintenanceRecordStatusSchema = z.object({
  ids: z.array(selectMaintenanceRecordSchema.shape.id).min(1).max(MAX_BULK_IDS),
  status: selectMaintenanceRecordSchema.shape.status,
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
