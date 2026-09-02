import { useMemo } from 'react'
import { computeAttentionFlags, avatarColors, initialsOf } from './utils'

export default function AttentionBanner({ report, transactions, onReviewTeacher }) {
  const flags = useMemo(() => computeAttentionFlags(report, transactions), [report, transactions])

  if (flags.length === 0) {
    return (
      <div className="flex items-center justify-between p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-900">All Faculty Balanced</p>
            <p className="text-[11px] text-emerald-700">No faculty members currently have negative balances or reconciliation discrepancies.</p>
          </div>
        </div>
        <span className="hidden sm:inline-block text-[10px] font-bold text-emerald-800 bg-white border border-emerald-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
          Up to Date
        </span>
      </div>
    )
  }

  const criticalCount = flags.filter(f => f.severity === 'high').length
  const attentionCount = flags.length - criticalCount

  return (
    <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 font-bold text-xs">
            ⚠️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-900">
                Action Required: {flags.length} {flags.length === 1 ? 'Faculty Member' : 'Faculty Members'} Need Review
              </h3>
              {criticalCount > 0 && (
                <span className="text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 px-1.5 py-0.5 rounded">
                  {criticalCount} Critical
                </span>
              )}
              {attentionCount > 0 && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">
                  {attentionCount} Review
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Faculty with negative balances or substitution imbalances require HOD verification.
            </p>
          </div>
        </div>

        {onReviewTeacher && flags[0] && (
          <button
            type="button"
            onClick={() => onReviewTeacher(flags[0])}
            className="self-start sm:self-auto text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-xl transition shadow-2xs cursor-pointer"
          >
            Review First ({flags[0].name})
          </button>
        )}
      </div>

      {/* Compact Quick-Review Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1 border-t border-amber-200/60">
        {flags.slice(0, 3).map((f) => {
          const c = avatarColors(f.name)
          const isHigh = f.severity === 'high'

          return (
            <div
              key={f.teacher_id}
              onClick={() => onReviewTeacher && onReviewTeacher(f)}
              className="flex items-center justify-between p-2 bg-white/90 hover:bg-white border border-amber-200/70 hover:border-amber-300 rounded-xl transition cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={`h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold ${c.bg} ${c.text}`}>
                  {initialsOf(f.name)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{f.name}</p>
                  <p className="text-[10px] text-slate-500 truncate">{f.department || 'Faculty'}</p>
                </div>
              </div>

              <div className="text-right shrink-0 ml-2">
                <span className={`text-xs font-mono font-bold ${isHigh ? 'text-rose-600' : 'text-amber-700'}`}>
                  {f.balance > 0 ? '+' : ''}{f.balance}
                </span>
                <span className="text-[10px] text-slate-400 block -mt-0.5">balance</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
