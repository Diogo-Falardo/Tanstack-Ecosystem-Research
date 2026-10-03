# TanStack Ecosystem Research

An ops console for tracking equipment (assets) and their maintenance history,
built to learn the TanStack ecosystem from one real full-stack app instead of
from each library on its own. The database is seeded with 80,000 maintenance
records so that slow queries and weak access control show up while you're
still learning, before the app ships. The domain doesn't matter much. What
matters is the data shape: lots of rows, aggregations and user roles.

**Ground rules** (from [`CONTEXT.md`](CONTEXT.md)):

1. Seed realistic volume (50k–100k+ rows) before building UI against a table.
2. Filtering, sorting and pagination all happen on the server. The UI never re-slices a full dataset.
3. Every server function validates its input with Zod and checks authorization itself.
4. Aggregation (sums, counts, group-by) happens in SQL, not in JavaScript.

**Progress:** Phases 1–5 of [`ROADMAP.md`](ROADMAP.md) are built: schema + seed,
server functions, a Query-backed list, the Table UI, and virtualization. The
next phase is 6 (Forms).

## Stack

| Layer | Package (installed version) |
| --- | --- |
| Framework | `@tanstack/react-start` (SSR, server functions, middleware) on Vite 8 + Nitro |
| Routing | `@tanstack/react-router` (file-based) |
| Server state | `@tanstack/react-query` `^5.103.2`, `@tanstack/react-router-ssr-query` |
| Table | `@tanstack/react-table` `^9.2.4` |
| Virtualization | `@tanstack/react-virtual` `^3.14.13` |
| Data | SQLite via `better-sqlite3` + `drizzle-orm` / `drizzle-kit` |
| Validation | `zod` `^4`, `drizzle-zod` |
| Styling | Tailwind CSS 4 |

## Getting started

