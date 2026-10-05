import { useTransition } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import {
  Link,
  createFileRoute,
  stripSearchParams,
} from '@tanstack/react-router'
import { dashboardQueries } from '#/features/dashboard/dashboard.queries'
import { dashboardInputSchema } from '#/features/dashboard/dashboard.schemas'
import type {
  CostByMonthRow,
  CostByStatusRow,
  DashboardInput,
  TopAssetRow,
} from '#/features/dashboard/dashboard.types'
import { formatCost } from '#/lib/format'

// Parsed from {} so the stripped value is exactly the schema's default.
const SEARCH_DEFAULTS = dashboardInputSchema.parse({})

export const Route = createFileRoute('/dashboard')({
  validateSearch: dashboardInputSchema,
  search: {
    middlewares: [stripSearchParams(SEARCH_DEFAULTS)],
  },
  loaderDeps: ({ search }) => ({ input: search }),
  // query(), not ensureQueryData(): it refetches when a mutation has
  // invalidated ['dashboard'], instead of returning the stale cache.
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.query(dashboardQueries.costByMonth(deps.input)),
      context.queryClient.query(dashboardQueries.costByStatus(deps.input)),
      context.queryClient.query(dashboardQueries.topAssets(deps.input)),
    ])
  },
  component: Dashboard,
})

const PERIOD_OPTIONS: Array<DashboardInput['months']> = [3, 6, 12, 36]

const CARD = 'rounded-xl border border-neutral-200 bg-white p-6 shadow-sm'

function Dashboard() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [isPending, startTransition] = useTransition()

  const { data: byMonth } = useSuspenseQuery(
    dashboardQueries.costByMonth(search),
  )
  const { data: byStatus } = useSuspenseQuery(
    dashboardQueries.costByStatus(search),
  )
  const { data: topAssets } = useSuspenseQuery(
    dashboardQueries.topAssets(search),
  )

  // Sums at most 4 aggregate rows, not records.
  const totalCents = byStatus.reduce((sum, row) => sum + row.costCents, 0)
  const totalCount = byStatus.reduce((sum, row) => sum + row.count, 0)

  const handlePeriodChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const months = Number(event.target.value) as DashboardInput['months']
    startTransition(() => {
      navigate({ search: (prev) => ({ ...prev, months }) })
    })
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-neutral-500 uppercase">
            Ops console
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
            Maintenance cost
          </h1>
        </div>
        <div>
          <label
            htmlFor="period"
            className="mr-2 text-sm font-medium text-neutral-700"
          >
            Period
          </label>
          <select
            id="period"
            value={search.months}
            onChange={handlePeriodChange}
            className="min-h-11 rounded-lg border border-neutral-300 bg-white px-3 text-neutral-900"
          >
            {PERIOD_OPTIONS.map((months) => (
              <option key={months} value={months}>
                Last {months} months
              </option>
            ))}
          </select>
        </div>
      </header>

      <div
        className="mt-8 transition-opacity"
        style={{ opacity: isPending ? 0.5 : 1 }}
        aria-busy={isPending}
      >
        {byStatus.length === 0 ? (
          <p className={`${CARD} text-neutral-600`}>
            No maintenance records in this period
          </p>
        ) : (
          <div className="grid gap-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <StatTile label="Total cost" value={formatCost(totalCents)} />
              <StatTile
                label="Records"
                value={totalCount.toLocaleString('en-US')}
              />
            </div>
            <CostOverTime rows={byMonth} />
            <div className="grid gap-6 md:grid-cols-2">
              <ByStatus rows={byStatus} totalCents={totalCents} />
              <TopAssets rows={topAssets} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className={CARD}>
      <p className="text-xs font-semibold tracking-widest text-neutral-500 uppercase">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-neutral-900 tabular-nums">
        {value}
      </p>
    </div>
  )
}

// Thin labels out so 36 months stay readable.
function labelEvery(count: number) {
  if (count > 12) return 6
  if (count > 6) return 2
  return 1
}

