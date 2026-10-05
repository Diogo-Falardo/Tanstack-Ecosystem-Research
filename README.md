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

**Progress:** Phases 1–10 of [`ROADMAP.md`](ROADMAP.md) are built:

| Phase | What it added | Tool |
| --- | --- | --- |
| 1 | Indexed schema, 500 assets + 80,000 maintenance records | Drizzle |
| 2 | Validated, role-checked server functions | Start, Zod |
| 3 | Paginated list, cache keyed by page/filter/sort | Query |
| 4 | Server-sorted, server-filtered table | Table |
| 5 | Virtualized body for pages of up to 2,000 rows | Virtual |
| 6 | Create/edit forms with optimistic updates | Form, Query |
| 7 | Every filter in the URL, debounced free-text search | Router, Pacer |
| 8 | Cost dashboard, every number a SQL `GROUP BY` | Query, Drizzle |
| 9 | Login, roles, route guards + server-function guards, cost hidden from viewers | Start middleware |
| 10 | Asset status board built twice, Query polling vs a reactive collection | Query, DB |

Phase 11 (Store, Ranger) is added only when a concrete need shows up.

## Stack

| Layer | Package (installed version) |
| --- | --- |
| Framework | `@tanstack/react-start` (SSR, server functions, middleware) on Vite 8 + Nitro |
| Routing | `@tanstack/react-router` (file-based) |
| Server state | `@tanstack/react-query` `^5.103.2`, `@tanstack/react-router-ssr-query` |
| Table | `@tanstack/react-table` `^9.2.4` |
| Virtualization | `@tanstack/react-virtual` `^3.14.13` |
| Forms | `@tanstack/react-form` `1.33.5` (pinned exactly) |
| Debouncing | `@tanstack/react-pacer` `^0.24.1` |
| Reactive collections | `@tanstack/react-db` `^0.5.3`, `@tanstack/query-db-collection` `^1.3.4` |
| Data | SQLite via `better-sqlite3` + `drizzle-orm` / `drizzle-kit` |
| Validation | `zod` `^4`, `drizzle-zod` |
| Styling | Tailwind CSS 4 |

## Getting started

