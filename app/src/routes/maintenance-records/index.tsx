import { useTransition } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  createColumnHelper,
  flexRender,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import type { OnChangeFn, SortingState } from '@tanstack/react-table'
import { maintenanceRecordQueries } from '#/features/maintenance-records/maintenance-records.queries'
import { listMaintenanceRecordsInputSchema } from '#/features/maintenance-records/maintenance-records.schemas'
import type {
  ListMaintenanceRecordsInput,
  MaintenanceRecord,
} from '#/features/maintenance-records/maintenance-records.types'

export const Route = createFileRoute('/maintenance-records/')({
  validateSearch: (search) => listMaintenanceRecordsInputSchema.parse(search),
  loaderDeps: ({ search }) => ({ filters: search }),
  loader: ({ context, deps }) =>
    context.queryClient.query({
      ...maintenanceRecordQueries.list(deps.filters),
      staleTime: 'static',
    }),
  component: MaintenanceRecordsList,
})

const STATUS_OPTIONS = [
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
] as const

function formatCost(costCents: number) {
  return (costCents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
}

// No sortedRowModel registered — the server sorts (manualSorting below), so
// this table never re-sorts the page it's given, only reports/relays intent.
const features = tableFeatures({ rowSortingFeature })

const columnHelper = createColumnHelper<typeof features, MaintenanceRecord>()

const columns = columnHelper.columns([
  columnHelper.accessor('id', { header: 'ID', enableSorting: false }),
  columnHelper.accessor('assetId', {
    header: 'Asset',
    enableSorting: false,
  }),
  columnHelper.accessor('description', {
    header: 'Description',
    enableSorting: false,
  }),
  columnHelper.accessor('technician', {
    header: 'Technician',
    enableSorting: false,
  }),
  columnHelper.accessor('status', { header: 'Status' }),
  columnHelper.accessor('performedAt', {
    header: 'Performed at',
    cell: (info) => new Date(info.getValue()).toLocaleDateString(),
  }),
  columnHelper.accessor('costCents', {
    header: 'Cost',
    enableSorting: false,
    cell: (info) => formatCost(info.getValue()),
  }),
])

function MaintenanceRecordsList() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [isPending, startTransition] = useTransition()

  const { data } = useSuspenseQuery(maintenanceRecordQueries.list(search))

  const sorting: SortingState = search.sortBy
    ? [{ id: search.sortBy, desc: search.sortDir === 'desc' }]
    : []

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater
    const sort = next.at(0)
    startTransition(() => {
      navigate({
        search: (prev) => ({
          ...prev,
          sortBy: sort?.id as ListMaintenanceRecordsInput['sortBy'],
          sortDir: sort?.desc ? 'desc' : 'asc',
          page: 0,
        }),
      })
    })
  }

  const table = useTable({
    features,
    columns,
    data: data.rows,
    manualSorting: true,
    getRowId: (row) => String(row.id),
    state: { sorting },
    onSortingChange: handleSortingChange,
  })

  const handleStatusChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    startTransition(() => {
      navigate({
        search: (prev) => ({
          ...prev,
          status: (value || undefined) as ListMaintenanceRecordsInput['status'],
          page: 0,
        }),
      })
    })
  }

  const goToPage = (page: number) =>
    startTransition(() => {
      navigate({ search: (prev) => ({ ...prev, page }) })
    })

  const isFirstPage = search.page === 0
  const isLastPage = data.rows.length < search.pageSize

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">Maintenance Records</h1>

      <div className="mt-4">
        <label htmlFor="status-filter" className="mr-2">
          Status
        </label>
        <select
          id="status-filter"
          value={search.status ?? ''}
          onChange={handleStatusChange}
        >
          <option value="">All</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <table className="mt-6 w-full text-left">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="p-2">
                  <button
                    type="button"
                    disabled={!header.column.getCanSort()}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                    {{ asc: ' ↑', desc: ' ↓' }[
                      header.column.getIsSorted() as string
                    ] ?? null}
                  </button>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody style={{ opacity: isPending ? 0.5 : 1 }}>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-t">
              {row.getAllCells().map((cell) => (
                <td key={cell.id} className="p-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          disabled={isFirstPage || isPending}
          onClick={() => goToPage(search.page - 1)}
        >
          Prev
        </button>
        <span>Page {search.page + 1}</span>
        <button
          type="button"
          disabled={isLastPage || isPending}
          onClick={() => goToPage(search.page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}
