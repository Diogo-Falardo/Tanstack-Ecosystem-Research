# Dashboards — Maintenance Cost (TanStack Query + SQL aggregation)

ROADMAP.md Phase 8. This phase adds a `/dashboard` route with three views: a
cost-over-time chart (monthly), cost by record status, and the top assets by
cost. Every number is computed in SQL with `GROUP BY` / `SUM` / `COUNT`
(ground rule #4). The server returns at most a few dozen aggregate rows. It
never returns raw maintenance records for the client to reduce. A `months`
window lives in the URL as a typed search param, like the Phase 7 filters.

## Files to modify

- app/src/features/dashboard/dashboard.schemas.ts                        # create
- app/src/features/dashboard/dashboard.types.ts                          # create
- app/src/features/dashboard/dashboard.server.ts                         # create
- app/src/features/dashboard/dashboard.function.ts                       # create
- app/src/features/dashboard/dashboard.queries.ts                        # create
- app/src/routes/dashboard.tsx                                           # create
- app/src/features/maintenance-records/maintenance-records.mutations.ts  # existing, modify (also invalidate `['dashboard']`)
- app/src/features/assets/assets.mutations.ts                            # existing, modify (also invalidate `['dashboard']`)
- app/src/lib/format.ts                                                  # create (move `formatCost` here)
- app/src/routes/maintenance-records/route.tsx                           # existing, modify (import `formatCost` from `#/lib/format`)
- app/src/routes/__root.tsx                                              # existing, modify (add a "Dashboard" link to TopBar)
- ROADMAP.md                                                             # existing, modify (add a dated note under Phase 8)

## Analyze these

- app/src/features/maintenance-records/maintenance-records.server.ts
- app/src/features/maintenance-records/maintenance-records.function.ts
- app/src/features/maintenance-records/maintenance-records.queries.ts
- app/src/features/maintenance-records/maintenance-records.schemas.ts
- app/src/features/assets/assets.queries.ts
- app/src/routes/maintenance-records/route.tsx
- app/src/db/schema.ts

Copy the maintenance-records feature split. Use a class with static methods
in `*.server.ts` for the Drizzle queries, `createServerFn` + `anyRole` +
`.validator(schema)` in `*.function.ts`, `queryOptions` factories in
`*.queries.ts`, and Zod schemas in `*.schemas.ts` with types `z.infer`'d in
`*.types.ts`. For the route, copy `maintenance-records/route.tsx`:
`validateSearch` reuses the server-function schema, `stripSearchParams` uses
the schema defaults parsed from `{}`, `loaderDeps` passes the search, the
loader prefetches with `context.queryClient`, and the component reads data
with `useSuspenseQuery`. This feature has no mutations, so there is no
`dashboard.mutations.ts`.

## Research findings (80k seeded rows, 500 assets, 2023-10 → 2026-10)

These were measured on the current `local.db` with `better-sqlite3`. The
implementer doesn't need to redo them, but should re-measure through the real
server functions for the ROADMAP note.

| Query | Time | Plan |
|---|---|---|
| Cost by month, all 37 months | ~40 ms | `SCAN maintenance_records` + temp B-tree for GROUP BY |
| Cost by month, last 12 months | ~18 ms | `SEARCH … USING INDEX idx_maintenance_performed_at (performed_at>?)` |
| Cost by status, all | ~17 ms | `SCAN … USING INDEX idx_maintenance_status` |
| Top 10 assets by cost (JOIN assets) | ~26 ms | `SCAN … USING INDEX idx_maintenance_asset_id` + temp B-tree for ORDER BY |

- A covering index `(performed_at, cost_cents, asset_id, status)` cut the
  12-month series from ~18 ms to ~9 ms and the full series from ~40 ms to
  ~29 ms. It did not help top-assets, because the planner still picks
  `idx_maintenance_asset_id`. That's a small gain at this volume, so no new
  index this phase (see Out of scope).
- Sums fit in a JS number. The all-time total is about 2×10¹⁰ cents, far
  below 2⁵³. SQLite returns `sum()` of an INTEGER column as an integer.
- `performed_at` is stored as unix **seconds** (`mode: 'timestamp'`), so
  month bucketing is `strftime('%Y-%m', performed_at, 'unixepoch')`. That
  is UTC. Raw SQL is required here because Drizzle has no date-bucket helper.

## What we currently need

### Schema — `dashboard.schemas.ts`

- `dashboardInputSchema = z.object({ months: z.union([z.literal(3), z.literal(6), z.literal(12), z.literal(36)]).default(12) })`.
  A closed set is used so the URL can't request an arbitrary window. 36
  covers the full seed range.
- Schemas for the three result row shapes, used only for types (no runtime
  parse of aggregate rows is needed):
  - month row: `{ month: string /* 'YYYY-MM' */, costCents: number, count: number }`
  - status row: `{ status: MaintenanceRecord['status'], costCents: number, count: number }`.
    Reuse `selectMaintenanceRecordSchema.shape.status`.
  - asset row: `{ assetId: number, name: string, costCents: number, count: number }`

### Types — `dashboard.types.ts`

- `DashboardInput` (`z.infer` of the input schema), `CostByMonthRow`,
  `CostByStatusRow`, `TopAssetRow`. These follow the `maintenance-records.types.ts` style.

### Server — `dashboard.server.ts`, `class Dashboard`

Shared window: records with `performed_at >= <start of the month (months − 1) months ago, UTC>`
and `performed_at < <start of next month, UTC>`. Compute both bounds in SQL,
e.g. `unixepoch('now', 'start of month', ${'-' + (months - 1) + ' months'})`
with the modifier passed as a bound parameter, not string-concatenated into
the SQL. Put this in one private helper so all three methods use the same
`where`. The lower bound is what makes SQLite use `idx_maintenance_performed_at`.

- `static async costByMonth({ months }): Promise<CostByMonthRow[]>`
  - `select month = strftime('%Y-%m', performed_at, 'unixepoch'), costCents = sum(cost_cents), count = count(*)`
    over the window, with `group by month order by month`.
  - Fill gaps: build the list of `months` month keys (oldest → current) and
    merge in the SQL rows, so a month with no records becomes `costCents: 0, count: 0`.
    The result always has exactly `months` entries. This is a merge over at
    most 36 aggregate rows, not a reduce over records, so it stays in JS.
    Build the month keys in UTC so they match `strftime`.
- `static async costByStatus({ months }): Promise<CostByStatusRow[]>`
  - `sum(cost_cents)`, `count(*)` grouped by `status`, over the window,
    ordered by `costCents desc`. Statuses with no rows are omitted
    (ASSUMPTION: fine for a breakdown).
- `static async topAssets({ months }, limit = 10): Promise<TopAssetRow[]>`
  - `maintenance_records` inner join `assets` on `asset_id`, over the window,
    grouped by `maintenance_records.asset_id`, selecting `assets.name`,
    `sum(cost_cents)`, `count(*)`, ordered by `sum desc`, with `limit`.
- Use Drizzle's query builder (`db.select({...}).from(...).where(...).groupBy(...)`)
  with `sql<number>` / `sum()` / `count()` for the aggregate columns. Drizzle's
  `sum()` returns `string | null` for SQLite, so either use
  `sql<number>\`sum(${maintenanceRecords.costCents})\`` or `.mapWith(Number)`
  so the result type is `number`. Never select `maintenanceRecords.*` rows here.
- Add a one-line comment on `costByMonth` saying the bucketing is UTC.

### Server functions — `dashboard.function.ts`

- `sfDashboardCostByMonth`, `sfDashboardCostByStatus`, `sfDashboardTopAssets`:
  each is `createServerFn({ method: 'GET' }).middleware([anyRole]).validator(dashboardInputSchema)`
  and calls the matching `Dashboard` method.
- Add `// TODO(Phase 9): cost totals are sensitive. Tighten the role here.`
  above the three. Keep `anyRole` for now. The records list already returns
  `costCents` to every role, so tightening only here would be inconsistent
  before Phase 9.

### Queries — `dashboard.queries.ts`

- `dashboardQueries.costByMonth(input)`, `.costByStatus(input)`,
  `.topAssets(input)`, each built with `queryOptions` and keyed
  `['dashboard', '<name>', input] as const`.
- Use three separate queries, not one combined server function, so each
  panel caches on its own and a single `['dashboard']` prefix invalidates
  them all.
- ASSUMPTION: `staleTime: 60_000`. Aggregates don't need to be fresher than
  that, and mutations invalidate them anyway (below).

### Invalidation — existing mutations

- `maintenance-records.mutations.ts`: wherever `onSettled` invalidates
  `['maintenance-records']` (create, and update's last-in-flight branch),
  also invalidate `['dashboard']`. Return a `Promise.all` of both so the
  mutation stays pending through both refetches, as it does today.
- `assets.mutations.ts`: in `update` (and `create`, for consistency), also
  invalidate `['dashboard']`. A renamed asset appears in `topAssets`.
- No optimistic patching of dashboard caches.

### Route — `app/src/routes/dashboard.tsx` (create)

- `createFileRoute('/dashboard')`, with `validateSearch: dashboardInputSchema`
  and `search.middlewares: [stripSearchParams(dashboardInputSchema.parse({}))]`.
- `loaderDeps: ({ search }) => ({ input: search })`. The loader prefetches all
  three queries in parallel with `Promise.all`. Use the same
  `context.queryClient` call style as `maintenance-records/route.tsx`.
- Component: `Route.useSearch()`, then `useSuspenseQueries` (or three
  `useSuspenseQuery` calls) for the three queries.
- **Window picker**: a segmented control or `<select>` labelled
  "Period", with options 3 / 6 / 12 / 36 months. On change, call `navigate`
  inside `startTransition` (copy `handleStatusChange`) and dim the panels
  while `isPending`.
- **Summary tiles**: total cost and total record count for the window,
  summed from the `costByStatus` rows. That sums at most 4 aggregate rows,
  which is allowed. Reuse the `formatCost` formatting from
  `maintenance-records/route.tsx` (cents → USD). Move it to `src/lib/format.ts`
  and import it in both places, rather than copying it.
- **Cost over time**: a bar chart, one bar per month, height proportional to
  `costCents / max`. Show the month label on the x-axis (thin out labels at 36),
  the formatted cost in a `<title>`/tooltip per bar, and a visually-hidden
  `<table>` with the same data for screen readers.
  ASSUMPTION: hand-rolled inline SVG or CSS bars, with no chart library.
  No chart dependency is installed, at most 36 points need no library, and
  it avoids SSR issues. If a library is wanted, that is a separate decision.
- **By status**: one row per status with a horizontal bar (share of total
  cost), the formatted cost, and the count. Each row links to
  `/maintenance-records` with `search={{ status }}`, so the breakdown drills
  into the server-filtered list.
- **Top assets**: a table with columns rank, asset name, cost, and record
  count. The name links to `/maintenance-records` with
  `search={{ assetId }}`. Add a secondary "Edit" link to `/assets/$id/edit`.
- **Empty state**: if `costByStatus` is empty, show "No maintenance records in
  this period" instead of the three panels.
- Style it like `src/routes/index.tsx` (white rounded cards,
  `border-neutral-200`, neutral palette, `max-w-5xl` container).

### Nav — `__root.tsx`

- Add a "Dashboard" `Link` to `/dashboard` in `TopBar`, between "Ops Console"
  and "Records". Use the same `NAV_LINK` / `activeProps`.

### ROADMAP note

- Add a dated note under Phase 8. Re-time each server function against the
  seeded DB (cold and warm), paste the `EXPLAIN QUERY PLAN` for the month
  series, and say whether the window bound used `idx_maintenance_performed_at`.

## Out of scope

- New indexes or migrations. This includes the covering index measured above
  (~2× on the time series, still only ~10–30 ms). Revisit if the seed grows.
- Asset-status breakdown (operational / broken / …), category breakdown,
  and date-range pickers (Ranger, Phase 11).
- Role changes (Phase 9), beyond the TODO comment.
- Pre-aggregated or materialized summary tables.
- TanStack DB / live updates (Phase 10).
- Changes to the records list, its schema, or its server layer.
