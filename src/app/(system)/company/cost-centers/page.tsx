import { getAllCostCenters } from '@/actions/store-issues'
import CostCentersClient from './cost-centers-client'

export const metadata = { title: 'مراكز التكلفة | الشركة' }

export default async function CostCentersPage() {
  const costCenters = await getAllCostCenters()
  return <CostCentersClient costCenters={costCenters} />
}