Prerequisites: [Bun](https://bun.sh) (the lockfile is `app/bun.lock`) and
[Node.js](https://nodejs.org) LTS. The dev server and seed scripts run on Node
because `better-sqlite3` is a native Node module that Bun can't load. The seed
scripts run through `tsx`, and `@types/node` is already a dev dependency.

Run everything from `app/`:

```bash
cd app
bun install
echo 'DATABASE_URL=./local.db' > .env.local                       # any SQLite file path
echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env.local         # 32+ chars, encrypts the session cookie
bun run db:migrate                                                 # creates assets, maintenance_records, users
bun run db:seed                                                    # 500 assets, 80,000 maintenance records
bun run db:seed-users                                              # the three logins below
bun run dev
```

Then open http://localhost:3000. Every page except `/login` requires a
login, so you land on the login form first.

### Login access

`bun run db:seed-users` creates one account per role. All three use the
password `password123`, or the value of `SEED_USER_PASSWORD` if it is set
when you run the script. Re-running it resets the passwords and signs those
users out everywhere.

| Email | Role | Can |
| --- | --- | --- |
| `admin@example.com` | admin | Everything: records with costs, create/edit records, create/edit assets, change asset status on the boards, `/dashboard` |
| `tech@example.com` | technician | Records with costs, create/edit records, read-only asset boards. No asset forms, no dashboard |
| `viewer@example.com` | viewer | Read the records list and the asset boards. Cost comes back as `null` and the Cost column is hidden |

There is no sign-up or user-management screen. To add a user or change a
role, edit the `users` table (e.g. `bun run db:studio`) or `scripts/seed-users.ts`.
A role change takes effect on the user's next request, with no re-login.

After login, the home page links to every screen your role can open: the
records list (with preset views such as "Completed" or "Newest first"), the
two asset status boards, new record, new asset, and edit-by-ID for records
and assets. The top bar shows
the links for your role, your name and role, and a **Log out** button.
Logging out signs that user out on every device.

| Env var | Read by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `drizzle.config.ts`, both seed scripts, `src/db/index.ts` | SQLite file path |
| `SESSION_SECRET` | `src/lib/session.ts` | Encrypts and signs the session cookie. Must be at least 32 characters; server functions throw without it |
| `SEED_USER_PASSWORD` | `scripts/seed-users.ts` (optional) | Password for the three seeded users (default `password123`) |

The scripts load `.env.local`, then `.env`. `*.db` files and `*.local` files
are gitignored.

| Script | Purpose |
| --- | --- |
| `dev` | Vite dev server on port 3000 |
| `build` / `preview` | Production build, then serve it locally |
| `db:generate` | Generate a SQL migration in `drizzle/` from `src/db/schema.ts` |
| `db:migrate` | Apply migrations from `drizzle/` |
| `db:push` | Push the schema straight to the DB without a migration |
| `db:pull` | Introspect the DB back into a schema |
| `db:studio` | Open Drizzle Studio |
| `db:seed` | Wipe and reseed assets and maintenance records (`scripts/db.init.ts`) |
| `db:seed-users` | Upsert the three role logins (`scripts/seed-users.ts`); leaves records alone |
| `generate-routes` | Regenerate `src/routeTree.gen.ts` with the TanStack Router CLI |
| `lint` | ESLint |
| `format` | Prettier write + ESLint fix |
| `check` | Prettier check |

## Project structure

```
app/
├── drizzle/                 # generated SQL migrations
├── scripts/
│   ├── db.init.ts           # seed assets + maintenance records
│   └── seed-users.ts        # seed the three role logins
└── src/
    ├── db/
    │   ├── index.ts         # drizzle(better-sqlite3) client
    │   └── schema.ts        # tables (users, assets, maintenance_records), indexes, relations
    ├── components/form/     # TanStack Form field kit (useAppForm, fields, alert, submit)
    ├── features/
    │   ├── assets/          # + asset-form.tsx, asset-status-board.tsx, assets.collection.ts (TanStack DB)
    │   ├── auth/            # login/logout/current user + login-form.tsx
    │   ├── dashboard/       # read-only aggregates: no mutations, no form
    │   └── maintenance-records/   # + maintenance-record-form.tsx
    ├── lib/
    │   ├── action-result.ts # { ok, data } | { ok: false, formError, fieldErrors }
    │   ├── format.ts        # formatCost: integer cents → USD string
    │   ├── route-guards.ts  # requireRouteRole, safeRedirect, role helpers for the UI
    │   └── session.ts       # useAppSession: sealed session cookie config
    ├── middleware/
    │   └── auth.middleware.ts   # getCurrentUser + anyRole / technicianOrAdmin / adminOnly
    ├── routes/
    │   ├── __root.tsx             # document shell, loads the user, top nav bar
    │   ├── login.tsx              # /login (public)
    │   ├── _authed.tsx            # pathless layout: redirects to /login if logged out
    │   └── _authed/               # everything below requires a login
    │       ├── index.tsx              # / home: links to every route your role can open
    │       ├── dashboard.tsx          # /dashboard (admin): cost charts and breakdowns
    │       ├── assets/
    │       │   ├── index.tsx          # /assets: status board, Query version
    │       │   ├── live.tsx           # /assets/live: status board, TanStack DB version (no SSR)
    │       │   ├── new.tsx            # /assets/new (admin)
    │       │   └── $id.edit.tsx       # /assets/$id/edit (admin)
    │       └── maintenance-records/
    │           ├── route.tsx          # list (layout) + drawer <Outlet/>
    │           ├── index.tsx          # empty: drawer closed
    │           ├── new.tsx            # create drawer (admin, technician)
    │           └── $id.edit.tsx       # edit drawer (admin, technician)
    ├── routeTree.gen.ts     # generated, do not edit
    ├── router.tsx
    └── start.ts             # Start instance: CSRF middleware for server functions
```

The `_authed` folder is pathless: it adds a guard, not a URL segment, so
`routes/_authed/dashboard.tsx` is still served at `/dashboard`.

Each feature uses the same file split. Using `maintenance-records` as the example:

| File | Contents |
| --- | --- |
| `*.schemas.ts` | Zod schemas derived from the Drizzle table with `drizzle-zod` (`createSelectSchema` / `createInsertSchema`, with shared refinements), the list-input schema, and the form schema |
| `*.types.ts` | `z.infer` types from those schemas, the `{ rows, total }` result type, `ActionResult` and form-value types |
| `*.server.ts` | A class with static DB methods (`get`, `create`, `update`, `list`). Server-only. `create`/`update` return `ActionResult` |
| `*.function.ts` | `createServerFn` wrappers: middleware, then validator, then handler, calling the server class |
| `*.queries.ts` | `queryOptions` factories that call the server functions (`list`, `detail`, asset `options`) |
| `*.mutations.ts` | `mutationOptions` factories: cache work (optimistic patch, rollback, invalidation) |
| `*-form.tsx` | The feature form, built from the shared field kit |
| `*.collection.ts` | `assets` only: the TanStack DB collection factory, which calls the same server functions |

`dashboard` only reads data, so it has just `schemas`, `types`, `server`,
`function` and `queries`. `auth` has no `list`/`get`: its server class is
`verifyCredentials`, `getSessionUser` and `revokeSessions`. `assets` adds a
`*.collection.ts` for the Phase 10 comparison.

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
gets `total` from a `count()` query, not from `rows.length`. It selects
columns explicitly so the cost column can be swapped for `NULL` when the
caller may not see it (see section 10):

`app/src/features/maintenance-records/maintenance-records.server.ts`
```ts
    const [rows, totalRow] = await Promise.all([
      db
        .select({
          id: maintenanceRecords.id,
          // …
          costCents: includeCost
            ? maintenanceRecords.costCents
            : sql<null>`null`,
          // …
        })
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
  .handler(async ({ data, context }) =>
    MaintenanceRecords.list(data, {
      includeCost: context.user.role !== 'viewer',
    }),
  )
```

`authMiddleware` puts `user` in the context (or answers 401). `requireRole(roles)` builds on it
and answers 403 `Forbidden` for any role not in the list. Three presets are exported:

`app/src/middleware/auth.middleware.ts`
```ts
export const anyRole = requireRole(['admin', 'technician', 'viewer'])
export const technicianOrAdmin = requireRole(['admin', 'technician'])
export const adminOnly = requireRole(['admin'])
```

| Server function | Guard |
| --- | --- |
| `sfListMaintenanceRecords` | `anyRole`; `costCents` is `null` for viewers |
| `sfGetMaintenanceRecord` (edit drawer) | `technicianOrAdmin` |
| `sfCreateMaintenanceRecord`, `sfUpdateMaintenanceRecord` | `technicianOrAdmin` |
| `sfGetAsset`, `sfListAssets`, `sfListAssetOptions` | `anyRole` |
| `sfCreateAsset`, `sfUpdateAsset` | `adminOnly` |
| `sfDashboardCostByMonth` / `ByStatus` / `TopAssets` | `adminOnly` |
| `sfLogin`, `sfGetCurrentUser`, `sfLogout` | none (public); `sfGetCurrentUser` returns `null` when logged out |

The validator runs **on the server**, so it is the security gate; the form's
client-side validation is only UX. Create/update now return an `ActionResult`:
expected failures (asset not found, record deleted) come back as
`{ ok: false, formError?, fieldErrors? }`, while auth and validator failures
still throw.

How the user is resolved (session cookie, DB lookup, CSRF) is in section 10.

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

The list page keeps **every** filter in the URL: page, sort, status, asset
and the free-text search `q`. The same Zod schema that the server function
validates against also validates the search params, so a hand-edited URL
can't send an invalid request. It's passed to `validateSearch` directly (as a
Standard Schema) rather than wrapped in `(search) => schema.parse(search)`,
because the wrapped form loses the input type and `stripSearchParams` can no
longer type-check against it. `stripSearchParams` keeps default values out of
the URL: `/maintenance-records?page=0&pageSize=500&sortDir=asc` redirects to
plain `/maintenance-records`. `loaderDeps` makes the loader re-run whenever
the search params change:

`app/src/routes/_authed/maintenance-records/route.tsx`
```ts
const SEARCH_DEFAULTS = listMaintenanceRecordsInputSchema.parse({})

export const Route = createFileRoute('/_authed/maintenance-records')({
  validateSearch: listMaintenanceRecordsInputSchema,
  search: {
    middlewares: [stripSearchParams(SEARCH_DEFAULTS)],
  },
  loaderDeps: ({ search }) => ({ filters: search }),
```

The list is a **layout route** (`route.tsx`). `new.tsx` and `$id.edit.tsx`
render through its `<Outlet/>` in a drawer beside the table, and they inherit
its search params, so opening or closing the drawer keeps page, sort and
filter. `index.tsx` renders nothing, and the drawer only opens when
`useChildMatches` finds a child other than the index
(`routeId !== '/_authed/maintenance-records/'`).

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
`context.queryClient.query({ ...maintenanceRecordQueries.list(deps.filters), staleTime: 30_000 })`,
and the component reads the same options with
`useSuspenseQuery(maintenanceRecordQueries.list(search))`, so the data is
already there on first render. It used to be `staleTime: 'static'`, but
`'static'` ignores `invalidateQueries` (query-core's `isStaleByTime` returns
"fresh" before it checks `isInvalidated`), so post-save refreshes never
reached the loader.

**Gotcha:** `placeholderData` (the "keep the old page visible while the next
one loads" option) doesn't work with `useSuspenseQuery`. Instead, every
`navigate` call is wrapped in `useTransition`'s `startTransition`. React keeps
showing the current page while the next one loads, and `isPending` dims the
table and disables Prev/Next.

#### Mutations

Mutations are plain `mutationOptions` factories in `*.mutations.ts`. The v5
callbacks receive a trailing `context` holding `client`, so the file needs no
`useQueryClient`. Cache work lives here; alerts, reset and navigation live in
the form.

- **Edit = cache patch with rollback.** `onMutate` cancels queries, snapshots
  every list page and the detail entry, then patches the row in place. The
  rollback runs in `onError` *and* in `onSuccess` when the server returned
  `ok: false`, because a returned failure doesn't trigger `onError`.
- **Create = ghost rows + invalidate.** The client can't know where a new row
  lands in a server-sorted, paginated list, so nothing is written into list
  caches. The list renders pending creates from `useMutationState` at half
  opacity, and `onSettled` returns the invalidation so the mutation (and the
  form's `isSubmitting`) stays pending through the refetch.

`app/src/features/maintenance-records/maintenance-records.mutations.ts`
```ts
      onError: (_error, _vars, result, { client }) =>
        restore(client, result?.snapshots),
      // A returned failure doesn't trigger onError, so roll back here too.
      onSuccess: (data, _vars, result, { client }) => {
        if (!data.ok) restore(client, result.snapshots)
      },
      // Skip the refetch while other edits are still in flight, so one
      // edit's refetch doesn't overwrite another's optimistic patch.
      onSettled: (_data, _error, _vars, _result, { client }) => {
        if (
          client.isMutating({
            mutationKey: ['maintenance-records', 'update'],
          }) === 1
        ) {
          return invalidateRecordViews(client)
        }
      },
```

`invalidateRecordViews` invalidates both `['maintenance-records']` and
`['dashboard']`, because a saved record changes the dashboard's totals too.
Asset mutations invalidate `['assets']` and `['dashboard']` the same way,
since asset names appear in the top-assets panel.

`app/src/routes/_authed/maintenance-records/route.tsx`
```ts
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
```

Ghost rows render in their own `<tbody>` above the virtualized one, keyed
`ghost-<submittedAt>`, so the virtualizer's `getItemKey` is never disturbed.

### 5. TanStack Table (v9)

TanStack Table is headless. It handles column definitions, header groups and
sort state, and you write the markup yourself. v9 makes you opt in to
features: register them with `tableFeatures`, and use the result to type the
column helper:

`app/src/routes/_authed/maintenance-records/route.tsx`
```ts
const features = tableFeatures({ rowSortingFeature, columnSizingFeature })

const columnHelper = createColumnHelper<typeof features, MaintenanceRecordRow>()
```

There are two column arrays: `viewerColumns`, and `staffColumns`, which adds
Cost and the Edit link. The table picks one by role.

**The key point:** no sorted row model is registered, and the table uses
`manualSorting: true`. Clicking a sortable header (`status` or `performedAt`)
calls `onSortingChange`, which writes `sortBy`/`sortDir` to the URL (and resets
`page` to 0). That triggers a new server request. The table only ever renders
the slice the server returned, and it never sorts it again (ground rule 2).

```ts
  const table = useTable({
    features,
    columns: canEdit ? staffColumns : viewerColumns,
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

`app/src/routes/_authed/maintenance-records/route.tsx`
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

### 7. TanStack Form

TanStack Form is a headless form state library: values, field meta (touched,
blurred, default-value checks), validation per event, and submission state,
held in a store you subscribe to with selectors.

**How it's set up here:** a field kit built once in `src/components/form/`.
`createFormHookContexts()` makes the contexts. `createFormHook()` registers the
field and form components and returns `useAppForm`. Feature forms only write
`form.AppField` + `<field.TextField/>`; only the kit reads `field.state`, so
the v2 migration stays inside the kit.

`app/src/components/form/form-kit.tsx`
```ts
export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField,
    TextareaField,
    NumberField,
    DateField,
    SelectField,
  },
  formComponents: { SubmitButton, FormAlert },
})
```

**Validation timing:** `validationLogic: revalidateLogic()` +
`validators: { onDynamic: schema }` validates on submit first, then live after
the first submit. There's no form-level `onChange` schema (it re-renders every
field on every keystroke). Errors show according to one helper:

`app/src/components/form/should-show-error.ts`
```ts
  return !meta.isValid && (meta.isBlurred || submissionAttempts > 0)
```

**Form values vs server payload:** v1 infers form types from `defaultValues`,
not the schema, and validation hands over the schema *input*. So
`MaintenanceRecordFormValues = z.input<typeof maintenanceRecordFormSchema>`
types the defaults, and submit calls `schema.parse(value)` to get the output.
The form schema converts the three columns whose UI type differs from the DB
type:

| Form value | Server value |
| --- | --- |
| `cost` in dollars (`number \| null`, ≤ 2 decimals) | `costCents = Math.round(cost * 100)` |
| `performedAt` as `YYYY-MM-DD` | `Date` (Start's serializer carries it as a real `Date`) |
| `assetId: number \| null` (empty select) | positive int; `null` fails with "Choose an asset" |

**Server errors:** the form's `onSubmitAsync` validator calls `mutateAsync`
and maps the `ActionResult` onto `{ form, fields }`, so `fieldErrors` land on
the fields and `formError` lands in `FormAlert`. A thrown error becomes a
form-level message. Input is kept on failure.

`app/src/features/maintenance-records/maintenance-record-form.tsx`
```ts
      onSubmitAsync: async ({ value }) => {
        // Validation only hands over the schema *input*; parse for the output.
        const payload = maintenanceRecordFormSchema.parse(value)
        try {
          const result = record
            ? await updateMutation.mutateAsync({ id: record.id, ...payload })
            : await createMutation.mutateAsync(payload)
          if (!result.ok) return toFormErrors(result)
          savedRef.current = result.data
          return undefined
        } catch (error) {
          return thrownToFormErrors(error)
        }
      },
```

**Accessibility:** every control has a `<label htmlFor>`. When an error shows,
the control gets `aria-invalid="true"` and `aria-describedby` pointing at the
hint and the error text. Field errors are plain text; only `FormAlert` is
`role="alert"`. `onSubmitInvalid` focuses the first `[aria-invalid="true"]`
one frame later, after React has rendered it. The submit button is disabled
only while `isSubmitting`, never by `canSubmit`, so pressing it always runs
validation and moves focus.

**Unsaved changes:** `useBlocker` blocks navigation (with a Stay / Leave
prompt) while `!form.state.isDefaultValue`. The navigation after a successful
save passes `ignoreBlocker: true`.

**Gotchas:**

- `@tanstack/react-form` is pinned to exactly `1.33.5`. Type changes ship as
  patch releases, and the v2 alpha rewrites the API (validators, field reads,
  `withForm`).
- `isDirty` stays true after the user reverts a value. "Has unsaved changes"
  is `!isDefaultValue`.
- `canSubmit` is true on first render even when fields are invalid, which is
  one more reason not to gate the button on it.
- The form-level `onSubmitAsync` result must include a `fields` key (even
  `{}`). Otherwise form-core stores the whole object as the form error.
- After a save, `form.reset(saved, { keepDefaultValues: true })` plus moving
  the defaults (held in `useState`) to the saved values works around #1798, so
  `isDefaultValue` is true again.

### 8. TanStack Pacer (debounced search)

Pacer controls how often a function runs. Here it debounces the search box: the
input keeps every keystroke in local state, and only the debounced call writes
`q` to the URL. Typing a word causes one navigation and one server request, not
one per character.

`app/src/routes/_authed/maintenance-records/route.tsx`
```ts
  const searchDebouncer = useDebouncer(applySearch, {
    wait: SEARCH_DEBOUNCE_MS,
  })

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(event.target.value)
    searchDebouncer.maybeExecute(event.target.value)
  }
