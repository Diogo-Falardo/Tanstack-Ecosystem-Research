import { createServerFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'
import { z } from 'zod'
import { anyRole, technicianOrAdmin } from '#/middleware/auth.middleware'
import { MaintenanceRecords } from './maintenance-records.server'
import {
  bulkSetMaintenanceRecordStatusSchema,
  createMaintenanceRecordSchema,
  listMaintenanceRecordsInputSchema,
  updateMaintenanceRecordSchema,
} from './maintenance-records.schemas'

// Only the edit drawer reads a single record, and it returns cost.
export const sfGetMaintenanceRecord = createServerFn({ method: 'GET' })
  .middleware([technicianOrAdmin])
  .validator(z.number().int().positive())
  .handler(async ({ data }) => MaintenanceRecords.get(data))

export const sfListMaintenanceRecords = createServerFn({ method: 'GET' })
  .middleware([anyRole])
  .validator(listMaintenanceRecordsInputSchema)
  .handler(async ({ data, context }) => {
    const includeCost = context.user.role !== 'viewer'
    // Viewers never see cost, so they can't filter by it either: a cost range
    // would let them binary-search any record's cost from `total` and from
    // which rows come back.
    if (
      !includeCost &&
      (data.costMin !== undefined || data.costMax !== undefined)
    ) {
      setResponseStatus(403)
      throw new Error('Forbidden')
    }
    return MaintenanceRecords.list(data, { includeCost })
  })

export const sfCreateMaintenanceRecord = createServerFn({ method: 'POST' })
  .middleware([technicianOrAdmin])
  .validator(createMaintenanceRecordSchema)
  .handler(async ({ data }) => MaintenanceRecords.create(data))

export const sfUpdateMaintenanceRecord = createServerFn({ method: 'POST' })
  .middleware([technicianOrAdmin])
  .validator(updateMaintenanceRecordSchema)
  .handler(async ({ data }) => {
    const { id, ...rest } = data
    return MaintenanceRecords.update(id, rest)
  })

// Same roles as single-record edit.
export const sfBulkSetMaintenanceRecordStatus = createServerFn({
  method: 'POST',
})
  .middleware([technicianOrAdmin])
  .validator(bulkSetMaintenanceRecordStatusSchema)
  .handler(async ({ data }) =>
    MaintenanceRecords.setStatusMany(data.ids, data.status),
  )
