'use client'

import { useState } from 'react'

interface Props {
  url: string
  title: string
}

export default function ImagePreviewButton({ url, title }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button 
        type="button" 
        onClick={() => setOpen(true)}
        className="w-10 h-10 rounded-lg border border-border bg-background-secondary/30 hover:bg-background-secondary flex flex-col items-center justify-center shrink-0 transition-colors text-primary hover:text-primary/80 group"
        title="عرض الصورة"
      >
        <svg className="w-4 h-4 mb-0.5 opacity-80 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setOpen(false)} />
          <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-white max-w-2xl w-full max-h-[80vh] flex flex-col pointer-events-auto border border-border">
            <div className="flex items-center justify-between p-4 border-b border-border bg-background">
              <h3 className="font-bold text-text-primary text-lg">{title}</h3>
              <button onClick={() => setOpen(false)} className="rounded-full p-2 text-text-secondary hover:bg-background-secondary hover:text-text-primary transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-background-secondary/30 min-h-[300px] flex-1 overflow-hidden">
              <img src={url} alt={title} className="max-w-full max-h-full object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
