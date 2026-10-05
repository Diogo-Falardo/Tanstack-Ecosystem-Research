import { useEffect, useRef, useState, useTransition } from 'react'
import { useMutationState, useSuspenseQuery } from '@tanstack/react-query'
import {
  Link,
  Outlet,
  createFileRoute,
  stripSearchParams,
  useChildMatches,
} from '@tanstack/react-router'
import { useDebouncer } from '@tanstack/react-pacer'
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
import { assetQueries } from '#/features/assets/assets.queries'
import { formatCost } from '#/lib/format'
import { canEditRecords } from '#/lib/route-guards'
import { maintenanceRecordQueries } from '#/features/maintenance-records/maintenance-records.queries'
import { listMaintenanceRecordsInputSchema } from '#/features/maintenance-records/maintenance-records.schemas'
import type {
  CreateMaintenanceRecordInput,
  ListMaintenanceRecordsInput,
  MaintenanceRecordRow,
} from '#/features/maintenance-records/maintenance-records.types'

// Parsed from {} so the stripped values are exactly the schema's defaults
// (page, pageSize, sortDir — every other field is optional).
const SEARCH_DEFAULTS = listMaintenanceRecordsInputSchema.parse({})

// Layout route: the list stays mounted while child routes (new / edit) render
// in a drawer beside it, so optimistic patches and ghost rows stay visible.
export const Route = createFileRoute('/_authed/maintenance-records')({
  validateSearch: listMaintenanceRecordsInputSchema,
  // Default values stay out of the URL; validateSearch fills them back in.
  search: {
    middlewares: [stripSearchParams(SEARCH_DEFAULTS)],
  },
  loaderDeps: ({ search }) => ({ filters: search }),
  // Finite, not 'static': query-core's isStaleByTime returns false for
  // 'static' before it checks isInvalidated, so invalidateQueries after a
  // save would never make this loader refetch.
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.query({
        ...maintenanceRecordQueries.list(deps.filters),
        staleTime: 30_000,
      }),
      // Feeds the asset filter, so it doesn't suspend on first render.
      context.queryClient.ensureQueryData(assetQueries.options()),
    ])
  },
  component: MaintenanceRecordsList,
})

const STATUS_OPTIONS = [
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
] as const

// No sortedRowModel registered — the server sorts (manualSorting below), so
// this table never re-sorts the page it's given, only reports/relays intent.
// columnSizingFeature adds column.getSize()/header.getSize() — required once
// rows are absolutely positioned via CSS grid/flex for virtualization (the
// browser's table auto-layout no longer applies), not for interactive
// resizing (no onColumnSizingChange wired).
const features = tableFeatures({ rowSortingFeature, columnSizingFeature })

const columnHelper = createColumnHelper<typeof features, MaintenanceRecordRow>()

// Viewers get neither cost (the server sends null for it) nor the edit link.
// Both arrays are module constants, so switching on role keeps them stable.
const viewerColumns = columnHelper.columns([
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
])

const staffColumns = columnHelper.columns([
  ...viewerColumns,
  columnHelper.accessor('costCents', {
    header: 'Cost',
    enableSorting: false,
    size: 110,
    cell: (info) => {
      const costCents = info.getValue()
      return costCents === null ? '—' : formatCost(costCents)
    },
  }),
  columnHelper.display({
    id: 'edit',
    header: '',
    size: 70,
    cell: ({ row }) => (
      <Link
        from="/maintenance-records"
        to="/maintenance-records/$id/edit"
        params={{ id: row.original.id }}
        search={(prev) => prev}
        className="underline"
      >
        Edit
      </Link>
    ),
  }),
])

type GhostRow = CreateMaintenanceRecordInput & { submittedAt: number }

// Pending creates, shown at reduced opacity until the refetch places the real
// row. Same column widths as the table; not part of the virtualized list.
function ghostCell(columnId: string, ghost: GhostRow) {
  switch (columnId) {
    case 'id':
      return '…'
    case 'assetId':
      return ghost.assetId
    case 'description':
      return ghost.description
    case 'technician':
      return ghost.technician
    case 'status':
      return ghost.status
    case 'performedAt':
      return new Date(ghost.performedAt).toLocaleDateString()
    case 'costCents':
      return formatCost(ghost.costCents)
    default:
      return null
  }
}

// Pre-measurement guess only — measureElement (in MaintenanceRecordsTableBody)
// replaces it with each row's real rendered height once mounted.
const ROW_HEIGHT_ESTIMATE = 40

const SEARCH_DEBOUNCE_MS = 300

