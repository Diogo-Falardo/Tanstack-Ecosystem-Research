import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { assetQueries } from '#/features/assets/assets.queries'
import { MaintenanceRecordForm } from '#/features/maintenance-records/maintenance-record-form'
import { maintenanceRecordQueries } from '#/features/maintenance-records/maintenance-records.queries'
import { requireRouteRole } from '#/lib/route-guards'

export const Route = createFileRoute('/_authed/maintenance-records/$id/edit')({
  params: {
    parse: ({ id }) => ({ id: z.coerce.number().int().positive().parse(id) }),
    stringify: ({ id }) => ({ id: String(id) }),
  },
  beforeLoad: ({ context }) =>
    requireRouteRole(context.user, ['admin', 'technician']),
  // Finite staleTime (not the deprecated ensureQueryData, which is 'static'):
  // a detail invalidated by a previous save is refetched before the form
  // mounts, so its defaults are never stale.
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.query({
        ...maintenanceRecordQueries.detail(params.id),
        staleTime: 30_000,
      }),
      context.queryClient.query(assetQueries.options()),
    ]),
  component: EditMaintenanceRecord,
})

function EditMaintenanceRecord() {
  const { id } = Route.useParams()
  const navigate = Route.useNavigate()
  const { data: record } = useSuspenseQuery(maintenanceRecordQueries.detail(id))

  return (
    <MaintenanceRecordForm
      key={record.id}
      mode="edit"
      record={record}
      onSaved={() =>
        navigate({
          to: '/maintenance-records',
          search: true,
          ignoreBlocker: true,
        })
      }
      onCancel={() => navigate({ to: '/maintenance-records', search: true })}
    />
  )
}
