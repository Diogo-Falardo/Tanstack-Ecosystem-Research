import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { AssetForm } from '#/features/assets/asset-form'
import { assetQueries } from '#/features/assets/assets.queries'

export const Route = createFileRoute('/assets/$id/edit')({
  params: {
    parse: ({ id }) => ({ id: z.coerce.number().int().positive().parse(id) }),
    stringify: ({ id }) => ({ id: String(id) }),
  },
  loader: ({ context, params }) =>
    context.queryClient.query({
      ...assetQueries.detail(params.id),
      staleTime: 30_000,
    }),
  component: EditAsset,
})

function EditAsset() {
  const { id } = Route.useParams()
  const { data: asset } = useSuspenseQuery(assetQueries.detail(id))

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">Edit asset #{asset.id}</h1>
      {/* Stays on the page after a save; the form resets to the saved values. */}
      <AssetForm key={asset.id} mode="edit" asset={asset} onSaved={() => {}} />
    </div>
  )
}
