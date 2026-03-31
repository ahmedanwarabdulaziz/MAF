'use client'

import { useState, useTransition } from 'react'
import {
  deleteProjectPayments,
  deleteSubcontractorCertificates,
  deleteSubcontractAgreements,
  deleteSupplierInvoices,
  deletePurchaseRequests,
  deleteOwnerBilling,
  deleteStoreIssues,
  deleteStockLedger,
  deletePettyExpenses,
  deleteWorkItems,
  deleteProjects,
  deleteAuditLogs,
  deleteDocumentSequences,
  deleteFinancialAccounts,
  deleteUsersExceptAdmin,
  deleteParties,
  deletePettyExpenseGroups,
  deleteCompanyPurchases,
  deleteExpenseCategories,
  deleteWarehousesAndItems,
} from './actions'

type Dataset = {
  key: string
  label: string
  description: string
  warning: string
  icon: string
  danger: 'medium' | 'high' | 'critical'
  action: () => Promise<void>
  dependsOn?: string[]
}

const DATASETS: Dataset[] = [
  {
    key: 'audit_logs',
    label: 'سجل النشاط والتدقيق',
    description: 'حذف جميع سجلات المراجعة والتدقيق المسجلة في النظام.',
    warning: 'لا يمكن التراجع عن هذه العملية.',
    icon: '📋',
    danger: 'medium',
    action: deleteAuditLogs,
  },
  {
    key: 'doc_sequences',
    label: 'تسلسل رقم الوثائق',
    description: 'إعادة ضبط عدادات أرقام الوثائق التسلسلية (طلبات الشراء، الفواتير، إلخ).',
    warning: 'ستُعاد الأرقام من الصفر. قد تتعارض مع وثائق موجودة.',
    icon: '🔢',
    danger: 'medium',
    action: deleteDocumentSequences,
  },
  {
    key: 'payments',
    label: 'سندات الصرف والتسويات',
    description: 'حذف جميع سندات الصرف وتخصيصات المدفوعات والحركات المالية للخزينة.',
    warning: 'يؤثر على أرصدة الخزينة وتسويات الفواتير والمستخلصات.',
    icon: '💸',
    danger: 'high',
    action: deleteProjectPayments,
  },
  {
    key: 'financial_accounts',
    label: 'الخزينة والحسابات البنكية',
    description: 'حذف الخزائن، الحسابات البنكية، وجميع الحركات المالية المرتبطة بها.',
    warning: 'سيتم حذف الخزائن بالشركة والمشاريع، وكل ما يتبعها من سندات صرف وعهد.',
    icon: '🏦',
    danger: 'critical',
    action: deleteFinancialAccounts,
    dependsOn: ['payments', 'petty_expenses'],
  },
  {
    key: 'petty_expenses',
    label: 'العهد والمصروفات النثرية',
    description: 'حذف جميع حسابات العهدة والمصروفات النثرية المسجلة.',
    warning: 'سيتم حذف جميع حسابات عهدة المهندسين ومصروفاتهم.',
    icon: '🧾',
    danger: 'medium',
    action: deletePettyExpenses,
  },
  {
    key: 'owner_billing',
    label: 'فواتير المالك والتحصيلات',
    description: 'حذف جميع مستخلصات فواتير المالك وتحصيلاتها.',
    warning: 'سيتم حذف جميع بيانات الإيرادات المسجلة.',
    icon: '🏗️',
    danger: 'high',
    action: deleteOwnerBilling,
  },
  {
    key: 'purchase_requests',
    label: 'طلبات الشراء (PR)',
    description: 'حذف جميع طلبات الشراء وبنودها.',
    warning: 'لن يؤثر على الفواتير الموجودة، فقط الطلبات.',
    icon: '📝',
    danger: 'medium',
    action: deletePurchaseRequests,
  },
  {
    key: 'supplier_invoices',
    label: 'فواتير الموردين',
    description: 'حذف جميع فواتير الموردين وبنودها وتسوياتها.',
    warning: 'سيتم أيضاً حذف مخصصات المدفوعات المرتبطة بهذه الفواتير.',
    icon: '🧾',
    danger: 'high',
    action: deleteSupplierInvoices,
  },
  {
    key: 'store_issues',
    label: 'أذون صرف المخزن',
    description: 'حذف جميع أذون الصرف (صرف للمشاريع) من المخزن الرئيسي والفرعي.',
    warning: 'لن يُعيد ضبط أرصدة المخزن، استخدم "حركات المخزن" لذلك.',
    icon: '📦',
    danger: 'medium',
    action: deleteStoreIssues,
  },
  {
    key: 'stock_ledger',
    label: 'سجل وأرصدة المخزن',
    description: 'حذف جميع حركات سجل المخزن وإعادة تصفير أرصدة المخزون.',
    warning: 'ستصبح جميع أرصدة الأصناف صفراً في كافة المخازن.',
    icon: '🏭',
    danger: 'critical',
    action: deleteStockLedger,
    dependsOn: ['store_issues'],
  },
  {
    key: 'certificates',
    label: 'مستخلصات مقاولي الباطن',
    description: 'حذف جميع المستخلصات وبنودها والسماحات والخصومات المرتبطة.',
    warning: 'يشمل حذف تخصيصات المدفوعات المرتبطة بهذه المستخلصات.',
    icon: '📄',
    danger: 'high',
    action: deleteSubcontractorCertificates,
  },
  {
    key: 'agreements',
    label: 'عقود مقاولي الباطن',
    description: 'حذف جميع عقود التعاقد من الباطن والمستخلصات المرتبطة بها.',
    warning: 'سيتم تلقائياً حذف جميع المستخلصات قبل حذف العقود.',
    icon: '📃',
    danger: 'high',
    action: deleteSubcontractAgreements,
    dependsOn: ['certificates'],
  },
  {
    key: 'work_items',
    label: 'بنود الأعمال (BOQ)',
    description: 'حذف جميع بنود الأعمال، العقود، والمستخلصات من جميع المشاريع.',
    warning: 'عملية حذف متتالية: يُحذف كل ما يعتمد على بنود الأعمال.',
    icon: '🔨',
    danger: 'critical',
    action: deleteWorkItems,
    dependsOn: ['certificates', 'agreements'],
  },
  {
    key: 'projects',
    label: 'المشاريع',
    description: 'حذف جميع المشاريع وكل ما يتبعها من بيانات.',
    warning: 'سيُحذف كل شيء مرتبط بالمشاريع. لا يمكن التراجع.',
    icon: '🏢',
    danger: 'critical',
    action: deleteProjects,
    dependsOn: ['work_items', 'certificates', 'agreements', 'supplier_invoices', 'payments', 'stock_ledger'],
  },
  {
    key: 'company_purchases',
    label: 'مشتريات الشركة',
    description: 'حذف جميع أوامر وفواتير مشتريات الشركة المركزية وإدخالاتها.',
    warning: 'هذا الإجراء سيحذف فواتير المشتريات العامة وحركات المخزن المرتبطة بها.',
    icon: '🛒',
    danger: 'high',
    action: deleteCompanyPurchases,
  },
  {
    key: 'expense_categories',
    label: 'أقسام المصروفات',
    description: 'حذف أقسام وتصنيفات المصروفات العامة (تستخدم في مشتريات الشركة).',
    warning: 'يجب حذف فواتير مشتريات الشركة أولاً.',
    icon: '📂',
    danger: 'medium',
    action: deleteExpenseCategories,
    dependsOn: ['company_purchases'],
  },
  {
    key: 'parties',
    label: 'جهات التعامل (مركز حسابات الموردين والمقاولين)',
    description: 'حذف جميع جهات التعامل، الموردين، والمقاولين المسجلين في النظام.',
    warning: 'سيتم مسح جهات التعامل فقط في حال تم حذف جميع التعاقدات والمستخلصات والفواتير التابعة لهم.',
    icon: '👥',
    danger: 'high',
    action: deleteParties,
    dependsOn: ['agreements', 'certificates', 'supplier_invoices', 'company_purchases', 'stock_ledger'],
  },
  {
    key: 'petty_expense_groups',
    label: 'التبويبات المحاسبية للنثريات',
    description: 'حذف جميع حسابات وبنود التبويب المحاسبي لمصروفات النثريات.',
    warning: 'يجب حذف كافة (العهد والمصروفات النثرية) التابعة للمشاريع والشركة قبل حذف تبويباتها.',
    icon: '🗂️',
    danger: 'medium',
    action: deletePettyExpenseGroups,
    dependsOn: ['petty_expenses'],
  },
  {
    key: 'warehouses_and_items',
    label: 'إدارة المخازن، ودليل ومجموعات الأصناف',
    description: 'حذف جميع المخازن، ومجموعات الأصناف، ودليل الأصناف بالكامل.',
    warning: 'لا يمكن الحذف إلا بعد تصفير كافة الأرصدة وإلغاء حركات المخزون والمشتريات.',
    icon: '📦',
    danger: 'critical',
    action: deleteWarehousesAndItems,
    dependsOn: ['stock_ledger', 'store_issues', 'company_purchases', 'supplier_invoices'],
  },
  {
    key: 'users',
    label: 'إدارة المستخدمين',
    description: 'حذف كافة مديري المشاريع والمهندسين وحسابات الموظفين بخلاف مدير النظام الأساسي.',
    warning: 'سيتم حذف جميع المستخدمين وصلاحياتهم ولن يتمكنوا من الدخول. (لن يتم حذف حساب مدير النظام).',
    icon: '👤',
    danger: 'critical',
    action: deleteUsersExceptAdmin,
  },
]

