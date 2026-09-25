import { useTransition } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { maintenanceRecordQueries } from '#/features/maintenance-records/maintenance-records.queries'
import { listMaintenanceRecordsInputSchema } from '#/features/maintenance-records/maintenance-records.schemas'

export const Route = createFileRoute('/maintenance-records/')({
  validateSearch: (search) => listMaintenanceRecordsInputSchema.parse(search),
  loaderDeps: ({ search }) => ({ filters: search }),
  loader: ({ context, deps }) =>
    context.queryClient.query({
      ...maintenanceRecordQueries.list(deps.filters),
      staleTime: 'static',
    }),
  component: MaintenanceRecordsList,
})

function formatCost(costCents: number) {
  return (costCents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
}

function MaintenanceRecordsList() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [isPending, startTransition] = useTransition()

  const { data } = useSuspenseQuery(maintenanceRecordQueries.list(search))

  const goToPage = (page: number) =>
    startTransition(() => {
      navigate({ search: (prev) => ({ ...prev, page }) })
    })

  const isFirstPage = search.page === 0
  const isLastPage = data.rows.length < search.pageSize

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">Maintenance Records</h1>

      <table className="mt-6 w-full text-left">
        <thead>
          <tr>
            <th className="p-2">ID</th>
            <th className="p-2">Asset</th>
            <th className="p-2">Description</th>
            <th className="p-2">Technician</th>
            <th className="p-2">Status</th>
            <th className="p-2">Performed at</th>
            <th className="p-2">Cost</th>
          </tr>
        </thead>
        <tbody style={{ opacity: isPending ? 0.5 : 1 }}>
          {data.rows.map((record) => (
            <tr key={record.id} className="border-t">
              <td className="p-2">{record.id}</td>
              <td className="p-2">{record.assetId}</td>
              <td className="p-2">{record.description}</td>
              <td className="p-2">{record.technician}</td>
              <td className="p-2">{record.status}</td>
              <td className="p-2">
                {new Date(record.performedAt).toLocaleDateString()}
              </td>
              <td className="p-2">{formatCost(record.costCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          disabled={isFirstPage || isPending}
          onClick={() => goToPage(search.page - 1)}
        >
          Prev
        </button>
        <span>Page {search.page + 1}</span>
        <button
          type="button"
          disabled={isLastPage || isPending}
          onClick={() => goToPage(search.page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}
