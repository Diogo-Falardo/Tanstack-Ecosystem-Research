import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import type { QueryClient } from '@tanstack/react-query'
import { sfListAssetBoard, sfUpdateAsset } from './assets.function'

// TanStack DB version of the status board. It's an eager collection: every
// asset is downloaded once and filtered/counted by live queries on the client.
// That only works because Assets.board() is capped at 1000 rows; the 80k
// maintenance records must never be loaded this way.
//
// Still polling: a query collection gets no server push, so other tabs'
// changes arrive on refetchInterval, the same as the Query version.
function createAssetsCollection(queryClient: QueryClient) {
  return createCollection(
    queryCollectionOptions({
      id: 'assets-board',
      // Not ['assets', 'board']: the Query version owns that entry, and sharing
      // it would skew the comparison. The 'assets' prefix keeps the asset
      // form's invalidateQueries({ queryKey: ['assets'] }) reaching this one.
      queryKey: ['assets', 'board', 'collection'],
      queryFn: () => sfListAssetBoard(),
      queryClient,
      getKey: (row) => row.id,
      refetchInterval: 5_000,
      // Throwing rolls the optimistic change back. Returning nothing keeps
      // the automatic refetch, so the server's row replaces the guess.
      onUpdate: async ({ transaction }) => {
        const results = await Promise.all(
          transaction.mutations.map((mutation) =>
            sfUpdateAsset({
              data: { ...mutation.changes, id: mutation.modified.id },
            }),
          ),
        )
        for (const result of results) {
          if (!result.ok) throw new Error(result.formError ?? 'Update failed')
        }
      },
    }),
  )
}

export type AssetsCollection = ReturnType<typeof createAssetsCollection>

// One collection per QueryClient (one per tab on the client), never per render.
const collections = new WeakMap<QueryClient, AssetsCollection>()

export function getAssetsCollection(queryClient: QueryClient) {
  let collection = collections.get(queryClient)
  if (!collection) {
    collection = createAssetsCollection(queryClient)
    collections.set(queryClient, collection)
  }
  return collection
}

// queryClient.clear() drops the Query cache entry but not the collection's own
// store, so a user switch must clean it up too. The next
// getAssetsCollection() call builds a fresh one.
export async function cleanupAssetsCollection(queryClient: QueryClient) {
  const collection = collections.get(queryClient)
  if (!collection) return
  collections.delete(queryClient)
  await collection.cleanup()
}
