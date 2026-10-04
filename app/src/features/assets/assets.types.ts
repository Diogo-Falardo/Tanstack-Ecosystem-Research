import type { z } from 'zod'
import type { ActionResult } from '#/lib/action-result'
import type {
  assetFormSchema,
  createAssetSchema,
  listAssetsInputSchema,
  selectAssetSchema,
  updateAssetSchema,
} from './assets.schemas'

export type Asset = z.infer<typeof selectAssetSchema>
export type CreateAssetInput = z.infer<typeof createAssetSchema>
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>
export type ListAssetsInput = z.infer<typeof listAssetsInputSchema>

export type ListAssetsResult = {
  rows: Asset[]
  total: number
}

export type AssetResult = ActionResult<Asset>

export type AssetOption = { id: number; name: string }

export type AssetFormValues = z.input<typeof assetFormSchema>
