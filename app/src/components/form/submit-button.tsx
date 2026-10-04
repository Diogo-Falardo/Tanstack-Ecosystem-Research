import { useSelector } from '@tanstack/react-form'
import { useFormContext } from './form-context'

// Disabled only while submitting (blocks duplicate creates). Never gated on
// `canSubmit`: an enabled button lets submit run validation and move focus
// to the first error, and `canSubmit` is true on first render anyway.
export function SubmitButton({
  label,
  pendingLabel = 'Saving…',
}: {
  label: string
  pendingLabel?: string
}) {
  const form = useFormContext()
  const isSubmitting = useSelector(form.store, (state) => state.isSubmitting)

  return (
    <button
      type="submit"
      disabled={isSubmitting}
      aria-busy={isSubmitting}
      className="mt-6 border px-4 py-2 font-medium"
    >
      {isSubmitting ? pendingLabel : label}
    </button>
  )
}
