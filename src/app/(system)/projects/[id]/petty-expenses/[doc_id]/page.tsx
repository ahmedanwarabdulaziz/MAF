import React from 'react'
import { createClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { StatusActions } from './StatusActions'
import { formatDate, formatDateTime } from '@/lib/format'

export const metadata = {
  title: 'تفاصيل مسودة المصروف | نظام إدارة المقاولات'
}

const statusMap: Record<string, { label: string, color: string }> = {
  draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-800' },
  pm_approved: { label: 'موافقة م. المشروع', color: 'bg-blue-50 text-blue-700' },
  gm_approved: { label: 'موافقة الإدارة', color: 'bg-green-50 text-green-700' },
  reimbursed: { label: 'تمت التسوية', color: 'bg-purple-50 text-purple-700' },
  rejected: { label: 'مرفوض', color: 'bg-red-50 text-red-700' },
}

export default async function PettyExpenseDetailPage({ params }: { params: { id: string, doc_id: string } }) {
  const supabase = createClient()

  const { data: expense } = await supabase
    .from('petty_expenses')
    .select(`
      *,
      cost_center:cost_centers(arabic_name, cost_center_code),
      expense_group:expense_groups(arabic_name),
      expense_item:expense_items(arabic_name),
      creator:users!petty_expenses_created_by_fkey(display_name, email),
      pm_approver:users!petty_expenses_pm_approved_by_fkey(display_name),
      gm_approver:users!petty_expenses_gm_approved_by_fkey(display_name),
      cashbox:financial_accounts!petty_expenses_financial_account_id_fkey(arabic_name)
    `)
    .eq('id', params.doc_id)
    .single()

  const { data: costCenters } = await supabase.from('cost_centers').select('id, arabic_name, cost_center_code').order('cost_center_code')

  if (!expense || expense.project_id !== params.id) {
    notFound()
  }

  const s = statusMap[expense.status] || { label: expense.status, color: 'bg-gray-100' }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center space-x-4 space-x-reverse mb-4">
        <Link
          href={`/projects/${params.id}/petty-expenses`}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted hover:text-foreground h-9 w-9 text-muted-foreground"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          <span className="sr-only">عودة للصرفية</span>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">مصروف نثري</h1>
          <p className="text-sm text-muted-foreground">
            تاريخ التسجيل: {formatDateTime(expense.created_at)}
          </p>
        </div>
        <div className="flex-1" />
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${s.color}`}>
          {s.label}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-xl border bg-card text-card-foreground shadow">
            <div className="p-6 border-b flex flex-row items-center space-x-2 space-x-reverse">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-muted-foreground"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
              <h2 className="text-lg font-semibold">تفاصيل المصروف</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">خزينة المشروع المسحوب منها</div>
                  <div className="font-semibold text-base">
                     {expense.cashbox?.arabic_name || 'غير محدد'}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">تاريخ المصروف (الفعلي)</div>
                  <div className="font-semibold text-base">{formatDate(expense.expense_date)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">مركز التكلفة / التبويب</div>
                  <div className="font-medium">
                    {expense.cost_center ? `${expense.cost_center.cost_center_code} - ${expense.cost_center.arabic_name}` : '-'} <br/>
                    {expense.expense_group?.arabic_name || '-'} / {expense.expense_item?.arabic_name || '-'}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">مدخل البيان (المُسجِل)</div>
                  <div className="font-medium">{expense.creator?.display_name || '-'}</div>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <div className="text-sm font-medium text-muted-foreground mb-2">القيمة المسجلة</div>
                <div className="text-3xl font-bold text-red-600">
                  {Number(expense.total_amount).toLocaleString()} <span className="text-lg font-normal text-muted-foreground">ج.م</span>
                </div>
              </div>

              <div className="pt-4 border-t bg-muted/20 -mx-6 -mb-6 p-6 rounded-b-xl">
                <div className="text-sm font-medium text-muted-foreground mb-2">البيان و الملاحظات</div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{expense.notes || 'لا يوجد بيان إضافي'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border bg-card text-card-foreground shadow">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">إجراءات الاعتماد</h2>
            </div>
            <div className="p-6">
              <StatusActions 
                expenseId={expense.id} 
                currentStatus={expense.status} 
                costCenters={costCenters || []}
                currentCostCenterId={expense.cost_center_id}
              />
            </div>
          </div>

          <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase opacity-80 tracking-wider">سجل الموافقات</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-blue-100 p-1 text-blue-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">موافقة م. المشروع</p>
                  <p className="text-sm text-muted-foreground">
                    {expense.pm_approved_at 
                      ? `${expense.pm_approver?.display_name || 'مدير'} - ${formatDateTime(expense.pm_approved_at)}`
                      : 'بانتظار الموافقة'
                    }
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-green-100 p-1 text-green-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">موافقة الإدارة (خصم)</p>
                  <p className="text-sm text-muted-foreground">
                    {expense.gm_approved_at 
                      ? `${expense.gm_approver?.display_name || 'مدير'} - ${formatDateTime(expense.gm_approved_at)}`
                      : 'بانتظار الموافقة'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
