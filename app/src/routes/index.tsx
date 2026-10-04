import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">Welcome to TanStack Start</h1>
      <p className="mt-4 text-lg">
        Edit <code>src/routes/index.tsx</code> to get started.
      </p>
      <ul className="mt-4 list-disc pl-6">
        <li>
          <Link to="/assets/new" className="underline">
            New asset
          </Link>
        </li>
      </ul>
    </div>
  )
}
