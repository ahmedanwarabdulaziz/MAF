import { getOwnerBillingDocuments } from '@/actions/owner_billing'
import OwnerBillingClientManager from './OwnerBillingClientManager'

export default async function OwnerBillingList({ params }: { params: { id: string } }) {
  const documents = await getOwnerBillingDocuments(params.id)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <OwnerBillingClientManager documents={documents} projectId={params.id} />
    </div>
  )
}
