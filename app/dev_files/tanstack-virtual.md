# Long Lists — Maintenance Records (TanStack Virtual)

ROADMAP.md Phase 5. Wires `@tanstack/react-virtual` into the existing
maintenance-records table body from Phase 4: raise the server-side `pageSize`
cap so a filtered view can return thousands of rows in one response, then
virtualize rendering of that response so the table only ever mounts the rows
currently in view. Builds on Phase 4's Table wiring; no new fetching model —
the server still slices and authorizes every row (ground rule #2), Virtual
only changes how many of the already-fetched rows get a DOM node. Infinite
scroll / `useInfiniteQuery` is explicitly out of scope for this phase (see
`docs/tanstack-virtual.md` §9, Option B) — Prev/Next stays.

## Files to modify

- app/src/features/maintenance-records/maintenance-records.schemas.ts   # existing, modify — raise pageSize cap/default in listMaintenanceRecordsInputSchema
- app/src/routes/maintenance-records/index.tsx                          # existing, modify — virtualize the table body, CSS grid/flex row layout, sticky header
- app/package.json                                                      # existing, modify — add `@tanstack/react-virtual` dependency (`bun add @tanstack/react-virtual`)

## Analyze these

- docs/tanstack-virtual.md
- docs/tanstack-table.md
- app/src/routes/maintenance-records/index.tsx
- app/src/features/maintenance-records/maintenance-records.schemas.ts
- app/src/features/maintenance-records/maintenance-records.server.ts
- app/src/db/schema.ts

`docs/tanstack-virtual.md` documents the exact shape to copy for this phase —
§3 (required `useVirtualizer` options), §4 (why this table needs dynamic
sizing via `measureElement`, not fixed row heights — `description` is
unbounded `text()` in `app/src/db/schema.ts`), §7 (the concrete Table+Virtual
combined pattern: CSS grid/flex row layout, `data-index` +
`ref={rowVirtualizer.measureElement}`, sticky header, and — important — use
the existing standalone `flexRender` import, not `table.FlexRender`, which
doesn't exist in the installed `9.2.4`), §8 (the `overscan`-default and
`getItemKey`-index pitfalls, and resetting scroll position when sort/filter/
page changes swap the underlying row array), and §9 (why this phase raises
`pageSize` rather than switching to infinite scroll). Read it before writing
code — this dev file only restates the concrete work items, not the
reasoning behind them. (Note: `docs/tanstack-virtual.md` §7 was corrected
after an initial pass mis-checked an unpkg path — both `table.FlexRender`
and the standalone `flexRender` import exist in the installed `9.2.4`; this
implementation keeps the existing standalone `flexRender` for consistency
with the current code, not because the other form is unavailable.) `MaintenanceRecords.list()` in `maintenance-records.server.ts`
already applies `filters.pageSize` generically to `.limit()`/`.offset()` — no
server-function or server-class change is needed, only the Zod cap.

## What we currently need

### Dependency

- `bun add @tanstack/react-virtual` (pins `3.14.13`, per `docs/tanstack-virtual.md`).

### Schema — `listMaintenanceRecordsInputSchema`

- Raise `pageSize`'s `.max(100)` to a real "one filtered view" upper bound and
  raise the default well above 25 so virtualization actually has thousands of
  rows to window over. **ASSUMPTION:** the repo doesn't settle a number —
  use `.max(2000).default(500)`. Adjust if a different ceiling is wanted, but
  keep a real `.max()`; per `docs/tanstack-virtual.md` §8, virtualizing does
  not relax ground rule #2 — it's still a hard upper bound on one response,
  not "fetch all."
- Everything else on the schema (status/assetId/sortBy/sortDir) is untouched.

### Route — `maintenance-records/index.tsx`

- Add explicit `size` to every column def in the existing `columns` array
  (`columnHelper.accessor(..., { size: <n> })`) — required once rows are
  absolutely positioned via CSS grid/flex (`docs/tanstack-virtual.md` §7);
  the browser's table auto-layout no longer applies.
- Split the row-rendering portion of `MaintenanceRecordsList` into its own
  component (e.g. `MaintenanceRecordsTableBody`) that receives `table` and a
  `tableContainerRef`, and owns `useVirtualizer` itself — per
  `docs/tanstack-virtual.md` §7's "keep the virtualizer in the lowest
  component possible" so router/sorting state changes above it don't get
  coupled to per-scroll-frame updates.
- Wrap the `<table>` in a container `<div>` with a fixed height, `overflow:
  auto`, and `position: relative`, holding a `ref` (`tableContainerRef`)
  passed down to the new `MaintenanceRecordsTableBody`.
- Change `<table>` to `style={{ display: 'grid' }}`, header/body `<tr>` to
  `style={{ display: 'flex' }}`, and give `<thead>`
  `style={{ position: 'sticky', top: 0 }}` — per `docs/tanstack-virtual.md`
  §7.
- In `MaintenanceRecordsTableBody`, configure `useVirtualizer<HTMLDivElement, HTMLTableRowElement>`:
  - `count: rows.length` (from `table.getRowModel().rows`, same array Phase 4
    already established as the server-sliced page — `docs/tanstack-table.md` §7)
  - `getScrollElement: () => tableContainerRef.current`
  - `estimateSize: () => 40` (or whatever the current unvirtualized row's
    typical rendered height is — approximate is fine, it's only the
    pre-measurement guess)
  - `measureElement: (el) => el.getBoundingClientRect().height` — dynamic
    sizing, per `docs/tanstack-virtual.md` §4
  - `overscan: 5` — do not leave this at the library default of `1`
    (`docs/tanstack-virtual.md` §8)
  - `getItemKey: (index) => rows[index]?.id ?? index` — key by the row's real
    id, not the default array index, so measured heights don't get
    misattributed across a sort (`docs/tanstack-virtual.md` §8; mirrors the
    existing `getRowId: (row) => String(row.id)` already on the table)
- Render only `rowVirtualizer.getVirtualItems()`. Spacer `<tbody
  style={{ display: 'grid', height: rowVirtualizer.getTotalSize(), position: 'relative' }}>`;
  each row `<tr data-index={virtualRow.index} ref={rowVirtualizer.measureElement}
  style={{ display: 'flex', position: 'absolute', width: '100%', transform: \`translateY(${virtualRow.start}px)\` }}>`,
  cells unchanged (`row.getAllCells()` + the existing standalone `flexRender`
  import — not `table.FlexRender`, per `docs/tanstack-virtual.md` §7).
- In the existing `handleSortingChange`, `handleStatusChange`, and `goToPage`
  callbacks (all of which already reset `page: 0` on sort/filter change),
  also reset scroll position on the container (e.g.
  `tableContainerRef.current?.scrollTo(0, 0)`) — per
  `docs/tanstack-virtual.md` §8: a sort/filter/page change swaps in an
  entirely different `rows` array, and nothing resets scroll position for you
  when that happens.

## Out of scope

- Infinite scroll / `useInfiniteQuery` (`docs/tanstack-virtual.md` §9,
  Option B) — Prev/Next stays exactly as Phase 4 built it, just now paging
  through a much larger `pageSize`.
- `directDomUpdates` / `containerRef` / `useFlushSync` React-specific perf
  options (`docs/tanstack-virtual.md` §6) — only worth it once profiling
  shows scroll-driven re-renders are an actual bottleneck.
- Horizontal/column virtualization — this table has a fixed, small column
  count.
- Any change to `sortBy`'s allowlist or which columns are sortable — settled
  in Phase 4 (`docs/tanstack-table.md` §6).
- Row selection / multi-select (Phase 11).