```

`applySearch` follows the same pattern as the status and asset filters:
`startTransition`, reset the scroll container, then
`navigate({ search: (prev) => ({ ...prev, q, page: 0 }) })`. The input also
follows the URL, so back/forward updates the box. The Clear button calls
`searchDebouncer.cancel()` before navigating, so a pending keystroke can't land
after it.

`useDebouncer` is used instead of `useDebouncedCallback` because the callback
hook returns a bare function with no `cancel()`.

On the server, `q` matches description **or** technician. The schema caps it at
100 characters, and `%`, `_` and `\` are escaped so a typed `%` matches itself
instead of every row. Drizzle's `like()` can't express `ESCAPE`, so it's raw
`sql`:

`app/src/features/maintenance-records/maintenance-records.server.ts`
```ts
function matchesText(q: string) {
  const pattern = containsPattern(q)
  return or(
    sql`${maintenanceRecords.description} LIKE ${pattern} ESCAPE '\\'`,
    sql`${maintenanceRecords.technician} LIKE ${pattern} ESCAPE '\\'`,
  )
}
```

A leading-wildcard `LIKE` can't use an index. On the 80k seeded rows it takes
about 15–25 ms for a common term and about 47 ms for a term with no hits (a
full scan). That's fast enough, so there's no FTS5 index. The measurement is
noted under Phase 7 in [`ROADMAP.md`](ROADMAP.md).

### 9. SQL aggregation + Query (dashboard)

`/dashboard` shows total cost and record count, cost per month, cost by
record status and the 10 most expensive assets, over the last 3, 6, 12 or 36
months. Every number is a `GROUP BY` / `SUM` / `COUNT` in SQL (ground rule 4).
The server returns at most 36 + 4 + 10 aggregate rows and never sends
individual records to the browser.

The period is the `months` search param (`?months=36`). Its schema is a closed
set, so a URL can't request an arbitrary window, and the route reuses it for
`validateSearch` and `stripSearchParams`, as the records list does:

`app/src/features/dashboard/dashboard.schemas.ts`
```ts
export const dashboardInputSchema = z.object({
  months: z
    .union([z.literal(3), z.literal(6), z.literal(12), z.literal(36)])
    .default(12),
})
```

All three queries share one window, computed in SQL. The lower bound is what
lets SQLite use `idx_maintenance_performed_at` instead of scanning the table.
`performed_at` is stored as unix seconds, so months are bucketed with
`strftime(..., 'unixepoch')`, which is UTC. Drizzle has no date-bucket helper,
so that part is raw `sql`:

`app/src/features/dashboard/dashboard.server.ts`
```ts
const costSum = sql<number>`sum(${maintenanceRecords.costCents})`.mapWith(
  Number,
)
const monthBucket = sql<string>`strftime('%Y-%m', ${maintenanceRecords.performedAt}, 'unixepoch')`

