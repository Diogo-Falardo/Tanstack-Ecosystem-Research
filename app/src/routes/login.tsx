import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { LoginForm } from '#/features/auth/login-form'
import { safeRedirect } from '#/lib/route-guards'

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  beforeLoad: ({ context, search }) => {
    if (context.user) throw redirect({ href: safeRedirect(search.redirect) })
  },
  component: Login,
})

function Login() {
  const search = Route.useSearch()
  const router = useRouter()

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">Log in</h1>
      <LoginForm
        onLoggedIn={async () => {
          // Re-runs the root beforeLoad so guards see the new user.
          await router.invalidate()
          await router.navigate({ href: safeRedirect(search.redirect) })
        }}
      />
    </div>
  )
}
