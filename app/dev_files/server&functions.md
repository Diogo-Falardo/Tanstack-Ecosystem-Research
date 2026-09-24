# Create Server and Functions

## Files to modify
- app/src/features/assets/assets.server.ts                               # existing, empty — fill in
- app/src/features/assets/assets.function.ts                             # existing, empty — fill in
- app/src/features/assets/assets.schemas.ts                              # existing, empty — fill in
- app/src/features/assets/assets.types.ts                                # existing, empty — fill in
- app/src/features/maintenance-records/maintenance-records.server.ts     # existing, empty — fill in
- app/src/features/maintenance-records/maintenance-records.function.ts   # existing, empty — fill in
- app/src/features/maintenance-records/maintenance-records.schemas.ts    # existing, empty — fill in
- app/src/features/maintenance-records/maintenance-records.types.ts      # existing, empty — fill in

## Analyze these
- app/src/db/schema.ts

No feature in this repo has server/function code written yet, so there is no existing file to copy — this pair sets the pattern every later feature follows. Split each feature into: `*.server.ts` — a class (`Assets`, `MaintenanceRecords`; PascalCase, plural, matching the file) with static methods holding all Drizzle/business logic, taking explicit args only (no session or cookie reads inside the class); `*.function.ts` — thin `createServerFn` wrappers that validate input, resolve the caller's role, and delegate to exactly on class method each, with no business logic of their own.

## What we currently need

### Assets (table `assets` in app/src/db/schema.ts)

`assets.schemas.ts` / `assets.types.ts`
- Zod schemas derived from the `assets` table (drizzle-zod): a select schema; a create-input schema (select schema minus `id`, `createdAt`); an update-input schema (create-input made partial, plus a required `id`); a list-input schema (`page`, `pageSize`, optional `status`, optional `category` — `status`/`category` are the two indexed, filterable columns on this table).

`assets.server.ts` — `class Assets`
- `(static) get(id: number)` — fetch one row by id; throw if not found.
- `(static) create(data)` — insert one row using the create-input shape; return the created row.
- `(static) update(id: number, data)` — update one row by id using the update-input shape (minus `id`); return the updated row; throw if not found.
- `(static) list(filters)` — the "get all assets" function needs backing logic here: paginated (`LIMIT`/`OFFSET` from `page`/`pageSize`), filterable by `status`/`category` in the `WHERE` clause — no fetch-all-then-slice. Return `{ rows, total }`, with `total` from a `count()` query, not `rows.length`.

`assets.function.ts`
- One `createServerFn` per `Assets` method: `sfGetAsset`, `sfCreateAsset`, `sfUpdateAsset`, `sfListAssets` (this last one is the "get all assets" function). GET method for `sfGetAsset`/`sfListAssets`, POST for `sfCreateAsset`/`sfUpdateAsset`. Each has a `.validator()` matching the corresponding schema.
- ASSUMPTION: every function checks the caller's role before calling into `Assets`, via a stubbed session (no real auth yet — matches `ROADMAP.md` Phase 2, real auth lands in Phase 9). Do not skip the check just because the session is fake.

### Maintenance records (table `maintenance_records` in app/src/db/schema.ts)

`maintenance-records.schemas.ts` / `maintenance-records.types.ts`
- Same shape as assets: select schema; create-input (select schema minus `id`, `createdAt`); update-input (create-input made partial, plus required `id`); list-input (`page`, `pageSize`, optional `status`, optional `assetId` — the two indexed, filterable columns on this table).

`maintenance-records.server.ts` — `class MaintenanceRecords`
- `(static) get(id: number)` — fetch one row by id; throw if not found.
- `(static) create(data)` — insert one row using the create-input shape; return the created row.
- `(static) update(id: number, data)` — update one row by id using the update-input shape (minus `id`); return the updated row; throw if not found.
- `(static) list(filters)` — backing logic for "get all records": paginated, filterable by `status`/`assetId` in the `WHERE` clause — no fetch-all-then-slice. Return `{ rows, total }` via a `count()` query.

`maintenance-records.function.ts`
- One `createServerFn` per `MaintenanceRecords` method: `sfGetMaintenanceRecord`, `sfCreateMaintenanceRecord`, `sfUpdateMaintenanceRecord`, `sfListMaintenanceRecords` (this last one is "get all records"). Same GET/POST split, `.validator()`, and role-check rule as assets.

## Out of scope
- `assets.queries.ts` / `assets.mutations.ts` / `maintenance-records.queries.ts` / `maintenance-records.mutations.ts` — stay empty. TanStack Query wiring is Phase 3, not this pass.
- `delete`/`remove` methods on either class — not requested.
- Real session/auth — `ROADMAP.md` Phase 9 work; this pass only needs the stub check to be present and called.