function inWindow(months: number) {
  const startOffset = `-${months - 1} months`
  return and(
    gte(
      maintenanceRecords.performedAt,
      sql`unixepoch('now', 'start of month', ${startOffset})`,
    ),
    lt(
      maintenanceRecords.performedAt,
      sql`unixepoch('now', 'start of month', '+1 month')`,
    ),
  )
}
```

`Dashboard.costByMonth()` groups by `monthBucket`, then fills months with no
records as zero, so the chart always has exactly `months` bars. That merge
runs over at most 36 aggregate rows, not over records. `costByStatus()`
groups by `status`, and `topAssets()` joins `assets` and groups by
`asset_id`, ordered by `costSum desc` with `limit 10`.

Each panel is its own server function and its own `queryOptions`, keyed
`['dashboard', '<name>', input]` with a 60 s `staleTime`. That way each panel
caches separately and one `['dashboard']` prefix invalidates them all. The
loader prefetches all three with `queryClient.query(...)` (which, unlike
`ensureQueryData`, refetches invalidated data). The component reads them with
`useSuspenseQuery`. Changing the period calls `navigate` inside
`startTransition`, and the panels dim while `isPending`.

The page:

- **Totals:** summed from the at most 4 status rows.
- **Cost over time:** a CSS bar chart with no chart library. Each bar has a
  `title` tooltip, and a visually hidden `<table>` gives screen readers the
  same data.
- **By status:** each row links to `/maintenance-records?status=…`.
- **Top assets:** each name links to `/maintenance-records?assetId=…`, with an
  Edit link to the asset.

On the 80k seeded rows, each server function takes about 27–31 ms over HTTP
for 12 months and 55–68 ms for 36 months (warm). The measurements and query
plan are noted under Phase 8 in [`ROADMAP.md`](ROADMAP.md).

**Gotchas:**

- Drizzle's `sum()` comes back as a string on SQLite. `sql<number>` plus
  `.mapWith(Number)` gives a real number.
- The dashboard is admin-only: all three server functions use `adminOnly`,
  and the route redirects other roles to `/`.

### 10. Auth and roles (Start middleware)

Login sets a session cookie. Each server function reads that cookie and the
`users` row, and checks the role itself (ground rule 3). The route guards
only decide what the UI shows and where it redirects.

**Session.** `useSession` from `@tanstack/react-start/server` stores a sealed
(encrypted and signed) cookie, `ops-session`, with no server-side session
store. It holds only `{ userId, sessionVersion }`, never the role:

`app/src/lib/session.ts`
```ts
  return useSession<AppSession>({
    name: 'ops-session',
    password: sessionSecret(),
    maxAge: 60 * 60 * 8,
    sessionHeader: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    },
  })
