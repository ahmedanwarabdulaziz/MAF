'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import { payCompanyInvoice, bulkPaySupplier } from '../../actions'
import { paySubcontractorCertificate, bulkPaySubcontractor } from '@/actions/certificates'
import { bulkPaySupplierInvoices } from '@/actions/procurement'
import ViewInvoiceModal from '../../ViewInvoiceModal'
import { requestRetentionRelease, approveRetentionRelease, payRetentionRelease, RetentionMetric } from '@/actions/retention'

const STATUS_LABELS: Record<string, { label: string; badgeClass: string }> = {
  draft:          { label: 'مسودة',          badgeClass: 'bg-gray-100 text-gray-700' },
  posted:         { label: 'مُرحَّلة',       badgeClass: 'bg-blue-100 text-blue-700' },
  pending_receipt:{ label: 'انتظار استلام',  badgeClass: 'bg-orange-100 text-orange-700' },
  partially_paid: { label: 'مدفوعة جزئياً', badgeClass: 'bg-yellow-100 text-yellow-700' },
  paid:           { label: 'مدفوعة',         badgeClass: 'bg-green-100 text-green-700' },
  cancelled:      { label: 'ملغية',           badgeClass: 'bg-red-100 text-red-700' },
  approved:       { label: 'اعتمدت',         badgeClass: 'bg-blue-100 text-blue-700' },
  paid_in_full:   { label: 'مسددة بالكامل',  badgeClass: 'bg-green-100 text-green-700' },
}

const TYPE_LABELS: Record<string, string> = {
  general_expense: 'مصروف عام',
  stock_purchase: 'شراء للمخزن',
}

