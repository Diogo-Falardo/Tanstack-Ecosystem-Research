import { useEffect, useRef, useTransition } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  columnSizingFeature,
  createColumnHelper,
  flexRender,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import type {
  OnChangeFn,
  ReactTable,
  SortingState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
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
// columnSizingFeature adds column.getSize()/header.getSize() — required once
// rows are absolutely positioned via CSS grid/flex for virtualization (the
// browser's table auto-layout no longer applies), not for interactive
// resizing (no onColumnSizingChange wired).
const features = tableFeatures({ rowSortingFeature, columnSizingFeature })

const columnHelper = createColumnHelper<typeof features, MaintenanceRecord>()

const columns = columnHelper.columns([
  columnHelper.accessor('id', { header: 'ID', enableSorting: false, size: 60 }),
  columnHelper.accessor('assetId', {
    header: 'Asset',
    enableSorting: false,
    size: 90,
  }),
  columnHelper.accessor('description', {
    header: 'Description',
    enableSorting: false,
    size: 320,
  }),
  columnHelper.accessor('technician', {
    header: 'Technician',
    enableSorting: false,
    size: 160,
  }),
  columnHelper.accessor('status', { header: 'Status', size: 130 }),
  columnHelper.accessor('performedAt', {
    header: 'Performed at',
    size: 140,
    cell: (info) => new Date(info.getValue()).toLocaleDateString(),
  }),
  columnHelper.accessor('costCents', {
    header: 'Cost',
    enableSorting: false,
    size: 110,
    cell: (info) => formatCost(info.getValue()),
  }),
])

// Pre-measurement guess only — measureElement (in MaintenanceRecordsTableBody)
// replaces it with each row's real rendered height once mounted.
const ROW_HEIGHT_ESTIMATE = 40

function MaintenanceRecordsList() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [isPending, startTransition] = useTransition()
  const tableContainerRef = useRef<HTMLDivElement>(null)

  const { data } = useSuspenseQuery(maintenanceRecordQueries.list(search))

  const sorting: SortingState = search.sortBy
    ? [{ id: search.sortBy, desc: search.sortDir === 'desc' }]
    : []

  // Sort/filter/page changes swap in a different `rows` array — nothing
  // resets scroll position for a virtualized list automatically when that
  // happens, so each navigation resets the scroll container itself.
  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater
    const sort = next.at(0)
    startTransition(() => {
      tableContainerRef.current?.scrollTo(0, 0)
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
      tableContainerRef.current?.scrollTo(0, 0)
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
      tableContainerRef.current?.scrollTo(0, 0)
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

      <div
        ref={tableContainerRef}
        className="mt-6"
        style={{ height: 600, overflow: 'auto', position: 'relative' }}
      >
        <table style={{ display: 'grid', width: '100%' }} className="text-left">
          <thead
            className="bg-white"
            style={{ display: 'grid', position: 'sticky', top: 0, zIndex: 1 }}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                style={{ display: 'flex', width: '100%' }}
              >
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="p-2"
                    style={{ width: header.getSize() }}
                  >
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
          <MaintenanceRecordsTableBody
            table={table}
            tableContainerRef={tableContainerRef}
            isPending={isPending}
          />
        </table>
      </div>

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

// The virtualizer is kept in its own component, below the router-state/
// sorting wiring in MaintenanceRecordsList, so its per-scroll-frame updates
// don't re-render the header, filter, or Prev/Next controls above it.
function MaintenanceRecordsTableBody({
  table,
  tableContainerRef,
  isPending,
}: {
  table: ReactTable<typeof features, MaintenanceRecord>
  tableContainerRef: React.RefObject<HTMLDivElement | null>
  isPending: boolean
}) {
  const { rows } = table.getRowModel()

  const rowVirtualizer = useVirtualizer<HTMLDivElement, HTMLTableRowElement>({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    // description is unbounded free text — rows wrap to different heights,
    // so measure the real rendered height instead of trusting a fixed guess.
    measureElement: (element) => element.getBoundingClientRect().height,
    overscan: 5,
    // Key by the row's real id, not the default array index, so a measured
    // height can't get misattributed to a different row after a sort
    // reorders `rows` — mirrors the table's own getRowId above.
    getItemKey: (index) => rows[index]?.id ?? index,
  })

  // On first mount, tableContainerRef's DOM node isn't attached yet when
  // this virtualizer's own layout effect runs (it lives in an ancestor
  // component, and child layout effects fire before ancestor ones) — so
  // getScrollElement() sees null and never subscribes to scroll/resize
  // observers. This forces one extra render right after mount, by which
  // point the ref is attached and the virtualizer picks it up. Same fix
  // TanStack's own Table+Virtual example uses for this exact split.
  useEffect(() => {
    rowVirtualizer.measure()
  }, [])

  return (
    <tbody
      style={{
        display: 'grid',
        height: rowVirtualizer.getTotalSize(),
        position: 'relative',
        width: '100%',
        opacity: isPending ? 0.5 : 1,
      }}
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const row = rows[virtualRow.index]
        return (
          <tr
            key={row.id}
            data-index={virtualRow.index}
            ref={rowVirtualizer.measureElement}
            className="border-t"
            style={{
              display: 'flex',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {row.getAllCells().map((cell) => (
              <td
                key={cell.id}
                className="p-2"
                style={{ width: cell.column.getSize() }}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        )
      })}
    </tbody>
  )
}
