import React from 'react'

export default function PageLoader() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center animate-fadeIn">
      <div className="relative w-12 h-12 mb-4">
        <div className="w-12 h-12 rounded-full border-2 border-slate-200 dark:border-slate-800"></div>
        <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-2 border-transparent border-t-brand-primary border-r-brand-primary animate-spin"></div>
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
        Loading module...
      </p>
    </div>
  )
}