export default function VendorStatementClient({ 
  party, 
  companyInvoices, 
  projectInvoices, 
  certificates, 
  retentionMetrics, 
  retentionReleases, 
  accounts 
}: { 
  party: any; 
  companyInvoices: any[]; 
  projectInvoices: any[]; 
  certificates: any[]; 
  retentionMetrics: RetentionMetric[];
  retentionReleases: any[];
  accounts: any[] 
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Per-invoice Payment Modal State
  const [payInvoiceId, setPayInvoiceId] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState(0)
  const [payAccountId, setPayAccountId] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [payRef, setPayRef] = useState('')

  // Bulk Payment Modal State
  const [showBulkPay, setShowBulkPay] = useState(false)
  const [bulkScope, setBulkScope] = useState<string>('')
  const [bulkAmount, setBulkAmount] = useState(0)
  const [bulkAccountId, setBulkAccountId] = useState('')
  const [bulkMethod, setBulkMethod] = useState('cash')
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().split('T')[0])
  const [bulkRef, setBulkRef] = useState('')
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [bulkSuccess, setBulkSuccess] = useState<{ voucherNo: string; allocations: { invoiceNo: string; amount: number }[] } | null>(null)

  // Subcontractor Certificate Payment Modal State
  const [payCertId, setPayCertId] = useState<string | null>(null)

  // Subcontractor Bulk Payment Modal State
  const [showBulkSubPay, setShowBulkSubPay] = useState(false)
  const [bulkSubProjectId, setBulkSubProjectId] = useState('')
  const [bulkSubSuccess, setBulkSubSuccess] = useState<{ voucherNo: string; allocations: { certNo: string; amount: number }[] } | null>(null)

  // Retention Release State
  const [showReqRetention, setShowReqRetention] = useState(false)
  const [reqRetProject, setReqRetProject] = useState('')
  const [reqRetAmount, setReqRetAmount] = useState(0)
  const [reqRetDate, setReqRetDate] = useState(new Date().toISOString().split('T')[0])
  const [reqRetNotes, setReqRetNotes] = useState('')

  const [approveRetId, setApproveRetId] = useState<string | null>(null)
  
  const [payRetId, setPayRetId] = useState<string | null>(null)
  const [payRetAmount, setPayRetAmount] = useState(0)

  const fmt = (n: number) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })

  // Summary Metrics (Combo)
  const computeMetrics = (list: any[]) => list.reduce((acc, inv) => {
    if (['posted', 'partially_paid', 'paid', 'approved', 'paid_in_full'].includes(inv.status)) {
      const rtAmt = Number(inv.returned_amount || 0)
      acc.total_gross += Number(inv.gross_amount)
      acc.total_net += (Number(inv.net_amount) - rtAmt)
      acc.total_returned += rtAmt
      acc.total_paid += Number(inv.paid_to_date)
      acc.total_outstanding += Number(inv.outstanding_amount)
    }
    return acc
  }, { total_gross: 0, total_net: 0, total_paid: 0, total_outstanding: 0, total_returned: 0 })

  const compMetrics = computeMetrics(companyInvoices)
  const projMetrics = computeMetrics(projectInvoices)
  const certMetrics = computeMetrics(certificates || [])

  const summary = {
    total_net: compMetrics.total_net + projMetrics.total_net + certMetrics.total_net,
    total_paid: compMetrics.total_paid + projMetrics.total_paid + certMetrics.total_paid,
    total_returned: compMetrics.total_returned + projMetrics.total_returned + certMetrics.total_returned,
    total_outstanding: compMetrics.total_outstanding + projMetrics.total_outstanding + certMetrics.total_outstanding,
  }

  // Group Project Invoices by Project
  const projectsGroup = useMemo(() => {
    const groups: Record<string, any[]> = {}
    projectInvoices.forEach(inv => {
      const pName = inv.project?.arabic_name || 'مشروع غير معروف'
      if (!groups[pName]) groups[pName] = []
      groups[pName].push(inv)
    })
    return groups
  }, [projectInvoices])

  // Group Certificates by Project
  const certificatesGroup = useMemo(() => {
    const groups: Record<string, any[]> = {}
    ;(certificates || []).forEach(cert => {
      const pName = cert.project?.arabic_name || 'مشروع غير معروف'
      if (!groups[pName]) groups[pName] = []
      groups[pName].push(cert)
    })
    return groups
  }, [certificates])

  // Get distinct projects for Subcontractor bulk pay dropdown
  const subcontractorProjects = useMemo(() => {
    const projMap = new Map<string, string>()
    ;(certificates || []).forEach(c => {
      if (c.project_id && c.project?.arabic_name) {
        projMap.set(c.project_id, c.project.arabic_name)
      }
    })
    return Array.from(projMap.entries()).map(([id, name]) => ({ id, name }))
  }, [certificates])

  // Get distinct projects for Supplier bulk pay dropdown
  const supplierProjects = useMemo(() => {
    const projMap = new Map<string, string>()
    ;(projectInvoices || []).forEach(i => {
      if (i.project_id && i.project?.arabic_name) {
        projMap.set(i.project_id, i.project.arabic_name)
      }
    })
    return Array.from(projMap.entries()).map(([id, name]) => ({ id, name }))
  }, [projectInvoices])

  const totalOutstandingSub = (projectId: string) => {
    return (certificates || [])
      .filter(c => c.project_id === projectId && ['approved', 'partially_paid'].includes(c.status) && Number(c.outstanding_amount) > 0)
      .reduce((sum, c) => sum + Number(c.outstanding_amount), 0)
  }

  // Live preview for subcontractor bulk payment allocation
  const bulkSubAllocationPreview = useMemo(() => {
    if (!bulkSubProjectId) return []
    const payableCerts = [...(certificates || [])]
      .filter(c => c.project_id === bulkSubProjectId && ['approved', 'partially_paid'].includes(c.status) && Number(c.outstanding_amount) > 0)
      .sort((a, b) => {
        if (a.created_at < b.created_at) return -1
        if (a.created_at > b.created_at) return 1
        return 0
      })
    let remaining = bulkAmount
    return payableCerts.map(cert => {
      const outstanding = Number(cert.outstanding_amount)
      const allocated = Math.min(remaining, outstanding)
      remaining = Math.max(0, remaining - allocated)
      return { ...cert, allocated, willBePaid: allocated > 0 }
    }).filter(c => c.willBePaid)
  }, [bulkAmount, bulkSubProjectId, certificates])

  // Live preview for bulk payment allocation (oldest → newest)
  const bulkAllocationPreview = useMemo(() => {
    if (!bulkScope) return []
    const sourceList = bulkScope === 'company' 
      ? companyInvoices 
      : projectInvoices.filter(i => i.project_id === bulkScope)

    const payableInvoices = [...sourceList]
      .filter(i => ['posted', 'partially_paid'].includes(i.status) && Number(i.outstanding_amount) > 0)
      .sort((a, b) => {
        if (a.invoice_date < b.invoice_date) return -1
        if (a.invoice_date > b.invoice_date) return 1
        return 0
      })
    let remaining = bulkAmount
    return payableInvoices.map(inv => {
      const outstanding = Number(inv.outstanding_amount)
      const allocated = Math.min(remaining, outstanding)
      remaining = Math.max(0, remaining - allocated)
      return { ...inv, allocated, willBePaid: allocated > 0 }
    }).filter(i => i.willBePaid)
  }, [bulkAmount, bulkScope, companyInvoices, projectInvoices])

  const totalOutstandingScope = useMemo(() => {
    if (bulkScope === 'company') {
      return companyInvoices
        .filter(i => ['posted', 'partially_paid'].includes(i.status) && Number(i.outstanding_amount) > 0)
        .reduce((sum, i) => sum + Number(i.outstanding_amount), 0)
    } else if (bulkScope) {
      return projectInvoices
        .filter(i => i.project_id === bulkScope && ['posted', 'partially_paid'].includes(i.status) && Number(i.outstanding_amount) > 0)
        .reduce((sum, i) => sum + Number(i.outstanding_amount), 0)
    }
    return 0
  }, [bulkScope, companyInvoices, projectInvoices])

  const totalOutstandingCompany = companyInvoices
    .filter(i => ['posted', 'partially_paid'].includes(i.status) && Number(i.outstanding_amount) > 0)
    .reduce((sum, i) => sum + Number(i.outstanding_amount), 0)

  const hasAnyProjectOutstanding = projectInvoices.some(i => ['posted', 'partially_paid'].includes(i.status) && Number(i.outstanding_amount) > 0)

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault()
    if (!payInvoiceId) return
    if (!payAccountId) return setError('يرجى اختيار حساب الخزينة/البنك')
    
    const maxAmt = companyInvoices.find(i => i.id === payInvoiceId)?.outstanding_amount || 0
    if (payAmount <= 0 || payAmount > maxAmt) return setError('المبلغ المدخل غير صالح')

    setError(null)
    startTransition(async () => {
      try {
        await payCompanyInvoice(payInvoiceId, {
          financial_account_id: payAccountId,
          payment_method: payMethod,
          payment_date: payDate,
          amount: payAmount,
          receipt_reference_no: payRef,
        })
        setPayInvoiceId(null)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'خطأ في السداد')
      }
    })
  }

  const handleBulkPay = (e: React.FormEvent) => {
    e.preventDefault()
    if (!bulkScope) return setBulkError('يرجى اختيار النطاق أولاً')
    if (!bulkAccountId) return setBulkError('يرجى اختيار حساب الخزينة/البنك')
    if (bulkAmount <= 0) return setBulkError('يرجى إدخال مبلغ صحيح')
    
    if (bulkAmount > totalOutstandingScope) return setBulkError(`المبلغ أكبر من إجمالي المستحق (${fmt(totalOutstandingScope)} ج.م)`)
    if (bulkAllocationPreview.length === 0) return setBulkError('لا توجد فواتير مستحقة يمكن السداد عليها')

    setBulkError(null)
    startTransition(async () => {
      try {
        let result;
        if (bulkScope === 'company') {
          result = await bulkPaySupplier(party.id, {
            financial_account_id: bulkAccountId,
            payment_method: bulkMethod,
            payment_date: bulkDate,
            amount: bulkAmount,
            receipt_reference_no: bulkRef,
          })
        } else {
          result = await bulkPaySupplierInvoices(party.id, bulkScope, {
            financial_account_id: bulkAccountId,
            payment_method: bulkMethod,
            payment_date: bulkDate,
            amount: bulkAmount,
            receipt_reference_no: bulkRef,
          })
        }
        setBulkSuccess(result)
      } catch (e: unknown) {
        setBulkError(e instanceof Error ? e.message : 'خطأ في السداد')
      }
    })
  }

  const handlePaySub = (e: React.FormEvent) => {
    e.preventDefault()
    if (!payCertId) return
    if (!payAccountId) return setError('يرجى اختيار الحساب')
    
    const maxAmt = certificates.find(c => c.id === payCertId)?.outstanding_amount || 0
    if (payAmount <= 0 || payAmount > maxAmt) return setError('المبلغ المدخل غير صالح')

    setError(null)
    startTransition(async () => {
      try {
        await paySubcontractorCertificate(payCertId, {
          financial_account_id: payAccountId,
          payment_method: payMethod,
          payment_date: payDate,
          amount: payAmount,
          receipt_reference_no: payRef,
        })
        setPayCertId(null)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'خطأ في السداد')
      }
    })
  }

  const handleBulkSubPay = (e: React.FormEvent) => {
    e.preventDefault()
    if (!bulkSubProjectId) return setBulkError('يرجى اختيار المشروع أولاً')
    if (!bulkAccountId) return setBulkError('يرجى اختيار الحساب')
    if (bulkAmount <= 0) return setBulkError('يرجى إدخال مبلغ صحيح')
    
    const maxPoss = totalOutstandingSub(bulkSubProjectId)
    if (bulkAmount > maxPoss) return setBulkError(`المبلغ أكبر من إجمالي المستحق (${fmt(maxPoss)} ج.م)`)
    if (bulkSubAllocationPreview.length === 0) return setBulkError('لا توجد مستخلصات مستحقة في هذا المشروع')

    setBulkError(null)
    startTransition(async () => {
      try {
        const result = await bulkPaySubcontractor(party.id, bulkSubProjectId, {
          financial_account_id: bulkAccountId,
          payment_method: bulkMethod,
          payment_date: bulkDate,
          amount: bulkAmount,
          receipt_reference_no: bulkRef,
        })
        setBulkSubSuccess(result)
      } catch (e: unknown) {
        setBulkError(e instanceof Error ? e.message : 'خطأ في السداد')
      }
    })
  }

  const handleReqRet = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reqRetProject) return setError('يرجى اختيار المشروع')
    if (reqRetAmount <= 0) return setError('يرجى إدخال مبلغ صحيح')

    setError(null)
    startTransition(async () => {
      try {
        await requestRetentionRelease(party.id, reqRetProject, {
          amount: reqRetAmount,
          release_date: reqRetDate,
          notes: reqRetNotes
        })
        setShowReqRetention(false)
        setReqRetProject('')
        setReqRetAmount(0)
        setReqRetNotes('')
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'خطأ في طلب الاسترداد')
      }
    })
  }

  const handleConfirmApprove = () => {
    if (!approveRetId) return
    startTransition(async () => {
      try {
        await approveRetentionRelease(approveRetId, party.id)
        setApproveRetId(null)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'خطأ في الاعتماد')
      }
    })
  }

  const handlePayRet = (e: React.FormEvent) => {
    e.preventDefault()
    if (!payRetId) return
    if (!payAccountId) return setError('يرجى اختيار حساب الخزينة/البنك')
    
    setError(null)
    startTransition(async () => {
      try {
        await payRetentionRelease(payRetId, party.id, {
          amount: payRetAmount,
          financial_account_id: payAccountId,
          payment_method: payMethod,
          payment_date: payDate,
          reference_no: payRef,
        })
        setPayRetId(null)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'خطأ في السداد')
      }
    })
  }

  const selectedInvoiceAmount = payInvoiceId ? companyInvoices.find(i => i.id === payInvoiceId)?.outstanding_amount : 0
  const selectedCertAmount = payCertId ? certificates.find(c => c.id === payCertId)?.outstanding_amount : 0

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/company/purchases/suppliers" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
              العودة لقائمة الموردين
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-navy border-b-2 border-primary pb-2 inline-block">
            {party.arabic_name}
          </h1>
          <p className="text-gray-500 mt-2 text-sm">{party.email ? `${party.email} | ` : ''}الهاتف: {party.phone || 'غير مسجل'}</p>
        </div>
        <div className="flex gap-2 shrink-0 pt-2 flex-wrap justify-end max-w-sm">
          {(totalOutstandingCompany > 0 || hasAnyProjectOutstanding) && (
            <div className="text-center">
              <button
                onClick={() => {
                  setShowBulkPay(true)
                  setBulkScope('')
                  setBulkAmount(0)
                  setBulkAccountId('')
                  setBulkRef('')
                  setBulkError(null)
                  setBulkSuccess(null)
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all duration-200 whitespace-nowrap"
              >
                دفعة شاملة للمورد
              </button>
            </div>
          )}
          {retentionMetrics.some(m => m.available_balance > 0) && (
            <div className="text-center">
              <button
                onClick={() => {
                  setShowReqRetention(true)
                  setReqRetAmount(0)
                  setReqRetProject('')
                  setReqRetNotes('')
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-l from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all duration-200 whitespace-nowrap"
              >
                صرف تعلية 
              </button>
            </div>
          )}
          {certificates && certificates.length > 0 && subcontractorProjects.length > 0 && (
            <div className="text-center">
              <button
                onClick={() => {
                  setShowBulkSubPay(true)
                  setBulkSubProjectId('')
                  setBulkAmount(0)
                  setBulkAccountId('')
                  setBulkRef('')
                  setBulkError(null)
                  setBulkSubSuccess(null)
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-l from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all duration-200 whitespace-nowrap"
              >
                دفعة شاملة مقاول
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 text-danger px-4 py-3 rounded-lg border border-danger/20 text-sm">
          {error}
        </div>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <p className="text-sm font-semibold text-text-secondary mb-1">إجمالي الفواتير والمستخلصات</p>
          <p className="text-2xl font-black text-navy dir-ltr text-right">{fmt(summary.total_net)} ج.م</p>
        </div>
        <div className="bg-white p-5 rounded-xl border shadow-sm border-l-4 border-l-success">
          <p className="text-sm font-semibold text-text-secondary mb-1">المسدد للمورد/المقاول</p>
          <p className="text-2xl font-black text-success dir-ltr text-right">{fmt(summary.total_paid)} ج.م</p>
        </div>
        <div className="bg-white p-5 rounded-xl border shadow-sm border-l-4 border-l-purple-500">
          <p className="text-sm font-semibold text-text-secondary mb-1">المرتجعات والتخفيضات</p>
          <p className="text-2xl font-black text-purple-700 dir-ltr text-right">{fmt(summary.total_returned)} ج.م</p>
        </div>
        <div className="bg-white p-5 rounded-xl border shadow-sm border-l-4 border-l-danger">
          <p className="text-sm font-semibold text-text-secondary mb-1">المستحق الحالي (عامل)</p>
          <p className="text-2xl font-black text-danger dir-ltr text-right">{fmt(summary.total_outstanding)} ج.م</p>
        </div>
        <div className="bg-white p-5 rounded-xl border shadow-sm border-l-4 border-l-orange-500">
          <p className="text-sm font-semibold text-text-secondary mb-1">تعلية متاحة للاسترداد</p>
          <p className="text-2xl font-black text-orange-600 dir-ltr text-right">{fmt(retentionMetrics.reduce((s, m) => s + m.available_balance, 0))} ج.م</p>
        </div>
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <p className="text-sm font-semibold text-text-secondary mb-1">عدد الحركات (الكلي)</p>
          <p className="text-2xl font-black text-navy dir-ltr text-right">{companyInvoices.length + projectInvoices.length + (certificates || []).length}</p>
        </div>
      </div>

      <p className="text-sm text-text-tertiary">يعرض هذا الكشف الفواتير منفصلة لكل قطاع ومشروع لتسهيل متابعة المديونيات المركزية.</p>

      {/* Corporate Invoices List */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden mt-6">
        <div className="px-5 py-4 border-b bg-background-secondary flex items-center justify-between">
          <h2 className="font-bold text-navy text-lg flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary mx-1"></span>
            فواتير ومشتريات الشركة الرئيسية
          </h2>
          <span className="text-xs bg-white border border-border px-2 py-1 rounded text-text-secondary">يعرض مدفوعات الخزينة الرئيسية</span>
        </div>
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-50 border-b text-gray-600">
            <tr>
              <th className="px-4 py-3 font-semibold">رقم الفاتورة</th>
              <th className="px-4 py-3 font-semibold">التاريخ</th>
              <th className="px-4 py-3 font-semibold">النوع / القسم</th>
              <th className="px-4 py-3 font-semibold">الإجمالي الأصلي</th>
              <th className="px-4 py-3 font-semibold text-purple-700">المرتجع</th>
              <th className="px-4 py-3 font-semibold text-success">المسدد</th>
              <th className="px-4 py-3 font-semibold text-danger">المتبقي</th>
              <th className="px-4 py-3 font-semibold text-center">الحالة</th>
              <th className="px-4 py-3 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {companyInvoices.map((inv) => {
              const status = STATUS_LABELS[inv.status] || { label: inv.status, badgeClass: 'bg-gray-100 text-gray-700' }
              const canPay = ['posted', 'partially_paid'].includes(inv.status) && Number(inv.outstanding_amount) > 0
              const contextLabel = inv.invoice_type === 'general_expense' 
                ? (inv.expense_category?.arabic_name ?? '—') 
                : (inv.warehouse?.arabic_name ?? '—')

              return (
                <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-primary">
                    <Link href={`/company/purchases/${inv.id}`}>{inv.invoice_no}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dir-ltr text-right">{inv.invoice_date}</td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900 font-medium">{TYPE_LABELS[inv.invoice_type]}</div>
                    <div className="text-xs text-text-tertiary">{contextLabel}</div>
                  </td>
                  <td className="px-4 py-3 dir-ltr text-right text-gray-500">{fmt(inv.net_amount)}</td>
                  <td className="px-4 py-3 text-purple-700 font-medium dir-ltr text-right">{Number(inv.returned_amount || 0) > 0 ? fmt(inv.returned_amount) : '—'}</td>
                  <td className="px-4 py-3 text-success font-medium dir-ltr text-right">{fmt(inv.paid_to_date)}</td>
                  <td className="px-4 py-3 font-bold text-gray-900 dir-ltr text-right">
                     <span className={Number(inv.outstanding_amount) > 0 ? 'text-danger' : Number(inv.outstanding_amount) < 0 ? 'text-purple-600' : 'text-gray-500'}>
                        {fmt(inv.outstanding_amount)}
                     </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold ${status.badgeClass}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center space-x-2 space-x-reverse flex justify-center">
                    {canPay && (
                      <button
                        onClick={() => {
                          setPayInvoiceId(inv.id)
                          setPayAmount(inv.outstanding_amount)
                          setPayAccountId('')
                          setPayRef('')
                          setError(null)
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success rounded text-xs font-bold hover:bg-success/20 transition-colors shadow-sm"
                      >
                        سداد الدفعة
                      </button>
                    )}
                    <ViewInvoiceModal id={inv.id} />
                  </td>
                </tr>
              )
            })}
            {companyInvoices.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">لا توجد فواتير للشركة الرئيسية مبنية على هذا المورد.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Project Invoices Lists */}
      {Object.entries(projectsGroup).map(([projectName, prjInvoices]) => (
        <div key={projectName} className="bg-white rounded-xl shadow-sm border overflow-hidden mt-6">
          <div className="px-5 py-4 border-b bg-amber-50/30 flex items-center justify-between">
            <h2 className="font-bold text-amber-900 text-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 mx-1"></span>
              فواتير مشروع: {projectName}
            </h2>
            <span className="text-xs bg-white border border-border px-2 py-1 rounded text-text-secondary">تسدد الفواتير من خزائن المشروع</span>
          </div>
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 border-b text-gray-600">
              <tr>
                <th className="px-4 py-3 font-semibold">رقم الفاتورة</th>
                <th className="px-4 py-3 font-semibold">تاريخ المطالبة</th>
                <th className="px-4 py-3 font-semibold">الإجمالي الأصلي</th>
                <th className="px-4 py-3 font-semibold text-purple-700">المرتجع</th>
                <th className="px-4 py-3 font-semibold text-success">المسدد</th>
                <th className="px-4 py-3 font-semibold text-danger">المتبقي</th>
                <th className="px-4 py-3 font-semibold text-center">حالة الفحص / المخزن</th>
                <th className="px-4 py-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {prjInvoices.map((inv) => {
                const status = STATUS_LABELS[inv.status] || { label: inv.status, badgeClass: 'bg-gray-100 text-gray-700' }
                
                return (
                  <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-amber-700">
                      {inv.invoice_no}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dir-ltr text-right">{inv.invoice_date}</td>
                    <td className="px-4 py-3 dir-ltr text-right text-gray-500">{fmt(inv.net_amount)}</td>
                    <td className="px-4 py-3 text-purple-700 font-medium dir-ltr text-right">{Number(inv.returned_amount || 0) > 0 ? fmt(inv.returned_amount) : '—'}</td>
                    <td className="px-4 py-3 text-success font-medium dir-ltr text-right">{fmt(inv.paid_to_date)}</td>
                    <td className="px-4 py-3 font-bold text-gray-900 dir-ltr text-right">
                       <span className={Number(inv.outstanding_amount) > 0 ? 'text-danger' : Number(inv.outstanding_amount) < 0 ? 'text-purple-600' : 'text-gray-500'}>
                          {fmt(inv.outstanding_amount)}
                       </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold ${status.badgeClass}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center space-x-2 space-x-reverse flex justify-center">
                      <Link
                        href={`/projects/${inv.project_id}/procurement/invoices/${inv.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded text-text-primary bg-white hover:bg-background-secondary text-xs font-bold transition-colors"
                      >
                        عرض الفاتورة أو دفعها
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* Subcontractor Certificates Lists */}
      {Object.entries(certificatesGroup).map(([projectName, prjCerts]) => (
        <div key={`cert-${projectName}`} className="bg-white rounded-xl shadow-sm border overflow-hidden mt-6">
          <div className="px-5 py-4 border-b bg-indigo-50/50 flex items-center justify-between">
            <h2 className="font-bold text-indigo-900 text-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 mx-1"></span>
              مستخلصات مشروع: {projectName}
            </h2>
            <span className="text-xs bg-white border border-border px-2 py-1 rounded text-text-secondary">تسدد من خزائن المشروع</span>
          </div>
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 border-b text-gray-600">
              <tr>
                <th className="px-4 py-3 font-semibold">رقم المستخلص</th>
                <th className="px-4 py-3 font-semibold">رقم العقد</th>
                <th className="px-4 py-3 font-semibold">الإجمالي الأصلي</th>
                <th className="px-4 py-3 font-semibold text-purple-700">الاستقطاعات</th>
                <th className="px-4 py-3 font-semibold text-success">المسدد</th>
                <th className="px-4 py-3 font-semibold text-danger">المتبقي</th>
                <th className="px-4 py-3 font-semibold text-center">الحالة</th>
                <th className="px-4 py-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {prjCerts.map((cert) => {
                const status = STATUS_LABELS[cert.status] || { label: cert.status, badgeClass: 'bg-gray-100 text-gray-700' }
                const canPay = ['approved', 'partially_paid'].includes(cert.status) && Number(cert.outstanding_amount) > 0

                return (
                  <tr key={cert.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-indigo-700">
                      <Link href={`/projects/${cert.project_id}/certificates/${cert.id}`}>{cert.certificate_no}</Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dir-ltr text-right">{cert.agreement?.agreement_code || '—'}</td>
                    <td className="px-4 py-3 dir-ltr text-right text-gray-500">{fmt(cert.net_amount)} ج.م</td>
                    <td className="px-4 py-3 text-purple-700 font-medium dir-ltr text-right">{Number(cert.returned_amount || 0) > 0 ? fmt(cert.returned_amount) : '—'}</td>
                    <td className="px-4 py-3 text-success font-medium dir-ltr text-right">{fmt(cert.paid_to_date)} ج.م</td>
                    <td className="px-4 py-3 font-bold text-gray-900 dir-ltr text-right">
                       <span className={Number(cert.outstanding_amount) > 0 ? 'text-danger' : Number(cert.outstanding_amount) < 0 ? 'text-purple-600' : 'text-gray-500'}>
                          {fmt(cert.outstanding_amount)} ج.م
                       </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold ${status.badgeClass}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center space-x-2 space-x-reverse flex justify-center">
                      {canPay && (
                        <button
                          onClick={() => {
                            setPayCertId(cert.id)
                            setPayAmount(cert.outstanding_amount)
                            setPayAccountId('')
                            setPayRef('')
                            setError(null)
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success rounded text-xs font-bold hover:bg-success/20 transition-colors shadow-sm"
                        >
                          سداد المستخلص
                        </button>
                      )}
                      <Link
                        href={`/projects/${cert.project_id}/certificates/${cert.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded text-text-primary bg-white hover:bg-background-secondary text-xs font-bold transition-colors"
                      >
                        التفاصيل
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

      {retentionReleases && retentionReleases.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden mt-6">
          <div className="px-5 py-4 border-b bg-orange-50 flex items-center justify-between">
            <h2 className="font-bold text-orange-900 text-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-600 mx-1"></span>
              طلبات استرداد التعلية (ضمان الأعمال)
            </h2>
            <span className="bg-orange-100 text-orange-800 text-xs py-1 px-3 rounded-full font-bold">
              {retentionReleases.length} طلب
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50/80 text-gray-700 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-semibold">تاريخ الطلب</th>
                  <th className="px-4 py-3 font-semibold">المشروع</th>
                  <th className="px-4 py-3 font-semibold">المبلغ المطلوب</th>
                  <th className="px-4 py-3 font-semibold text-center">الحالة</th>
                  <th className="px-4 py-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {retentionReleases.map(rel => {
                  let statusBadge = ''
                  let statusName = ''
                  switch(rel.status) {
                    case 'draft': statusBadge = 'bg-gray-100 text-gray-700'; statusName = 'مسودة'; break;
                    case 'pending_approval': statusBadge = 'bg-blue-100 text-blue-700'; statusName = 'انتظار الاعتماد'; break;
                    case 'approved': statusBadge = 'bg-yellow-100 text-yellow-700'; statusName = 'معتمد (بانتظار السداد)'; break;
                    case 'paid': statusBadge = 'bg-green-100 text-green-700'; statusName = 'تم السداد'; break;
                    default: statusBadge = 'bg-gray-100'; statusName = rel.status;
                  }
                  
                  return (
                    <tr key={rel.id} className="hover:bg-orange-50/30 transition-colors">
                      <td className="px-4 py-3 text-gray-600">{new Date(rel.created_at).toLocaleDateString('en-GB')}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{rel.project?.arabic_name}</td>
                      <td className="px-4 py-3 font-bold text-orange-700 dir-ltr text-right">{fmt(rel.released_amount)} ج.م</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold ${statusBadge}`}>
                          {statusName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center space-x-2 space-x-reverse flex justify-center">
                        {rel.status === 'pending_approval' && (
                          <button
                            onClick={() => setApproveRetId(rel.id)}
                            className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 rounded text-xs font-bold hover:bg-blue-200 transition-colors"
                          >
                            اعتماد الطلب
                          </button>
                        )}
                        {rel.status === 'approved' && (
                          <button
                            onClick={() => {
                              setPayRetId(rel.id)
                              setPayRetAmount(rel.released_amount)
                              setPayAccountId('')
                              setPayRef('')
                              setError(null)
                            }}
                            className="inline-flex items-center px-3 py-1.5 bg-success/10 text-success rounded text-xs font-bold hover:bg-success/20 transition-colors"
                          >
                            سداد 
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Modal for Company Invoices */}
      {payInvoiceId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">سداد الفاتورة (خزينة الشركة الرئيسية)</h3>
              <button 
                onClick={() => setPayInvoiceId(null)} 
                disabled={isPending}
                className="text-gray-400 hover:text-gray-600 transition"
              >✕</button>
            </div>
            <form onSubmit={handlePay} className="p-6 space-y-5">
              
              <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 flex justify-between items-center text-sm">
                <span className="text-gray-600">المبلغ المستحق كحد أقصى:</span>
                <span className="font-bold text-blue-700 dir-ltr text-right">{fmt(selectedInvoiceAmount || 0)} ج.م</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">حساب السداد (الخزينة/البنك) *</label>
                <select
                  required
                  value={payAccountId}
                  onChange={e => setPayAccountId(e.target.value)}
                  className="w-full rounded-lg border-gray-300 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                >
                  <option value="">-- اختر الحساب الذي سيتم الدفع منه --</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.financial_account_id}>
                      {acc.arabic_name} {acc.project ? `(مشروع ${acc.project.arabic_name})` : '(حساب رئيسي)'} - متاح: {fmt(acc.current_balance)} {acc.currency}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ المراد سداده *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedInvoiceAmount}
                    required
                    dir="ltr"
                    value={payAmount}
                    onChange={e => setPayAmount(Number(e.target.value))}
                    className="w-full rounded-lg border-gray-300 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-medium text-right"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ السداد *</label>
                  <input
                    type="date"
                    required
                    dir="ltr"
                    value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                    className="w-full rounded-lg border-gray-300 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm text-right"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">طريقة الدفع *</label>
                  <select
                    required
                    value={payMethod}
                    onChange={e => setPayMethod(e.target.value)}
                    className="w-full rounded-lg border-gray-300 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  >
                    <option value="cash">نقدي</option>
                    <option value="bank_transfer">تحويل بنكي</option>
                    <option value="cheque">شيك</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">رقم مرجعي / شيك</label>
                  <input
                    type="text"
                    value={payRef}
                    onChange={e => setPayRef(e.target.value)}
                    dir="ltr"
                    placeholder="اختياري"
                    className="w-full rounded-lg border-gray-300 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm text-right"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 bg-primary text-white rounded-lg py-2.5 font-bold hover:bg-primary/90 transition shadow-sm disabled:opacity-50"
                >
                  {isPending ? 'جاري السداد وتحديث الأرصدة...' : 'تأكيد السداد'}
                </button>
                <button
                  type="button"
                  onClick={() => setPayInvoiceId(null)}
                  disabled={isPending}
                  className="px-5 py-2.5 border border-border rounded-lg text-text-primary hover:bg-background-secondary font-bold transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal for Subcontractor Certificates */}
      {payCertId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">سداد المستخلص</h3>
              <button 
                onClick={() => setPayCertId(null)} 
                disabled={isPending}
                className="text-gray-400 hover:text-gray-600 transition"
              >✕</button>
            </div>
            <form onSubmit={handlePaySub} className="p-6 space-y-5">
              
              <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 flex justify-between items-center text-sm">
                <span className="text-gray-600">المبلغ المستحق كحد أقصى:</span>
                <span className="font-bold text-indigo-700 dir-ltr text-right">{fmt(selectedCertAmount || 0)} ج.م</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">حساب السداد (الخزينة/البنك) *</label>
                <select
                  required
                  value={payAccountId}
                  onChange={e => setPayAccountId(e.target.value)}
                  className="w-full rounded-lg border-gray-300 py-2.5 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                >
                  <option value="">-- اختر الحساب الذي سيتم الدفع منه --</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.financial_account_id}>
                      {acc.arabic_name} {acc.project ? `(مشروع ${acc.project.arabic_name})` : '(حساب رئيسي)'} - متاح: {fmt(acc.current_balance)} {acc.currency}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ المراد سداده *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedCertAmount}
                    required
                    dir="ltr"
                    value={payAmount}
                    onChange={e => setPayAmount(Number(e.target.value))}
                    className="w-full rounded-lg border-gray-300 py-2.5 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-medium text-right"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ السداد *</label>
                  <input
                    type="date"
                    required
                    dir="ltr"
                    value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                    className="w-full rounded-lg border-gray-300 py-2.5 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm text-right"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">طريقة الدفع *</label>
                  <select
                    required
                    value={payMethod}
                    onChange={e => setPayMethod(e.target.value)}
                    className="w-full rounded-lg border-gray-300 py-2.5 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                  >
                    <option value="cash">نقدي</option>
                    <option value="bank_transfer">تحويل بنكي</option>
                    <option value="cheque">شيك</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">رقم مرجعي / شيك</label>
                  <input
                    type="text"
                    value={payRef}
                    onChange={e => setPayRef(e.target.value)}
                    dir="ltr"
                    placeholder="اختياري"
                    className="w-full rounded-lg border-gray-300 py-2.5 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm text-right"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 bg-indigo-600 text-white rounded-lg py-2.5 font-bold hover:bg-indigo-700 transition shadow-sm disabled:opacity-50"
                >
                  {isPending ? 'جاري السداد وتحديث الأرصدة...' : 'تأكيد السداد'}
                </button>
                <button
                  type="button"
                  onClick={() => setPayCertId(null)}
                  disabled={isPending}
                  className="px-5 py-2.5 border border-border rounded-lg text-text-primary hover:bg-background-secondary font-bold transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Payment Modal */}
      {showBulkPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b bg-gradient-to-l from-emerald-700 to-teal-700 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  دفعة شاملة للمورد
                </h3>
                <p className="text-white/80 text-sm mt-0.5">يتم التوزيع من الأقدم للأحدث تلقائياً</p>
              </div>
              <button
                onClick={() => setShowBulkPay(false)}
                disabled={isPending}
                className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {bulkSuccess ? (
              /* Success Screen */
              <div className="p-6 space-y-5 overflow-y-auto">
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-bold text-gray-900">تم السداد بنجاح</h4>
                  <p className="text-sm text-gray-500">سند الدفع: <span className="font-mono font-bold text-emerald-700">{bulkSuccess.voucherNo}</span></p>
                </div>
                <div className="bg-gray-50 rounded-xl border overflow-hidden">
                  <div className="px-4 py-3 bg-gray-100 border-b">
                    <p className="text-sm font-bold text-gray-700">توزيع الدفعة على الفواتير</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="text-xs text-gray-500 border-b">
                      <tr>
                        <th className="px-4 py-2 text-right">رقم الفاتورة</th>
                        <th className="px-4 py-2 text-left">المبلغ المسدد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {bulkSuccess.allocations.map((a, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-medium text-gray-800">{a.invoiceNo}</td>
                          <td className="px-4 py-2.5 text-left font-bold text-emerald-700 dir-ltr">{fmt(a.amount)} ج.م</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-emerald-50 border-t">
                      <tr>
                        <td className="px-4 py-2.5 font-bold text-gray-800">الإجمالي</td>
                        <td className="px-4 py-2.5 text-left font-black text-emerald-700 dir-ltr">
                          {fmt(bulkSuccess.allocations.reduce((s, a) => s + a.amount, 0))} ج.م
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <button
                  onClick={() => setShowBulkPay(false)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 font-bold transition"
                >
                  إغلاق
                </button>
              </div>
            ) : (
              /* Payment Form */
              <form onSubmit={handleBulkPay} className="flex flex-col overflow-hidden">
                <div className="p-6 space-y-5 overflow-y-auto flex-1">
                  {bulkError && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">{bulkError}</div>
                  )}

                  {/* Scope selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">نطاق العمل (المشروع أو الشركة) *</label>
                    <select
                      required
                      value={bulkScope}
                      onChange={e => {
                        setBulkScope(e.target.value)
                        setBulkAmount(0)
                      }}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500 outline-none"
                    >
                      <option value="">-- يرجى اختيار النطاق --</option>
                      {companyInvoices.length > 0 && <option value="company">فواتير الشركة الرئيسية</option>}
                      {supplierProjects.map(proj => (
                        <option key={proj.id} value={proj.id}>مشروع: {proj.name}</option>
                      ))}
                    </select>
                  </div>

                  {bulkScope && (
                    <>
                      {/* Amount input */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            المبلغ الإجمالي للدفعة (ج.م) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={totalOutstandingScope}
                            required
                            dir="ltr"
                            value={bulkAmount || ''}
                            onChange={e => setBulkAmount(Number(e.target.value))}
                            placeholder="0.00"
                            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500 outline-none text-right font-bold"
                          />
                          <p className="text-xs text-gray-400 mt-1">الحد الأقصى: {fmt(totalOutstandingScope)} ج.م</p>
                        </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ السداد *</label>
                      <input
                        type="date"
                        required
                        value={bulkDate}
                        onChange={e => setBulkDate(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">حساب السداد (الخزينة/البنك) *</label>
                    <select
                      required
                      value={bulkAccountId}
                      onChange={e => setBulkAccountId(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500 outline-none"
                    >
                      <option value="">-- اختر الحساب --</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.financial_account_id}>
                          {acc.arabic_name} {acc.project ? `(مشروع ${acc.project.arabic_name})` : '(حساب رئيسي)'} - متاح: {fmt(acc.current_balance)} {acc.currency}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">طريقة الدفع *</label>
                      <select
                        required
                        value={bulkMethod}
                        onChange={e => setBulkMethod(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500 outline-none"
                      >
                        <option value="cash">نقدي</option>
                        <option value="bank_transfer">تحويل بنكي</option>
                        <option value="cheque">شيك</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم مرجعي / شيك</label>
                      <input
                        type="text"
                        value={bulkRef}
                        onChange={e => setBulkRef(e.target.value)}
                        dir="ltr"
                        placeholder="اختياري"
                        className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500 outline-none text-right"
                      />
                    </div>
                  </div>

                  {/* Live Distribution Preview */}
                  {bulkAmount > 0 && (
                    <div className="bg-emerald-50/60 rounded-xl border border-emerald-100 overflow-hidden">
                      <div className="px-4 py-3 bg-emerald-100/70 border-b border-emerald-100 flex items-center justify-between">
                        <p className="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          معاينة توزيع الدفعة (من الأقدم للأحدث)
                        </p>
                        <span className="text-xs bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded font-medium">
                          {bulkAllocationPreview.length} فاتورة
                        </span>
                      </div>
                      {bulkAllocationPreview.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-gray-500 text-center">لا توجد فواتير مستحقة للتوزيع</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="text-xs text-gray-500 border-b border-emerald-100">
                            <tr>
                              <th className="px-4 py-2 text-right">رقم الفاتورة</th>
                              <th className="px-4 py-2 text-right">التاريخ</th>
                              <th className="px-4 py-2 text-left">المتبقي</th>
                              <th className="px-4 py-2 text-left">سيُسدَّد</th>
                              <th className="px-4 py-2 text-center">الحالة بعد</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-emerald-50">
                            {bulkAllocationPreview.map((inv) => {
                              const willFullyPay = inv.allocated >= Number(inv.outstanding_amount)
                              return (
                                <tr key={inv.id} className="hover:bg-emerald-50/50">
                                  <td className="px-4 py-2.5 font-medium text-gray-800">{inv.invoice_no}</td>
                                  <td className="px-4 py-2.5 text-gray-500 dir-ltr text-right text-xs">{inv.invoice_date}</td>
                                  <td className="px-4 py-2.5 text-left text-red-600 font-medium dir-ltr">{fmt(inv.outstanding_amount)}</td>
                                  <td className="px-4 py-2.5 text-left font-bold text-emerald-700 dir-ltr">{fmt(inv.allocated)}</td>
                                  <td className="px-4 py-2.5 text-center">
                                    {willFullyPay ? (
                                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">مدفوعة ✓</span>
                                    ) : (
                                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-700">جزئي</span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                          <tfoot className="bg-emerald-100/50 border-t border-emerald-200">
                            <tr>
                              <td colSpan={3} className="px-4 py-2.5 font-bold text-gray-700">إجمالي الدفعة</td>
                              <td className="px-4 py-2.5 text-left font-black text-emerald-800 dir-ltr" colSpan={2}>
                                {fmt(bulkAllocationPreview.reduce((s, i) => s + i.allocated, 0))} ج.م
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  )}
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="px-6 py-4 border-t bg-gray-50 flex gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowBulkPay(false)}
                    disabled={isPending}
                    className="flex-1 px-4 py-2.5 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 rounded-xl font-medium transition text-sm"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || bulkAmount <= 0 || bulkAllocationPreview.length === 0}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 font-bold transition shadow-sm disabled:opacity-50 text-sm"
                  >
                    {isPending ? 'جاري تنفيذ الدفعة...' : `تأكيد دفع ${fmt(bulkAmount)} ج.م`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Subcontractor Bulk Payment Modal */}
      {showBulkSubPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b bg-gradient-to-l from-indigo-700 to-blue-700 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  دفعة شاملة مقاول
                </h3>
                <p className="text-white/80 text-sm mt-0.5">يتم توزيع الدفعة على المستخلصات غير المسددة في هذا المشروع بدءاً من الأقدم.</p>
              </div>
              <button
                onClick={() => setShowBulkSubPay(false)}
                disabled={isPending}
                className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {bulkSubSuccess ? (
              /* Success Screen */
              <div className="p-6 space-y-5 overflow-y-auto">
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-bold text-gray-900">تم السداد بنجاح</h4>
                  <p className="text-sm text-gray-500">سند الدفع: <span className="font-mono font-bold text-indigo-700">{bulkSubSuccess.voucherNo}</span></p>
                </div>
                <div className="bg-gray-50 rounded-xl border overflow-hidden">
                  <div className="px-4 py-3 bg-gray-100 border-b">
                    <p className="text-sm font-bold text-gray-700">توزيع الدفعة على المستخلصات</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="text-xs text-gray-500 border-b">
                      <tr>
                        <th className="px-4 py-2 text-right">رقم المستخلص</th>
                        <th className="px-4 py-2 text-left">المبلغ المسدد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {bulkSubSuccess.allocations.map((a, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-medium text-gray-800">{a.certNo}</td>
                          <td className="px-4 py-2.5 text-left font-bold text-indigo-700 dir-ltr">{fmt(a.amount)} ج.م</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-indigo-50 border-t">
                      <tr>
                        <td className="px-4 py-2.5 font-bold text-gray-800">الإجمالي</td>
                        <td className="px-4 py-2.5 text-left font-black text-indigo-700 dir-ltr">
                          {fmt(bulkSubSuccess.allocations.reduce((s, a) => s + a.amount, 0))} ج.م
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <button
                  onClick={() => setShowBulkSubPay(false)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 font-bold transition"
                >
                  إغلاق
                </button>
              </div>
            ) : (
              /* Payment Form */
              <form onSubmit={handleBulkSubPay} className="flex flex-col overflow-hidden">
                <div className="p-6 space-y-5 overflow-y-auto flex-1">
                  {bulkError && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">{bulkError}</div>
                  )}

                  {/* Project selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">نطاق العمل (المشروع) *</label>
                    <select
                      required
                      value={bulkSubProjectId}
                      onChange={e => {
                        setBulkSubProjectId(e.target.value)
                        setBulkAmount(0)
                      }}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">-- يرجى اختيار المشروع --</option>
                      {subcontractorProjects.map(proj => (
                        <option key={proj.id} value={proj.id}>{proj.name}</option>
                      ))}
                    </select>
                  </div>

                  {bulkSubProjectId && (
                    <>
                      {/* Amount input */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            المبلغ الإجمالي للدفعة (ج.م) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={totalOutstandingSub(bulkSubProjectId)}
                            required
                            dir="ltr"
                            value={bulkAmount || ''}
                            onChange={e => setBulkAmount(Number(e.target.value))}
                            placeholder="0.00"
                            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 outline-none text-right font-bold flex-1"
                          />
                          <p className="text-xs text-gray-400 mt-1">الحد الأقصى للمشروع: {fmt(totalOutstandingSub(bulkSubProjectId))} ج.م</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ السداد *</label>
                          <input
                            type="date"
                            required
                            value={bulkDate}
                            onChange={e => setBulkDate(e.target.value)}
                            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">حساب السداد (الخزينة/البنك) *</label>
                        <select
                          required
                          value={bulkAccountId}
                          onChange={e => setBulkAccountId(e.target.value)}
                          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 outline-none"
                        >
                          <option value="">-- اختر الحساب --</option>
                          {accounts.map(acc => (
                            <option key={acc.id} value={acc.financial_account_id}>
                              {acc.arabic_name} {acc.project ? `(مشروع ${acc.project.arabic_name})` : '(حساب رئيسي)'} - متاح: {fmt(acc.current_balance)} {acc.currency}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">طريقة الدفع *</label>
                          <select
                            required
                            value={bulkMethod}
                            onChange={e => setBulkMethod(e.target.value)}
                            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 outline-none"
                          >
                            <option value="cash">نقدي</option>
                            <option value="bank_transfer">تحويل بنكي</option>
                            <option value="cheque">شيك</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم مرجعي / شيك</label>
                          <input
                            type="text"
                            value={bulkRef}
                            onChange={e => setBulkRef(e.target.value)}
                            dir="ltr"
                            placeholder="اختياري"
                            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 outline-none text-right"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Live Distribution Preview */}
                  {bulkSubProjectId && bulkAmount > 0 && (
                    <div className="bg-indigo-50/60 rounded-xl border border-indigo-100 overflow-hidden">
                      <div className="px-4 py-3 bg-indigo-100/70 border-b border-indigo-100 flex items-center justify-between">
                        <p className="text-sm font-bold text-indigo-800 flex items-center gap-1.5">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          معاينة التوزيع
                        </p>
                        <span className="text-xs bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded font-medium">
                          {bulkSubAllocationPreview.length} مستخلص
                        </span>
                      </div>
                      {bulkSubAllocationPreview.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-gray-500 text-center">لا توجد مستخلصات مستحقة للتوزيع في هذا المشروع</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="text-xs text-gray-500 border-b border-indigo-100">
                            <tr>
                              <th className="px-4 py-2 text-right">المستخلص</th>
                              <th className="px-4 py-2 text-left">المتبقي قبل الدفع</th>
                              <th className="px-4 py-2 text-left">سيُسدَّد</th>
                              <th className="px-4 py-2 text-center">الحالة بعد</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-indigo-50">
                            {bulkSubAllocationPreview.map((cert) => {
                              const willFullyPay = cert.allocated >= Number(cert.outstanding_amount)
                              return (
                                <tr key={cert.id} className="hover:bg-indigo-50/50">
                                  <td className="px-4 py-2.5 font-medium text-gray-800">{cert.certificate_no}</td>
                                  <td className="px-4 py-2.5 text-left text-red-600 font-medium dir-ltr">{fmt(cert.outstanding_amount)}</td>
                                  <td className="px-4 py-2.5 text-left font-bold text-indigo-700 dir-ltr">{fmt(cert.allocated)}</td>
                                  <td className="px-4 py-2.5 text-center">
                                    {willFullyPay ? (
                                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">مسدد ✓</span>
                                    ) : (
                                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-700">جزئي</span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                          <tfoot className="bg-indigo-100/50 border-t border-indigo-200">
                            <tr>
                              <td colSpan={2} className="px-4 py-2.5 font-bold text-gray-700">الإجمالي</td>
                              <td className="px-4 py-2.5 text-left font-black text-indigo-800 dir-ltr" colSpan={2}>
                                {fmt(bulkSubAllocationPreview.reduce((s, c) => s + c.allocated, 0))} ج.م
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="px-6 py-4 border-t bg-gray-50 flex gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowBulkSubPay(false)}
                    disabled={isPending}
                    className="flex-1 px-4 py-2.5 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 rounded-xl font-medium transition text-sm"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || !bulkSubProjectId || bulkAmount <= 0 || bulkSubAllocationPreview.length === 0}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 font-bold transition shadow-sm disabled:opacity-50 text-sm"
                  >
                    {isPending ? 'جاري السداد...' : `تأكيد الدفع`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Request Retention Release Modal */}
      {showReqRetention && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b bg-orange-50 flex items-center justify-between">
              <h3 className="font-bold text-orange-900">طلب استرداد تعلية (ضمان أعمال)</h3>
              <button 
                onClick={() => setShowReqRetention(false)} 
                disabled={isPending}
                className="text-gray-400 hover:text-gray-600 transition"
              >✕</button>
            </div>
            <form onSubmit={handleReqRet} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المشروع *</label>
                <select
                  required
                  value={reqRetProject}
                  onChange={e => setReqRetProject(e.target.value)}
                  className="w-full rounded-lg border-gray-300 py-2.5 text-sm"
                >
                  <option value="">-- اختر المشروع --</option>
                  {retentionMetrics.filter(m => m.available_balance > 0).map(m => (
                    <option key={m.project_id} value={m.project_id}>
                      {m.project_name} (متاح: {fmt(m.available_balance)} ج.م)
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">مبلغ الاسترداد *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={reqRetProject ? retentionMetrics.find(m => m.project_id === reqRetProject)?.available_balance : undefined}
                    step="0.01"
                    value={reqRetAmount || ''}
                    onChange={e => setReqRetAmount(Number(e.target.value))}
                    className="w-full rounded-lg border-gray-300 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الطلب *</label>
                  <input
                    type="date"
                    required
                    value={reqRetDate}
                    onChange={e => setReqRetDate(e.target.value)}
                    className="w-full rounded-lg border-gray-300 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
                <textarea
                  rows={2}
                  value={reqRetNotes}
                  onChange={e => setReqRetNotes(e.target.value)}
                  className="w-full rounded-lg border-gray-300 py-2.5 text-sm"
                  placeholder="سبب صرف التعلية (اختياري)"
                />
              </div>

              <div className="pt-4 flex gap-3 border-t mt-6">
                <button
                  type="button"
                  onClick={() => setShowReqRetention(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 rounded-xl font-medium transition text-sm"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending || !reqRetProject || reqRetAmount <= 0}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white rounded-xl py-2.5 font-bold transition shadow-sm disabled:opacity-50 text-sm"
                >
                  {isPending ? 'جاري الحفظ...' : 'تقديم الطلب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approve Retention Modal */}
      {approveRetId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b bg-blue-50 flex items-center justify-between">
              <h3 className="font-bold text-blue-900">تأكيد اعتماد الطلب</h3>
              <button 
                onClick={() => setApproveRetId(null)} 
                disabled={isPending}
                className="text-gray-400 hover:text-gray-600 transition"
              >✕</button>
            </div>
            <div className="p-6">
              <p className="text-gray-700 text-sm mb-6 leading-relaxed">
                هل أنت متأكد من اعتماد طلب استرداد التعلية المختار للمقاول ({party.arabic_name})؟
                <br /> <span className="text-gray-500 mt-2 block">بمجرد الاعتماد سيصبح الطلب جاهزاً للسداد من الخزينة.</span>
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setApproveRetId(null)}
                  disabled={isPending}
                  className="flex-1 px-4 py-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 rounded-xl font-medium transition text-sm"
                >إلغاء</button>
                <button
                  type="button"
                  onClick={handleConfirmApprove}
                  disabled={isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2 font-bold transition shadow-sm disabled:opacity-50 text-sm"
                >
                  {isPending ? 'جاري الاعتماد...' : 'نعم، اعتماد'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pay Retention Modal */}
      {payRetId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b bg-green-50 flex items-center justify-between">
              <h3 className="font-bold text-green-900">سداد التعلية المعتمدة</h3>
              <button 
                onClick={() => setPayRetId(null)} 
                disabled={isPending}
                className="text-gray-400 hover:text-gray-600 transition"
              >✕</button>
            </div>
            <form onSubmit={handlePayRet} className="p-6 space-y-4">
              <div className="bg-green-50 p-3 rounded-lg border border-green-100 flex justify-between items-center text-sm">
                <span className="text-gray-600">المبلغ المطلوب سداده:</span>
                <span className="font-bold text-green-700 dir-ltr text-right">{fmt(payRetAmount)} ج.م</span>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">حساب السداد (الخزينة/البنك) *</label>
                <select
                  required
                  value={payAccountId}
                  onChange={e => setPayAccountId(e.target.value)}
                  className="w-full rounded-lg border-gray-300 py-2.5 shadow-sm text-sm"
                >
                  <option value="">-- اختر الحساب الذي سيتم الدفع منه --</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.financial_account_id}>
                      {acc.arabic_name} - متاح: {fmt(acc.current_balance)} {acc.currency}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">طريقة الدفع *</label>
                  <select
                    required
                    value={payMethod}
                    onChange={e => setPayMethod(e.target.value)}
                    className="w-full rounded-lg border-gray-300 py-2.5 shadow-sm text-sm"
                  >
                    <option value="cash">نقدي (Cash)</option>
                    <option value="bank_transfer">تحويل بنكي</option>
                    <option value="cheque">شيك</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الدفع *</label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                    className="w-full rounded-lg border-gray-300 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رقم المرجع (اختياري)</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={e => setPayRef(e.target.value)}
                  placeholder="مثال: رقم التحويل البنكي أو الشيك"
                  className="w-full rounded-lg border-gray-300 py-2.5 text-sm"
                />
              </div>

              <div className="pt-4 flex gap-3 border-t mt-6">
                <button
                  type="button"
                  onClick={() => setPayRetId(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 rounded-xl font-medium transition text-sm"
                >إلغاء</button>
                <button
                  type="submit"
                  disabled={isPending || !payAccountId}
                  className="flex-1 bg-success hover:bg-green-700 text-white rounded-xl py-2.5 font-bold transition shadow-sm disabled:opacity-50 text-sm"
                >
                  {isPending ? 'جاري الحفظ...' : 'تأكيد السداد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
