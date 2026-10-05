import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import type { Role } from '#/features/auth/auth.types'
import type { ListMaintenanceRecordsInput } from '#/features/maintenance-records/maintenance-records.types'
import { canEditRecords, isAdmin } from '#/lib/route-guards'

export const Route = createFileRoute('/_authed/')({ component: Home })

// Shortcuts into the records list. Each one is just typed search params, so
// it lands on the same server-filtered URL the filter controls would build.
const RECORD_VIEWS: Array<{
  label: string
  search: Partial<ListMaintenanceRecordsInput>
}> = [
  { label: 'Scheduled', search: { status: 'scheduled' } },
  { label: 'In progress', search: { status: 'in_progress' } },
  { label: 'Completed', search: { status: 'completed' } },
  { label: 'Cancelled', search: { status: 'cancelled' } },
  { label: 'Newest first', search: { sortBy: 'performedAt', sortDir: 'desc' } },
]

const ALL_ROLES: Role[] = ['admin', 'technician', 'viewer']
const STAFF: Role[] = ['admin', 'technician']
const ADMIN: Role[] = ['admin']

// Same role lists as the route guards; only shows routes the user can open.
const ROUTE_MAP: Array<{ path: string; note: string; roles: Role[] }> = [
  {
    path: '/maintenance-records',
    note: 'List with search, filters, sort',
    roles: ALL_ROLES,
  },
  {
    path: '/maintenance-records/new',
    note: 'Create, in the drawer',
    roles: STAFF,
  },
  {
    path: '/maintenance-records/$id/edit',
    note: 'Edit, in the drawer',
    roles: STAFF,
  },
  { path: '/dashboard', note: 'Cost dashboard', roles: ADMIN },
  { path: '/assets/new', note: 'Create asset', roles: ADMIN },
  { path: '/assets/$id/edit', note: 'Edit asset', roles: ADMIN },
]

function Home() {
  const { user } = Route.useRouteContext()
  const canEdit = canEditRecords(user)
  const admin = isAdmin(user)

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
      <header className="home-rise">
        <p className="text-xs font-semibold tracking-widest text-neutral-500 uppercase">
          Ops console
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Equipment &amp; maintenance
        </h1>
        <p className="mt-3 max-w-2xl text-neutral-600">
          Go to any screen in the app. Lists are filtered, sorted and paged on
          the server, so every view below is just a URL.
        </p>
      </header>

      <div className="mt-10 grid gap-6 md:grid-cols-5">
        <section
          aria-labelledby="records-heading"
          className={`home-rise rounded-xl border border-neutral-200 bg-white p-6 shadow-sm ${admin ? 'md:col-span-3' : 'md:col-span-5'}`}
          style={{ animationDelay: '60ms' }}
        >
          <h2
            id="records-heading"
            className="text-lg font-semibold text-neutral-900"
          >
            Maintenance records
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            80k seeded service records, searchable and virtualized.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/maintenance-records"
              className="inline-flex min-h-11 items-center rounded-lg bg-neutral-900 px-4 font-medium text-white transition hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 active:scale-[0.98]"
            >
              Open records →
            </Link>
            {canEdit && (
              <Link
                to="/maintenance-records/new"
                className="inline-flex min-h-11 items-center rounded-lg border border-neutral-300 px-4 font-medium text-neutral-900 transition hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 active:scale-[0.98]"
              >
                New record
              </Link>
            )}
          </div>

          <h3 className="mt-7 text-xs font-semibold tracking-widest text-neutral-500 uppercase">
            Jump to a view
          </h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {RECORD_VIEWS.map((view) => (
              <li key={view.label}>
                <Link
                  to="/maintenance-records"
                  search={view.search}
                  className="inline-flex min-h-9 items-center rounded-full border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                >
                  {view.label}
                </Link>
              </li>
            ))}
          </ul>

          {canEdit && (
            <OpenById
              label="Edit record by ID"
              inputId="record-id"
              to="/maintenance-records/$id/edit"
            />
          )}
        </section>

        {admin && (
          <section
            aria-labelledby="assets-heading"
            className="home-rise flex flex-col rounded-xl border border-neutral-200 bg-white p-6 shadow-sm md:col-span-2"
            style={{ animationDelay: '120ms' }}
          >
            <h2
              id="assets-heading"
              className="text-lg font-semibold text-neutral-900"
            >
              Assets
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              The equipment records attach to. There's no list page yet, so open
              one by ID.
            </p>

            <div className="mt-5">
              <Link
                to="/assets/new"
                className="inline-flex min-h-11 items-center rounded-lg border border-neutral-300 px-4 font-medium text-neutral-900 transition hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 active:scale-[0.98]"
              >
                New asset
              </Link>
            </div>

            <OpenById
              label="Edit asset by ID"
              inputId="asset-id"
              to="/assets/$id/edit"
            />
          </section>
        )}
      </div>

      <section
        aria-labelledby="routes-heading"
        className="home-rise mt-10"
        style={{ animationDelay: '180ms' }}
      >
        <h2
          id="routes-heading"
          className="text-xs font-semibold tracking-widest text-neutral-500 uppercase"
        >
          Route map
        </h2>
        <ul className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200">
          {ROUTE_MAP.filter((route) => route.roles.includes(user.role)).map(
            (route) => (
              <li
                key={route.path}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-6"
              >
                <code className="text-sm text-neutral-900 sm:w-80 sm:shrink-0">
                  {route.path}
                </code>
                <span className="text-sm text-neutral-500">{route.note}</span>
              </li>
            ),
          )}
        </ul>
      </section>
    </div>
  )
}

// Param routes have no list to click from (assets) or are deep in a big list
// (records), so this goes straight to one by ID. The route's own params.parse
// still validates the ID; this only keeps obviously bad input from navigating.
function OpenById({
  label,
  inputId,
  to,
}: {
  label: string
  inputId: string
  to: '/maintenance-records/$id/edit' | '/assets/$id/edit'
}) {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const id = Number(value)
  const isValid = Number.isInteger(id) && id > 0

  return (
    <form
      className="mt-auto pt-7"
      onSubmit={(event) => {
        event.preventDefault()
        if (isValid) navigate({ to, params: { id } })
      }}
    >
      <label
        htmlFor={inputId}
        className="text-xs font-semibold tracking-widest text-neutral-500 uppercase"
      >
        {label}
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="e.g. 42"
          className="min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 text-neutral-900 focus-visible:border-neutral-900 focus-visible:outline-none"
        />
        <button
          type="submit"
          disabled={!isValid}
          className="min-h-11 shrink-0 rounded-lg bg-neutral-900 px-4 font-medium text-white transition hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Open
        </button>
      </div>
    </form>
  )
}
