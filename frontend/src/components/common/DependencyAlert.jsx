import { Link } from 'react-router-dom'

/**
  * Reusable contextual prerequisite alert for administrative pages.
  * Warns administrators when required dependency entities do not exist yet,
  * providing direct setup action buttons and a link to the Setup Guide.
  */
export default function DependencyAlert({
  title = 'Prerequisite Setup Required',
  message,
  prerequisites = [],
  actionText,
  actionLink,
  compact = false,
}) {
  if (compact) {
    return (
      <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-base shrink-0">⚠️</span>
          <span className="font-medium truncate">{message || title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actionLink && actionText && (
            <Link
              to={actionLink}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] transition shadow-xs"
            >
              {actionText} →
            </Link>
          )}
          <Link
            to="/admin/setup"
            className="px-2 py-1 text-amber-800 dark:text-amber-300 hover:underline font-semibold text-[11px]"
          >
            Setup Guide
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6 bg-gradient-to-br from-amber-50 to-orange-50/40 dark:from-amber-950/30 dark:to-slate-900 border-2 border-amber-300 dark:border-amber-800 rounded-2xl shadow-sm space-y-4">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/60 border border-amber-200 dark:border-amber-700 flex items-center justify-center text-2xl shrink-0">
          ⚠️
        </div>
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-amber-950 dark:text-amber-100">{title}</h3>
            <span className="px-2 py-0.5 rounded-md bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 text-[11px] font-black uppercase">
              Action Required
            </span>
          </div>
          <p className="text-xs text-amber-900/80 dark:text-amber-200/80 leading-relaxed">
            {message}
          </p>
        </div>
      </div>

      {prerequisites.length > 0 && (
        <div className="pt-2 border-t border-amber-200/60 dark:border-amber-800/60 space-y-2">
          <p className="text-[11px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
            Required Prerequisites Checklist:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {prerequisites.map((item, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                  item.is_satisfied
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : 'bg-white dark:bg-slate-800 border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-100 shadow-xs'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0">{item.is_satisfied ? '✅' : '⏳'}</span>
                  <span className="font-semibold truncate">{item.title}</span>
                </div>
                {!item.is_satisfied && item.actionLink && (
                  <Link
                    to={item.actionLink}
                    className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline shrink-0"
                  >
                    Configure →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          {actionLink && actionText && (
            <Link
              to={actionLink}
              className="btn bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-xs inline-flex items-center gap-1.5"
            >
              {actionText} →
            </Link>
          )}
        </div>
        <Link
          to="/admin/setup"
          className="text-xs font-bold text-amber-900 dark:text-amber-300 hover:underline inline-flex items-center gap-1"
        >
          <span>📖 View Complete Admin Setup Guide</span>
        </Link>
      </div>
    </div>
  )
}
