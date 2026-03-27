import { getExpenseCategories } from '../actions'
import ExpenseCategoriesClient from './categories-client'

export default async function ExpenseCategoriesPage() {
  const categories = await getExpenseCategories()
  return (
    <div className="p-6" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">أقسام المصروفات</h1>
        <p className="text-sm text-gray-500 mt-1">تصنيف هيراركي لمصروفات الشركة الرئيسية</p>
      </div>
      <ExpenseCategoriesClient categories={categories} />
    </div>
  )
}
