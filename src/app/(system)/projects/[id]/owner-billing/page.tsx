import OwnerBillingClientManager from './OwnerBillingClientManager'

export default function OwnerBillingList({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <OwnerBillingClientManager projectId={params.id} />
    </div>
  )
}
