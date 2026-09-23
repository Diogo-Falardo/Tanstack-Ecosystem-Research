import { createServerFn } from '@tanstack/react-start'
import { Assets } from './assets.server'
import {
  createAssetSchema,
  listAssetsInputSchema,
  updateAssetSchema,
} from './assets.schemas'
import { z } from 'zod'

// TODO(Phase 9): replace with a real cookie/DB-backed session lookup.
type Role = 'admin' | 'technician' | 'viewer'

function requireRole(roles: Role[]) {
  const role: Role = 'admin'
  if (!roles.includes(role)) throw new Error('Forbidden')
}

export const sfGetAsset = createServerFn({ method: 'GET' })
  .validator(z.number().int().positive())
  .handler(async ({ data }) => {
    requireRole(['admin', 'technician', 'viewer'])
    return Assets.get(data)
  })

export const sfListAssets = createServerFn({ method: 'GET' })
  .validator(listAssetsInputSchema)
  .handler(async ({ data }) => {
    requireRole(['admin', 'technician', 'viewer'])
    return Assets.list(data)
  })

export const sfCreateAsset = createServerFn({ method: 'POST' })
  .validator(createAssetSchema)
  .handler(async ({ data }) => {
    requireRole(['admin', 'technician'])
    return Assets.create(data)
  })

export const sfUpdateAsset = createServerFn({ method: 'POST' })
  .validator(updateAssetSchema)
  .handler(async ({ data }) => {
    requireRole(['admin', 'technician'])
    const { id, ...rest } = data
    return Assets.update(id, rest)
  })
