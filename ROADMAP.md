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

- [ ] **Phase 8 — Dashboards**
  Tools: Query + SQL aggregation
  Cost-over-time chart, breakdown by asset/status. Aggregation happens in
  SQL (`GROUP BY`/`SUM`), not in JS after fetching every row.

- [ ] **Phase 9 — Roles/security pass**
  Tools: Start middleware
  Real auth + roles. Route-level guard *and* server-function-level guard on
  every mutation and every query that returns sensitive fields (e.g. cost).

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
