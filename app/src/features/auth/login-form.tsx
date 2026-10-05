import { useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { revalidateLogic } from '@tanstack/react-form'
import { useAppForm } from '#/components/form/form-kit'
import { focusFirstInvalid } from '#/components/form/form-guards'
import { thrownToFormErrors, toFormErrors } from '#/lib/action-result'
import { authMutations } from './auth.mutations'
import { loginInputSchema } from './auth.schemas'
import type { LoginInput, PublicUser } from './auth.types'

const SEEDED_LOGINS = [
  'admin@example.com',
  'tech@example.com',
  'viewer@example.com',
]

export function LoginForm({
  onLoggedIn,
}: {
  onLoggedIn: (user: PublicUser) => Promise<void> | void
}) {
  const loginMutation = useMutation(authMutations.login())
  const formRef = useRef<HTMLFormElement>(null)
  const userRef = useRef<PublicUser | null>(null)

  const form = useAppForm({
    defaultValues: { email: '', password: '' } satisfies LoginInput,
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: loginInputSchema,
      onSubmitAsync: async ({ value }) => {
        const payload = loginInputSchema.parse(value)
        try {
          const result = await loginMutation.mutateAsync(payload)
          if (!result.ok) return toFormErrors(result)
          userRef.current = result.data
          return undefined
        } catch (error) {
          return thrownToFormErrors(error)
        }
      },
    },
    onSubmitInvalid: () => focusFirstInvalid(formRef.current),
    onSubmit: async () => {
      if (userRef.current) await onLoggedIn(userRef.current)
    },
  })

  return (
    <form
      ref={formRef}
      noValidate
      className="max-w-sm"
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
        name="email"
        children={(field) => (
          <field.TextField label="Email" type="email" autoComplete="username" />
        )}
      />
      <form.AppField
        name="password"
        children={(field) => (
          <field.TextField
            label="Password"
            type="password"
            autoComplete="current-password"
          />
        )}
      />

      <form.AppForm>
        <form.SubmitButton label="Log in" pendingLabel="Logging in…" />
      </form.AppForm>

      <p className="mt-6 text-sm text-neutral-500">
        Seeded logins ({SEEDED_LOGINS.join(', ')}) use the password from{' '}
        <code>bun run db:seed-users</code>.
      </p>
    </form>
  )
}
