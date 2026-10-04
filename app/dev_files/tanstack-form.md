# Forms — Maintenance Records + Assets (TanStack Form)

ROADMAP.md Phase 6. Adds create/edit forms on `@tanstack/react-form` v1,
wired to the existing JSON server functions through TanStack Query mutations.
The approach is "pessimistic correctness, optimistic presentation": the server
validator plus a returned error contract are the source of truth, edits patch
rows already on screen, and creates show as ghost rows until the refetch puts
them in place. The maintenance-record forms open in a **drawer over the list**
so the optimistic UI is actually visible. Asset forms are simple full pages.
Finish by updating `README.md`.

## Read first (required, before writing any code)

- reports/Phase 6 TanStack Form.md   # the synthesized decisions; this brief follows it
- research_notes/Phase 6 TanStack Form/form_core_api.md
- research_notes/Phase 6 TanStack Form/start_server_validation.md
- research_notes/Phase 6 TanStack Form/optimistic_mutations.md
- research_notes/Phase 6 TanStack Form/ux_a11y_testing_comparison.md

Where a note and the report disagree, **the report wins** (e.g. use
`invalidateQueries`, not `router.invalidate()`). The report's "Claims the notes
could not verify" table lists what to check while implementing. Several items
below point to it.

## Files to modify

- app/package.json                                                       # existing — add `@tanstack/react-form` pinned exactly `1.33.5`
- app/src/components/form/form-context.ts                               # create — createFormHookContexts()
- app/src/components/form/form-kit.tsx                                  # create — createFormHook → useAppForm, withForm
- app/src/components/form/should-show-error.ts                          # create — single error-timing helper
- app/src/components/form/text-field.tsx                                # create
- app/src/components/form/textarea-field.tsx                            # create
- app/src/components/form/number-field.tsx                              # create
- app/src/components/form/date-field.tsx                                # create
- app/src/components/form/select-field.tsx                              # create
- app/src/components/form/field-error.tsx                               # create
- app/src/components/form/form-alert.tsx                                # create — role="alert" submit/server error
- app/src/components/form/submit-button.tsx                             # create
- app/src/lib/action-result.ts                                          # create — shared result union type + helpers
- app/src/features/maintenance-records/maintenance-records.schemas.ts   # existing — refinements + form schema
- app/src/features/maintenance-records/maintenance-records.types.ts     # existing — form/result types
- app/src/features/maintenance-records/maintenance-records.server.ts    # existing — return result union, asset existence check
- app/src/features/maintenance-records/maintenance-records.function.ts  # existing — create/update return result union
- app/src/features/maintenance-records/maintenance-records.queries.ts   # existing — add `detail(id)`
- app/src/features/maintenance-records/maintenance-records.mutations.ts # existing, empty — fill in
- app/src/features/maintenance-records/maintenance-record-form.tsx      # create — shared create/edit form component
- app/src/features/assets/assets.schemas.ts                             # existing — refinements + form schema
- app/src/features/assets/assets.types.ts                               # existing
- app/src/features/assets/assets.server.ts                              # existing — return result union, add `options()`
- app/src/features/assets/assets.function.ts                            # existing — result union + `sfListAssetOptions`
- app/src/features/assets/assets.queries.ts                             # existing, empty — `detail(id)`, `options()`
- app/src/features/assets/assets.mutations.ts                           # existing, empty — fill in
- app/src/features/assets/asset-form.tsx                                # create
- app/src/routes/maintenance-records/route.tsx                          # create — list moves here (layout + <Outlet/> drawer)
- app/src/routes/maintenance-records/index.tsx                          # existing — reduce to an empty index route
- app/src/routes/maintenance-records/new.tsx                            # create — create drawer
- app/src/routes/maintenance-records/$id.edit.tsx                       # create — edit drawer
- app/src/routes/assets/new.tsx                                         # create
- app/src/routes/assets/$id.edit.tsx                                    # create
- README.md                                                             # existing — document Phase 6 (see last section)

## Analyze these

