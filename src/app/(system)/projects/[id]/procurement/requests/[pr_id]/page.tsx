'use client'

import PurchaseRequestView from '@/components/procurement/PurchaseRequestView'

export default function PurchaseRequestDetails({ params }: { params: { id: string, pr_id: string } }) {
  return (
    <div className="pt-2">
      <PurchaseRequestView projectId={params.id} prId={params.pr_id} />
    </div>
  )
}

