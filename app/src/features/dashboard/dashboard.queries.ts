import { queryOptions } from '@tanstack/react-query'
import {
  sfDashboardCostByMonth,
  sfDashboardCostByStatus,
  sfDashboardTopAssets,
} from './dashboard.function'
import type { DashboardInput } from './dashboard.types'

// Aggregates don't need to be fresher than a minute; record and asset
// mutations invalidate the ['dashboard'] prefix anyway.
const STALE_TIME = 60_000

// One query per panel so each caches on its own.
export const dashboardQueries = {
  costByMonth: (input: DashboardInput) =>
    queryOptions({
      queryKey: ['dashboard', 'cost-by-month', input] as const,
      queryFn: () => sfDashboardCostByMonth({ data: input }),
      staleTime: STALE_TIME,
    }),
  costByStatus: (input: DashboardInput) =>
    queryOptions({
      queryKey: ['dashboard', 'cost-by-status', input] as const,
      queryFn: () => sfDashboardCostByStatus({ data: input }),
      staleTime: STALE_TIME,
    }),
  topAssets: (input: DashboardInput) =>
    queryOptions({
      queryKey: ['dashboard', 'top-assets', input] as const,
      queryFn: () => sfDashboardTopAssets({ data: input }),
      staleTime: STALE_TIME,
    }),
}
