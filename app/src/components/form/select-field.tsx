import { useSelector } from '@tanstack/react-form'
import { FieldError, FieldHint, useFieldA11y } from './field-error'

type OptionValue = string | number

// Option values keep their real type (enum string or numeric id). With a
// `placeholder`, the empty option maps to `null` (e.g. "no asset chosen").
export function SelectField({
  label,
  hint,
  options,
  placeholder,
}: {
  label: string
  hint?: string
  options: Array<{ value: OptionValue; label: string }>
  placeholder?: string
}) {
  const { field, hintId, errorId, showError, message, controlProps } =
    useFieldA11y(hint)
  const value = useSelector(
    field.store,
    (state) => state.value as OptionValue | null,
  )

  return (
    <div className="mt-4 flex flex-col">
      <label htmlFor={field.name} className="font-medium">
        {label}
      </label>
      <FieldHint id={hintId} hint={hint} />
      <select
        {...controlProps}
        className="mt-1 border p-2"
        value={value === null ? '' : String(value)}
        onChange={(e) => {
          const raw = e.target.value
          const option = options.find((o) => String(o.value) === raw)
          field.handleChange(option ? option.value : null)
        }}
      >
        {placeholder !== undefined ? (
          <option value="">{placeholder}</option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError id={errorId} show={showError} message={message} />
    </div>
  )
}
