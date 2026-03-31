import { getExpenseCategories } from '@/actions/expense_categories'
import { requirePermission, requireSuperAdmin } from '@/lib/auth'
import ExpenseCategoriesManager from './ExpenseCategoriesManager'

export const metadata = {
  title: 'إعدادات بنود المصروفات | نظام إدارة المقاولات'
}

export default async function ExpenseCategoriesPage() {
  // Check permission directly via central auth helper (which checks super_admin internally)
  await requirePermission('corporate_expenses', 'view') // or 'treasury' depending on context

  const { groups, items } = await getExpenseCategories()

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col gap-1 pb-4 border-b">
        <h1 className="text-3xl font-bold tracking-tight">التبويبات المحاسبية للنثريات</h1>
        <p className="text-muted-foreground">
          إدارة مجموعات وبنود المصروفات النثرية التي تظهر في شاشات تسجيل الصرفيات في كافة المشاريع.
        </p>
      </div>

      <ExpenseCategoriesManager initialGroups={groups} initialItems={items} />
    </div>
  )
}
