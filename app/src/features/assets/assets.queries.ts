import { queryOptions } from '@tanstack/react-query'
import { sfGetAsset, sfListAssetOptions } from './assets.function'

export const assetQueries = {
  detail: (id: number) =>
    queryOptions({
      queryKey: ['assets', 'detail', id] as const,
      queryFn: () => sfGetAsset({ data: id }),
    }),
  options: () =>
    queryOptions({
      queryKey: ['assets', 'options'] as const,
      queryFn: () => sfListAssetOptions(),
      staleTime: 5 * 60_000,
    }),
}
