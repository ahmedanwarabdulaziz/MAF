import React from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { formatDate } from '@/lib/format'

export const metadata = {
  title: 'المصروفات النثرية | نظام إدارة المقاولات'
}

const statusMap: Record<string, { label: string, color: string }> = {
  draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-800 border-gray-200' },
  pm_approved: { label: 'موافقة م. المشروع', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  gm_approved: { label: 'موافقة الإدارة', color: 'bg-green-50 text-green-700 border-green-200' },
  reimbursed: { label: 'تمت التسوية', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  rejected: { label: 'مرفوض', color: 'bg-red-50 text-red-700 border-red-200' },
}

export default async function PettyExpensesLogPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  
  const { data: expenses } = await supabase
    .from('petty_expenses')
    .select(`
      id,
      expense_date,
      total_amount,
      status,
      notes,
      expense_group:expense_groups(arabic_name),
      expense_item:expense_items(arabic_name),
      creator:users!petty_expenses_created_by_fkey(display_name, email)
    `)
    .eq('project_id', params.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">سجل المصروفات النثرية</h1>
        <Link
          href={`/projects/${params.id}/custody/expenses/new`}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 h-4 w-4"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          تسجيل مصروف جديد
        </Link>
      </div>

      <div className="rounded-md border bg-card">
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground w-[120px]">تاريخ المصروف</th>
                <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">صاحب العهدة</th>
                <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">التبويب</th>
                <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">بند المصروف</th>
                <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">البيان</th>
                <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">القيمة</th>
                <th className="h-10 px-4 text-center align-middle font-medium text-muted-foreground">الحالة</th>
                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {expenses && expenses.length > 0 ? (
                expenses.map((expense: any) => {
                  const s = statusMap[expense.status] || { label: expense.status, color: 'bg-gray-100 text-gray-800' }
                  return (
                    <tr key={expense.id} className="border-b transition-colors hover:bg-muted/50 group">
                      <td className="p-4 align-middle font-mono text-xs">
                        {formatDate(expense.expense_date)}
                      </td>
                      <td className="p-4 align-middle">
                        <div className="font-medium">{expense.creator?.display_name || expense.creator?.email?.split('@')[0]}</div>
                      </td>
                      <td className="p-4 align-middle">
                        {expense.expense_group?.arabic_name || '-'}
                      </td>
                      <td className="p-4 align-middle">
                        {expense.expense_item?.arabic_name || '-'}
                      </td>
                      <td className="p-4 align-middle text-muted-foreground max-w-[200px] truncate">
                        {expense.notes || '-'}
                      </td>
                      <td className="p-4 align-middle font-bold text-red-600">
                        {Number(expense.total_amount).toLocaleString()} ج.م
                      </td>
                      <td className="p-4 align-middle text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${s.color}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="p-4 align-middle text-left">
                        <Link
                          href={`/projects/${params.id}/custody/expenses/${expense.id}`}
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted hover:text-foreground h-8 w-8 text-muted-foreground"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                          <span className="sr-only">عرض</span>
                        </Link>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    لا توجد مصروفات نثرية مسجلة بعد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