function MaintenanceRecordsList() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { user } = Route.useRouteContext()
  const canEdit = canEditRecords(user)
  const [isPending, startTransition] = useTransition()
  const tableContainerRef = useRef<HTMLDivElement>(null)

  const { data } = useSuspenseQuery(maintenanceRecordQueries.list(search))
  const { data: assetOptions } = useSuspenseQuery(assetQueries.options())

  const ghostRows = useMutationState({
    filters: {
      mutationKey: ['maintenance-records', 'create'],
      status: 'pending',
    },
    select: (mutation): GhostRow => ({
      ...(mutation.state.variables as CreateMaintenanceRecordInput),
      submittedAt: mutation.state.submittedAt,
    }),
  })

  // Only open the drawer for a real child (new / edit), not the empty index.
  const isDrawerOpen = useChildMatches({
    select: (matches) =>
      matches.some(
        (match) => match.routeId !== '/_authed/maintenance-records/',
      ),
  })

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
    columns: canEdit ? staffColumns : viewerColumns,
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

  const handleAssetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    startTransition(() => {
      tableContainerRef.current?.scrollTo(0, 0)
      navigate({
        search: (prev) => ({
          ...prev,
          assetId: value ? Number(value) : undefined,
          page: 0,
        }),
      })
    })
  }

  // The input holds every keystroke; only the debounced call writes `q` to
  // the URL, so a typed word is one navigation and one server request.
  const [searchText, setSearchText] = useState(search.q ?? '')

  const applySearch = (value: string) =>
    startTransition(() => {
      tableContainerRef.current?.scrollTo(0, 0)
      navigate({
        search: (prev) => ({
          ...prev,
          q: value.trim() || undefined,
          page: 0,
        }),
      })
    })

  const searchDebouncer = useDebouncer(applySearch, {
    wait: SEARCH_DEBOUNCE_MS,
  })

  // Back/forward or a link can change `q` without typing — follow the URL.
  useEffect(() => {
    setSearchText(search.q ?? '')
  }, [search.q])

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(event.target.value)
    searchDebouncer.maybeExecute(event.target.value)
  }

  const clearSearch = () => {
    searchDebouncer.cancel()
    setSearchText('')
    applySearch('')
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
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold">Maintenance Records</h1>
        {canEdit && (
          <Link
            from="/maintenance-records"
            to="/maintenance-records/new"
            search={(prev) => prev}
            className="border px-4 py-2 font-medium"
          >
            New record
          </Link>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-6">
        <div>
          <label htmlFor="search-filter" className="mr-2">
            Search
          </label>
          <input
            id="search-filter"
            type="search"
            value={searchText}
            onChange={handleSearchChange}
            placeholder="Description or technician"
            maxLength={100}
            className="border px-2 py-1"
          />
          {searchText ? (
            <button type="button" onClick={clearSearch} className="ml-2">
              Clear
            </button>
          ) : null}
        </div>

        <div>
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

        <div>
          <label htmlFor="asset-filter" className="mr-2">
            Asset
          </label>
          <select
            id="asset-filter"
            value={search.assetId ?? ''}
            onChange={handleAssetChange}
          >
            <option value="">All</option>
            {assetOptions.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {`${asset.name} (#${asset.id})`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6 flex gap-6">
        <div
          ref={tableContainerRef}
          className="min-w-0 flex-1"
          style={{ height: 600, overflow: 'auto', position: 'relative' }}
        >
          <table
            style={{ display: 'grid', width: '100%' }}
            className="text-left"
          >
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
            {ghostRows.length > 0 ? (
              <tbody style={{ display: 'grid', width: '100%' }}>
                {ghostRows.map((ghost) => (
                  <tr
                    key={`ghost-${ghost.submittedAt}`}
                    className="border-t"
                    style={{ display: 'flex', width: '100%', opacity: 0.5 }}
                    aria-label="Saving new record"
                  >
                    {table.getAllLeafColumns().map((column) => (
                      <td
                        key={column.id}
                        className="p-2"
                        style={{ width: column.getSize() }}
                      >
                        {ghostCell(column.id, ghost)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ) : null}
            {data.rows.length > 0 ? (
              <MaintenanceRecordsTableBody
                table={table}
                tableContainerRef={tableContainerRef}
                isPending={isPending}
              />
            ) : null}
          </table>
          {data.rows.length === 0 && ghostRows.length === 0 ? (
            <p className="p-4" style={{ opacity: isPending ? 0.5 : 1 }}>
              No records match these filters
            </p>
          ) : null}
        </div>

        {isDrawerOpen ? (
          <aside
            className="w-md shrink-0 overflow-auto border-l pl-6"
            style={{ height: 600 }}
          >
            <Outlet />
          </aside>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          disabled={isFirstPage || isPending}
          onClick={() => goToPage(search.page - 1)}
        >
          Prev
        </button>
        <span>
          Page {search.page + 1} · {data.total.toLocaleString('en-US')} records
        </span>
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
  table: ReactTable<typeof features, MaintenanceRecordRow>
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
