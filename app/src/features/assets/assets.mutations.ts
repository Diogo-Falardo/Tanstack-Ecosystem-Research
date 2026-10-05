import { mutationOptions } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { sfCreateAsset, sfUpdateAsset } from './assets.function'
import type { CreateAssetInput, UpdateAssetInput } from './assets.types'

// Asset names show up in the dashboard's top-assets panel.
function invalidateAssetViews(client: QueryClient) {
  return Promise.all([
    client.invalidateQueries({ queryKey: ['assets'] }),
    client.invalidateQueries({ queryKey: ['dashboard'] }),
  ])
}

// No optimism for assets: save, then refetch.
export const assetMutations = {
  create: () =>
    mutationOptions({
      mutationKey: ['assets', 'create'],
      mutationFn: (data: CreateAssetInput) => sfCreateAsset({ data }),
      onSettled: (_data, _error, _variables, _result, { client }) =>
        invalidateAssetViews(client),
    }),

  update: () =>
    mutationOptions({
      mutationKey: ['assets', 'update'],
      mutationFn: (data: UpdateAssetInput) => sfUpdateAsset({ data }),
      onSettled: (_data, _error, _variables, _result, { client }) =>
        invalidateAssetViews(client),
    }),
}
