import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { count, eq, useLiveQuery } from '@tanstack/react-db'
import {
  AssetStatusBoard,
  BoardHeader,
  emptyStatusCounts,
} from '#/features/assets/asset-status-board'
import { getAssetsCollection } from '#/features/assets/assets.collection'
import type { AssetStatus } from '#/features/assets/assets.types'
import { isAdmin } from '#/lib/route-guards'

// TanStack DB version of the status board. Collections are client-only (no
// SSR support), so this route renders in the browser only. _authed's
// beforeLoad still runs, and sfListAssetBoard re-checks the role regardless.
export const Route = createFileRoute('/_authed/assets/live')({
  ssr: false,
  loader: async ({ context }) => {
    await getAssetsCollection(context.queryClient).preload()
  },
  component: AssetBoardLive,
})

function AssetBoardLive() {
  const { user, queryClient } = Route.useRouteContext()
  const collection = getAssetsCollection(queryClient)
  const [statusFilter, setStatusFilter] = useState<AssetStatus>()
  const [updateError, setUpdateError] = useState<string>()

  // Filter and sort run in the live query (incrementally maintained), not as
  // JS over the result array. Same documented exception to ground rules #2/#4
  // as the Query version: the board is capped at 1000 rows.
  const { data: rows } = useLiveQuery({
    query: (q) => {
      const base = q.from({ asset: collection })
      const filtered = statusFilter
        ? base.where(({ asset }) => eq(asset.status, statusFilter))
        : base
      return filtered.orderBy(({ asset }) => asset.name)
    },
  })

  const { data: countRows } = useLiveQuery({
    query: (q) =>
      q
        .from({ asset: collection })
        .groupBy(({ asset }) => asset.status)
        .select(({ asset }) => ({
          status: asset.status,
          n: count(asset.id),
        })),
  })

  const counts = emptyStatusCounts()
  for (const row of countRows) counts[row.status] = row.n

  // $hasPendingWrites is set by TanStack DB while an optimistic write on the
  // row is still persisting, so no mutation state needs tracking here.
  const pendingIds = new Set(
    rows.filter((row) => row.$hasPendingWrites).map((row) => row.id),
  )

  const handleSetStatus = (id: number, status: AssetStatus) => {
    setUpdateError(undefined)
    const tx = collection.update(id, (draft) => {
      draft.status = status
    })
    // onUpdate threw (403 or a returned failure): the row is already rolled
    // back, so only the message needs showing.
    tx.isPersisted.promise.catch((error: unknown) => {
      setUpdateError(error instanceof Error ? error.message : 'Update failed')
    })
  }

  return (
    <div className="p-8">
      <BoardHeader
        title="Live asset board"
        note="TanStack DB: query collection + live queries, polling every 5 s"
        other={{ to: '/assets', label: '← Query board' }}
      />
      {updateError ? (
        <p role="alert" className="mt-2 text-red-700">
          {updateError}
        </p>
      ) : null}
      {collection.utils.isError ? (
        <p role="alert" className="mt-2 text-red-700">
          Couldn't refresh the board; showing the last loaded data.
        </p>
      ) : null}
      <div className="mt-4">
        <AssetStatusBoard
          rows={rows}
          counts={counts}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          canEdit={isAdmin(user)}
          onSetStatus={handleSetStatus}
          pendingIds={pendingIds}
        />
      </div>
    </div>
  )
}
