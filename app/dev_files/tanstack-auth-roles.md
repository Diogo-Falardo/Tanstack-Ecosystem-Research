# Roles / Security Pass — real auth, route guards, server-function guards (Start middleware)

ROADMAP.md Phase 9. Replace the hard-coded `getCurrentUser()` stub with a real
session-backed user. Every route is guarded by default, and every server
function re-checks the role itself (ground rule #3). Cost is the sensitive
field: viewers never receive it from the server. The UI hides it too, but the
UI check is a convenience, not the protection.

## Files to modify

- app/src/db/schema.ts                                                    # existing, modify (add `users` table)
- app/drizzle/<generated>.sql                                             # create via `bun run db:generate`, then `db:migrate`
- app/scripts/seed-users.ts                                               # create
- app/package.json                                                        # existing, modify (add `db:seed-users` script)
- app/.env.local                                                          # existing, modify (add `SESSION_SECRET`, gitignored)
- app/src/start.ts                                                        # create (CSRF request middleware — see Research findings)
- app/src/lib/session.ts                                                  # create
- app/src/middleware/auth.middleware.ts                                   # existing, modify (real `getCurrentUser`, 401/403 status)
- app/src/features/auth/auth.schemas.ts                                   # create
- app/src/features/auth/auth.types.ts                                     # create
- app/src/features/auth/auth.server.ts                                    # create
- app/src/features/auth/auth.function.ts                                  # create
- app/src/features/auth/auth.queries.ts                                   # create
- app/src/features/auth/auth.mutations.ts                                 # create
- app/src/features/auth/login-form.tsx                                    # create
- app/src/features/maintenance-records/maintenance-records.schemas.ts     # existing, modify (view schema with nullable cost)
- app/src/features/maintenance-records/maintenance-records.types.ts       # existing, modify
- app/src/features/maintenance-records/maintenance-records.server.ts      # existing, modify (`list` takes `includeCost`)
- app/src/features/maintenance-records/maintenance-records.function.ts    # existing, modify (roles, pass `includeCost`)
- app/src/features/dashboard/dashboard.function.ts                        # existing, modify (`adminOnly`, drop the TODO)
- app/src/lib/route-guards.ts                                             # create
- app/src/routes/__root.tsx                                               # existing, modify (`beforeLoad` loads user, TopBar by role, logout)
- app/src/routes/login.tsx                                                # create
- app/src/routes/_authed.tsx                                              # create (pathless layout guard)
- app/src/routes/index.tsx                     → app/src/routes/_authed/index.tsx                      # move (`git mv`)
- app/src/routes/dashboard.tsx                 → app/src/routes/_authed/dashboard.tsx                  # move
- app/src/routes/maintenance-records/*         → app/src/routes/_authed/maintenance-records/*          # move (all 4 files)
- app/src/routes/assets/*                      → app/src/routes/_authed/assets/*                       # move (both files)
- ROADMAP.md                                                              # existing, modify (dated note under Phase 9)

After moving, update every `createFileRoute('...')` string to its new id
(`'/_authed/dashboard'`, `'/_authed/maintenance-records'`, …). URLs and every
`<Link to="...">` stay the same, because `_authed` is pathless.

## Analyze these

- app/src/middleware/auth.middleware.ts
- app/src/features/assets/assets.function.ts
- app/src/features/maintenance-records/maintenance-records.server.ts
- app/src/features/maintenance-records/maintenance-records.mutations.ts
- app/src/features/assets/asset-form.tsx
- app/src/lib/action-result.ts
- app/src/routes/__root.tsx
- app/src/routes/maintenance-records/route.tsx
- app/src/router.tsx
- app/scripts/db.init.ts

Copy the existing feature split for `features/auth/`: a class with static
methods in `auth.server.ts` that takes explicit args (no cookie or session reads
inside the class), thin `createServerFn` wrappers in `auth.function.ts`, and
`queryOptions` / `mutationOptions` factories. Mutating functions return
`ActionResult` for expected failures (bad credentials) and throw only for
auth/validator failures, as `action-result.ts` describes. The login form copies
`asset-form.tsx` (TanStack Form, `FormAlert`, `thrownToFormErrors`). Role
middleware stays the `requireRole([...])` composition already in
`auth.middleware.ts`. Only `getCurrentUser` changes.

## Research findings (installed versions: react-start 1.168.57, react-router 1.170.38, h3 2.0.1-rc.22)

These are verified against `node_modules`. They are the non-obvious parts of
this phase.

- **Adding `src/start.ts` silently drops CSRF protection.** In
  `start-server-core/dist/esm/createStartHandler.js`, when no start instance
  exists, Start applies a default
  `createCsrfMiddleware({ filter: ctx => ctx.handlerType === 'serverFn' })`.
  When `src/start.ts` exists, only *its* `requestMiddleware` runs. So
  `src/start.ts` **must** include that CSRF middleware. Dev prints a warning
  ("server functions are not protected by the CSRF middleware") if it is
  missing. That is also why curl calls need `origin` + `sec-fetch-site:
  same-origin` headers.
- **Sessions:** `useSession(config)` from `@tanstack/react-start/server`
  (h3 underneath). This is a sealed (encrypted + signed) **cookie**. There is
  no server-side session store. Consequences:
  - `password` must be at least 32 chars (h3 seal `minPasswordlength`).
  - Default cookie is `{ path: '/', secure: true, httpOnly: true }`, with **no
    `sameSite`**. Set `sameSite: 'lax'` explicitly.
  - By default h3 also accepts the sealed session from an `x-<name>-session`
    **request header**. Set `sessionHeader: false` so the cookie is the only
    carrier.
  - Logout only deletes the browser's cookie. A copied cookie stays valid
    until `maxAge`. Revocation needs server state, which is why `users` gets
    `sessionVersion` (below).
  - `session.clear()` followed by `session.update(...)` issues a new session
    id. Do that on login (session fixation).
- **Role in the session = stale role.** If the session stored `role`, a
  demoted user would keep the old role until the cookie expired. Store only
  `{ userId, sessionVersion }` and load the user row on every server-function
  call. This is a primary-key lookup, cheap at this scale. Measure it for the
  ROADMAP note.
- **`beforeLoad` is not a security boundary.** It runs on the client during
  client navigation, so it is UX only. Server functions run their own
  middleware even when called directly during SSR, so the function-level
  guard is what actually protects data.
- **Client cache crosses users.** The `QueryClient` in `router.tsx` is
  created per request on the server, but it lives for the whole tab on the
  client. Without `queryClient.clear()` on login/logout, an admin's cached
  list (with costs) would render for the next viewer who logs in on that tab.
- No password-hashing dependency is installed. Use `node:crypto`
  `scrypt` + `randomBytes` + `timingSafeEqual`. No new package is needed.

## What we currently need

### Role matrix (the whole phase in one table)

| Server function | Today | Phase 9 |
|---|---|---|
| `sfListMaintenanceRecords` | `anyRole` | `anyRole`. `costCents` is `null` unless role is admin/technician |
| `sfGetMaintenanceRecord` | `anyRole` | `technicianOrAdmin` (only the edit drawer reads it) |
| `sfCreate/UpdateMaintenanceRecord` | `technicianOrAdmin` | unchanged |
| `sfGetAsset`, `sfListAssets`, `sfListAssetOptions` | `anyRole` | unchanged (no sensitive fields) |
| `sfCreate/UpdateAsset` | `adminOnly` | unchanged |
| `sfDashboardCostByMonth/ByStatus/TopAssets` | `anyRole` + TODO | `adminOnly`, TODO removed |
| `sfLogin`, `sfGetCurrentUser` | — | no auth middleware (public) |
| `sfLogout` | — | no role middleware. Clearing an absent session is a no-op |

| Route | Guard |
|---|---|
| `/login` | public. If already logged in, redirect to `/` |
| `/`, `/maintenance-records` | any logged-in user (from `_authed`) |
| `/maintenance-records/new`, `/maintenance-records/$id/edit` | admin, technician |
| `/assets/new`, `/assets/$id/edit`, `/dashboard` | admin |

ASSUMPTION: technicians see costs (they enter them in the record form). The
dashboard's cost totals are admin-only. Technicians can edit any record, not
just their own. Row ownership is out of scope (the `technician` column is
free text, not a user FK).

### Schema — `users` table in `db/schema.ts`

- `users`: `id` (int PK autoincrement), `email` (text, not null, **unique
  index** `idx_users_email`), `name` (text, not null), `passwordHash` (text,
  `password_hash`, not null), `role` (text enum `['admin','technician','viewer']`,
  not null, default `'viewer'`), `sessionVersion` (integer `session_version`,
  not null, default 0), `createdAt` (same as other tables).
- Derive `Role` from this column (`(typeof users.$inferSelect)['role']`) and
  re-export it from `auth.middleware.ts`, so there is one source of truth.
- Generate a migration with `bun run db:generate` and apply it with
  `bun run db:migrate`. A `drizzle/` folder already exists, so don't use `push`.

### Users seed — `scripts/seed-users.ts` + `db:seed-users` script

- Separate from `db.init.ts`, so the 80k records aren't wiped and re-seeded.
  Copy its `dotenv` / `better-sqlite3` / drizzle setup.
- Upsert by email (`onConflictDoUpdate`): `admin@example.com` (admin),
  `tech@example.com` (technician), `viewer@example.com` (viewer). Use the
  password `SEED_USER_PASSWORD` from env, falling back to `password123`.
  Print the three logins. ASSUMPTION: a fixed dev password is fine for a
  research DB.
- Hash with the same `hashPassword` exported from `auth.server.ts`. The seed
  is plain Node (`tsx`). Use a relative import like `db.init.ts` does.

### Session — `src/lib/session.ts`

- `type AppSession = { userId: number; sessionVersion: number }`.
- `useAppSession()` returns `useSession<AppSession>({ name: 'ops-session', password: SESSION_SECRET, maxAge: 60 * 60 * 8, sessionHeader: false, cookie: { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production' } })`.
- Read `SESSION_SECRET` from `process.env` (like `DATABASE_URL` in `db/index.ts`).
  Throw at call time if it is missing or shorter than 32 chars. Add a random
  64-char value to `.env.local`.
- Server-only. It is imported only from `auth.middleware.ts` and
  `auth.function.ts` handler bodies.

### CSRF — `src/start.ts` (create)

- `export const startInstance = createStart(() => ({ requestMiddleware: [createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === 'serverFn' })] }))`,
  importing both from `@tanstack/react-start`. Add a comment saying this line
  replaces Start's implicit default and must not be removed.
- No `functionMiddleware` here. Each server function keeps its explicit role
  middleware, so the guard is visible at the definition.

### Server — `auth.server.ts`, `class Auth`

- `export async function hashPassword(password): Promise<string>`: scrypt
  with a 16-byte random salt, stored as `scrypt$<saltHex>$<hashHex>`.
- `static async verifyCredentials(email, password): Promise<CurrentUser | null>`:
  look up by lowercased email. If there is no user, still run a scrypt
  against a fixed dummy hash, so response time doesn't reveal which emails
  exist. Compare with `timingSafeEqual`. Return `{ id, name, email, role, sessionVersion }`
  or `null`. Never return `passwordHash`.
- `static async getSessionUser(userId, sessionVersion): Promise<CurrentUser | null>`:
  a primary-key select of the same columns. Return `null` if the row is
  missing or `sessionVersion` doesn't match.
- `static async revokeSessions(userId): Promise<void>`: increment
  `sessionVersion`.
- `CurrentUser` grows to `{ id, name, email, role, sessionVersion }` (type in
  `auth.types.ts`). The client-facing shape omits `sessionVersion` (see
  `sfGetCurrentUser`).

### Middleware — `auth.middleware.ts`

- `getCurrentUser()`: `useAppSession()`. If there is no `data.userId`,
  return `null`. Otherwise return `Auth.getSessionUser(userId, sessionVersion)`.
  Remove the stub and its TODO.
- `authMiddleware`: on `null`, call `setResponseStatus(401)` (from
  `@tanstack/react-start/server`) and then `throw new Error('Unauthorized')`.
- `requireRole`: on a role miss, call `setResponseStatus(403)` and then
  `throw new Error('Forbidden')`.
- Keep `anyRole` / `technicianOrAdmin` / `adminOnly` exports and the
  `context.user` shape, so handlers can read `context.user.role`.

### Auth functions — `auth.function.ts`, schemas, types

- `loginInputSchema = z.object({ email: z.email().trim().toLowerCase().max(254), password: z.string().min(1).max(200) })`.
  Bound the password so scrypt can't be fed huge strings.
- `sfLogin` (POST, `.validator(loginInputSchema)`, no auth middleware):
  `Auth.verifyCredentials`. On `null`, return
  `fail({ formError: 'Invalid email or password' })`, the same message for
  both cases. On success: `session.clear()`, then
  `session.update({ userId, sessionVersion })`, then return
  `ok(publicUser)`.
- `sfLogout` (POST, no validator, no role middleware): if there is a
  session, `Auth.revokeSessions(userId)` (kills copied cookies too), then
  `session.clear()`. Return `ok(null)`.
  ASSUMPTION: logout signs out all of that user's devices. That is the price
  of revocation with sealed cookies.
- `sfGetCurrentUser` (GET, no middleware): `getCurrentUser()` mapped to
  `PublicUser = { id, name, email, role }` or `null`. It never throws for
  anonymous.
- Types: `LoginInput`, `PublicUser`, `LoginResult = ActionResult<PublicUser>`.

### Queries / mutations — `auth.queries.ts`, `auth.mutations.ts`

- `authQueries.me()`: key `['auth', 'me']`, `queryFn: () => sfGetCurrentUser()`,
  `staleTime: 5 * 60_000`. This is UI only. The server re-checks every call.
- `authMutations.login()` / `.logout()`: keys `['auth', 'login']` /
  `['auth', 'logout']`. In `onSuccess` (only when `data.ok`), call
  `client.clear()`, so no previous user's cached rows survive. Router
  navigation and `router.invalidate()` happen in the UI (see login route,
  TopBar), as in the existing "cache work here, UI work in the form" split.

### Login — `routes/login.tsx` + `features/auth/login-form.tsx`

- `validateSearch: z.object({ redirect: z.string().optional() })`.
- `beforeLoad`: if `context.user`, throw `redirect({ to: safeRedirect(search.redirect) })`.
- `safeRedirect(value)` lives in `lib/route-guards.ts`. It accepts only paths
  that start with `/` and not `//` or `/\`, and otherwise returns `'/'`. This
  prevents an open redirect.
- `LoginForm`: email + password (`type="password"`, `autoComplete`). Submit
  calls `authMutations.login()`. A `fail` maps to `toFormErrors`, and a thrown
  error maps to `thrownToFormErrors`. On success the route does
  `await router.invalidate()` and then
  `navigate({ to: safeRedirect(search.redirect) })`.
- A small hint under the form lists the three seeded emails. ASSUMPTION:
  it's a research app.

### Route guards — `routes/__root.tsx`, `routes/_authed.tsx`, `lib/route-guards.ts`

- Root `beforeLoad: async ({ context }) => ({ user: await context.queryClient.query(authQueries.me()) })`.
  Every route's context now has `user: PublicUser | null`. Keep
  `createRootRouteWithContext<{ queryClient: QueryClient }>()`.
- `_authed.tsx`: pathless layout, `beforeLoad({ context, location })`. If
  `!context.user`, throw `redirect({ to: '/login', search: { redirect: location.href } })`.
  Otherwise return `{ user: context.user }`, narrowed to non-null for
  children. The component renders `<Outlet />`. Every new route placed under
  `_authed/` is guarded by default. That is the point of the layout.
- `lib/route-guards.ts`: `requireRouteRole(user, roles)` throws
  `redirect({ to: '/' })` when the role is not allowed.
  ASSUMPTION: redirect home rather than show a 403 page. Call it in
  `beforeLoad` of `_authed/dashboard.tsx` and `_authed/assets/*` (admin),
  and `_authed/maintenance-records/new.tsx` / `$id.edit.tsx` (admin,
  technician). Use the same role lists as the server matrix.

### Records — cost redaction for viewers

- `maintenance-records.schemas.ts`: add
  `maintenanceRecordRowSchema = selectMaintenanceRecordSchema.extend({ costCents: z.number().int().nullable() })`.
  `types.ts`: add `MaintenanceRecordRow`. `ListMaintenanceRecordsResult.rows`
  becomes `MaintenanceRecordRow[]`. `get` keeps returning the full
  `MaintenanceRecord`, because it is technician/admin only now.
- `MaintenanceRecords.list(filters, { includeCost }: { includeCost: boolean })`:
  select explicit columns, with
  `costCents: includeCost ? maintenanceRecords.costCents : sql<null>\`null\``,
  so the value never leaves SQLite for viewers. Parse with
  `maintenanceRecordRowSchema`. The class still takes no session. The role
  arrives as an arg.
- `sfListMaintenanceRecords`: `.handler(({ data, context }) => MaintenanceRecords.list(data, { includeCost: context.user.role !== 'viewer' }))`.
- `maintenance-records.mutations.ts`: the optimistic `{ ...row, ...vars }`
  patch must still type-check against the new row type. Adjust types only,
  with no behavior change.
- `_authed/maintenance-records/route.tsx`: for viewers, drop the `costCents`
  column from the column list. Memoize on `role`. Read the user with
  `Route.useRouteContext()`. Also hide the "New record" link (line ~297) and
  the row "Edit" link (line ~117) for viewers.

### UI by role — `__root.tsx` TopBar, `_authed/index.tsx`

- TopBar reads the user from the root route context. If the shell component
  can't read it, move TopBar into a root `component` that renders
  `<TopBar /><Outlet />`. Show "Dashboard" and "New asset" only to admins.
  Show the user's name + role and a "Log out" button when logged in. Logout
  calls `authMutations.logout()`, then `await router.invalidate()`, then
  `navigate({ to: '/login' })`.
- `_authed/index.tsx`: hide the shortcuts to `/maintenance-records/new`,
  `/assets/new`, and the edit links for roles that can't use them. Use the
  same matrix.

### ROADMAP note (Phase 9)

Add a dated note covering:
- A curl run per role against the real server functions (log in through
  `sfLogin` with the cookie jar, plus `origin` / `sec-fetch-site` headers):
  viewer → dashboard fns **403**, viewer list → `costCents: null`,
  technician → `sfCreateAsset` **403**, no cookie → **401**, and a
  cross-site `sec-fetch-site: cross-site` POST → **403** from CSRF.
- A copied cookie still works after the user logs out on another device →
  it should **not** (`sessionVersion`).
- The per-call cost of the user lookup (time `sfListMaintenanceRecords`
  before and after).
- The `src/start.ts` CSRF gotcha above.

## Out of scope

- User management UI (create users, change roles). The seed script is enough.
- Sign-up, password reset, email verification, OAuth/third-party auth
  libraries.
- Login rate limiting / lockout. Mention it in the ROADMAP note as the next
  gap.
- Row-level ownership (technicians editing only "their" records).
- Server-side session store (sealed cookie + `sessionVersion` only).
- Global `functionMiddleware` in `start.ts`.
- README changes (separate `readme.md` brief).
- TanStack DB / Store / Ranger (Phases 10–11).
