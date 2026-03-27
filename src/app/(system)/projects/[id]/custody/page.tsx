import React from 'react'
import Link from 'next/link'
import { getCustodyBalances } from '@/actions/custody'

export const metadata = {
  title: 'أرصدة العهد | نظام إدارة المقاولات'
}

export default async function CustodyDashboardPage({ params }: { params: { id: string } }) {
  const balances = await getCustodyBalances(params.id)

  const totalCurrentBalance = balances?.reduce((acc, b) => acc + Number(b.current_balance), 0) || 0
  const totalAllowedDeficit = balances?.reduce((acc, b) => acc + Number(b.allowed_negative_limit), 0) || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">أرصدة العهد للمشروع</h1>
        <Link
          href={`/projects/${params.id}/custody/new-account`}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 h-4 w-4"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          تأسيس عهدة جديدة
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">إجمالي الأرصدة الحالية</h3>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-muted-foreground"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold">{totalCurrentBalance.toLocaleString()} ج.م</div>
            <p className="text-xs text-muted-foreground mt-1">الرصيد الفعلي في حوزة المهندسين</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">إجمالي الحد المسموح بالعجز</h3>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-muted-foreground"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold text-red-600">{totalAllowedDeficit.toLocaleString()} ج.م</div>
            <p className="text-xs text-muted-foreground mt-1">مجموع حدود المصروفات الإضافية المسموحة</p>
          </div>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">سجل العهد المفتوحة</h2>
        </div>
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">صاحب العهدة</th>
                <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">نوع العهدة</th>
                <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">الرصيد الفعلي</th>
                <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">الحد المسموح بالعجز</th>
                <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">السحب المتاح</th>
                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">إجراءات</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {balances && balances.length > 0 ? (
                balances.map((eca: any) => (
                  <tr key={eca.custody_account_id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-4 align-middle">
                      <div className="font-semibold">{eca.employee?.email?.split('@')[0]}</div>
                    </td>
                    <td className="p-4 align-middle">
                      {eca.account_type === 'permanent' ? 'مستديمة' : 'مؤقتة'}
                    </td>
                    <td className="p-4 align-middle font-bold">
                      {Number(eca.current_balance).toLocaleString()} ج.م
                    </td>
                    <td className="p-4 align-middle text-red-600">
                      {Number(eca.allowed_negative_limit).toLocaleString()} ج.م
                    </td>
                    <td className="p-4 align-middle font-mono font-medium text-green-700">
                      {Number(eca.available_spending_power).toLocaleString()} ج.م
                    </td>
                    <td className="p-4 align-middle text-left">
                       {/* Dropdown for view details or add funds */}
                       <Link
                          href={`/projects/${params.id}/custody/expenses/new?account_id=${eca.custody_account_id}`}
                          className="text-xs transition-colors focus-visible:outline-none bg-secondary text-secondary-foreground hover:bg-secondary/80 h-8 px-3 py-1 rounded inline-flex items-center"
                        >
                          تنزيل مصروف
                        </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    لا يوجد أي عهد نشطة في هذا المشروع
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
