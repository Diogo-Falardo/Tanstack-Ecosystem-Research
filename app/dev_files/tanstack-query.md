# List + Fetch — Maintenance Records (TanStack Query)

ROADMAP.md Phase 3. Wires `@tanstack/react-query` into the app and ships a
paginated maintenance-records list route, backed by the server functions from
`server&functions.md`. No mutations, no TanStack Table, no filter UI beyond
what the URL search params carry — those are later phases.

## Files to modify

- app/src/routes/__root.tsx                                              # existing, modify — typed router context
- app/src/router.tsx                                                     # existing, modify — QueryClient + SSR integration
- app/src/features/maintenance-records/maintenance-records.queries.ts    # existing, empty — fill in
- app/src/routes/maintenance-records/index.tsx                           # create

## Analyze these

- app/src/features/maintenance-records/maintenance-records.function.ts
- app/src/features/maintenance-records/maintenance-records.schemas.ts
- app/src/features/maintenance-records/maintenance-records.types.ts
- docs/tanstack-query.md

No feature in this repo has Query wiring yet, so this pass sets the pattern
every later list (assets, and any future feature) follows. `docs/tanstack-query.md`
already documents the exact shape to copy — `queryOptions` in `*.queries.ts`
paired with the `sf*` functions from `*.function.ts`, a route that prefetches
via `loader` + `ensureQueryData` and reads via `useSuspenseQuery` — read its
§2–§4 before writing code; §4 in particular corrects an earlier draft that
wrongly combined `placeholderData` with `useSuspenseQuery` (not supported —
don't do that here either).

## What we currently need

### Dependencies

- Add `@tanstack/react-query` and `@tanstack/react-router-ssr-query`. Nothing
  below compiles without both.

### Router context — `app/src/routes/__root.tsx`, `app/src/router.tsx`

- `__root.tsx`: change `createRootRoute()` to
  `createRootRouteWithContext<{ queryClient: QueryClient }>()()` so every
  route's `loader` and component can read `context.queryClient` with types.
  No other change to this file.
- `router.tsx`: inside `getRouter()` (not at module scope — Start creates one
  router per SSR request, and a module-scoped `QueryClient` would leak one
  request's cached data into another request's HTML), construct
  `new QueryClient()`, pass it to `createRouter` as `context: { queryClient }`,
  then call `setupRouterSsrQueryIntegration({ router, queryClient })` (from
  `@tanstack/react-router-ssr-query`) before returning the router. This
  replaces manual dehydrate/hydrate wiring — don't add a separate
  `QueryClientProvider` anywhere; the integration handles it.

### `maintenance-records.queries.ts`

- Export `maintenanceRecordQueries` with one member, `list(filters: ListMaintenanceRecordsInput)`,
  built with `queryOptions()`: `queryKey: ['maintenance-records', 'list', filters]`,
  `queryFn: () => sfListMaintenanceRecords({ data: filters })`. No
  `placeholderData` — see the gotcha in `docs/tanstack-query.md` §4; this
  query is consumed by `useSuspenseQuery`, which doesn't support it.
- ASSUMPTION: no `detail` query in this pass — `sfGetMaintenanceRecord` has no
  consuming route yet (see Out of scope).

### Maintenance records list route — `app/src/routes/maintenance-records/index.tsx` (create)

- `validateSearch`: reuse `listMaintenanceRecordsInputSchema` from
  `maintenance-records.schemas.ts` directly (don't redefine `page`/`pageSize`/
  `status`/`assetId` as a second schema) — so the URL's search params and the
  server function's validator can never drift apart.
- `loaderDeps: ({ search }) => ({ filters: search })` — required; without it
  the loader won't rerun when the URL's page/filter values change.
- `loader: ({ context, deps }) => context.queryClient.ensureQueryData(maintenanceRecordQueries.list(deps.filters))`.
- `component`: read `Route.useSearch()`, call
  `useSuspenseQuery(maintenanceRecordQueries.list(search))`, render `data.rows`
  as a plain list — one row per record showing `id`, `assetId`, `description`,
  `technician`, `status`, `performedAt`, and `costCents` formatted as currency
  (divide by 100). No sortable/filterable columns and no TanStack Table yet —
  that's Phase 4.
- Page controls: a "Page {page + 1}" indicator (page is 0-indexed per the
  schema) and Prev/Next buttons that change the `page` search param via
  `navigate({ search: (prev) => ({ ...prev, page: prev.page + 1 }) })`.
  Disable Prev at `page === 0`; disable Next when `data.rows.length < pageSize`
  (last page, computed from what came back — no separate "hasNextPage" field
  exists on `ListMaintenanceRecordsResult`).
- Wrap the page-changing `navigate` calls in `useTransition`'s
  `startTransition` and use its `isPending` to dim/disable the Prev/Next
  buttons while the new page loads — see `docs/tanstack-query.md` §4 for why
  (this is the suspense-safe replacement for `isPlaceholderData`, which only
  applies to plain `useQuery`).

## Out of scope

- `maintenance-records.mutations.ts` — stays empty. Mutations are Phase 6.
- Status/assetId filter *controls* (dropdown, asset picker) — the route reads
  `status`/`assetId` from search params if present (so the queryKey/schema
  already support them), but nothing in the UI sets them yet. Filter UX is
  Phase 7; sortable columns are Phase 4.
- `maintenanceRecordQueries.detail` / a record detail route — no consumer yet.
- `assets.queries.ts` / an assets list route — same pattern applies later, not
  built here.
- Any change to `maintenance-records.server.ts`, `.function.ts`, `.schemas.ts`,
  or `.types.ts` — those are already correct from the prior pass (server-side
  `LIMIT`/`OFFSET`, `count()` for `total`, role-checked via `anyRole`).
