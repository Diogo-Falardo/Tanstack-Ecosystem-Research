import type { z } from 'zod'
import type {
  costByMonthRowSchema,
  costByStatusRowSchema,
  dashboardInputSchema,
  topAssetRowSchema,
} from './dashboard.schemas'

export type DashboardInput = z.infer<typeof dashboardInputSchema>
export type CostByMonthRow = z.infer<typeof costByMonthRowSchema>
export type CostByStatusRow = z.infer<typeof costByStatusRowSchema>
export type TopAssetRow = z.infer<typeof topAssetRowSchema>
