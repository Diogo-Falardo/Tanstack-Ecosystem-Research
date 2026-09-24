import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { anyRole, technicianOrAdmin } from '#/middleware/auth.middleware'
import { MaintenanceRecords } from './maintenance-records.server'
import {
  createMaintenanceRecordSchema,
  listMaintenanceRecordsInputSchema,
  updateMaintenanceRecordSchema,
} from './maintenance-records.schemas'

export const sfGetMaintenanceRecord = createServerFn({ method: 'GET' })
  .middleware([anyRole])
  .validator(z.number().int().positive())
  .handler(async ({ data }) => MaintenanceRecords.get(data))

export const sfListMaintenanceRecords = createServerFn({ method: 'GET' })
  .middleware([anyRole])
  .validator(listMaintenanceRecordsInputSchema)
  .handler(async ({ data }) => MaintenanceRecords.list(data))

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
