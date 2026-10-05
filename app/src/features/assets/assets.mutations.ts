import { mutationOptions } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { sfCreateAsset, sfUpdateAsset } from './assets.function'
import type {
  AssetBoardRow,
  AssetStatus,
  CreateAssetInput,
  UpdateAssetInput,
} from './assets.types'

// Asset names show up in the dashboard's top-assets panel.
function invalidateAssetViews(client: QueryClient) {
  return Promise.all([
    client.invalidateQueries({ queryKey: ['assets'] }),
    client.invalidateQueries({ queryKey: ['dashboard'] }),
  ])
}

const boardKey = ['assets', 'board'] as const

function restoreBoard(client: QueryClient, snapshot: unknown) {
  client.setQueryData(boardKey, snapshot)
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

  // Status board (Query version). Optimistic, like the record update: patch
  // the cached board, roll back on a thrown or returned failure.
  setStatus: () =>
    mutationOptions({
      mutationKey: ['assets', 'set-status'],
      mutationFn: (vars: { id: number; status: AssetStatus }) =>
        sfUpdateAsset({ data: vars }),
      onMutate: async (vars, { client }) => {
        await client.cancelQueries({ queryKey: boardKey })
        const snapshot = client.getQueryData(boardKey)
        client.setQueryData<AssetBoardRow[]>(boardKey, (rows) =>
          rows?.map((row) =>
            row.id === vars.id ? { ...row, status: vars.status } : row,
          ),
        )
        return { snapshot }
      },
      onError: (_error, _vars, result, { client }) => {
        if (result) restoreBoard(client, result.snapshot)
      },
      // A returned failure doesn't trigger onError, so roll back here too.
      onSuccess: (data, _vars, result, { client }) => {
        if (!data.ok) restoreBoard(client, result.snapshot)
      },
      // Skip the refetch while other status changes are still in flight, so
      // one change's refetch doesn't overwrite another's optimistic patch.
      onSettled: (_data, _error, _vars, _result, { client }) => {
        if (
          client.isMutating({ mutationKey: ['assets', 'set-status'] }) === 1
        ) {
          return invalidateAssetViews(client)
        }
      },
    }),
}
