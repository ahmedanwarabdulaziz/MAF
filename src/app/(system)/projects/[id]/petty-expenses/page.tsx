import React from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { formatDate } from '@/lib/format'
import QuickApproveBtn from './QuickApproveBtn'
import ViewExpenseModalBtn from './ViewExpenseModalBtn'
import EditExpenseModalBtn from './EditExpenseModalBtn'
import NewPettyExpenseModal from './NewPettyExpenseModal'

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
  
  const { data: expenses, error } = await supabase
    .from('petty_expenses')
    .select(`
      id,
      financial_account_id,
      expense_group_id,
      expense_item_id,
      expense_date,
      total_amount,
      status,
      notes,
      attachment_url,
      expense_group:expense_groups(arabic_name),
      expense_item:expense_items(arabic_name),
      cashbox:financial_accounts!petty_expenses_financial_account_id_fkey(arabic_name),
      creator:users!petty_expenses_created_by_fkey(display_name, email),
      pm_approver:users!petty_expenses_pm_approved_by_fkey(display_name),
      gm_approver:users!petty_expenses_gm_approved_by_fkey(display_name)
    `)
    .eq('project_id', params.id)
    .order('created_at', { ascending: false })

  const { data: accounts } = await supabase.from('financial_account_balances_view').select('*').eq('project_id', params.id).eq('is_active', true)
  const { data: groups } = await supabase.from('expense_groups').select('id, arabic_name').eq('is_active', true)
  const { data: items } = await supabase.from('expense_items').select('id, expense_group_id, arabic_name').eq('is_active', true)

  if (error) {
    return (
      <div className="p-8 text-center rounded-xl border border-red-200 bg-red-50 text-red-800 space-y-4 max-w-2xl mx-auto mt-10">
        <h2 className="text-xl font-bold">تحديث قاعدة البيانات مطلوب</h2>
        <p className="text-sm">لم يكتمل تحديث الجداول والعلاقات في قاعدة البيانات لعرض هذه الصفحة.</p>
        <p className="text-xs font-mono bg-white p-2 rounded text-left" dir="ltr">{error.message}</p>
        <p className="text-sm font-semibold">يرجى تنفيذ أمر SQL المتاح في ملف Migration 026 وتحديث الذاكرة عبر `NOTIFY pgrst, 'reload schema'`.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">سجل المصروفات النثرية</h1>
        <NewPettyExpenseModal projectId={params.id} accounts={accounts || []} groups={groups || []} items={items || []} />
      </div>

      <div className="rounded-md border bg-card">
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground w-[120px]">تاريخ المصروف</th>
                <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">خزينة السداد</th>
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
                        <div className="font-medium">{expense.cashbox?.arabic_name || '-'}</div>
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
                      <td className="p-4 align-middle text-left flex items-center justify-end gap-2 text-left" dir="ltr">
                        <QuickApproveBtn expenseId={expense.id} currentStatus={expense.status} />
                        {(expense.status === 'draft' || expense.status === 'rejected') && (
                          <EditExpenseModalBtn 
                            expense={expense} 
                            accounts={accounts || []} 
                            groups={groups || []} 
                            items={items || []} 
                          />
                        )}
                        <ViewExpenseModalBtn expense={expense} />
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