```

`getCurrentUser()` (in `auth.middleware.ts`) unseals the cookie and loads the
user by primary key on **every** server-function call. A role change or a
revoked session therefore applies on the next request. The lookup adds about
1 ms per call. It is wrapped in `createServerOnlyFn` so its session and DB
imports stay out of the client bundle.

**Passwords.** Hashed with `node:crypto` scrypt (`scrypt$<salt>$<hash>`) and
compared with `timingSafeEqual`. An unknown email still runs scrypt against a
dummy hash, and both failures return the same "Invalid email or password", so
neither the message nor the timing reveals which emails exist.

**Login / logout.** `sfLogin` clears the session before writing the new one,
which issues a fresh session id. `sfLogout` bumps `users.session_version`, so
every copy of that user's cookie, on any device, stops working. Both
mutations call `queryClient.clear()` on success. The browser keeps one
`QueryClient` for the whole tab, so without that the previous user's cached
rows (with costs) could render for the next user. Login also cleans up the
TanStack DB assets collection, which keeps its own store (see section 11).

**Route guards.** The root route's `beforeLoad` loads the current user
(`authQueries.me()`, 5-minute `staleTime`) into the router context. Then:

- `_authed.tsx` redirects a logged-out visitor to `/login?redirect=<path>`.
- Routes that need a role call `requireRouteRole(context.user, [...])` in
  `beforeLoad`, which redirects to `/`.
- `/login` sends a logged-in user on to `redirect`. `safeRedirect()` only
  accepts same-app paths, so `?redirect=//evil.com` goes to `/`.

