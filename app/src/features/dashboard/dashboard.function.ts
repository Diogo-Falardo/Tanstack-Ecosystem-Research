import { createServerFn } from '@tanstack/react-start'
import { adminOnly } from '#/middleware/auth.middleware'
import { Dashboard } from './dashboard.server'
import { dashboardInputSchema } from './dashboard.schemas'

// Cost totals are admin-only.
export const sfDashboardCostByMonth = createServerFn({ method: 'GET' })
  .middleware([adminOnly])
  .validator(dashboardInputSchema)
  .handler(async ({ data }) => Dashboard.costByMonth(data))

export const sfDashboardCostByStatus = createServerFn({ method: 'GET' })
  .middleware([adminOnly])
  .validator(dashboardInputSchema)
  .handler(async ({ data }) => Dashboard.costByStatus(data))

export const sfDashboardTopAssets = createServerFn({ method: 'GET' })
  .middleware([adminOnly])
  .validator(dashboardInputSchema)
  .handler(async ({ data }) => Dashboard.topAssets(data))
