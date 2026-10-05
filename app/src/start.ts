import { createCsrfMiddleware, createStart } from '@tanstack/react-start'

// Without this file Start applies this exact CSRF middleware by default. Once
// a start instance exists, only the middleware listed here runs, so removing
// this line silently leaves every server function open to cross-site calls.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
}))