const dangerConfig = {
  medium: {
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    badge: 'bg-amber-100 text-amber-700',
    btn: 'bg-amber-500 hover:bg-amber-600 text-white',
    label: 'تحذير',
  },
  high: {
    border: 'border-orange-200',
    bg: 'bg-orange-50',
    badge: 'bg-orange-100 text-orange-700',
    btn: 'bg-orange-500 hover:bg-orange-600 text-white',
    label: 'خطر',
  },
  critical: {
    border: 'border-red-200',
    bg: 'bg-red-50',
    badge: 'bg-red-100 text-red-700',
    btn: 'bg-red-600 hover:bg-red-700 text-white',
    label: 'خطر بالغ',
  },
}

function DeleteCard({ dataset, initialCount }: { dataset: Dataset; initialCount: number }) {
  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const cfg = dangerConfig[dataset.danger]
  const count = done ? 0 : initialCount

  const handleDelete = () => {
    setError(null)
    startTransition(async () => {
      try {
        await dataset.action()
        setDone(true)
        setConfirming(false)
      } catch (e: any) {
        setError(e.message || 'فشلت العملية')
      }
    })
  }

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-5 space-y-3 transition-all`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none mt-0.5">{dataset.icon}</span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-text-primary text-sm">{dataset.label}</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                {cfg.label}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                {count.toLocaleString('en-US')} سجل
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-1">{dataset.description}</p>
          </div>
        </div>

        {done ? (
          <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg whitespace-nowrap">
            ✓ تم الحذف
          </span>
        ) : !confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors whitespace-nowrap ${cfg.btn}`}
          >
            حذف البيانات
          </button>
        ) : null}
      </div>

      {/* Warning */}
      <div className="flex items-start gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
        <span className="shrink-0">⚠️</span>
        <span>{dataset.warning}</span>
      </div>

      {/* Confirmation panel */}
      {confirming && !done && (
        <div className="border border-red-300 rounded-lg bg-white p-4 space-y-3">
          <p className="text-sm font-medium text-red-700">
            هل أنت متأكد من رغبتك في الحذف النهائي لهذه البيانات؟ لا يمكن التراجع عن هذه الخطوة.
          </p>
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              ❌ {error}
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setConfirming(false); setError(null) }}
              className="text-xs px-4 py-2 rounded-lg text-text-secondary hover:bg-black/5 transition-colors"
              disabled={isPending}
            >
              إلغاء
            </button>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="text-xs font-bold px-6 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending ? 'جاري الحذف...' : '⚠️ نعم، تأكيد الحذف النهائي'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DataResetClient({ initialCounts }: { initialCounts: Record<string, number> }) {
  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header warning */}
      <div className="rounded-xl border-2 border-red-300 bg-red-50 p-5 flex gap-4">
        <div className="text-3xl shrink-0">🛑</div>
        <div>
          <h2 className="font-bold text-red-800 text-base">منطقة الخطر — إعادة تعيين البيانات</h2>
          <p className="text-sm text-red-700 mt-1">
            جميع العمليات في هذه الصفحة <strong>لا يمكن التراجع عنها</strong>. سيتم حذف البيانات نهائياً من قاعدة البيانات.
            هذه الصفحة مخصصة لبيئة <strong>الاختبار والتطوير</strong> فقط. لا تستخدمها في بيئة الإنتاج.
          </p>
        </div>
      </div>

      {/* Cards grid */}
      <div className="space-y-3">
        {DATASETS.map((ds) => (
          <DeleteCard key={ds.key} dataset={ds} initialCount={initialCounts[ds.key] || 0} />
        ))}
      </div>
    </div>
  )
}
