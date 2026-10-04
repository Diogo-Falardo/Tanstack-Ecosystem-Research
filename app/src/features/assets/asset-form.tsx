import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { revalidateLogic } from '@tanstack/react-form'
import { useAppForm } from '#/components/form/form-kit'
import {
  UnsavedChangesPrompt,
  focusFirstInvalid,
  useUnsavedChangesBlocker,
} from '#/components/form/form-guards'
import { thrownToFormErrors, toFormErrors } from '#/lib/action-result'
import { assetMutations } from './assets.mutations'
import { assetFormSchema, selectAssetSchema } from './assets.schemas'
import type { Asset, AssetFormValues } from './assets.types'

const STATUS_OPTIONS = selectAssetSchema.shape.status.options.map((status) => ({
  value: status,
  label: status,
}))

function toFormValues(asset: Asset): AssetFormValues {
  return {
    name: asset.name,
    category: asset.category,
    location: asset.location,
    status: asset.status,
  }
}

type Props = {
  onSaved: (asset: Asset) => void
} & ({ mode: 'create'; asset?: undefined } | { mode: 'edit'; asset: Asset })

export function AssetForm({ mode, asset, onSaved }: Props) {
  const createMutation = useMutation(assetMutations.create())
  const updateMutation = useMutation(assetMutations.update())
  const formRef = useRef<HTMLFormElement>(null)
  const savedRef = useRef<Asset | null>(null)

  const [defaultValues, setDefaultValues] = useState<AssetFormValues>(() =>
    asset
      ? toFormValues(asset)
      : { name: '', category: '', location: '', status: 'operational' },
  )

  const form = useAppForm({
    defaultValues,
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: assetFormSchema,
      onSubmitAsync: async ({ value }) => {
        const payload = assetFormSchema.parse(value)
        try {
          const result = asset
            ? await updateMutation.mutateAsync({ id: asset.id, ...payload })
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
      className="max-w-xl"
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void form.handleSubmit()
      }}
    >
      <form.AppForm>
        <form.FormAlert />
      </form.AppForm>

      <form.AppField
        name="name"
        children={(field) => <field.TextField label="Name" />}
      />
      <form.AppField
        name="category"
        children={(field) => <field.TextField label="Category" />}
      />
      <form.AppField
        name="location"
        children={(field) => <field.TextField label="Location" />}
      />
      <form.AppField
        name="status"
        children={(field) => (
          <field.SelectField label="Status" options={STATUS_OPTIONS} />
        )}
      />

      <form.AppForm>
        <form.SubmitButton
          label={mode === 'create' ? 'Create asset' : 'Save changes'}
        />
      </form.AppForm>

      <UnsavedChangesPrompt blocker={blocker} />
    </form>
  )
}
