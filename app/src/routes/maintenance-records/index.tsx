import { createFileRoute } from '@tanstack/react-router'

// The list lives in route.tsx (layout); the index renders nothing so the
// drawer stays closed.
export const Route = createFileRoute('/maintenance-records/')({
  component: () => null,
})
