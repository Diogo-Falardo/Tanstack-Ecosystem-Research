import { useMemo, useState } from 'react'
import {
  useMutation,
  useMutationState,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  AssetStatusBoard,
  BoardHeader,
  emptyStatusCounts,
} from '#/features/assets/asset-status-board'
import { assetMutations } from '#/features/assets/assets.mutations'
import { assetQueries } from '#/features/assets/assets.queries'
import type { AssetStatus } from '#/features/assets/assets.types'
import { isAdmin } from '#/lib/route-guards'

// Query version of the status board: polls every 5 s, optimistic status
// changes patch the cached array (assetMutations.setStatus).
export const Route = createFileRoute('/_authed/assets/')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(assetQueries.board()),
  component: AssetBoardQuery,
})

function AssetBoardQuery() {
  const { user } = Route.useRouteContext()
  const [statusFilter, setStatusFilter] = useState<AssetStatus>()
  const { data } = useSuspenseQuery(assetQueries.board())
  const setStatus = useMutation(assetMutations.setStatus())

  // Client-side filter/count over the whole board: the documented exception
  // to ground rules #2/#4, only because Assets.board() is capped at 1000.
  const rows = useMemo(
    () =>
      statusFilter ? data.filter((row) => row.status === statusFilter) : data,
    [data, statusFilter],
  )
  const counts = useMemo(() => {
    const next = emptyStatusCounts()
    for (const row of data) next[row.status] += 1
    return next
  }, [data])

  const pendingIds = new Set(
    useMutationState({
      filters: { mutationKey: ['assets', 'set-status'], status: 'pending' },
      select: (mutation) => (mutation.state.variables as { id: number }).id,
    }),
  )

  return (
    <div className="p-8">
      <BoardHeader
        title="Asset status board"
        note="TanStack Query: polling every 5 s"
        other={{ to: '/assets/live', label: 'Live board (DB) →' }}
      />
      {setStatus.data && !setStatus.data.ok ? (
        <p role="alert" className="mt-2 text-red-700">
          {setStatus.data.formError ?? 'Update failed'}
        </p>
      ) : null}
      {setStatus.error ? (
        <p role="alert" className="mt-2 text-red-700">
          {setStatus.error.message}
        </p>
      ) : null}
      <div className="mt-4">
        <AssetStatusBoard
          rows={rows}
          counts={counts}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          canEdit={isAdmin(user)}
          onSetStatus={(id, status) => setStatus.mutate({ id, status })}
          pendingIds={pendingIds}
        />
      </div>
    </div>
  )
}
