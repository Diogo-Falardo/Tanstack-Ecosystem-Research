# README — TanStack Ecosystem Research (how each tool is used, with examples)

Write the repo's root `README.md` (currently empty, 1 byte). We are at the end
of ROADMAP.md Phase 5. The README explains, tool by tool, **what the tool does,
how it's set up in this project, and a real example from this repo**, so a
reader can learn the TanStack ecosystem from the code that's actually here.
Run it through the `/readme` skill: inspect the code first, describe only what
exists.

## Files to modify

- README.md   # existing (empty), repo root — write it

## Analyze these

- CONTEXT.md                     # project purpose, stack, 4 ground rules
- ROADMAP.md                     # phases; 1–5 are built, 6–11 are not
- app/package.json               # scripts + installed versions
- app/drizzle.config.ts, app/src/db/index.ts, app/src/db/schema.ts
- app/scripts/db.init.ts         # seed script (`bun run db:seed`)
- app/src/router.tsx, app/src/routes/__root.tsx
- app/src/middleware/auth.middleware.ts
- app/src/features/maintenance-records/*.ts   # the reference feature (4-file split)
- app/src/features/assets/*.ts                # same split, server side only so far
- app/src/routes/maintenance-records/index.tsx   # Router + Query + Table + Virtual together
- app/dev_files/server&functions.md, tanstack-query.md, tanstack-table.md, tanstack-virtual.md   # the "why" behind each phase

Examples in the README are short excerpts copied from these files (with the
file path above each block), not invented snippets. `docs/*.md` is referenced
by the older dev files but **does not exist in the repo** — do not link it.

## What we currently need

### Top of README
- Project name, 2–3 sentence summary from `CONTEXT.md` (ops console for
  equipment + maintenance history; built to learn TanStack by hitting real
  perf/security failure modes with 50k–100k seeded rows).
- The 4 ground rules from `CONTEXT.md`, condensed to one line each.
- Progress line: Phases 1–5 built (schema/seed, server functions, Query list,
  Table UI, Virtual). ASSUMPTION: ROADMAP checkboxes are still unchecked; state
  progress from the code, don't edit ROADMAP.md.

### Getting started
- Prereqs: Bun (lockfile is `app/bun.lock`), Node types for `tsx`.
- Steps, all from `app/`: `bun install`, create `.env.local` with
  `DATABASE_URL=<sqlite file path>` (read by `drizzle.config.ts` and
  `src/db/index.ts`), `bun run db:migrate` (or `db:push`), `bun run db:seed`,
  `bun run dev` → http://localhost:3000/maintenance-records.
- Table of the other `package.json` scripts (`db:generate`, `db:studio`,
  `generate-routes`, `lint`, `format`, `check`, `build`) with one-line purpose.

### Project structure
- Short tree of `app/src` (db, features, middleware, routes, router.tsx).
- Explain the per-feature file split, using maintenance-records as the example:
  `*.schemas.ts` (Zod, via drizzle-zod), `*.types.ts`, `*.server.ts` (class
  with static DB methods), `*.function.ts` (`createServerFn` + middleware +
  validator), `*.queries.ts` (`queryOptions`), `*.mutations.ts` (empty until
  Phase 6 — say so).
- `#/*` import alias → `app/src/*` (`package.json` `imports`).

### One section per tool in use — each with: what it is · how it's set up here · example · gotcha
Order follows the request path:

1. **Drizzle + SQLite** (not TanStack, but the data layer) — `schema.ts` tables
   and the indexes on filtered/sorted columns (`idx_maintenance_asset_id`,
   `_performed_at`, `_status`); example: `MaintenanceRecords.list()` doing
   `orderBy`/`limit`/`offset` + `count()` in SQL. Link to ground rules 2 and 4.
2. **TanStack Start — server functions + middleware** — example:
   `sfListMaintenanceRecords` (`.middleware([anyRole])`,
   `.validator(listMaintenanceRecordsInputSchema)`, `.handler`), and
   `authMiddleware` / `requireRole` / `anyRole` / `technicianOrAdmin` /
   `adminOnly`. Gotcha: `getCurrentUser()` is a stub returning admin until
   Phase 9 — change the role there to test rejections.
3. **TanStack Router** — file-based routes (`src/routes`, generated
   `routeTree.gen.ts`, don't edit it), typed root context
   (`createRootRouteWithContext<{ queryClient }>`), `Register` declaration in
   `router.tsx`; example from `maintenance-records/index.tsx`:
   `validateSearch` with the Zod schema, `loaderDeps`, `Route.useSearch` /
   `Route.useNavigate` so page/sort/status live in the URL.
4. **TanStack Query** — setup: `QueryClient` created **inside** `getRouter()`
   (per-request on SSR) + `setupRouterSsrQueryIntegration`, no manual
   `QueryClientProvider`; example: `maintenanceRecordQueries.list(filters)`
   with `queryKey: ['maintenance-records', 'list', filters]`, loader prefetch
   (`context.queryClient.query({ ...list(deps.filters), staleTime: 'static' })`
   as currently written), component reads with `useSuspenseQuery`. Gotcha: no
   `placeholderData` with `useSuspenseQuery`.
5. **TanStack Table (v9, `9.2.4`)** — v9 API as used here: `tableFeatures({
   rowSortingFeature, columnSizingFeature })`, `createColumnHelper<typeof
   features, MaintenanceRecord>()`, `useTable({ features, columns, data,
   manualSorting: true, getRowId, state: { sorting }, onSortingChange })`,
   `flexRender`. Key point: no sorted row model — sort clicks become URL
   search params → new server request; Table renders the server slice only.
6. **TanStack Virtual** — `useVirtualizer` in its own
   `MaintenanceRecordsTableBody`, scroll container ref, grid/flex row layout,
   sticky header, `measureElement` (dynamic heights — `description` is
   unbounded text), `overscan: 5`, `getItemKey` by row id, scroll reset on
   sort/filter/page change; `pageSize` cap raised to `.max(2000).default(500)`
   and why that's still a hard server-side bound (not fetch-all).

Each section: ≤ ~25 lines of prose + 1–2 code excerpts. Pull exact option
values from the files at write time; if code differs from this brief, the code
wins.

### How it fits together
- One short walkthrough (numbered list or small ASCII diagram): URL search
  params → `validateSearch` → loader → `queryOptions` → `sfList…` →
  middleware (auth/role) → Zod validator → `MaintenanceRecords.list()` (SQL) →
  `useSuspenseQuery` → Table → Virtual. This is the "examples" payoff — the
  reader should see all tools in one request.

### Not used yet
- One line each for TanStack Form (Phase 6), Pacer (Phase 7), Store / Ranger
  (Phase 11), DB (Phase 10), with the phase they're planned for. No code
  examples for these.

### Further reading
- Link `CONTEXT.md`, `ROADMAP.md`, `app/dev_files/` and the official
  tanstack.com docs per tool.

## Out of scope
- Changing any application code, ROADMAP.md, or CONTEXT.md.
- A separate `app/README.md` (none exists; root README only).
- Documenting planned tools as if implemented.
