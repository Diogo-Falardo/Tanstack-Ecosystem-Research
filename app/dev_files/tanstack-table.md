# Table UI — Maintenance Records (TanStack Table)

ROADMAP.md Phase 4. Wires `@tanstack/react-table` (v9) into the existing
maintenance-records list route: sortable columns and a status filter, both
driving a server request — no client-side re-sort/re-filter of the page
already returned. Builds on Phase 3's TanStack Query wiring; no new
mutations, no virtualization (Phase 5).

## Files to modify

- app/src/features/maintenance-records/maintenance-records.schemas.ts   # existing, modify — add sortBy/sortDir to listMaintenanceRecordsInputSchema
- app/src/features/maintenance-records/maintenance-records.server.ts    # existing, modify — ORDER BY in MaintenanceRecords.list()
- app/src/routes/maintenance-records/index.tsx                          # existing, modify — replace raw <table> with useTable/flexRender, add status filter

## Analyze these

- docs/tanstack-table.md
- docs/tanstack-query.md
- app/src/routes/maintenance-records/index.tsx
- app/src/features/maintenance-records/maintenance-records.server.ts
- app/src/features/maintenance-records/maintenance-records.schemas.ts
- app/src/db/schema.ts

`docs/tanstack-table.md` documents the exact shape to copy for this phase —
§4 (register the sorting feature without a client row model +
`manualSorting: true`), §5 (state driven by `Route.useSearch()`/`navigate`,
the same pattern `docs/tanstack-query.md` already uses for pagination), §6
(column defs + which columns are allowed to be sortable), §7 (`flexRender`
markup), and §8 (the `sortBy` allowlist requirement and why a bare string
column name is unsafe). Read it before writing code — this dev file only
restates the concrete work items, not the reasoning behind them.

## What we currently need

### Schema — `listMaintenanceRecordsInputSchema`
- Add `sortBy: z.enum(['status', 'performedAt', 'id']).optional()`. This
  allowlist matches the indexed/PK columns only (`idx_maintenance_performed_at`,
  `idx_maintenance_status`, PK `id`), per `docs/tanstack-table.md` §6 — do
  not add other columns.
- Add `sortDir: z.enum(['asc', 'desc']).default('asc')`.

### Server — `MaintenanceRecords.list()`
- Map `filters.sortBy` to an actual Drizzle column via a lookup object (not
  a raw string or `sql.raw`), defaulting to `performedAt` when `sortBy` is
  unset.
- Apply `.orderBy(filters.sortDir === 'desc' ? desc(sortColumn) : asc(sortColumn))`
  on the rows query only — the existing `count()` query needs no `orderBy`.

### Route — `maintenance-records/index.tsx`
- Define a `tableFeatures()` config outside the component with
  `rowSortingFeature` only (no `sortedRowModel` factory registered).
  Filtering stays a plain `<select>`, not `columnFilteringFeature` — per
  `docs/tanstack-table.md` §5.
- `useTable({ features, columns, data: data.rows, manualSorting: true, getRowId: (row) => String(row.id) })`.
- Column defs via `createColumnHelper<typeof features, MaintenanceRecord>()`:
  `id`, `assetId`, `description`, `technician`, `costCents` non-sortable
  (`enableSorting: false`); `status` and `performedAt` sortable (leave
  `sortFn` unset — see `docs/tanstack-table.md` §6 for why it doesn't apply
  under `manualSorting`).
- Compute `sorting: SortingState` from `search.sortBy`/`search.sortDir`.
  `onSortingChange` translates the updater into
  `navigate({ search: (prev) => ({ ...prev, sortBy, sortDir, page: 0 }) })`,
  wrapped in the existing `startTransition` (same pattern the current
  `goToPage` already uses).
- Replace the hand-written `<thead>`/`<tbody>` with `table.getHeaderGroups()`
  / `table.getRowModel().rows` + `flexRender`, per §7 of the research doc.
  Sortable headers are clickable
  (`header.column.getToggleSortingHandler()`, disabled when
  `!header.column.getCanSort()`) and show an asc/desc indicator from
  `header.column.getIsSorted()`.
- Add a status filter: a `<select>` listing the four `maintenance_records`
  status values (`scheduled`, `in_progress`, `completed`, `cancelled`) plus
  an "All" option, bound directly to `search.status` →
  `navigate({ search: (prev) => ({ ...prev, status: value || undefined, page: 0 }) })`.
  No TanStack Table state involved for this control.
- Keep the existing Prev/Next pagination exactly as it is today — do not
  move it onto `rowPaginationFeature`.

## Out of scope

- `assetId` filter UI (schema/server already support the param; no UI item
  was requested for this phase).
- Any column becoming sortable beyond `status`/`performedAt` — the rest
  aren't index-backed (`docs/tanstack-table.md` §6).
- Row selection / multi-select (Phase 11) — `getRowId` above is prep for it,
  not the feature itself.
