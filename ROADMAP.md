# Roadmap

Phases build on each other — each one adds a tool and a lesson tied to the
ground rules in `CONTEXT.md`. Check a phase off once the feature works *and*
you can explain the perf/security lesson it was meant to teach.

- [x] Scaffold TanStack Start app (`app/`), SQLite + Drizzle wired up.

- [ ] **Phase 1 — Schema + seed**
  Tools: Drizzle
  Design `assets` and `maintenance_records` tables. Index columns you'll
  filter/sort on (asset id, status, date). Write a seed script generating
  50k-100k maintenance records.

- [ ] **Phase 2 — Server functions**
  Tools: Start server functions, Zod
  CRUD server functions for assets/records. Validate every input. Stub an
  auth/role check even before real auth exists, so the habit is there from
  the start.

- [ ] **Phase 3 — List + fetch**
  Tools: TanStack Query
  Paginated list of maintenance records. `queryKey` encodes page/filter/sort.
  No fetch-all-then-slice.

- [ ] **Phase 4 — Table UI**
  Tools: TanStack Table
  Sortable/filterable columns, but sort/filter state drives a server request
  — Table renders server-sliced data, doesn't re-slice it.

- [ ] **Phase 5 — Long lists**
  Tools: TanStack Virtual
  Virtualize the table body once a filtered view can still return thousands
  of rows.

- [ ] **Phase 6 — Forms**
  Tools: TanStack Form
  Create/edit maintenance record + asset forms. Optimistic mutations via
  Query. Server re-validates regardless of client-side validation.

- [ ] **Phase 7 — Search/filter UX**
  Tools: Router typed search params, Pacer
  Filters live in the URL. Debounce free-text search input.
  - 2026-10-05: free-text `q` is `LIKE '%q%'` over description + technician
    (leading wildcard, so no index). On 80k seeded rows `list()` takes
    ~15–25 ms for a common term ("Cleaned", 11.5k hits) and ~47 ms for a term
    with no hits ("zzzz"). The full scan is the slow case, not the match count.
    Fast enough without FTS5. Typed `%`/`_` are escaped, so `q=%` matches 0 rows.

- [ ] **Phase 8 — Dashboards**
  Tools: Query + SQL aggregation
  Cost-over-time chart, breakdown by asset/status. Aggregation happens in
  SQL (`GROUP BY`/`SUM`), not in JS after fetching every row.
  - 2026-10-05: `/dashboard` runs three server functions (cost by month,
    by status, top 10 assets) over a `months` window (3/6/12/36). Only
    aggregate rows leave the DB: at most 36 + 4 + 10. Timed over HTTP on 80k
    seeded rows (dev server, cold / warm median): 12 months: by-month 83 / 31 ms,
    by-status 27 / 28 ms, top-assets 28 / 27 ms. 36 months: 63–68 ms each.
    Month series plan:
    `SEARCH maintenance_records USING INDEX idx_maintenance_performed_at (performed_at>? AND performed_at<?) | USE TEMP B-TREE FOR GROUP BY`.
    Both window bounds use the index. Without the window it's a full `SCAN`.
    The window also moved top-assets off `idx_maintenance_asset_id` onto the
    date index. A covering `(performed_at, cost_cents, …)` index halved the
    month series in a raw-SQL test (~18 → 9 ms), but it isn't worth adding
    at this volume. Months bucket in UTC (`strftime(..., 'unixepoch')`).

- [ ] **Phase 9 — Roles/security pass**
  Tools: Start middleware
  Real auth + roles. Route-level guard *and* server-function-level guard on
  every mutation and every query that returns sensitive fields (e.g. cost).
  - 2026-10-05: sealed-cookie session (`useSession`) holding only
    `{ userId, sessionVersion }`. The `users` row is read on every server
    function call, so a role change applies on the next request. A tech
    demoted to viewer in the DB got 403 on the very next call with the same
    cookie. Lookup cost over HTTP on the dev server (median of 50, before →
    after): `sfGetAsset` 6.2 → 7.5 ms, records list (25 rows) 6.8 → 8.0 ms,
    500 rows 13 → 13.7 ms. About 1 ms per call.
    Server-function matrix checked with real calls (cookie jar plus `origin` /
    `sec-fetch-site` headers): no cookie → 401. Viewer → dashboard fns 403,
    `sfGetMaintenanceRecord` 403, list returns `costCents: null` (NULL in the
    SELECT, so cost never leaves SQLite; the SSR payload carries nulls too).
    Technician → dashboard 403, `sfCreateAsset` 403, costs visible. Admin →
    everything. A tampered cookie → 401. The sealed value sent as an
    `x-ops-session-session` header → 401 (`sessionHeader: false`).
    Surprises:
    - Adding `src/start.ts` turns off Start's default CSRF middleware. It only
      applies when no start instance exists. `start.ts` re-adds it, and a
      `sec-fetch-site: cross-site` call with a valid admin cookie gets 403
      (the POST created nothing).
    - Logout can't kill a sealed cookie. A copied admin cookie still worked
      until `sfLogout` bumped `sessionVersion`, then it got 401. So logout
      signs out every device.
    - h3's session cookie has no `SameSite` by default. It is set to `lax`
      explicitly.
    - Route guards are UX only (`beforeLoad` runs in the browser). Anonymous
      SSR requests get 307 → `/login?redirect=…`, and wrong roles get 307 →
      `/`. `//evil.com` as `redirect` falls back to `/`.
    - Moving routes under the pathless `_authed/` changed route *ids*. One
      `routeId !== '/maintenance-records/'` check (drawer open state) would
      have silently broken. Also, `beforeLoad` placed above `params` broke
      `params.parse` type inference, because route option order matters.
    - Login takes ~35 ms of scrypt for both a wrong password and an unknown
      email (dummy hash), so timing doesn't reveal which emails exist.
    Next gap: no login rate limiting or lockout.

- [ ] **Phase 10 — (optional) reactive sync**
  Tools: TanStack DB
  Swap one high-churn view (e.g. live asset status) from manual refetching
  to a synced reactive collection. Compare against the Query version.

- [ ] **Phase 11 — (as needed) Store, Ranger**
  Add only when a concrete need shows up — e.g. Store for multi-select state
  across paginated pages, Ranger for a cost/date range filter.

## Notes

- Add a dated note under a phase when something surprising happens (a query
  that was slow until indexed, a role check that was missing, etc.) — that's
  the actual research output of this project.
