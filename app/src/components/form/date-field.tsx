import { useSelector } from '@tanstack/react-form'
import { FieldError, FieldHint, useFieldA11y } from './field-error'

// Holds the input's own `YYYY-MM-DD` string; the form schema converts it.
export function DateField({ label, hint }: { label: string; hint?: string }) {
  const { field, hintId, errorId, showError, message, controlProps } =
    useFieldA11y(hint)
  const value = useSelector(field.store, (state) => state.value as string)

  return (
    <div className="mt-4 flex flex-col">
      <label htmlFor={field.name} className="font-medium">
        {label}
      </label>
      <FieldHint id={hintId} hint={hint} />
      <input
        {...controlProps}
        type="date"
        className="mt-1 border p-2"
        value={value}
        onChange={(e) => field.handleChange(e.target.value)}
      />
      <FieldError id={errorId} show={showError} message={message} />
    </div>
  )
}
