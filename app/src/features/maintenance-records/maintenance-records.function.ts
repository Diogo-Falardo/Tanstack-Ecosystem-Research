import { createServerFn } from '@tanstack/react-start'
import { MaintenanceRecords } from './maintenance-records.server'
import {
  createMaintenanceRecordSchema,
  listMaintenanceRecordsInputSchema,
  updateMaintenanceRecordSchema,
} from './maintenance-records.schemas'
import { z } from 'zod'

// TODO(Phase 9): replace with a real cookie/DB-backed session lookup.
type Role = 'admin' | 'technician' | 'viewer'

function requireRole(roles: Role[]) {
  const role: Role = 'admin'
  if (!roles.includes(role)) throw new Error('Forbidden')
}

export const sfGetMaintenanceRecord = createServerFn({ method: 'GET' })
  .validator(z.number().int().positive())
  .handler(async ({ data }) => {
    requireRole(['admin', 'technician', 'viewer'])
    return MaintenanceRecords.get(data)
  })

export const sfListMaintenanceRecords = createServerFn({ method: 'GET' })
  .validator(listMaintenanceRecordsInputSchema)
  .handler(async ({ data }) => {
    requireRole(['admin', 'technician', 'viewer'])
    return MaintenanceRecords.list(data)
  })

export const sfCreateMaintenanceRecord = createServerFn({ method: 'POST' })
  .validator(createMaintenanceRecordSchema)
  .handler(async ({ data }) => {
    requireRole(['admin', 'technician'])
    return MaintenanceRecords.create(data)
  })

export const sfUpdateMaintenanceRecord = createServerFn({ method: 'POST' })
  .validator(updateMaintenanceRecordSchema)
  .handler(async ({ data }) => {
    requireRole(['admin', 'technician'])
    const { id, ...rest } = data
    return MaintenanceRecords.update(id, rest)
  })