| Route | Who |
| --- | --- |
| `/login` | anyone |
| `/`, `/maintenance-records`, `/assets`, `/assets/live` | any logged-in user |
| `/maintenance-records/new`, `/maintenance-records/$id/edit` | admin, technician |
| `/dashboard`, `/assets/new`, `/assets/$id/edit` | admin |

**CSRF.** Start protects server functions from cross-site calls with a default
CSRF middleware, but **only while no `src/start.ts` exists**. Once that file
exists, only the middleware it lists runs, so `start.ts` re-adds it:

`app/src/start.ts`
```ts
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
}))
```

**Gotchas:**

- h3's session cookie sets no `SameSite` by default, and also accepts the
  sealed value from an `x-<name>-session` request header. `session.ts`
  sets `sameSite: 'lax'` and `sessionHeader: false`.
- In route options, `beforeLoad` must come after `params` / `validateSearch`.
  Above them, it breaks type inference for `params.parse`.
- Moving routes into `_authed/` changes their route **ids** (not URLs).
  Any code comparing `routeId` strings has to change too.
- Calling a server function from curl or a script needs
  `origin: http://localhost:3000` and `sec-fetch-site: same-origin` headers,
  or CSRF answers 403.
- There is no login rate limiting or lockout yet.

The role checks, revocation and timings are noted under Phase 9 in
[`ROADMAP.md`](ROADMAP.md).

