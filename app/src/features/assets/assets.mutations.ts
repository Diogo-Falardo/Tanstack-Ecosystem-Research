import { mutationOptions } from '@tanstack/react-query'
import { sfCreateAsset, sfUpdateAsset } from './assets.function'
import type { CreateAssetInput, UpdateAssetInput } from './assets.types'

// No optimism for assets: save, then refetch.
export const assetMutations = {
  create: () =>
    mutationOptions({
      mutationKey: ['assets', 'create'],
      mutationFn: (data: CreateAssetInput) => sfCreateAsset({ data }),
      onSettled: (_data, _error, _variables, _result, { client }) =>
        client.invalidateQueries({ queryKey: ['assets'] }),
    }),

  update: () =>
    mutationOptions({
      mutationKey: ['assets', 'update'],
      mutationFn: (data: UpdateAssetInput) => sfUpdateAsset({ data }),
      onSettled: (_data, _error, _variables, _result, { client }) =>
        client.invalidateQueries({ queryKey: ['assets'] }),
    }),
}
