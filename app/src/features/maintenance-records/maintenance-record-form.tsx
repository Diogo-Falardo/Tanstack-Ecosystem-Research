import { useRef, useState } from 'react'
import { useMutation, useSuspenseQuery } from '@tanstack/react-query'
import { revalidateLogic } from '@tanstack/react-form'
import { useAppForm } from '#/components/form/form-kit'
import {
  UnsavedChangesPrompt,
  focusFirstInvalid,
  useUnsavedChangesBlocker,
} from '#/components/form/form-guards'
import { thrownToFormErrors, toFormErrors } from '#/lib/action-result'
import { assetQueries } from '#/features/assets/assets.queries'
import { maintenanceRecordMutations } from './maintenance-records.mutations'
import {
  maintenanceRecordFormSchema,
  selectMaintenanceRecordSchema,
} from './maintenance-records.schemas'
import type {
  MaintenanceRecord,
  MaintenanceRecordFormValues,
} from './maintenance-records.types'

const STATUS_OPTIONS = selectMaintenanceRecordSchema.shape.status.options.map(
  (status) => ({ value: status, label: status }),
)

// `YYYY-MM-DD` in local time, matching how the form schema parses it back.
function toDateInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function toFormValues(record: MaintenanceRecord): MaintenanceRecordFormValues {
  return {
    assetId: record.assetId,
    description: record.description,
    technician: record.technician,
    status: record.status,
    performedAt: toDateInput(new Date(record.performedAt)),
    cost: record.costCents / 100,
  }
}

function emptyFormValues(): MaintenanceRecordFormValues {
  return {
    assetId: null,
    description: '',
    technician: '',
    status: 'scheduled',
    performedAt: toDateInput(new Date()),
    cost: null,
  }
}

type Props = {
  onSaved: (record: MaintenanceRecord) => void
  onCancel: () => void
} & (
  | { mode: 'create'; record?: undefined }
  | { mode: 'edit'; record: MaintenanceRecord }
)

// Parent renders `<MaintenanceRecordForm key={record.id} …/>` for edits so
// switching records never keeps stale edits.
export function MaintenanceRecordForm({
  mode,
  record,
  onSaved,
  onCancel,
}: Props) {
  const { data: assetOptions } = useSuspenseQuery(assetQueries.options())
  const createMutation = useMutation(maintenanceRecordMutations.create())
  const updateMutation = useMutation(maintenanceRecordMutations.update())
  const formRef = useRef<HTMLFormElement>(null)
  const savedRef = useRef<MaintenanceRecord | null>(null)

  // Defaults live in state (a stable object, as v1 treats a new object as
  // changed defaults). After a save they become the saved values, so
  // `isDefaultValue` is true again (#1798 workaround).
  const [defaultValues, setDefaultValues] = useState(() =>
    record ? toFormValues(record) : emptyFormValues(),
  )

  const form = useAppForm({
    defaultValues,
    // Submit first, then live re-validation after the first submit.
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: maintenanceRecordFormSchema,
      // Server errors land on fields and in FormAlert through this route.
      onSubmitAsync: async ({ value }) => {
        // Validation only hands over the schema *input*; parse for the output.
        const payload = maintenanceRecordFormSchema.parse(value)
        try {
          const result = record
            ? await updateMutation.mutateAsync({ id: record.id, ...payload })
            : await createMutation.mutateAsync(payload)
          if (!result.ok) return toFormErrors(result)
          savedRef.current = result.data
          return undefined
        } catch (error) {
          return thrownToFormErrors(error)
        }
      },
    },
    onSubmitInvalid: () => focusFirstInvalid(formRef.current),
    onSubmit: () => {
      const saved = savedRef.current
      if (!saved) return
      const savedValues = toFormValues(saved)
      setDefaultValues(savedValues)
      form.reset(savedValues, { keepDefaultValues: true })
      onSaved(saved)
    },
  })

  const blocker = useUnsavedChangesBlocker(form)

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void form.handleSubmit()
      }}
    >
      <h2 className="text-2xl font-bold">
        {mode === 'create'
          ? 'New maintenance record'
          : `Edit record #${record.id}`}
      </h2>

      <form.AppForm>
        <form.FormAlert />
      </form.AppForm>

      <form.AppField
        name="assetId"
        children={(field) => (
          <field.SelectField
            label="Asset"
            placeholder="Choose an asset"
            options={assetOptions.map((asset) => ({
              value: asset.id,
              label: `${asset.name} (#${asset.id})`,
            }))}
          />
        )}
      />
      <form.AppField
        name="description"
        children={(field) => <field.TextareaField label="Description" />}
      />
      <form.AppField
        name="technician"
        children={(field) => (
          <field.TextField label="Technician" autoComplete="name" />
        )}
      />
      <form.AppField
        name="status"
        children={(field) => (
          <field.SelectField label="Status" options={STATUS_OPTIONS} />
        )}
      />
      <form.AppField
        name="performedAt"
        children={(field) => <field.DateField label="Performed at" />}
      />
      <form.AppField
        name="cost"
        children={(field) => (
          <field.NumberField
            label="Cost (USD)"
            hint="In dollars, up to 2 decimal places"
            step={0.01}
            min={0}
          />
        )}
      />

      <div className="flex items-center gap-4">
        <form.AppForm>
          <form.SubmitButton
            label={mode === 'create' ? 'Create record' : 'Save changes'}
          />
        </form.AppForm>
        <button type="button" className="mt-6 px-4 py-2" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <UnsavedChangesPrompt blocker={blocker} />
    </form>
  )
}
