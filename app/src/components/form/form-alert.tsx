import { useSelector } from '@tanstack/react-form'
import { useFormContext } from './form-context'

// Form-level submit/server error. The region is always mounted so screen
// readers announce the message when it appears.
export function FormAlert() {
  const form = useFormContext()
  const error = useSelector(form.store, (state) => state.errorMap.onSubmit)
  const message = typeof error === 'string' ? error : undefined

  return (
    <div
      role="alert"
      className={message ? 'mt-4 border border-red-700 p-2 text-red-700' : ''}
    >
      {message}
    </div>
  )
}
