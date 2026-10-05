# Range Filters — Maintenance Records (TanStack Ranger + Router search params)

ROADMAP.md Phase 11, part 1 of 2 (Store is `tanstack-store.md`). Add a **cost
range** and a **performed-at month range** filter to the records list, each
driven by a two-handle Ranger slider. Both ranges are typed search params on the
layout route, validated by the shared list schema, and applied in SQL (ground
rule #2). The slider is UI only. The server still validates and re-checks the
role on every request (ground rule #3).

## Files to modify

- app/package.json                                                       # existing, modify — `bun add @tanstack/react-ranger`
- app/src/components/range-slider.tsx                                    # create — reusable two-handle slider on `useRanger`
- app/src/features/maintenance-records/maintenance-records.schemas.ts    # existing, modify — add range params to listMaintenanceRecordsInputSchema
- app/src/features/maintenance-records/maintenance-records.server.ts     # existing, modify — apply ranges in MaintenanceRecords.list()
- app/src/features/maintenance-records/maintenance-records.function.ts   # existing, modify — reject cost range for viewers
- app/src/routes/_authed/maintenance-records/route.tsx                   # existing, modify — two sliders next to the existing filters
- ROADMAP.md                                                             # existing, modify — dated note under Phase 11

## Analyze these

- app/src/routes/_authed/maintenance-records/route.tsx — `handleStatusChange` / `applySearch` + `useDebouncer` (Phase 7)
- app/src/features/maintenance-records/maintenance-records.schemas.ts — `listMaintenanceRecordsInputSchema`
- app/src/features/maintenance-records/maintenance-records.server.ts — `list()` builds one `and(...)` reused by rows and `count()`
- app/src/features/maintenance-records/maintenance-records.function.ts — `includeCost: context.user.role !== 'viewer'`
- app/src/features/dashboard/dashboard.server.ts — UTC month bucketing (`strftime(..., 'unixepoch')`)
- app/src/lib/format.ts — `formatCost`
- app/dev_files/tanstack-pacer.md — how Phase 7 added `q` (same shape for these params)

Copy how Phase 7 added `q`. The new params go into the shared
`listMaintenanceRecordsInputSchema` (not a route-only schema). Each control
writes the URL through the same `startTransition` → scroll reset →
`navigate({ ...prev, <param>, page: 0 })` sequence, and `list()` adds one more
condition to its existing `and(...)`. `SEARCH_DEFAULTS` /
`stripSearchParams` keep working with no edit, because every new param is
optional.

## Research findings (npm latest on 2026-10-05: `@tanstack/react-ranger` 0.0.5 → `@tanstack/ranger` 0.0.4)

These come from reading the published source, not the docs site.

- **It's pre-1.0 and old.** `react-ranger`'s peer range is `react ^16.8 || ^17 || ^18`.
  This app runs React 19, so `bun add` will warn. The hook is ~30 lines
  (`useReducer` rerender, `useState` instance, `useLayoutEffect`) and doesn't
  use anything that React 19 removed. ASSUMPTION: it works on React 19. Verify
  in the browser and put the result in the ROADMAP note.
- **API:** `useRanger<HTMLDivElement>({ getRangerElement: () => ref.current, values, min, max, stepSize | steps, onChange, onDrag })`.
  The instance gives you `handles()` (`value`, `isActive`,
  `onKeyDownHandler`, `onMouseDownHandler`, `onTouchStart`), `getSteps()`
  (`left` / `width` percentages for the track segments), `getTicks()`, and
  `getPercentageForValue(v)`. Read the new values from `instance.sortedValues`.
- **When it fires:**
  - Mouse/touch: without `onDrag`, Ranger tracks the drag in its own
    `tempValues` and calls `onChange` **once on release**. That gives one URL
    write per drag.
  - Keyboard: **every** Left/Right arrow press calls `onChange` right away. It
    uses the deprecated `e.keyCode`, and it only handles those two keys (no
    Home/End/PageUp/PageDown). Five presses would mean five navigations and
    five server calls, so keyboard commits must be debounced.
- **No accessibility built in.** Handles get no role, no ARIA, and no
  `tabIndex`. You have to add all of it.
- **Mouse/touch only.** Ranger listens for mouse/touch events on `document`,
  not pointer events. That's fine for this research app. Don't patch it.

## What we currently need

### Dependency

- `bun add @tanstack/react-ranger`. Import `useRanger` from it (it re-exports
  `@tanstack/ranger`). Don't add `@tanstack/ranger` separately.

### Shared UI — `src/components/range-slider.tsx`

`RangeSlider` is a presentational two-handle slider. It does not touch the
router or Pacer. Props:
`{ label: string, min: number, max: number, stepSize?: number, steps?: readonly number[], value: [number, number], onCommit: (value: [number, number]) => void, formatValue: (v: number) => string, disabled?: boolean }`.

- Local `useState<[number, number]>` holds the displayed values, seeded from
  `value`. Re-sync it when `value` changes from outside (back/forward, Clear).
  Use a `useEffect` like the `search.q` one in `route.tsx`.
- `useRanger({ getRangerElement, values: local, min, max, stepSize | steps, onChange })`:
  `onChange` sets local state from `instance.sortedValues` and calls `onCommit`.
  Don't pass `onDrag`, so a drag commits only on release.
- Render the track (`getSteps()` segments, with the middle segment
  highlighted) and two handle `<button type="button">` elements positioned at
  `getPercentageForValue(value)%`. Each handle gets:
  - `role="slider"`, `aria-label` (`` `Minimum ${label}` `` / `` `Maximum ${label}` ``),
    `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and
    `aria-valuetext={formatValue(value)}`.
  - Ranger's `onKeyDown` / `onMouseDown` / `onTouchStart` handlers.
- Show the current range as text under the track:
  `formatValue(low) – formatValue(high)`.
- Plain Tailwind like the rest of the app. No new styling dependency.

### Schema — `listMaintenanceRecordsInputSchema`

- `costMin` and `costMax`: `z.number().int().nonnegative().max(100_000_000).optional()`,
  in **cents** (the same unit as `costCents`). The `max` bounds what a URL can
  send.
- `fromMonth` and `toMonth`: `z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional()`,
  as `'YYYY-MM'` in **UTC**. This matches the dashboard's month buckets.
- Add a `.refine` (or `.superRefine`) that rejects `costMin > costMax` and
  `fromMonth > toMonth` when both are set. Plain string compare works for
  `YYYY-MM`. After the change, check that `listMaintenanceRecordsInputSchema.parse({})`
  still works for `SEARCH_DEFAULTS`, and that `validateSearch` still accepts
  the schema. ASSUMPTION: Zod 4's object `.refine` keeps both working. If it
  doesn't, move the cross-field check into `list()` and return no rows.
- An invalid range in the URL keeps throwing through `validateSearch`, the
  same as `?status=foo` today. Per-field fallbacks stay out of scope.

### Server — `MaintenanceRecords.list()`

Add to the existing `and(...)`:

- `costMin` → `gte(maintenanceRecords.costCents, costMin)`. `costMax` →
  `lte(maintenanceRecords.costCents, costMax)`.
- `fromMonth` → `gte(maintenanceRecords.performedAt, <UTC start of fromMonth>)`.
  `toMonth` → `lt(maintenanceRecords.performedAt, <UTC start of the month after toMonth>)`.
  Build those dates in a small helper next to `containsPattern`, using
  `Date.UTC(y, m - 1, 1)`.
- `count()` already reuses `where`, so `total` stays right.
- Add a comment: `performed_at` has an index (`idx_maintenance_performed_at`),
  so the month range can seek. `cost_cents` has no index, so the cost range
  filters whatever rows the other conditions leave. Don't add an index or a
  migration. Measure first (see ROADMAP).

### Function — `sfListMaintenanceRecords` (viewer cost oracle)

- If the caller is a viewer and `costMin` or `costMax` is set, call
  `setResponseStatus(403)` and throw `new Error('Forbidden')` before calling
  `list()`. Copy the shape of `requireRole` in `auth.middleware.ts`, and
  import `setResponseStatus` from `@tanstack/react-start/server` the same way
  it does (the function file doesn't import it yet).
  Why: viewers get `costCents: null`, but if a cost range still filtered their
  rows, they could binary-search any record's cost from `total` and from which
  rows show up. That would undo the Phase 9 cost hiding.
- The month range is allowed for every role.

### Route — `maintenance-records/route.tsx`

- **Cost slider** (label "Cost"). Render it only when `canEdit` (staff), the
  same rule as the cost column.
  - Bounds: `min = 0`, `max = 500_000` cents ($5,000), `stepSize = 5_000`
    ($50). ASSUMPTION: these are fixed constants matching the seed
    (`randomInt(5_000, 500_000)`). Don't add a server function for the bounds.
  - `value = [search.costMin ?? 0, search.costMax ?? 500_000]`.
  - On commit, a handle at its edge means "no bound". The low handle at `min`
    → `costMin: undefined`. The high handle at `max` → `costMax: undefined`.
    So the default slider position keeps the URL clean, and records costing
    more than $5,000 still show up.
  - `formatValue = formatCost`.
- **Month slider** (label "Performed"):
  - `steps` = month indices `0..36`, mapped to the last 37 UTC months ending
    with the current month. ASSUMPTION: 36 months back matches the seed's
    3-year spread and the dashboard's widest window.
  - Map the indices to and from `'YYYY-MM'` with small helpers in the route
    file. Both edges mean "no bound", the same rule as cost. A URL month
    outside the window is clamped for display only. The server still applies
    the real URL value.
  - `formatValue` shows e.g. `Oct 2025`. Use UTC, so the labels match the
    server bounds.
- **Commits go through Pacer.** Each slider's `onCommit` calls a
  `useDebouncer` (`wait: SEARCH_DEBOUNCE_MS`). The callback runs the same
  `startTransition` → `scrollTo(0, 0)` → `navigate({ ...prev, <params>, page: 0 })`
  sequence as `applySearch`. A drag makes one call anyway. Debouncing is for
  keyboard arrows, which would otherwise navigate on every press.
- **Clear ranges** button, shown only when any of the four params is set. It
  cancels pending debounced calls and navigates with all four set to
  `undefined` and `page: 0`.
- Place both sliders in the existing `flex flex-wrap` filter row.

### ROADMAP note

Add a dated note under Phase 11 in `ROADMAP.md`:

- `EXPLAIN QUERY PLAN` and HTTP timing (cold and warm median, dev server, 80k
  rows) for: a month range alone, a cost range alone, and both together.
  Confirm the month range uses `idx_maintenance_performed_at` and the cost
  range is a scan.
- That a viewer sending `?costMin=…` gets 403.
- Whether Ranger 0.0.5 worked on React 19 as installed, and what you had to
  add yourself (ARIA, keyboard debounce).

## Out of scope

- Multi-select and bulk actions (`tanstack-store.md`).
- An index on `cost_cents` or any migration. Measure first and record the
  result.
- A server function for slider bounds (min/max cost, oldest record).
- Range filters on the dashboard. It keeps its fixed `months` window.
- Patching Ranger for pointer events or Home/End keys.
- Per-field fallbacks for invalid URL params.
