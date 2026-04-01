'use client'

import { useParams } from 'next/navigation'
import SupplierInvoiceView from '@/components/procurement/SupplierInvoiceView'

export default function SupplierInvoiceDetailsPage() {
  const params = useParams()
  const projectId = params.id as string
  const invoiceId = params.inv_id as string

  return (
    <div className="p-6 h-full overflow-y-auto">
      <SupplierInvoiceView projectId={projectId} invoiceId={invoiceId} />
    </div>
  )
}
