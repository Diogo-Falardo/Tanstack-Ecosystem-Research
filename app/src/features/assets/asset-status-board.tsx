import { Link } from '@tanstack/react-router'
import type { AssetBoardRow, AssetStatus } from './assets.types'

export const ASSET_STATUSES: AssetStatus[] = [
  'operational',
  'in_repair',
  'broken',
  'retired',
]

export function emptyStatusCounts(): Record<AssetStatus, number> {
  return { operational: 0, in_repair: 0, broken: 0, retired: 0 }
}

// Presentational only: /assets (Query) and /assets/live (TanStack DB) both
// render this, so the comparison is only about the data layer behind it.
export function AssetStatusBoard({
  rows,
  counts,
  statusFilter,
  onStatusFilterChange,
  canEdit,
  onSetStatus,
  pendingIds,
}: {
  rows: AssetBoardRow[]
  counts: Record<AssetStatus, number>
  statusFilter: AssetStatus | undefined
  onStatusFilterChange: (status: AssetStatus | undefined) => void
  canEdit: boolean
  onSetStatus: (id: number, status: AssetStatus) => void
  pendingIds?: Set<number>
}) {
  const total = ASSET_STATUSES.reduce((sum, status) => sum + counts[status], 0)

  return (
    <div>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Filter by status"
      >
        <StatusChip
          label="All"
          count={total}
          active={statusFilter === undefined}
          onClick={() => onStatusFilterChange(undefined)}
        />
        {ASSET_STATUSES.map((status) => (
          <StatusChip
            key={status}
            label={status}
            count={counts[status]}
            active={statusFilter === status}
            onClick={() => onStatusFilterChange(status)}
          />
        ))}
      </div>

      <div className="mt-4 overflow-auto" style={{ height: 600 }}>
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-white">
            <tr>
              <th className="p-2">Name</th>
              <th className="p-2">Category</th>
              <th className="p-2">Location</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isPending = pendingIds?.has(row.id) ?? false
              return (
                <tr
                  key={row.id}
                  className="border-t"
                  style={{ opacity: isPending ? 0.5 : 1 }}
                  aria-busy={isPending}
                >
                  <td className="p-2">{row.name}</td>
                  <td className="p-2">{row.category}</td>
                  <td className="p-2">{row.location}</td>
                  <td className="p-2">
                    {canEdit ? (
                      <select
                        aria-label={`Status of ${row.name}`}
                        value={row.status}
                        onChange={(event) =>
                          onSetStatus(row.id, event.target.value as AssetStatus)
                        }
                      >
                        {ASSET_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    ) : (
                      row.status
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="p-4">No assets with this status</p>
        ) : null}
      </div>
    </div>
  )
}

function StatusChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm ${active ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300'}`}
    >
      {label} · {count.toLocaleString('en-US')}
    </button>
  )
}

// Title + a link to the other version, so the two boards are one click apart.
export function BoardHeader({
  title,
  note,
  other,
}: {
  title: string
  note: string
  other: { to: '/assets' | '/assets/live'; label: string }
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-4">
      <div>
        <h1 className="text-4xl font-bold">{title}</h1>
        <p className="mt-1 text-neutral-600">{note}</p>
      </div>
      <Link to={other.to} className="underline">
        {other.label}
      </Link>
    </div>
  )
}
