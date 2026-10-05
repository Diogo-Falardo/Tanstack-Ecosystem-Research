import { createServerFn } from '@tanstack/react-start'
import { anyRole } from '#/middleware/auth.middleware'
import { Dashboard } from './dashboard.server'
import { dashboardInputSchema } from './dashboard.schemas'

// TODO(Phase 9): cost totals are sensitive. Tighten the role here.
export const sfDashboardCostByMonth = createServerFn({ method: 'GET' })
  .middleware([anyRole])
  .validator(dashboardInputSchema)
  .handler(async ({ data }) => Dashboard.costByMonth(data))

export const sfDashboardCostByStatus = createServerFn({ method: 'GET' })
  .middleware([anyRole])
  .validator(dashboardInputSchema)
  .handler(async ({ data }) => Dashboard.costByStatus(data))

export const sfDashboardTopAssets = createServerFn({ method: 'GET' })
  .middleware([anyRole])
  .validator(dashboardInputSchema)
  .handler(async ({ data }) => Dashboard.topAssets(data))
