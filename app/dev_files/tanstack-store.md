# Cross-Page Selection + Bulk Status — Maintenance Records (TanStack Store)

ROADMAP.md Phase 11, part 2 of 2 (Ranger is `tanstack-ranger.md`). Staff can
select records with checkboxes. The selection survives page changes, sort
changes, and opening the drawer. Staff can then set one status on every
selected record in a single request. A TanStack Store holds the selection. The
server validates the id list, caps it, and re-checks the role (ground rule #3).

The research question is what Store adds over a `useState<Set>` here. Each row
checkbox reads its own slice with `useSelector`, so toggling one row should
re-render that one row, not the 500-row virtualized table.

## Files to modify

- app/package.json                                                        # existing, modify — `bun add @tanstack/react-store` (promote from transitive)
- app/src/features/maintenance-records/maintenance-records.selection.ts   # create — selection store factory + context
- app/src/features/maintenance-records/maintenance-records.schemas.ts     # existing, modify — add bulkSetMaintenanceRecordStatusSchema
- app/src/features/maintenance-records/maintenance-records.types.ts       # existing, modify — add BulkSetMaintenanceRecordStatusInput / Result
- app/src/features/maintenance-records/maintenance-records.server.ts      # existing, modify — add MaintenanceRecords.setStatusMany()
- app/src/features/maintenance-records/maintenance-records.function.ts    # existing, modify — add sfBulkSetMaintenanceRecordStatus
- app/src/features/maintenance-records/maintenance-records.mutations.ts   # existing, modify — add maintenanceRecordMutations.bulkSetStatus()
- app/src/routes/_authed/maintenance-records/route.tsx                    # existing, modify — checkbox column, selection toolbar
- ROADMAP.md                                                              # existing, modify — dated note under Phase 11

## Analyze these

- app/src/routes/_authed/maintenance-records/route.tsx — `staffColumns`, `getRowId`, `MaintenanceRecordsTableBody`, filter handlers
- app/src/features/maintenance-records/maintenance-records.server.ts — `update()` returns `ActionResult`
- app/src/features/maintenance-records/maintenance-records.function.ts — `sfUpdateMaintenanceRecord` (`technicianOrAdmin`)
- app/src/features/maintenance-records/maintenance-records.mutations.ts — `invalidateRecordViews`, `mutationKey` naming
- app/src/lib/action-result.ts — `ok` / `fail`
- app/src/features/assets/assets.collection.ts — Phase 10 note on client state that outlives a user switch
- node_modules/@tanstack/react-store/src/{useCreateStore,useSelector,createStoreContext}.ts and node_modules/@tanstack/store/src/store.ts — the installed 0.11 API

The backend follows the feature's four-file split. `setStatusMany` goes on the
`MaintenanceRecords` class and returns an `ActionResult`. The server function is
a thin `createServerFn` with a validator and `technicianOrAdmin`. The mutation
factory goes in `*.mutations.ts` and reuses `invalidateRecordViews`. The
selection store is the new piece. It lives in the feature folder next to the
queries and mutations.

## Research findings (installed: `@tanstack/store` / `@tanstack/react-store` 0.11.1; npm latest 0.11.2)

- **It's already installed.** Router, Form, Table, and Pacer all depend on
  `@tanstack/react-store`. Add it to `package.json` anyway, because app code
  shouldn't import a transitive dependency.
- **0.11 API:** `createStore(initial, ({ setState, get }) => actions)` returns a
  `Store` with `.state`, `.setState(updater)`, `.subscribe`, and `.actions`.
  `useCreateStore(initial, actionsFactory)` creates one store per component
  mount. `useSelector(store, selector, { compare? })` is the read hook
  (`useStore` is deprecated). `createStoreContext<T>()` returns
  `{ StoreProvider, useStoreContext }`.
- **Keep it out of module scope.** Module state on the server is shared by
  every SSR request. A module-level store would also outlive logout and leak
  one user's selection to the next user in the tab. That's the same trap as
  the Phase 10 collection. Create it with `useCreateStore` in
  `MaintenanceRecordsList`. That component stays mounted across page, sort,
  and drawer changes (it's the layout route), and it unmounts on logout.
- **`setState` needs a new value.** Updates are compared by reference, so make
  a new `Set` each time. Never mutate the current one.

## What we currently need

### Dependency

- `bun add @tanstack/react-store`. Import `useCreateStore`, `useSelector`,
  and `createStoreContext` from it.

### Selection store — `maintenance-records.selection.ts`

- `type SelectionState = { ids: ReadonlySet<number> }`.
- `selectionActions` factory for `useCreateStore({ ids: new Set() }, selectionActions)`:
  - `toggle(id: number)`
  - `setMany(ids: number[], selected: boolean)` — used by the header checkbox
    for the current page
  - `clear()`
  Each action replaces `ids` with a new `Set`.
- `export const MAX_BULK_SELECTION = 1000`. Toggling or `setMany` past the cap
  is a no-op. The toolbar shows why.
- `export const { StoreProvider: SelectionProvider, useStoreContext: useSelection } = createStoreContext<{ selection: <store type> }>()`.
  Columns are module constants, so cells reach the store through context.

### Schema + types

- `bulkSetMaintenanceRecordStatusSchema = z.object({ ids: z.array(selectMaintenanceRecordSchema.shape.id).min(1).max(1000), status: selectMaintenanceRecordSchema.shape.status })`.
  Use the same `1000` as `MAX_BULK_SELECTION`. Keep one constant if you can
  import it without pulling client code into the schema.
- Types: `BulkSetMaintenanceRecordStatusInput` (`z.infer`) and
  `BulkSetMaintenanceRecordStatusResult = ActionResult<{ updated: number }>`.

### Server — `MaintenanceRecords.setStatusMany(ids, status)`

- Dedupe `ids`, then run one
  `db.update(maintenanceRecords).set({ status }).where(inArray(maintenanceRecords.id, ids)).returning({ id: maintenanceRecords.id })`.
  That's one statement and one round trip, not N `update()` calls.
- If 0 rows were updated, return `fail({ formError: 'None of the selected records exist anymore' })`.
  Otherwise return `ok({ updated: rows.length })`. Fewer than requested is
  still `ok`. The UI shows the count.

### Function — `sfBulkSetMaintenanceRecordStatus`

- `createServerFn({ method: 'POST' }).middleware([technicianOrAdmin]).validator(bulkSetMaintenanceRecordStatusSchema)`.
  The handler calls `MaintenanceRecords.setStatusMany(data.ids, data.status)`.
  These are the same roles as single-record edit.

### Mutation — `maintenanceRecordMutations.bulkSetStatus()`

- `mutationKey: ['maintenance-records', 'bulk-set-status']`, and `mutationFn`
  calls the server function.
- Not optimistic. ASSUMPTION: most selected rows are on pages that aren't in
  the cache, so a cache patch would cover only some of them. The toolbar shows
  a pending state instead.
- `onSettled` → `invalidateRecordViews(client)`. Return it, so the mutation
  stays pending through the refetch, like `create`.

### Route — `maintenance-records/route.tsx`

- `const selection = useCreateStore({ ids: new Set<number>() }, selectionActions)`
  in `MaintenanceRecordsList`. Wrap the table and toolbar in
  `<SelectionProvider value={{ selection }}>`.
- **Checkbox column**, staff only (viewers can't edit, so `viewerColumns`
  stays unchanged). Put it first in `staffColumns`:
  `columnHelper.display({ id: 'select', size: 40, header: SelectPageHeader, cell: SelectRowCell })`.
  - `SelectRowCell`: `useSelection()`, then
    `useSelector(selection, (s) => s.ids.has(row.original.id))`, and an
    `onChange` that calls `toggle`. Give it an `aria-label`
    (`` `Select record ${id}` ``).
  - `SelectPageHeader`: reads the current page's ids from
    `table.getRowModel().rows`. It's checked when every id on the page is
    selected and indeterminate when only some are. Set `indeterminate` on the
    element with a ref. `onChange` calls `setMany(pageIds, !allSelected)`.
  - Don't register Table's `rowSelectionFeature`. Selection state lives only in
    the Store. Table would keep its own copy, which re-renders the whole table.
  - `ghostCell` already returns `null` for an unknown column id, so ghost rows
    get an empty cell. No change there.
- **Toolbar**, shown when the selection isn't empty. Place it between the
  filter row and the table:
  - "N selected" (`useSelector(selection, (s) => s.ids.size)`), plus a cap
    message when N reaches `MAX_BULK_SELECTION`.
  - Status `<select>` (from `STATUS_OPTIONS`), an **Apply** button that calls
    `bulkSetStatus.mutate({ ids: [...ids], status })` (disabled while pending),
    and a **Clear selection** button.
  - On `ok`, clear the selection and show "Updated N records". On `!ok`, show
    `formError`. On a thrown error, show its message, which is how "Forbidden"
    arrives. ASSUMPTION: show these messages inline in the toolbar, with no
    toast system.
- **When to clear the selection.** Clear it when any *filter* changes:
  `status`, `assetId`, `q`, and the Ranger params `costMin`, `costMax`,
  `fromMonth`, `toMonth` once they exist. Keep it on `page`, `sortBy`,
  `sortDir`, and drawer open/close. Do this with one `useEffect` keyed on the
  filter-only part of `search`, so back/forward is covered too. Why: if the
  selection survived a filter change, a bulk action could change records the
  user can no longer see.

### ROADMAP note

Add a dated note under Phase 11 in `ROADMAP.md`:

- React DevTools "highlight updates" (or the Profiler) result: toggling one
  checkbox re-renders that row's cell only, versus the whole body. If you can,
  compare it against a quick `useState<Set>` version passed through props.
- HTTP timing for a 1000-id bulk update, and the `technicianOrAdmin` matrix
  (viewer → 403, a 1001-id payload → validator error).
- Whether the selection survived paging and sorting, and cleared on a filter
  change and on logout.

## Out of scope

- Range filters (`tanstack-ranger.md`).
- Bulk delete, bulk edit of fields other than `status`, and CSV export.
- "Select all N matching records" on the server. Selection is explicit ids
  only.
- Persisting the selection in the URL or in storage.
- Optimistic bulk patches.