- app/src/routes/maintenance-records/index.tsx      # current list: validateSearch, loader, Table, Virtual
- app/src/features/maintenance-records/*.ts          # four-file split to extend
- app/src/features/assets/*.ts
- app/src/middleware/auth.middleware.ts              # technicianOrAdmin (records), adminOnly (assets)
- app/src/db/schema.ts, app/src/db/index.ts          # column types; no `PRAGMA foreign_keys` set → SQLite FKs are NOT enforced
- app/scripts/db.init.ts                             # 500 assets seeded
- app/src/router.tsx                                 # QueryClient per request
- README.md

Pattern: keep the four-file split (`*.server.ts` class with static DB methods,
`*.function.ts` = `createServerFn` + middleware + `.validator(zodSchema)`,
`*.queries.ts` / `*.mutations.ts` = Query options objects). Feature forms only
use `form.AppField` + `<field.TextField/>` etc. Only the field-kit components
in `components/form/` read `field.state.*`, so the v2 migration stays inside
the kit (report: "Version 1.33.5 is the target"). Use the `/tanstack-form`
skill for the kit and form components, and `/tanstack-backend` for the
server/function/queries/mutations files.

## What we currently need

### 0. Loader freshness fix (do this first)

- In the list loader (`index.tsx` today, `route.tsx` after the move), change
  `staleTime: 'static'` to `staleTime: 30_000`. `'static'` makes
  `invalidateQueries` a no-op for the loader, so every post-save refresh would
  look broken (report: "Invalidate the query, and stop the loader from pinning
  it static"). Confirm against the installed `@tanstack/query-core` after
  `bun install`. The report checked `main`, not the installed version.

### 1. Dependency

- `bun add @tanstack/react-form@1.33.5`, pinned exactly with no caret (type
  changes ship as patches). Do **not** add `@tanstack/react-form-start`. It
  targets a FormData/cookie/302 flow this app doesn't use.

### 2. Shared result contract — `app/src/lib/action-result.ts`

- `type ActionResult<T> = { ok: true; data: T } | { ok: false; formError?: string; fieldErrors?: Partial<Record<string, string>> }`.
- Helpers `ok(data)` and `fail({ formError?, fieldErrors? })`.
- Expected domain failures are **returned**. Auth failures (middleware
  `Unauthorized`/`Forbidden`) and Zod validator failures still **throw**. The
  client treats a thrown error's `message` as a form-level error (only
  `message` is guaranteed to reach the client).

### 3. Schemas

`maintenance-records.schemas.ts`:
- Move refinements into the drizzle-zod `createInsertSchema(maintenanceRecords, { ... })`
  callback so client and server share the messages: `description` and
  `technician` `.trim().min(1)`, `costCents` `.int().nonnegative()`,
  `assetId` `.int().positive()`.
- `createMaintenanceRecordSchema` / `updateMaintenanceRecordSchema` keep
  `.omit({ id, createdAt })` (mass-assignment guard). Don't add server-owned
  columns.
- Add `maintenanceRecordFormSchema`, whose **input** type is the form values:
  `assetId: number | null` (required, positive int; null fails with "Choose an
  asset"), `description`, `technician`, `status` (enum), `performedAt` as a
  `YYYY-MM-DD` string, `cost` in **dollars** as a non-negative number with at
  most 2 decimals. Its output transforms to the server shape:
  `performedAt → Date`, `costCents = Math.round(cost * 100)`.
- `maintenance-records.types.ts`: `MaintenanceRecordFormValues = z.input<typeof maintenanceRecordFormSchema>`.
  Form `defaultValues` are typed with this (v1 infers form types from
  `defaultValues`, not the schema).

`assets.schemas.ts`: same treatment. Refinements `name`, `category`,
`location` `.trim().min(1)`. `assetFormSchema` input = `{ name, category, location, status }`.
No transforms are needed.

ASSUMPTION: `Date` survives Start's serializer as the `performedAt` input. This
is unverified (report table). Verify with one manual create. If it arrives as a
string, switch the server-side insert schema to drizzle-zod
`createSchemaFactory({ coerce: { date: true } })` and send an ISO string.

### 4. Server classes + functions

`MaintenanceRecords` (`*.server.ts`):
- `create(data)` → `Promise<ActionResult<MaintenanceRecord>>`: first check the
  asset exists (`select id from assets where id = ?`). If missing, return
  `fail({ fieldErrors: { assetId: 'Asset not found' } })`. This check is
  needed because SQLite FKs aren't enforced here. Then insert and return `ok(row)`.
- `update(id, data)` → `ActionResult`: if `data.assetId` is present, run the
  same asset check. If no row was updated, return
  `fail({ formError: 'This record no longer exists' })` instead of throwing.
- `get` and `list` stay unchanged and keep throwing.

`Assets` (`assets.server.ts`):
- `create` / `update` return `ActionResult<Asset>`. `update` returns
  `fail({ formError: 'This asset no longer exists' })` when no row is found.
- New `options()` → `Promise<{ id: number; name: string }[]>`: selects only
  `id, name`, ordered by `name`, with a hard `.limit(1000)`. This feeds the
  asset `<select>` in the record form. `listAssetsInputSchema` caps at 100, and
  there are 500 assets. ASSUMPTION: a plain select over ≤1000 options is fine
  for Phase 6. A searchable combobox belongs to Phase 7 (Pacer).

`*.function.ts`:
- `sfCreate*` / `sfUpdate*` keep their middleware (`technicianOrAdmin` for
  records, `adminOnly` for assets) and `.validator(...)`, and return the
  class's `ActionResult`.
- Add `sfListAssetOptions` (`GET`, `anyRole`, no input) → `Assets.options()`.

### 5. Queries

- `maintenanceRecordQueries.detail(id: number)`: `queryKey: ['maintenance-records', 'detail', id]`,
  `queryFn: () => sfGetMaintenanceRecord({ data: id })`.
- `assetQueries.detail(id)`: `['assets', 'detail', id]` → `sfGetAsset`.
- `assetQueries.options()`: `['assets', 'options']` → `sfListAssetOptions()`,
  `staleTime: 5 * 60_000`.

### 6. Mutations (`*.mutations.ts`)

Export plain option objects built with `mutationOptions`. Use the v5 callback
`context.client` (no `useQueryClient` in this file). Cache work lives here.
UI work (alerts, reset, navigate) lives in the form. Each `mutationFn` returns
the server's `ActionResult`.

`maintenanceRecordMutations.create()`:
- `mutationKey: ['maintenance-records', 'create']`
- `onSettled`: **return** `client.invalidateQueries({ queryKey: ['maintenance-records'] })`
  so the mutation stays pending through the refetch.
- No `setQueryData` into list pages. The client can't know where a new row
  lands in a server-sorted, paginated list.

`maintenanceRecordMutations.update()`:
- `mutationKey: ['maintenance-records', 'update']`
- `onMutate(vars)`: `cancelQueries(['maintenance-records'])`, snapshot
  `getQueriesData(['maintenance-records', 'list'])` and the `detail` entry
  for `vars.id`. Patch with `setQueriesData` by mapping each page's `rows` and
  replacing the row whose `id === vars.id`, merging `vars`. Patch the detail
  entry too. Return `{ snapshots }`.
- Rollback restores every snapshot. It runs in `onError` **and** in `onSuccess`
  when `data.ok === false`, because a returned failure doesn't trigger
  `onError`.
- `onSettled`: invalidate `['maintenance-records']` only when
  `client.isMutating({ mutationKey: ['maintenance-records', 'update'] }) === 1`
  (avoids flicker with concurrent edits). Return the promise.
- Don't move rows between pages client-side when `status`/`performedAt`
  (sortable columns) change. Let the refetch place them.

`assetMutations.create()` / `update()`: no optimism. `onSettled` returns
`client.invalidateQueries({ queryKey: ['assets'] })`.

### 7. Field kit — `app/src/components/form/`

- `form-context.ts`: `export const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts()`.
- `form-kit.tsx`: `createFormHook({ fieldContext, formContext, fieldComponents: { TextField, TextareaField, NumberField, DateField, SelectField }, formComponents: { SubmitButton, FormAlert } })`.
  Export `useAppForm` and `withForm`.
- `should-show-error.ts`: `shouldShowError(meta, submissionAttempts)` returns
  `!meta.isValid && (meta.isBlurred || submissionAttempts > 0)`. This is the
  single error-timing policy. Don't use shadcn's `isTouched` gate (it shows
  errors while the user is still typing).
- Every field component, read via `useFieldContext<T>()`:
  - takes props `label` and optional `hint`; renders `<label htmlFor>` +
    control with `id` from `field.name`
  - sets `value`, `onChange` → `field.handleChange`, `onBlur` → `field.handleBlur`
  - when `shouldShowError` is true: sets `aria-invalid="true"` on the focusable
    element, and `aria-describedby` points to both the hint id and the error id
  - renders `<FieldError>` (plain text, **not** `role="alert"`)
  - Subscribe with selectors only. Never subscribe to the whole store.
- `NumberField` maps empty input to `null`/`undefined` rather than `0`.
  `SelectField` takes `options: { value, label }[]` plus an optional empty
  placeholder option, and maps `''` → `null` for the asset select.
  `DateField` is `<input type="date">` holding the `YYYY-MM-DD` string.
- `FormAlert`: `role="alert"`. Renders the form-level error from
  `form.state.errorMap` (subscribed via selector).
- `SubmitButton`: label prop. `disabled` **only** while `isSubmitting`, never
  `!canSubmit`. Submitting with errors runs validation and moves focus.
- Styling: plain Tailwind classes matching the current list page (`p-2`,
  `mt-4`, etc.). The repo has no shadcn. Don't add a component library.

### 8. Form behavior (both feature forms)

- `useAppForm({ defaultValues, validationLogic: revalidateLogic(), validators: { onDynamic: <formSchema> }, ... })`.
  Validation runs on submit first, then live after the first submit. Don't use
  a form-level `onChange` schema (it re-renders every field on every keystroke,
  issue #1625).
- Server errors use the documented form-level `onSubmitAsync` route: call
  `mutateAsync(parsedOutput)`. On `ok: false`, return
  `{ form: formError, fields: fieldErrors }` so the errors land on the fields
  and in `FormAlert`. Catch a thrown error and return `{ form: error.message }`.
  On `ok: true`, keep the saved entity for `onSubmit`. Inside it, call
  `formSchema.parse(value)` to get the output (validation hands over the input
  only). ASSUMPTION: if `onSubmitAsync` doesn't cover a case in practice, call
  the mutation from `onSubmit` with try/catch and set the errors there. Keep
  the behavior identical: user input is preserved and errors are shown.
- `onSubmitInvalid`: focus `document.querySelector('[aria-invalid="true"]')`
  inside the form. Verify it works when untouched fields fail (report table
  item).
- After a successful save: `form.reset(savedValues, { keepDefaultValues: true })`
  (workaround for #1798), then navigate (see routes).
- Unsaved-changes guard: `useBlocker({ shouldBlockFn, withResolver: true, enableBeforeUnload })`
  fed by `!form.state.isDefaultValue` (not `isDirty`, which stays true after
  the user reverts a value). Bypass it for the navigation after a successful
  save. With `withResolver`, render a small confirm (Stay / Leave).
- Edit forms: memoize `defaultValues` (`useMemo` on the record), and the parent
  renders `<Form key={record.id} />` so switching records never keeps stale
  edits.

`maintenance-record-form.tsx`: one component for create + edit (props:
`mode`, optional `record`). Fields: Asset (SelectField from
`assetQueries.options()`), Description (Textarea), Technician (Text), Status
(Select of the 4 enum values), Performed at (Date), Cost in dollars (Number,
displayed as `costCents / 100` on edit). Create defaults: `assetId: null`,
`status: 'scheduled'`, `performedAt` = today, everything else empty.

`asset-form.tsx`: Name, Category, Location (Text), Status (Select of the 4
asset statuses).

### 9. Routes

Maintenance records (drawer over the list):
- `route.tsx` (`createFileRoute('/maintenance-records')`): move **everything**
  from today's `index.tsx` here unchanged (validateSearch, loaderDeps, loader
  with the §0 fix, Table, Virtual, Prev/Next), plus:
  - a "New record" `<Link to="/maintenance-records/new">` that keeps the
    current search params
  - an "Edit" link cell (new display column, `size` set) to
    `/maintenance-records/$id/edit`, also keeping the search params
  - `<Outlet/>` rendered as a right-side drawer panel next to the table
    container. Only render the panel when a child route other than the index
    is matched.
  - ghost rows: `useMutationState({ filters: { mutationKey: ['maintenance-records', 'create'], status: 'pending' }, select: (m) => m.state.variables })`,
    rendered above the virtualized body at reduced opacity. Pass them in a way
    that doesn't break the virtualizer's `getItemKey` (e.g. render them
    outside the virtualized `<tbody>` list, or give them stable keys like
    `ghost-<submittedAt>`).
- `index.tsx`: reduce to `createFileRoute('/maintenance-records/')({ component: () => null })`.
- `new.tsx`: renders `<MaintenanceRecordForm mode="create" />`. Its loader
  prefetches `assetQueries.options()`. On success, navigate to
  `/maintenance-records` with search `{ ...prev, page: 0 }` (closes the drawer).
- `$id.edit.tsx`: parse `$id` as a positive int. The loader calls
  `ensureQueryData(maintenanceRecordQueries.detail(id))` + asset options.
  The component reads with `useSuspenseQuery` and renders
  `<MaintenanceRecordForm key={record.id} mode="edit" record={record} />`.
  On success, navigate back to `/maintenance-records` keeping the search
  params. Close/cancel does the same (through the blocker).
- Run `bun run generate-routes` (or the dev server) so `routeTree.gen.ts`
  regenerates. Don't hand-edit it.

Assets (full pages):
- `assets/new.tsx`: `<AssetForm mode="create" />`. On success, navigate to
  `/assets/$id/edit` for the created id.
- `assets/$id.edit.tsx`: loader `ensureQueryData(assetQueries.detail(id))`,
  then `<AssetForm key={asset.id} ... />`. On success, stay on the page with
  the reset form.
- ASSUMPTION: no assets list route this phase. Reach these pages via URL. A
  `/` home link to `/assets/new` is fine.

### 10. README.md (after the code works)

Update the root `README.md` to match. Excerpts must be copied from the new
code, like the rest of the README:
- **Getting started / Project structure**: add `src/components/form/` and
  `src/lib/`. Note that `*.mutations.ts` is now filled in, and add the new
  routes to the tree.
- **4. TanStack Query**: replace the `staleTime: 'static'` sentence with the
  new `30_000` and one line on why (`'static'` ignores `invalidateQueries`).
  Add a short mutations subsection: `mutationOptions` + `context.client`,
  edit = cache patch with rollback (including the `ok: false` rollback),
  create = ghost rows via `useMutationState` + invalidate.
- **New section "7. TanStack Form"** in the same shape as the others (what it
  is · how it's set up here · example · gotcha): the field kit
  (`createFormHookContexts` / `createFormHook` / `useAppForm`),
  `revalidateLogic` + `onDynamic`, `z.input` defaults + `schema.parse` in
  submit, the dollars→cents / date / `assetId: null` conversion, the
  `ActionResult` contract and `onSubmitAsync` mapping, and accessibility
  (`aria-invalid`, `aria-describedby`, focus first invalid, button not
  disabled by `canSubmit`). Gotchas: pinned `1.33.5` (v2 alpha rewrites the
  API), `isDirty` vs `isDefaultValue`, `canSubmit` true on first render.
- **2. Start**: add one line saying the validator runs on the server, so it is
  the security gate, and that create/update now return `ActionResult`.
- **How it fits together**: add a second short walkthrough for an edit save:
  form submit → client `onDynamic` → `mutateAsync` → `onMutate` patch →
  `sfUpdateMaintenanceRecord` (middleware → validator → `MaintenanceRecords.update`)
  → `ok`/`fail` → rollback or invalidate → refetch.
- **Not used yet**: remove the TanStack Form line. Add Form to the Further
  reading docs links.
- Progress line: Phases 1–6 built.

## Out of scope

- `@tanstack/react-form-start`, FormData / no-JS progressive enhancement.
- TanStack Form v2 alpha, `withFieldGroup`/FormGroup steppers, array fields.
- Status-transition rules (e.g. completed → scheduled) and deriving
  `technician` from the session. These are listed in the report as candidates
  for later and need product decisions plus a user name in `CurrentUser`
  (Phase 9).
- Enabling `PRAGMA foreign_keys` / a DB migration. The explicit asset check
  covers Phase 6.
- Searchable asset combobox, debounced input (Phase 7), assets list page.
- TanStack DB optimistic collections (Phase 10).
- Tests. Vitest isn't installed. The report's testing plan (label queries,
  `aria-invalid`, focus after invalid submit, cents/number payload types,
  `ok: false` in `role="alert"`) is the starting point for a later `/vitest`
  pass.
- Editing ROADMAP.md, CONTEXT.md, or older dev files.
