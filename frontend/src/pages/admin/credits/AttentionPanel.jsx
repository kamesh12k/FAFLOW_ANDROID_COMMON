import { computeAttentionFlags, avatarColors, initialsOf } from './utils'

const SEVERITY_CONFIG = {
  high: {
    border: 'border-rose-200',
    bg: 'bg-rose-50/40',
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
    dot: 'bg-rose-500',
    label: 'Critical',
  },
  medium: {
    border: 'border-amber-200',
    bg: 'bg-amber-50/30',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    label: 'Needs Attention',
  },
}

function Avatar({ name }) {
  const c = avatarColors(name)
  return (
    <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${c.bg} ${c.text}`}>
      {initialsOf(name)}
    </div>
  )
}

export default function AttentionPanel({ report, transactions, onReview }) {
  const flags = computeAttentionFlags(report, transactions)

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Reconciliation & Attention
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Faculty requiring workload or balance review</p>
          </div>
          {flags.length > 0 && (
            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
              {flags.length} {flags.length === 1 ? 'Action Required' : 'Actions Required'}
            </span>
          )}
        </div>

        {flags.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2.5 border border-emerald-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-xs font-bold text-slate-800">All Faculty Balanced</p>
            <p className="text-[11px] text-slate-400 mt-0.5">No faculty members currently require balance reconciliation.</p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
            {flags.map((teacher) => {
              const cfg = SEVERITY_CONFIG[teacher.severity] || SEVERITY_CONFIG.medium
              return (
                <div
                  key={teacher.teacher_id}
                  className={`rounded-xl border ${cfg.border} ${cfg.bg} p-3 transition-all`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <Avatar name={teacher.name} />
                        <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ${cfg.dot} border-2 border-white`} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 truncate">{teacher.name}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${cfg.badge}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {teacher.department || 'General Faculty'} &middot; Balance:{' '}
                          <span className={`font-mono font-bold ${teacher.balance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                            {teacher.balance > 0 ? '+' : ''}{teacher.balance}
                          </span>
                        </p>

                        <div className="space-y-0.5 mt-1.5">
                          {teacher.reasons.map((reason, i) => (
                            <p key={i} className="text-[11px] text-slate-600 leading-snug">
                              &bull; {reason.text}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>

                    {onReview && (
                      <button
                        onClick={() => onReview(teacher)}
                        className="shrink-0 text-[11px] font-bold text-primary-700 hover:text-primary-800 bg-white hover:bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 transition shadow-2xs"
                      >
                        Review
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

