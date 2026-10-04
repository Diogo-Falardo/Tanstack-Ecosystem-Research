import { createFormHook } from '@tanstack/react-form'
import { DateField } from './date-field'
import { FormAlert } from './form-alert'
import { fieldContext, formContext } from './form-context'
import { NumberField } from './number-field'
import { SelectField } from './select-field'
import { SubmitButton } from './submit-button'
import { TextField } from './text-field'
import { TextareaField } from './textarea-field'

// The app-wide form hook. Feature forms render `form.AppField` +
// `<field.TextField/>` and never read `field.state` themselves.
export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField,
    TextareaField,
    NumberField,
    DateField,
    SelectField,
  },
  formComponents: { SubmitButton, FormAlert },
})
