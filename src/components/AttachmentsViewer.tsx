'use client'

import { useState } from 'react'

export default function AttachmentsViewer({ urls }: { urls?: string[] }) {
  const [isOpen, setIsOpen] = useState(false)

  if (!urls || urls.length === 0) return null

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsOpen(true)
        }}
        className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors relative"
        title={`يوجد ${urls.length} مرفقات`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
        </svg>
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white">
          {urls.length}
        </span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" dir="rtl">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col h-[85vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b relative z-10">
              <h2 className="text-lg font-bold text-gray-800">المرفقات ({urls.length})</h2>
              <button 
                type="button" 
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsOpen(false)
                }} 
                className="p-2 rounded-full hover:bg-gray-200 text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-100 flex flex-col gap-6 relative z-10">
              {urls.map((url, i) => {
                const isPdf = url.toLowerCase().includes('.pdf')
                return (
                  <div key={i} className="flex flex-col gap-2">
                    <div className="flex justify-between items-center px-2">
                      <span className="font-semibold text-gray-700">مرفق {i + 1}</span>
                      <a href={url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                        فتح في نافذة جديدة
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                      </a>
                    </div>
                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex items-center justify-center min-h-[400px]">
                      {isPdf ? (
                        <iframe src={url} className="w-full h-[600px] border-0" title={`مرفق ${i+1}`} />
                      ) : (
                        <img src={url} alt={`مرفق ${i+1}`} className="max-w-full max-h-[800px] object-contain" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