Prerequisites: [Bun](https://bun.sh) (the lockfile is `app/bun.lock`). The seed
script runs through `tsx`, and `@types/node` is already a dev dependency.

Run everything from `app/`:

```bash
cd app
bun install
echo 'DATABASE_URL=./local.db' > .env.local   # any SQLite file path
bun run db:migrate                             # or: bun run db:push
bun run db:seed                                # 500 assets, 80,000 maintenance records
bun run dev
```

Then open http://localhost:3000/maintenance-records.

`DATABASE_URL` is read by `drizzle.config.ts`, `scripts/db.init.ts` (both load
`.env.local`, then `.env`) and by `src/db/index.ts` at runtime. `*.db` files and
`*.local` files are gitignored.

| Script | Purpose |
| --- | --- |
| `dev` | Vite dev server on port 3000 |
| `build` / `preview` | Production build, then serve it locally |
| `db:generate` | Generate a SQL migration in `drizzle/` from `src/db/schema.ts` |
| `db:migrate` | Apply migrations from `drizzle/` |
| `db:push` | Push the schema straight to the DB without a migration |
| `db:pull` | Introspect the DB back into a schema |
| `db:studio` | Open Drizzle Studio |
| `db:seed` | Wipe and reseed both tables (`scripts/db.init.ts`) |
| `generate-routes` | Regenerate `src/routeTree.gen.ts` with the TanStack Router CLI |
| `lint` | ESLint |
| `format` | Prettier write + ESLint fix |
| `check` | Prettier check |

## Project structure

```
app/
├── drizzle/                 # generated SQL migrations
├── scripts/db.init.ts       # seed script
└── src/
    ├── db/
    │   ├── index.ts         # drizzle(better-sqlite3) client
    │   └── schema.ts        # tables, indexes, relations
    ├── features/
    │   ├── assets/          # server side only so far (queries/mutations empty)
    │   └── maintenance-records/
    ├── middleware/
    │   └── auth.middleware.ts
    ├── routes/
    │   ├── __root.tsx
    │   ├── index.tsx
    │   └── maintenance-records/index.tsx
    ├── routeTree.gen.ts     # generated, do not edit
    └── router.tsx
```

Each feature uses the same file split. Using `maintenance-records` as the example:

| File | Contents |
| --- | --- |
| `*.schemas.ts` | Zod schemas derived from the Drizzle table with `drizzle-zod` (`createSelectSchema` / `createInsertSchema`), plus the list-input schema |
| `*.types.ts` | `z.infer` types from those schemas, plus the `{ rows, total }` result type |
| `*.server.ts` | A class with static DB methods (`get`, `create`, `update`, `list`). Server-only. |
| `*.function.ts` | `createServerFn` wrappers: middleware, then validator, then handler, calling the server class |
| `*.queries.ts` | `queryOptions` factories that call the server functions |
| `*.mutations.ts` | Empty until Phase 6 (Forms) |

Imports use the `#/*` alias, which maps to `app/src/*` (the `imports` field in
`app/package.json`), e.g. `import { db } from '#/db'`.

## The tools, one by one

The sections follow the path a request takes, from the database up to the screen.

### 1. Drizzle + SQLite (data layer)

Drizzle isn't a TanStack library. It defines the tables, generates
migrations and builds the SQL. SQLite was picked over Postgres because it needs
no infrastructure and still exercises real schema, migration and index work.

Every column the list filters or sorts on has an index (ground rule 2). Costs
are stored as integer cents so that later SQL `SUM`s don't pick up float
rounding errors (ground rule 4).

`app/src/db/schema.ts`
```ts
  (table) => [
    index('idx_maintenance_asset_id').on(table.assetId),
    index('idx_maintenance_performed_at').on(table.performedAt),
    index('idx_maintenance_status').on(table.status),
  ],
```

`MaintenanceRecords.list()` pushes the filter, sort and page into SQL, and
gets `total` from a `count()` query, not from `rows.length`:

`app/src/features/maintenance-records/maintenance-records.server.ts`
```ts
    const [rows, totalRow] = await Promise.all([
      db
        .select()
        .from(maintenanceRecords)
        .where(where)
        .orderBy(orderBy)
        .limit(filters.pageSize)
        .offset(filters.page * filters.pageSize),
      db.select({ total: count() }).from(maintenanceRecords).where(where),
    ])
```

**Gotcha:** the seed script (`scripts/db.init.ts`) inserts in batches of 2,000
inside `sqlite.transaction(...)`, the raw better-sqlite3 transaction. Use
that, not `db.transaction()`: the raw version returns a reusable function, while
Drizzle's runs its callback once, immediately.

### 2. TanStack Start: server functions + middleware

`createServerFn` defines an RPC that always runs on the server. Calling it from
the client sends an HTTP request. Each function in this repo chains three
steps: **middleware** (who may call it), then **validator** (a Zod schema that
parses the input), then **handler** (calls the `*.server.ts` class). This is
how ground rule 3 is enforced: the check sits in the function itself, so it
still applies when someone calls the endpoint without going through the UI.

`app/src/features/maintenance-records/maintenance-records.function.ts`
```ts
export const sfListMaintenanceRecords = createServerFn({ method: 'GET' })
  .middleware([anyRole])
  .validator(listMaintenanceRecordsInputSchema)
  .handler(async ({ data }) => MaintenanceRecords.list(data))
```

`authMiddleware` puts `user` in the context. `requireRole(roles)` builds on it
and throws `Forbidden` for any role not in the list. Three presets are exported:

`app/src/middleware/auth.middleware.ts`
```ts
export const anyRole = requireRole(['admin', 'technician', 'viewer'])
export const technicianOrAdmin = requireRole(['admin', 'technician'])
export const adminOnly = requireRole(['admin'])
```

Reads use `anyRole`. Maintenance-record writes use `technicianOrAdmin`. Asset
writes use `adminOnly`.

**Gotcha:** `getCurrentUser()` is a stub that always returns
`{ id: 1, role: 'admin' }` until real auth arrives in Phase 9. To check that a
forbidden call really gets rejected, change the role there.

### 3. TanStack Router

Routes are files under `app/src/routes/`. The Vite plugin (or
`bun run generate-routes`) regenerates `src/routeTree.gen.ts` from them. Never
edit that file by hand.

`router.tsx` exports `getRouter()` and registers its type globally, which makes
links, params and search params type-checked everywhere. The root route
declares a typed context, so every loader can use `context.queryClient`:

`app/src/routes/__root.tsx`
```ts
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
```

The list page keeps page, sort and status filter in the **URL**. The same Zod
schema that the server function validates against also validates the search
params, so a hand-edited URL can't send an invalid request. `loaderDeps` makes
the loader re-run whenever the search params change:

`app/src/routes/maintenance-records/index.tsx`
```ts
export const Route = createFileRoute('/maintenance-records/')({
  validateSearch: (search) => listMaintenanceRecordsInputSchema.parse(search),
  loaderDeps: ({ search }) => ({ filters: search }),
```

The component reads the URL with `Route.useSearch()` and changes it with
`Route.useNavigate()`, e.g. `navigate({ search: (prev) => ({ ...prev, page }) })`.
Nothing is kept in `useState`, so reloading the page or sharing the link
reproduces the exact view.

### 4. TanStack Query

The `QueryClient` is created **inside** `getRouter()`, so each SSR request gets
its own cache and one user's data can't leak into another user's response.
`setupRouterSsrQueryIntegration` dehydrates the server cache into the HTML,
hydrates it on the client, and provides the `QueryClientProvider`. There is no
manual provider anywhere.

`app/src/router.tsx`
```ts
export function getRouter() {
  const queryClient = new QueryClient()

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  setupRouterSsrQueryIntegration({ router, queryClient })
```

Each query is defined once as `queryOptions`. The whole filter object goes into
the `queryKey`, so every page, sort and filter combination gets its own cache
entry:

`app/src/features/maintenance-records/maintenance-records.queries.ts`
```ts
  list: (filters: ListMaintenanceRecordsInput) =>
    queryOptions({
      queryKey: ['maintenance-records', 'list', filters] as const,
      queryFn: () => sfListMaintenanceRecords({ data: filters }),
    }),
```

The route loader prefetches with
`context.queryClient.query({ ...maintenanceRecordQueries.list(deps.filters), staleTime: 'static' })`,
and the component reads the same options with
`useSuspenseQuery(maintenanceRecordQueries.list(search))`, so the data is
already there on first render.

**Gotcha:** `placeholderData` (the "keep the old page visible while the next
one loads" option) doesn't work with `useSuspenseQuery`. Instead, every
`navigate` call is wrapped in `useTransition`'s `startTransition`. React keeps
showing the current page while the next one loads, and `isPending` dims the
table and disables Prev/Next.

### 5. TanStack Table (v9)

TanStack Table is headless. It handles column definitions, header groups and
sort state, and you write the markup yourself. v9 makes you opt in to
features: register them with `tableFeatures`, and use the result to type the
column helper:

`app/src/routes/maintenance-records/index.tsx`
```ts
const features = tableFeatures({ rowSortingFeature, columnSizingFeature })

const columnHelper = createColumnHelper<typeof features, MaintenanceRecord>()
```

**The key point:** no sorted row model is registered, and the table uses
`manualSorting: true`. Clicking a sortable header (`status` or `performedAt`)
calls `onSortingChange`, which writes `sortBy`/`sortDir` to the URL (and resets
`page` to 0). That triggers a new server request. The table only ever renders
the slice the server returned, and it never sorts it again (ground rule 2).

```ts
  const table = useTable({
    features,
    columns,
    data: data.rows,
    manualSorting: true,
    getRowId: (row) => String(row.id),
    state: { sorting },
    onSortingChange: handleSortingChange,
  })
```

Cells and headers render through `flexRender`. `columnSizingFeature` isn't
there for user resizing (no `onColumnSizingChange` is wired up). It provides
`header.getSize()` / `cell.column.getSize()`, which section 6 needs.

### 6. TanStack Virtual

One page can hold up to 2,000 rows, so the table body is virtualized: only
the rows in view (plus 5 overscan rows) are in the DOM. The virtualizer lives in
its own `MaintenanceRecordsTableBody` component, so scroll-driven re-renders
don't reach the header, filter or pager.

`app/src/routes/maintenance-records/index.tsx`
```ts
  const rowVirtualizer = useVirtualizer<HTMLDivElement, HTMLTableRowElement>({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    measureElement: (element) => element.getBoundingClientRect().height,
    overscan: 5,
    getItemKey: (index) => rows[index]?.id ?? index,
  })
```

How it's wired:

- **Scroll container:** a 600px `overflow: auto` div with a ref.
- **Layout:** `<table>`, `<thead>` and `<tbody>` use `display: grid`. Each row
  is a `display: flex` `<tr>`, absolutely positioned at
  `translateY(virtualRow.start)`. The browser's own table layout no longer
  applies, so every column gets an explicit `size`. The header is
  `position: sticky`.
- **Dynamic heights:** `description` is unbounded text that wraps. Each row
  passes `ref={rowVirtualizer.measureElement}` and `data-index`, so its real
  rendered height replaces the 40px estimate.
- **Stable keys:** `getItemKey` uses the row id, not the array index, so a
  measured height stays with its row after a sort reorders the list.
- **Scroll reset:** sort, filter and page changes swap in a new `rows` array,
  so each handler calls `tableContainerRef.current?.scrollTo(0, 0)` itself.
- A one-time `rowVirtualizer.measure()` in a mount effect makes the virtualizer
  pick up the container ref, which isn't attached yet when the child's layout
  effect first runs.

**Why 2,000 still respects ground rule 2:** `listMaintenanceRecordsInputSchema`
has `pageSize: z.number().int().min(1).max(2000).default(500)`. Virtualization
makes large pages cheap to *render*, but the server still rejects anything
above 2,000 rows per response. It never fetches everything.

## How it fits together

Loading `/maintenance-records?status=completed&sortBy=performedAt&sortDir=desc`:

1. **Router:** `validateSearch` parses the URL with
   `listMaintenanceRecordsInputSchema` (defaults fill in `page: 0`, `pageSize: 500`).
2. **Router:** `loaderDeps` hands the parsed search to the loader as `filters`.
3. **Query:** the loader calls `queryClient.query(maintenanceRecordQueries.list(filters))`,
   keyed by `['maintenance-records', 'list', filters]`.
4. **Start:** the `queryFn` calls `sfListMaintenanceRecords({ data: filters })`.
5. **Start middleware:** `anyRole` → `authMiddleware` resolves the user and checks the role.
6. **Start validator:** the same Zod schema parses `filters` again on the server.
7. **Drizzle:** `MaintenanceRecords.list()` runs `WHERE status = ? ORDER BY performed_at DESC LIMIT 500 OFFSET 0`
   and a `count()` query, using the indexes.
8. **Query:** on SSR the result is dehydrated into the HTML. On the client,
   `useSuspenseQuery` reads it from the cache.
9. **Table:** `useTable` builds the rows and headers from `data.rows` with no client-side sorting.
10. **Virtual:** `useVirtualizer` mounts only the visible rows.

Clicking a header, changing the status dropdown or paging calls `navigate`,
which updates the URL and starts again at step 1.

## Not used yet

- **TanStack Form:** create/edit forms with optimistic mutations (Phase 6).
- **TanStack Pacer:** debounced free-text search (Phase 7).
- **TanStack DB:** a synced reactive collection compared against the Query version (Phase 10).
- **TanStack Store / Ranger:** cross-page selection state and range filters, added only if needed (Phase 11).

## Further reading

- [`CONTEXT.md`](CONTEXT.md): why this project exists, the stack, ground rules
- [`ROADMAP.md`](ROADMAP.md): all phases and what each is meant to teach
- [`app/dev_files/`](app/dev_files/): the implementation brief for each phase
- Official docs: [Start](https://tanstack.com/start/latest) ·
  [Router](https://tanstack.com/router/latest) ·
  [Query](https://tanstack.com/query/latest) ·
  [Table](https://tanstack.com/table/latest) ·
  [Virtual](https://tanstack.com/virtual/latest) ·
  [Drizzle](https://orm.drizzle.team/docs/overview)
