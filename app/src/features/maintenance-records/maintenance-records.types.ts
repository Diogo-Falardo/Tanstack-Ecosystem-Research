import type { z } from 'zod'
import type { ActionResult } from '#/lib/action-result'
import type {
  createMaintenanceRecordSchema,
  listMaintenanceRecordsInputSchema,
  maintenanceRecordFormSchema,
  selectMaintenanceRecordSchema,
  updateMaintenanceRecordSchema,
} from './maintenance-records.schemas'

export type MaintenanceRecord = z.infer<typeof selectMaintenanceRecordSchema>
export type CreateMaintenanceRecordInput = z.infer<
  typeof createMaintenanceRecordSchema
>
export type UpdateMaintenanceRecordInput = z.infer<
  typeof updateMaintenanceRecordSchema
>
export type ListMaintenanceRecordsInput = z.infer<
  typeof listMaintenanceRecordsInputSchema
>

export type ListMaintenanceRecordsResult = {
  rows: MaintenanceRecord[]
  total: number
}

export type MaintenanceRecordResult = ActionResult<MaintenanceRecord>

// Form values are the form schema's *input* (v1 infers form types from
// defaultValues, not the schema). The output is the server payload.
export type MaintenanceRecordFormValues = z.input<
  typeof maintenanceRecordFormSchema
>
export type MaintenanceRecordFormOutput = z.output<
  typeof maintenanceRecordFormSchema
>