function CostOverTime({ rows }: { rows: CostByMonthRow[] }) {
  const max = Math.max(1, ...rows.map((row) => row.costCents))
  const every = labelEvery(rows.length)

  return (
    <section aria-labelledby="cost-over-time" className={CARD}>
      <h2
        id="cost-over-time"
        className="text-lg font-semibold text-neutral-900"
      >
        Cost over time
      </h2>

      {/* Visual chart; the table below carries the same data for screen readers. */}
      <div aria-hidden="true" className="mt-6">
        <div className="flex h-48 items-end gap-1">
          {rows.map((row) => (
            <div
              key={row.month}
              title={`${row.month}: ${formatCost(row.costCents)}`}
              className="flex-1 rounded-t bg-neutral-800 transition-colors hover:bg-neutral-500"
              style={{ height: `${(row.costCents / max) * 100}%` }}
            />
          ))}
        </div>
        <div className="mt-2 flex gap-1 border-t border-neutral-200 pt-2">
          {rows.map((row, i) => (
            <span
              key={row.month}
              className="flex-1 overflow-visible text-center text-xs whitespace-nowrap text-neutral-500"
            >
              {i % every === 0 ? row.month : ''}
            </span>
          ))}
        </div>
      </div>

      <table className="sr-only">
        <caption>Maintenance cost by month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Cost</th>
            <th scope="col">Records</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.month}>
              <th scope="row">{row.month}</th>
              <td>{formatCost(row.costCents)}</td>
              <td>{row.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function ByStatus({
  rows,
  totalCents,
}: {
  rows: CostByStatusRow[]
  totalCents: number
}) {
  return (
    <section aria-labelledby="by-status" className={CARD}>
      <h2 id="by-status" className="text-lg font-semibold text-neutral-900">
        By status
      </h2>
      <ul className="mt-4 grid gap-4">
        {rows.map((row) => {
          const share = totalCents > 0 ? row.costCents / totalCents : 0
          return (
            <li key={row.status}>
              <Link
                to="/maintenance-records"
                search={{ status: row.status }}
                className="block rounded-md p-1 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-neutral-900"
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-neutral-900">
                    {row.status}
                  </span>
                  <span className="text-neutral-600 tabular-nums">
                    {formatCost(row.costCents)} ·{' '}
                    {row.count.toLocaleString('en-US')} records
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-neutral-100">
                  <div
                    className="h-2 rounded-full bg-neutral-800"
                    style={{ width: `${share * 100}%` }}
                  />
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function TopAssets({ rows }: { rows: TopAssetRow[] }) {
  return (
    <section aria-labelledby="top-assets" className={CARD}>
      <h2 id="top-assets" className="text-lg font-semibold text-neutral-900">
        Top assets by cost
      </h2>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="text-left text-xs tracking-wide text-neutral-500 uppercase">
            <th scope="col" className="py-2 pr-2">
              #
            </th>
            <th scope="col" className="py-2 pr-2">
              Asset
            </th>
            <th scope="col" className="py-2 pr-2 text-right">
              Cost
            </th>
            <th scope="col" className="py-2 pr-2 text-right">
              Records
            </th>
            <th scope="col" className="py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((row, i) => (
            <tr key={row.assetId}>
              <td className="py-2 pr-2 text-neutral-500">{i + 1}</td>
              <td className="py-2 pr-2">
                <Link
                  to="/maintenance-records"
                  search={{ assetId: row.assetId }}
                  className="font-medium text-neutral-900 underline-offset-2 hover:underline"
                >
                  {row.name}
                </Link>
              </td>
              <td className="py-2 pr-2 text-right tabular-nums">
                {formatCost(row.costCents)}
              </td>
              <td className="py-2 pr-2 text-right tabular-nums">
                {row.count.toLocaleString('en-US')}
              </td>
              <td className="py-2 text-right">
                <Link
                  to="/assets/$id/edit"
                  params={{ id: row.assetId }}
                  className="text-neutral-500 hover:text-neutral-900"
                >
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
