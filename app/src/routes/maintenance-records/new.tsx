import { createFileRoute } from '@tanstack/react-router'
import { assetQueries } from '#/features/assets/assets.queries'
import { MaintenanceRecordForm } from '#/features/maintenance-records/maintenance-record-form'

export const Route = createFileRoute('/maintenance-records/new')({
  loader: ({ context }) => context.queryClient.query(assetQueries.options()),
  component: NewMaintenanceRecord,
})

function NewMaintenanceRecord() {
  const navigate = Route.useNavigate()

  return (
    <MaintenanceRecordForm
      mode="create"
      // The save already awaited the list refetch (onSettled), so page 0
      // never renders the pre-create list.
      onSaved={() =>
        navigate({
          to: '/maintenance-records',
          search: (prev) => ({ ...prev, page: 0 }),
          ignoreBlocker: true,
        })
      }
      onCancel={() => navigate({ to: '/maintenance-records', search: true })}
    />
  )
}
