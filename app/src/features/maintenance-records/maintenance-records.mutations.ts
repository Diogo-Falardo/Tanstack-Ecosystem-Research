import { mutationOptions } from '@tanstack/react-query'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import {
  sfBulkSetMaintenanceRecordStatus,
  sfCreateMaintenanceRecord,
  sfUpdateMaintenanceRecord,
} from './maintenance-records.function'
import type {
  BulkSetMaintenanceRecordStatusInput,
  CreateMaintenanceRecordInput,
  ListMaintenanceRecordsResult,
  MaintenanceRecord,
  UpdateMaintenanceRecordInput,
} from './maintenance-records.types'

type Snapshots = Array<[QueryKey, unknown]>

function restore(client: QueryClient, snapshots: Snapshots | undefined) {
  snapshots?.forEach(([queryKey, data]) => client.setQueryData(queryKey, data))
}

// Records feed both the list and the dashboard aggregates.
function invalidateRecordViews(client: QueryClient) {
  return Promise.all([
    client.invalidateQueries({ queryKey: ['maintenance-records'] }),
    client.invalidateQueries({ queryKey: ['dashboard'] }),
  ])
}

// Cache work lives here; UI work (alerts, reset, navigate) lives in the form.
export const maintenanceRecordMutations = {
  // No setQueryData into list pages: the client can't know where a new row
  // lands in a server-sorted, paginated list. The list renders pending
  // creates as ghost rows (useMutationState on this key) until the refetch.
  create: () =>
    mutationOptions({
      mutationKey: ['maintenance-records', 'create'],
      mutationFn: (data: CreateMaintenanceRecordInput) =>
        sfCreateMaintenanceRecord({ data }),
      // Returned so the mutation stays pending through the refetch.
      onSettled: (_data, _error, _variables, _result, { client }) =>
        invalidateRecordViews(client),
    }),

  update: () =>
    mutationOptions({
      mutationKey: ['maintenance-records', 'update'],
      mutationFn: (data: UpdateMaintenanceRecordInput) =>
        sfUpdateMaintenanceRecord({ data }),
      onMutate: async (vars, { client }) => {
        await client.cancelQueries({ queryKey: ['maintenance-records'] })

        const detailKey = ['maintenance-records', 'detail', vars.id] as const
        const snapshots: Snapshots = [
          ...client.getQueriesData({
            queryKey: ['maintenance-records', 'list'],
          }),
          [detailKey, client.getQueryData(detailKey)],
        ]

        // Patch the row in place on every cached page. Rows whose sortable
        // columns changed stay put until the onSettled refetch places them.
        client.setQueriesData<ListMaintenanceRecordsResult>(
          { queryKey: ['maintenance-records', 'list'] },
          (page) =>
            page && {
              ...page,
              rows: page.rows.map((row) =>
                row.id === vars.id ? { ...row, ...vars } : row,
              ),
            },
        )
        client.setQueryData<MaintenanceRecord>(
          detailKey,
          (record) => record && { ...record, ...vars },
        )

        return { snapshots }
      },
      onError: (_error, _vars, result, { client }) =>
        restore(client, result?.snapshots),
      // A returned failure doesn't trigger onError, so roll back here too.
      onSuccess: (data, _vars, result, { client }) => {
        if (!data.ok) restore(client, result.snapshots)
      },
      // Skip the refetch while other edits are still in flight, so one
      // edit's refetch doesn't overwrite another's optimistic patch.
      onSettled: (_data, _error, _vars, _result, { client }) => {
        if (
          client.isMutating({
            mutationKey: ['maintenance-records', 'update'],
          }) === 1
        ) {
          return invalidateRecordViews(client)
        }
      },
    }),

  // Not optimistic: most selected rows usually sit on pages that aren't in
  // the cache, so a patch would cover only some of them.
  bulkSetStatus: () =>
    mutationOptions({
      mutationKey: ['maintenance-records', 'bulk-set-status'],
      mutationFn: (data: BulkSetMaintenanceRecordStatusInput) =>
        sfBulkSetMaintenanceRecordStatus({ data }),
      // Returned so the mutation stays pending through the refetch.
      onSettled: (_data, _error, _variables, _result, { client }) =>
        invalidateRecordViews(client),
    }),
}