### 11. TanStack DB (live asset status board)

Phase 10 builds one frequently edited view twice to see what a reactive
collection adds over plain Query. Both boards list every asset with status
count chips (click one to filter) and, for admins, a status `<select>` per
row. They render the same `asset-status-board.tsx` and differ only in the
data layer:

| | `/assets` (Query) | `/assets/live` (TanStack DB) |
| --- | --- | --- |
| Read | `useSuspenseQuery(assetQueries.board())`, `refetchInterval: 5_000` | eager query collection, `refetchInterval: 5_000`, read through `useLiveQuery` |
| Filter + counts | `useMemo` over the array | live queries: `where` + `orderBy`, and `groupBy(status)` + `count()` |
| Status change | `assetMutations.setStatus()`: hand-written snapshot, patch, restore | `collection.update(id, draft => …)`; `onUpdate` calls `sfUpdateAsset` |
| Pending rows | `useMutationState` on `['assets', 'set-status']` | the row's `$hasPendingWrites` |
| SSR | yes, all rows server-rendered | no, `ssr: false` (TanStack DB is client-only) |

Both read `sfListAssetBoard` (any role), which returns `id, name, category,
location, status` for every asset, capped at 1000. Filtering and counting
that array in the browser is a deliberate exception to ground rules 2 and 4.
It's fine for 500 assets and wouldn't be for the 80k records. Writes still go
through the admin-only `sfUpdateAsset`, so the server checks the role either way.

The collection is created once per `QueryClient` and shares its cache:

