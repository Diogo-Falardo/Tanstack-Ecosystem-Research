import { useSelector } from '@tanstack/react-form'
import { FieldError, FieldHint, useFieldA11y } from './field-error'

// Holds `number | null`: an empty input is null, never 0, so "required"
// validation can tell "not entered" from "zero".
export function NumberField({
  label,
  hint,
  step,
  min,
}: {
  label: string
  hint?: string
  step?: number | 'any'
  min?: number
}) {
  const { field, hintId, errorId, showError, message, controlProps } =
    useFieldA11y(hint)
  const value = useSelector(
    field.store,
    (state) => state.value as number | null,
  )

  return (
    <div className="mt-4 flex flex-col">
      <label htmlFor={field.name} className="font-medium">
        {label}
      </label>
      <FieldHint id={hintId} hint={hint} />
      <input
        {...controlProps}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        className="mt-1 border p-2"
        value={value ?? ''}
        onChange={(e) => {
          const next = e.target.valueAsNumber
          field.handleChange(Number.isNaN(next) ? null : next)
        }}
      />
      <FieldError id={errorId} show={showError} message={message} />
    </div>
  )
}
