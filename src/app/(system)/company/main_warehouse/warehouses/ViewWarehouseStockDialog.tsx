'use client'

import { useState, useEffect } from 'react'
import { getWarehouseStock } from '@/actions/warehouse'

export default function ViewWarehouseStockDialog({ warehouse }: { warehouse: any }) {
  const [isOpen, setIsOpen] = useState(false)
  const [stock, setStock] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      getWarehouseStock(warehouse.id).then((data) => {
        setStock(data)
        setLoading(false)
      })
    }
  }, [isOpen, warehouse.id])

  const totalWarehouseValue = stock.reduce((sum, item) => sum + Number(item.total_value || 0), 0)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200 ml-2"
        title="عرض رصيد المخزن"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
              <div className="flex flex-col">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-blue-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                  </svg>
                  أرصدة مخزن: {warehouse.arabic_name}
                </h2>
                <span className="text-sm text-gray-500 mt-1">كود مستودع: {warehouse.warehouse_code}</span>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <div className="p-6 flex-1 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : stock.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
                  <p className="font-semibold mb-1">المخزن فارغ حالياً</p>
                  <p className="text-sm">لا توجد به أي أصناف مسجلة حتى اللحظة.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-blue-600 font-bold mb-1">إجمالي عدد الأصناف المخزنة</p>
                        <p className="text-xl font-black text-blue-900">{stock.length}</p>
                      </div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-emerald-600 font-bold mb-1">إجمالي قيمة المخزون (بحسب المتبقي)</p>
                        <p className="text-xl font-black text-emerald-900" dir="ltr">
                          {totalWarehouseValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr className="text-right">
                          <th className="px-4 py-3 font-semibold text-gray-600">كود الصنف</th>
                          <th className="px-4 py-3 font-semibold text-gray-600 w-1/3">اسم الصنف</th>
                          <th className="px-4 py-3 font-semibold text-gray-600">الكمية</th>
                          <th className="px-4 py-3 font-semibold text-gray-600">متوسط التكلفة</th>
                          <th className="px-4 py-3 font-semibold text-gray-600">القيمة المخزنية</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stock.map((line) => {
                          const item = Array.isArray(line.item) ? line.item[0] : line.item
                          const itemUnit = item?.unit;
                          const unit = Array.isArray(itemUnit) ? itemUnit[0] : itemUnit;
                          return (
                            <tr key={line.id} className="border-b last:border-0 hover:bg-gray-50/50">
                              <td className="px-4 py-3 text-gray-500 font-mono text-xs">{item?.item_code || '-'}</td>
                              <td className="px-4 py-3">
                                <span className="font-bold text-gray-800">{item?.arabic_name || 'صنف غير معروف'}</span>
                              </td>
                              <td className="px-4 py-3 font-bold text-blue-600 whitespace-nowrap">
                                {line.quantity_on_hand} <span className="text-xs text-gray-400 font-normal">{unit?.arabic_name || ''}</span>
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {Number(line.weighted_avg_cost).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-3 font-bold text-gray-800">
                                {Number(line.total_value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 sticky bottom-0 rounded-b-xl flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-6 py-2 bg-white border shadow-sm text-gray-700 rounded-lg hover:bg-gray-100 font-semibold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
