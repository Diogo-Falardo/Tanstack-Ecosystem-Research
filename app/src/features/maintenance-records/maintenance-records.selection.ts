import { createStoreContext } from '@tanstack/react-store'
import type { Store, StoreActionsFactory } from '@tanstack/react-store'
import { MAX_BULK_IDS } from './maintenance-records.schemas'

// Selected record ids across pages. Create it with useCreateStore inside the
// list component, never at module scope: module state is shared by every SSR
// request and would outlive logout (the Phase 10 collection trap).
export type SelectionState = { ids: ReadonlySet<number> }

export const MAX_BULK_SELECTION = MAX_BULK_IDS

export type SelectionActions = {
  toggle: (id: number) => void
  setMany: (ids: number[], selected: boolean) => void
  clear: () => void
}

// Every action builds a new Set: the store compares by reference, so mutating
// the current one would never notify subscribers. Going past the cap is a
// no-op; the toolbar says why.
export const selectionActions: StoreActionsFactory<
  SelectionState,
  SelectionActions
> = ({ setState }) => ({
  toggle: (id) =>
    setState((prev) => {
      const ids = new Set(prev.ids)
      if (ids.has(id)) ids.delete(id)
      else if (ids.size < MAX_BULK_SELECTION) ids.add(id)
      else return prev
      return { ids }
    }),
  setMany: (pageIds, selected) =>
    setState((prev) => {
      const ids = new Set(prev.ids)
      if (selected) {
        const added = pageIds.filter((id) => !ids.has(id))
        if (ids.size + added.length > MAX_BULK_SELECTION) return prev
        added.forEach((id) => ids.add(id))
      } else {
        pageIds.forEach((id) => ids.delete(id))
      }
      return { ids }
    }),
  clear: () =>
    setState((prev) => (prev.ids.size === 0 ? prev : { ids: new Set() })),
})

export type SelectionStore = Store<SelectionState, SelectionActions>

// Columns are module constants, so cells reach the store through context.
export const {
  StoreProvider: SelectionProvider,
  useStoreContext: useSelection,
} = createStoreContext<{ selection: SelectionStore }>()
