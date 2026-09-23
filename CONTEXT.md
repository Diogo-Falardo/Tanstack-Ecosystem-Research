# TanStack Ecosystem Research

## What this is

A hands-on research project to learn the TanStack ecosystem (Router, Start,
Query, Form, Table, Virtual, Store, DB, Pacer, Ranger) by building one real
full-stack TypeScript application end to end, instead of learning each
library in isolation.

## Why

A previous project (built outside this research track) got slow and had weak
security once it had real data volume. The gaps were:

- Client-side filtering/pagination instead of server-side (fetch-everything,
  then slice in JS).
- No indexes on columns that were actually filtered/sorted on.
- Access control only enforced in the UI, not re-checked in server-side
  mutations.

This project exists to deliberately hit those failure modes early, in a low-
stakes context, with real (seeded) data volume — not to ship a product.

## The app

An **ops console / dashboard** for tracking equipment and its maintenance
history. Chosen because the domain naturally produces:

- A large, growing table (maintenance records) — good for pagination,
  sorting, filtering, virtualization practice.
- Aggregate views (cost over time, breakdowns by equipment) — good for
  dashboard/chart practice backed by real SQL aggregation, not
  fetch-then-reduce-in-JS.
- Multiple user roles (admin vs technician vs viewer) — good for practicing
  access control that's enforced server-side, not just hidden in the UI.

The domain itself is not the point and is swappable (tickets, orders,
inventory would all work) — the data shape (volume + aggregation + roles) is
what matters.

## Stack

- **TanStack Start** (React) — full-stack framework (SSR, server functions),
  built on TanStack Router (file-based routing).
- **SQLite** via `better-sqlite3` + **Drizzle ORM** — chosen deliberately
  over the usual Postgres for this project, since it's research, not a real
  deployment: zero infra, file-based, still exercises real
  schema/migration/query patterns.
- **TanStack Query** — server-state fetching/caching/mutations.
- **TanStack Form** — validated forms wired to server functions.
- **TanStack Table** + **TanStack Virtual** — data table with large-list
  rendering.
- **TanStack Store**, **Pacer**, **Ranger** — used only where a real need for
  them shows up (cross-cutting client state, debounced search, range
  filters) — not bolted on for coverage's sake.
- **TanStack DB** — explored later, once the manual Query-based data flow is
  well understood, as the "what does a reactive sync layer add on top of
  Query" comparison.

## Ground rules

1. Seed realistic data volume (50k–100k+ rows) before building UI against a
   table — this is what makes performance problems visible while learning.
2. All filtering/sorting/pagination happens server-side. The UI renders what
   the server already sliced; it never re-filters a full dataset client-side.
3. Every server function validates its input (Zod) and re-checks
   authorization itself — never rely on the UI having already checked.
4. Aggregation (sums, counts, group-by) happens in SQL, not by fetching rows
   and reducing in JavaScript.

See `ROADMAP.md` for the build order.
