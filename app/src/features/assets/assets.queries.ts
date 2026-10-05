import { queryOptions } from '@tanstack/react-query'
import {
  sfGetAsset,
  sfListAssetBoard,
  sfListAssetOptions,
} from './assets.function'

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
  // Query version of the status board. Polling is the only way other tabs'
  // changes arrive; the TanStack DB version (assets.collection.ts) polls too.
  board: () =>
    queryOptions({
      queryKey: ['assets', 'board'] as const,
      queryFn: () => sfListAssetBoard(),
      refetchInterval: 5_000,
      staleTime: 0,
    }),
}
