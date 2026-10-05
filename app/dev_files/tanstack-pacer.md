# Search/Filter UX — Maintenance Records (Router search params + TanStack Pacer)

ROADMAP.md Phase 7. Status, sort, and page already live in the URL (Phase 4).
This phase adds the filters that are still missing: a free-text search box,
debounced with `@tanstack/react-pacer`, and an asset filter control for the
`assetId` param that the schema already accepts. Every filter stays a typed
search param on the layout route and is applied in SQL (ground rule #2).
Debouncing only cuts down URL writes and server calls. The server still
validates and slices every request.

## Files to modify

- app/package.json                                                       # existing, modify — `bun add @tanstack/react-pacer`
- app/src/features/maintenance-records/maintenance-records.schemas.ts    # existing, modify — add `q` to listMaintenanceRecordsInputSchema
- app/src/features/maintenance-records/maintenance-records.server.ts     # existing, modify — apply `q` in MaintenanceRecords.list()
- app/src/routes/maintenance-records/route.tsx                           # existing, modify — search input, asset filter, search middleware

## Analyze these

- app/src/routes/maintenance-records/route.tsx
- app/src/features/maintenance-records/maintenance-records.schemas.ts
- app/src/features/maintenance-records/maintenance-records.server.ts
- app/src/features/assets/assets.queries.ts
- app/src/features/maintenance-records/maintenance-record-form.tsx

Copy the existing status filter in `route.tsx`. `handleStatusChange` calls
`startTransition`, resets the scroll container, then calls `navigate` with
`{ ...prev, <param>, page: 0 }`. The route's `validateSearch` reuses
`listMaintenanceRecordsInputSchema`, so the URL and the server-function
validator share one schema. Keep that: add new params to the shared schema,
not to a second route-only schema. `ListMaintenanceRecordsInput` is
`z.infer`'d, so the types update without edits.

## What we currently need

### Dependency

- `bun add @tanstack/react-pacer`. Use the React hooks from that package, not
  `@tanstack/pacer-lite`. `pacer-lite` is already in `node_modules`, but only
  as a transitive dependency.

### Schema — `listMaintenanceRecordsInputSchema`

- Add `q: z.string().trim().min(1).max(100).optional()`. The `.max()` bounds
  what a URL can push into a `LIKE` pattern.
- Leave the other fields as they are.

### Server — `MaintenanceRecords.list()`

- When `filters.q` is set, add one more condition to the existing `and(...)`:
  `or(like(maintenanceRecords.description, pattern), like(maintenanceRecords.technician, pattern))`,
  where `pattern = %<escaped q>%`.
- Escape `%`, `_`, and `\` in `q` before wrapping it in `%…%`, and add
  `ESCAPE '\'` to the `LIKE`. Use `sql` if Drizzle's `like()` can't express
  `ESCAPE`. Without this, typing `%` matches every row.
- The `count()` query already reuses `where`, so `total` stays correct with
  no extra change.
- Add a short comment that a leading-wildcard `LIKE` can't use an index, so
  this is a scan of the other filters' result. Measure it against the seeded
  ~100k rows and record the timing as a dated note under Phase 7 in
  ROADMAP.md (the ROADMAP "Notes" convention). FTS5 is out of scope.

### Route — `maintenance-records/route.tsx`

- **Free-text search input** (label "Search", placed next to the status select):
  - Local `useState` holds what the user is typing, seeded from `search.q ?? ''`.
  - Use `useDebouncedCallback` from `@tanstack/react-pacer` with
    `{ wait: 300 }`. The callback runs the same `startTransition` → scroll
    reset → `navigate({ search: (prev) => ({ ...prev, q: value.trim() || undefined, page: 0 }) })`
    sequence as `handleStatusChange`.
  - `onChange` updates local state on every keystroke and calls the debounced
    function. Only the debounced call touches the URL, so a typed word makes
    one navigation and one server request, not one per character.
  - Keep the input in sync with the URL. When `search.q` changes from
    somewhere else (back/forward, a clear button, a link), reset the local
    state to it. ASSUMPTION: a `useEffect` on `search.q` is fine here.
  - A clear button (shown only when the input has text) empties local state,
    cancels any pending debounced call, and navigates with `q: undefined`
    right away.
- **Asset filter** (label "Asset", a `<select>` like the status filter):
  - Options come from `useSuspenseQuery(assetQueries.options())`, the same
    query and label format (`${name} (#${id})`) used in
    `maintenance-record-form.tsx`. Add an "All" option with value `''`.
  - On change, use the status-filter sequence with
    `assetId: value ? Number(value) : undefined, page: 0`.
  - Prefetch `assetQueries.options()` in the route `loader` alongside the list
    query, so the select doesn't suspend on first render.
- **Clean URLs:** add `search: { middlewares: [stripSearchParams({ page: 0, pageSize: 500, sortDir: 'asc' })] }`
  to the route (`stripSearchParams` comes from `@tanstack/react-router`), so
  default values stay out of the URL. Use the defaults that are actually in
  `listMaintenanceRecordsInputSchema`; don't hard-code different ones.
- **Empty state:** when `data.rows.length === 0`, show "No records match these
  filters" in the table container instead of an empty body.
- **Result count:** show `data.total` next to the page indicator
  (e.g. "Page 2 · 1,234 records"). `total` is already returned and unused.

## Out of scope

- Searchable asset combobox with server-side search in the record form. That
  would need a new `Assets` search query and server function. Do it in its
  own pass if it's still wanted.
- Cost/date range filters (Ranger, Phase 11).
- SQLite FTS5 or any new index or migration for text search.
- Per-field fallbacks for invalid URL params (e.g. `?status=foo`). For now
  `validateSearch` keeps throwing via `.parse()`, as it does today.
- An assets list page, dashboards (Phase 8), auth changes (Phase 9).
- Changes to mutations. They already invalidate `['maintenance-records']`,
  which covers every `q`/`assetId` combination.
