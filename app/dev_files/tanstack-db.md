# Reactive Sync — Live Asset Status Board (TanStack DB vs TanStack Query)

ROADMAP.md Phase 10. Build one high-churn view, an asset status board, twice:
once with plain TanStack Query (polling and invalidation), and once with a
TanStack DB query collection plus live queries. Then compare them and record
the results. Both versions read the same server function and write through the
existing `sfUpdateAsset`. The server stays the source of truth and still checks
the role on every call (ground rule #3).

The data is assets, not maintenance records. There are 500 seeded assets, so an
eager collection holding every row is bounded. Filtering and counting those rows
on the client is a deliberate, documented exception to ground rules #2 and #4.
It only works because the set is small and capped. The 80k maintenance records
must never go into an eager collection.

## Files to modify

- app/package.json                                          # existing, modify — `bun add @tanstack/react-db @tanstack/query-db-collection`
- app/src/features/assets/assets.server.ts                  # existing, modify — add `Assets.board()`
- app/src/features/assets/assets.function.ts                # existing, modify — add `sfListAssetBoard`
- app/src/features/assets/assets.types.ts                   # existing, modify — add `AssetBoardRow`
- app/src/features/assets/assets.queries.ts                 # existing, modify — add `assetQueries.board()`
- app/src/features/assets/assets.mutations.ts               # existing, modify — add `assetMutations.setStatus()` (Query version)
- app/src/features/assets/assets.collection.ts              # create — DB collection factory + cleanup
- app/src/features/assets/asset-status-board.tsx            # create — shared presentational board (rows + counts + status select)
- app/src/features/auth/auth.mutations.ts                   # existing, modify — clean up the assets collection on login/logout
- app/src/routes/_authed/assets/index.tsx                   # create — `/assets`, Query version
- app/src/routes/_authed/assets/live.tsx                    # create — `/assets/live`, TanStack DB version (`ssr: false`)
- app/src/routes/_authed/index.tsx                          # existing, modify — links + ROUTE_MAP entries, drop "no list page yet" copy
- ROADMAP.md                                                # existing, modify — dated note under Phase 10

## Analyze these

- app/src/features/assets/assets.server.ts — `Assets.options()` (bounded `.limit(1000)` select)
- app/src/features/assets/assets.function.ts
- app/src/features/assets/assets.queries.ts
- app/src/features/assets/assets.mutations.ts — `invalidateAssetViews` invalidates the `['assets']` prefix
- app/src/features/maintenance-records/maintenance-records.mutations.ts — optimistic `update` (snapshot, patch, restore on `!data.ok`)
- app/src/features/auth/auth.mutations.ts — `client.clear()` on user switch
- app/src/routes/_authed/assets/$id.edit.tsx — admin route guard + loader shape
- app/src/routes/_authed/maintenance-records/route.tsx — status `<select>` styling and table layout
- app/src/router.tsx — one `QueryClient` per request on the server, one per tab on the client
- node_modules/@tanstack/db/skills/db-core/** and node_modules/@tanstack/db/skills/meta-framework/SKILL.md — bundled API docs (read these after installing; they match the installed version)

Keep the feature split: the class in `assets.server.ts` gets the query,
`assets.function.ts` gets a thin `createServerFn` wrapper with a validator and
role middleware, and the factories go in `*.queries.ts` / `*.mutations.ts`. The
collection factory is the new piece. It lives next to them in
`assets.collection.ts` and calls the same server functions. Both routes render
the same `asset-status-board.tsx`, so only the data layer differs between them.

## Research findings (npm latest on 2026-10-05: `@tanstack/react-db` 0.5.3 → `@tanstack/db` 0.11.3, `@tanstack/query-db-collection` 1.3.4)

These are checked against the published package types and bundled skill docs.

- **There is no SSR.** DB collections are client-only. The DB route must set
  `ssr: false` and preload the collection in its `loader`. `_authed`'s
  `beforeLoad` still runs (on the client), and the server function still
  enforces the role.
- **Query collection = a Query cache entry + a reactive store.**
  `queryCollectionOptions({ queryKey, queryFn, queryClient, getKey, ... })`
  takes the usual Query options (`staleTime`, `refetchInterval`,
  `refetchOnWindowFocus`, ...). It does **not** take `placeholderData`, and its
  `select` extracts rows, which is not Query's observer `select`. Eager mode (the
  default) expects `queryFn` to return the *complete* collection state.
- **Persistence handlers refetch automatically.** After `onUpdate` resolves,
  the collection refetches and waits for the result unless the handler returns
  `{ refetch: false }`. If the handler **throws**, the optimistic change is
  rolled back.
- **It shares the Query cache.** The collection's `queryKey` lives in the
  router's `QueryClient`, so `invalidateQueries({ queryKey: ['assets'] })`
  (already called by the asset form) also refetches the collection, as long as
  its key starts with `'assets'`.
- **`client.clear()` is not enough.** The collection keeps its rows in its own
  store, and it is tied to one `QueryClient` for the life of the tab. A user
  switch needs `collection.cleanup()`, and the factory must drop its cached
  instance so it can create a fresh one.
- **Create collections once, not per render.** The docs pattern for a
  request-scoped `QueryClient` is a factory memoized in a
  `WeakMap<QueryClient, Collection>`.
- It is still polling. A query collection gets **no server push**. "Live" means
  every view reading the collection updates together from one store, with
  optimistic writes. Updates from other tabs still arrive on `refetchInterval`.
  Real push would need Electric/PowerSync, which is out of scope.

## What we currently need

### Dependency

- `bun add @tanstack/react-db @tanstack/query-db-collection`. Import
  `createCollection`, `useLiveQuery`, `eq`, `count` from `@tanstack/react-db`
  (it re-exports `@tanstack/db`). `@tanstack/query-core` comes in through
  `@tanstack/react-query`, so don't add it separately.

### Server — `Assets.board()` + `sfListAssetBoard`

- `Assets.board(): Promise<AssetBoardRow[]>` selects `id, name, category,
  location, status` from `assets`, ordered by `asc(assets.name)`, with
  `.limit(1000)`. Copy `options()`, including a comment that the cap is what
  makes a full-collection client store acceptable. Don't return `createdAt`.
- `AssetBoardRow` in `assets.types.ts`:
  `Pick<Asset, 'id' | 'name' | 'category' | 'location' | 'status'>`.
- `sfListAssetBoard`: `createServerFn({ method: 'GET' })`,
  `.middleware([anyRole])`, no validator (no input), handler returns
  `Assets.board()`. Assets have no sensitive fields, so every role can read
  them, which matches `sfListAssets`.
- Writes reuse `sfUpdateAsset` (`adminOnly`) as-is. Don't add a new mutation
  server function.

### Shared UI — `asset-status-board.tsx`

A presentational component that both routes render. Props:
`{ rows: AssetBoardRow[], counts: Record<AssetStatus, number>, statusFilter, onStatusFilterChange, canEdit: boolean, onSetStatus: (id, status) => void, pendingIds?: Set<number> }`.

- Header row of 4 count chips (operational / in_repair / broken / retired).
  Clicking a chip sets the status filter, and an "All" chip clears it.
- Table with columns Name, Category, Location, Status. For admins (`canEdit`),
  the Status cell is a `<select>` that calls `onSetStatus`. For everyone else it
  is plain text.
- Rows in `pendingIds` get a subtle pending style (the same idea as the ghost
  rows in the records list).
- No virtualization. 500 rows max.

### Query version — `/assets` (`routes/_authed/assets/index.tsx`)

- `assetQueries.board()`: `queryKey: ['assets', 'board']`,
  `queryFn: () => sfListAssetBoard()`, `refetchInterval: 5_000`,
  `staleTime: 0`.
- Loader: `context.queryClient.ensureQueryData(assetQueries.board())`. The
  component uses `useSuspenseQuery`.
- Status filter: local `useState` (not a URL search param, which keeps both
  versions identical. ASSUMPTION).
- Filtering and counts are computed with `useMemo` over `data` on the client
  (the documented exception above).
- `assetMutations.setStatus()`: `mutationKey: ['assets', 'set-status']`, calls
  `sfUpdateAsset({ data: { id, status } })`. Optimistic, copying
  `maintenanceRecordMutations.update`: cancel `['assets', 'board']`, snapshot,
  patch the row's status, restore on `onError` and on `!data.ok`, and
  `onSettled` → `invalidateAssetViews` only when it is the last in-flight
  `set-status` mutation.
- `pendingIds` come from `useMutationState` on `['assets', 'set-status']`.

### DB version — `/assets/live` (`routes/_authed/assets/live.tsx`)

- `assets.collection.ts`:
  - `createAssetsCollection(queryClient)` →
    `createCollection(queryCollectionOptions({ id: 'assets-board', queryKey: ['assets', 'board', 'collection'], queryFn: () => sfListAssetBoard(), queryClient, getKey: (row) => row.id, refetchInterval: 5_000, onUpdate }))`.
    Use a distinct key so the Query version and the DB version don't share one
    cache entry and skew the comparison. It keeps the `'assets'` prefix, so the
    asset form's invalidation still reaches it.
  - `onUpdate({ transaction })`: for each mutation, call
    `sfUpdateAsset({ data: { id: m.key, ...m.changes } })`. If any result is
    `!ok`, **throw** `new Error(result.formError ?? 'Update failed')` so
    the optimistic change rolls back. Otherwise return nothing (keep the
    automatic refetch). `ActionFailure` is flat (`{ ok: false, formError?, fieldErrors? }`,
    `src/lib/action-result.ts`). Auth failures (403) already throw.
  - `getAssetsCollection(queryClient)`: memoized through a
    `WeakMap<QueryClient, ReturnType<typeof createAssetsCollection>>`.
  - `cleanupAssetsCollection(queryClient)`: if the WeakMap has an instance,
    delete it and `await collection.cleanup()`.
- Route: `ssr: false`. `beforeLoad` has no extra role guard (any logged-in
  user). The loader calls `getAssetsCollection(context.queryClient).preload()`.
- Component:
  - `useLiveQuery((q) => q.from({ asset: collection }).where(...status filter...).orderBy(({ asset }) => asset.name), [statusFilter])`
    for the rows.
  - A second `useLiveQuery` with `groupBy(({ asset }) => asset.status)` and
    `select({ status, n: count(asset.id) })` for the chips, turned into the
    `counts` record. Missing statuses become 0.
  - `onSetStatus` → `collection.update(id, (draft) => { draft.status = status })`.
  - `pendingIds`: ASSUMPTION: use the collection's optimistic or pending state
    if the installed API exposes one per key. Otherwise track ids in local
    state around `tx.isPersisted.promise`. Pick whichever the bundled
    `mutations-optimistic` skill documents.
  - Show a small error line when `collection.utils.isError` (lastError).

### Auth — `auth.mutations.ts`

- In both `login` and `logout` `onSuccess`, when `data.ok`, call
  `cleanupAssetsCollection(client)` next to `client.clear()`. Return or await
  it so the next user can't see the previous user's rows. This is mostly
  about the habit, because asset rows aren't sensitive.

### Navigation — `routes/_authed/index.tsx`

- Assets section: add "Status board" (`/assets`) and "Live board (DB)"
  (`/assets/live`) links. Show the section to every role, but keep "New asset"
  and "Edit asset by ID" admin-only. Replace the "There's no list page yet"
  copy.
- `ROUTE_MAP`: add `/assets` ("Asset status board, Query polling", all roles)
  and `/assets/live` ("Asset status board, TanStack DB", all roles).

### Comparison + ROADMAP note

Run both boards on the dev server with the 500 seeded assets. Record a dated
note under Phase 10 in ROADMAP.md covering:

- Requests per minute while idle on each board (both poll every 5 s), and the
  payload size of one `sfListAssetBoard` response.
- Time from an admin's status change in tab A to the change showing in tab B
  (both versions: bounded by `refetchInterval`).
- Same-tab behavior after a status change: does the count chip update in the
  same frame as the row (DB live query) compared with the `useMemo` path? Does
  a filtered view (e.g. "broken") drop the row immediately?
- Rollback: make `sfUpdateAsset` fail (e.g. a technician cookie → 403, or
  update a deleted id) and confirm each version restores the old status.
- Lines of data-layer code each version needed (optimistic patch and rollback
  in `assets.mutations.ts` compared with the collection's `onUpdate`).
- Logout → log in as another user on the same tab: `/assets/live` refetches and
  shows no stale instance.
- A short verdict: what the DB version bought over Query for this view, and
  why it would *not* fit the 80k-row records list (eager mode = full download,
  and on-demand mode would need `parseLoadSubsetOptions` → SQL translation).

## Out of scope

- Electric / PowerSync / any server-push sync, WebSockets, SSE.
- `syncMode: 'on-demand'` and moving maintenance records to TanStack DB.
- Changing who can edit asset status (stays admin-only via `sfUpdateAsset`).
- Asset create/edit forms, URL search params for the board filter,
  virtualization, new indexes or migrations.
- Removing the Query version afterwards. Keep both routes for the comparison.
