import { queryOptions } from '@tanstack/react-query'
import {
  sfGetMaintenanceRecord,
  sfListMaintenanceRecords,
} from './maintenance-records.function'
import type { ListMaintenanceRecordsInput } from './maintenance-records.types'

export const maintenanceRecordQueries = {
  list: (filters: ListMaintenanceRecordsInput) =>
    queryOptions({
      queryKey: ['maintenance-records', 'list', filters] as const,
      queryFn: () => sfListMaintenanceRecords({ data: filters }),
    }),
  detail: (id: number) =>
    queryOptions({
      queryKey: ['maintenance-records', 'detail', id] as const,
      queryFn: () => sfGetMaintenanceRecord({ data: id }),
    }),
}
