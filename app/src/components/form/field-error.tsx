import { useSelector } from '@tanstack/react-form'
import { useFieldContext } from './form-context'
import { shouldShowError } from './should-show-error'

// Errors arrive as plain strings (server `fieldErrors`) or Standard Schema
// issues (the Zod form schema).
function errorMessage(error: unknown): string | undefined {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return undefined
}

// Shared by every field component: the only place outside the components
// themselves that reads field state, so the v2 migration stays in the kit.
export function useFieldA11y(hint?: string) {
  const field = useFieldContext<unknown>()
  const isValid = useSelector(field.store, (state) => state.meta.isValid)
  const isBlurred = useSelector(field.store, (state) => state.meta.isBlurred)
  const errors = useSelector(field.store, (state) => state.meta.errors)
  const submissionAttempts = useSelector(
    field.form.store,
    (state) => state.submissionAttempts,
  )

  const showError = shouldShowError({ isValid, isBlurred }, submissionAttempts)
  const hintId = hint ? `${field.name}-hint` : undefined
  const errorId = `${field.name}-error`
  const describedBy =
    [hintId, showError ? errorId : undefined].filter(Boolean).join(' ') ||
    undefined

  return {
    field,
    hintId,
    errorId,
    showError,
    message: errors.map(errorMessage).find(Boolean),
    controlProps: {
      id: field.name,
      name: field.name,
      onBlur: field.handleBlur,
      'aria-invalid': showError ? ('true' as const) : undefined,
      'aria-describedby': describedBy,
    },
  }
}

// Plain text, not role="alert": per-field alerts are noisy on submit. The
// control's aria-describedby points here instead.
export function FieldError({
  id,
  show,
  message,
}: {
  id: string
  show: boolean
  message: string | undefined
}) {
  if (!show || !message) return null
  return (
    <p id={id} className="mt-1 text-sm text-red-700">
      {message}
    </p>
  )
}

export function FieldHint({ id, hint }: { id?: string; hint?: string }) {
  if (!hint) return null
  return (
    <p id={id} className="text-sm text-gray-600">
      {hint}
    </p>
  )
}
