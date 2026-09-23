import type { z } from 'zod'
import type {
  createMaintenanceRecordSchema,
  listMaintenanceRecordsInputSchema,
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
