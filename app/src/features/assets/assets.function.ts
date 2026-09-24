import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { adminOnly, anyRole } from '#/middleware/auth.middleware'
import { Assets } from './assets.server'
import {
  createAssetSchema,
  listAssetsInputSchema,
  updateAssetSchema,
} from './assets.schemas'

export const sfGetAsset = createServerFn({ method: 'GET' })
  .middleware([anyRole])
  .validator(z.number().int().positive())
  .handler(async ({ data }) => Assets.get(data))

export const sfListAssets = createServerFn({ method: 'GET' })
  .middleware([anyRole])
  .validator(listAssetsInputSchema)
  .handler(async ({ data }) => Assets.list(data))

export const sfCreateAsset = createServerFn({ method: 'POST' })
  .middleware([adminOnly])
  .validator(createAssetSchema)
  .handler(async ({ data }) => Assets.create(data))

export const sfUpdateAsset = createServerFn({ method: 'POST' })
  .middleware([adminOnly])
  .validator(updateAssetSchema)
  .handler(async ({ data }) => {
    const { id, ...rest } = data
    return Assets.update(id, rest)
  })