`app/src/features/assets/assets.collection.ts`
```ts
queryCollectionOptions({
  id: 'assets-board',
  queryKey: ['assets', 'board', 'collection'],
  queryFn: () => sfListAssetBoard(),
  queryClient,
  getKey: (row) => row.id,
  refetchInterval: 5_000,
  onUpdate: async ({ transaction }) => {
    // calls sfUpdateAsset per mutation; throws on a failed result
  },
})
```

Throwing from `onUpdate` rolls the optimistic change back. Resolving triggers
an automatic refetch. The key starts with `'assets'`, so the asset form's
`invalidateQueries({ queryKey: ['assets'] })` refreshes the collection too.

**What the comparison showed** (headless Chromium against the dev server,
details under Phase 10 in [`ROADMAP.md`](ROADMAP.md)):

- Changes from another tab arrive in 2.8–4.7 s on **both** boards. A query
  collection still polls and gets no server push.
- In the same tab, both update the row and the count chip within one frame.
  Both roll back and show "Forbidden" when `sfUpdateAsset` returns 403.
- The DB version replaces ~33 lines of optimistic bookkeeping with a 12-line
  `onUpdate`. It then adds ~30 lines of collection setup and cleanup.

**Gotchas:**

- `queryClient.clear()` doesn't empty a collection. Login calls
  `cleanupAssetsCollection()`. Logout doesn't, because it runs while
  `/assets/live` may still be mounted, and cleaning up under live queries logs
  a Live Query Error.
- A collection's `select` extracts rows. It isn't Query's observer `select`,
  and `placeholderData` isn't supported.

## How it fits together

Loading `/maintenance-records?status=completed&q=bearings&sortBy=performedAt&sortDir=desc`:

0. **Router:** the root `beforeLoad` loads the current user, and
   `_authed.tsx` redirects to `/login` if there isn't one.
1. **Router:** `validateSearch` parses the URL with
   `listMaintenanceRecordsInputSchema` (defaults fill in `page: 0`, `pageSize: 500`).
2. **Router:** `loaderDeps` hands the parsed search to the loader as `filters`.
3. **Query:** the loader calls `queryClient.query(maintenanceRecordQueries.list(filters))`,
   keyed by `['maintenance-records', 'list', filters]`.
4. **Start:** the `queryFn` calls `sfListMaintenanceRecords({ data: filters })`.
5. **Start middleware:** `anyRole` → `authMiddleware` unseals the session
   cookie, loads the user row and checks the role. A viewer's request
   continues with `includeCost: false`.
6. **Start validator:** the same Zod schema parses `filters` again on the server.
7. **Drizzle:** `MaintenanceRecords.list()` runs
   `WHERE status = ? AND (description LIKE ? OR technician LIKE ?) ORDER BY performed_at DESC LIMIT 500 OFFSET 0`
   (selecting `NULL` instead of `cost_cents` for viewers) and a `count()`
   query with the same `WHERE`.
8. **Query:** on SSR the result is dehydrated into the HTML. On the client,
   `useSuspenseQuery` reads it from the cache.
9. **Table:** `useTable` builds the rows and headers from `data.rows` with no client-side sorting.
10. **Virtual:** `useVirtualizer` mounts only the visible rows.

Clicking a header, changing the status or asset dropdown, or paging calls
`navigate`, which updates the URL and starts again at step 1. Typing in the
search box does the same, but only after a 300 ms pause.

Saving an edit in the drawer (`/maintenance-records/42/edit`):

1. **Form:** submit runs the `onDynamic` form schema on the client. If it
   fails, focus moves to the first invalid field and nothing is sent.
2. **Form:** `onSubmitAsync` parses the values to the server shape and calls
   `mutateAsync({ id: 42, ...payload })`.
3. **Query:** `onMutate` snapshots and patches row 42 in every cached list
   page and in the detail entry, so the table behind the drawer updates
   immediately.
4. **Start:** `sfUpdateMaintenanceRecord` runs `technicianOrAdmin` middleware,
   then the Zod validator, then `MaintenanceRecords.update()`.
5. **Server:** checks the asset exists and the row was updated, returning
   `ok(row)` or `fail(...)`.
6. **Query:** on `ok: false` (or a thrown error) the snapshots are restored
   and the errors land on the form. Otherwise `onSettled` invalidates
   `['maintenance-records']` and `['dashboard']`.
7. **Query:** the visible list refetches and puts the row where the server
   sorts it. The form resets to the saved values and the drawer closes.

## Not used yet

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
  [Form](https://tanstack.com/form/latest) ·
  [Pacer](https://tanstack.com/pacer/latest) ·
  [DB](https://tanstack.com/db/latest) ·
  [Drizzle](https://orm.drizzle.team/docs/overview)
