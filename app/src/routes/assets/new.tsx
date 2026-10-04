import { createFileRoute } from '@tanstack/react-router'
import { AssetForm } from '#/features/assets/asset-form'

export const Route = createFileRoute('/assets/new')({
  component: NewAsset,
})

function NewAsset() {
  const navigate = Route.useNavigate()

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">New asset</h1>
      <AssetForm
        mode="create"
        onSaved={(asset) =>
          navigate({
            to: '/assets/$id/edit',
            params: { id: asset.id },
            ignoreBlocker: true,
          })
        }
      />
    </div>
  )
}
