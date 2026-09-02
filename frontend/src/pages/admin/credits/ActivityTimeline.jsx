import { useState, useMemo } from 'react'
import { getCategoryConfig, formatRelativeTime, formatTransactionReason } from './utils'
import TransactionModal from './TransactionModal'

function parseReasonContext(reasonText) {
  if (!reasonText) return '—'
  const details = []

  const classMatch = reasonText.match(/in\s+([I|V|X\d\s\w\.\-]+?)(?:\s+Period|\s+Day|\s+DO|$)/i) ||
                     reasonText.match(/for\s+([I|V|X\d\s\w\.\-]+?)(?:\s+Period|\s+Day|\s+DO|$)/i)
  if (classMatch && !classMatch[1].toLowerCase().includes('teacher') && !classMatch[1].toLowerCase().includes('leave')) {
    details.push(`Class: ${classMatch[1].trim()}`)
  }

  const doMatch = reasonText.match(/Day Order\s+(\d+)/i) || reasonText.match(/DO\s*(\d+)/i)
  if (doMatch) details.push(`DO: ${doMatch[1]}`)

  const pMatch = reasonText.match(/period\s+(\d+)/i) || reasonText.match(/P\s*(\d+)/i)
  if (pMatch) details.push(`P: ${pMatch[1]}`)

  return details.length > 0 ? details.join(' · ') : reasonText
}

function CreditChangePill({ value }) {
  if (value > 0) return (
    <span className="font-mono font-bold text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
      +{value}
    </span>
  )
  return (
    <span className="font-mono font-bold text-xs text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
      {value}
    </span>
  )
}

const ALL_FILTER_TABS = [
  { id: 'all', label: 'All Activities' },
  { id: 'substitute_class', label: 'Substitutions' },
  { id: 'leave_deduction', label: 'Leave Deductions' },
  { id: 'exam_duty', label: 'Exam Duties' },
  { id: 'department_duty', label: 'Dept. Duties' },
  { id: 'manual_adjustment', label: 'Adjustments' },
  { id: 'penalty', label: 'Penalties' },
]

export default function ActivityTimeline({
  transactions = [],
  report = [],
  allTeachers = [],
}) {
  const [activeFilter, setActiveFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showCount, setShowCount] = useState(30)
  const [selectedTx, setSelectedTx] = useState(null)

  const teacherMap = useMemo(() => {
    const m = {}
    for (const t of allTeachers) m[t.id] = t
    for (const r of report) if (!m[r.teacher_id]) m[r.teacher_id] = { id: r.teacher_id, name: r.name, department: r.department }
    return m
  }, [report, allTeachers])

  const filtered = useMemo(() => {
    let out = transactions

    if (activeFilter !== 'all') {
      out = out.filter(tx => {
        const cat = getCategoryConfig(tx)
        if (activeFilter === 'substitute_class') return cat.label.includes('Substitution')
        if (activeFilter === 'leave_deduction') return cat.label.includes('Leave')
        if (activeFilter === 'exam_duty') return cat.label.includes('Exam')
        if (activeFilter === 'department_duty') return cat.label.includes('Department')
        if (activeFilter === 'manual_adjustment') return cat.label.includes('Admin')
        if (activeFilter === 'penalty') return cat.label.includes('Penalty')
        return tx.category === activeFilter
      })
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(tx => {
        const tName = (teacherMap[tx.teacher_id]?.name || '').toLowerCase()
        const reason = (tx.reason || '').toLowerCase()
        return tName.includes(q) || reason.includes(q) || String(tx.id).includes(q)
      })
    }

    return out
  }, [transactions, activeFilter, search, teacherMap])

  const visibleTransactions = filtered.slice(0, showCount)

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Header & Controls */}
      <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Recent Credit Activity & Audit Stream</h3>
              <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                {filtered.length} Records
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Click any transaction row to inspect full class, day order, period, and audit references.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative min-w-[170px]">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search audit trail..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap rounded-xl border border-slate-200 bg-slate-100/80 p-0.5 text-xs font-semibold">
              {ALL_FILTER_TABS.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => { setActiveFilter(tab.id); setShowCount(30) }}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                    activeFilter === tab.id
                      ? 'bg-white text-slate-900 font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Compact Activity Table — No horizontal sliders */}
      {filtered.length === 0 ? (
        <div className="py-8 text-center text-slate-400 space-y-1">
          <p className="text-xs font-bold text-slate-700">No transaction records found</p>
          <p className="text-[11px] text-slate-500">No activity entries match the selected filter or search.</p>
        </div>
      ) : (
        <div className="w-full">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 select-none">
              <tr>
                <th className="px-3 py-2 w-14 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Ref</th>
                <th className="px-3 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider pl-4">Faculty & Activity</th>
                <th className="px-3 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Details / Context</th>
                <th className="px-3 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Credit</th>
                <th className="px-3 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleTransactions.map(tx => {
                const teacher = teacherMap[tx.teacher_id] || {}
                const cat = getCategoryConfig(tx)
                const formattedReason = formatTransactionReason(tx.reason, teacherMap)
                const contextStr = parseReasonContext(formattedReason)

                return (
                  <tr
                    key={tx.id}
                    onClick={() => setSelectedTx(tx)}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                  >
                    <td className="px-3 py-2 text-center font-mono font-bold text-slate-400 text-[11px] hidden sm:table-cell">
                      #TX-{tx.id}
                    </td>
                    <td className="px-3 py-2 pl-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm shrink-0">{cat.icon}</span>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-xs truncate leading-tight">
                            {teacher.name || `Teacher #${tx.teacher_id}`}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[9px] font-bold uppercase px-1 py-0.2 rounded border ${cat.pillClass}`}>
                              {cat.label}
                            </span>
                            <span className="text-slate-300 text-[10px]">•</span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {formatRelativeTime(tx.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-700 text-[11px] max-w-[280px] truncate hidden md:table-cell">
                      {contextStr}
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <CreditChangePill value={tx.change} />
                    </td>
                    <td className="px-3 py-2 text-right pr-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSelectedTx(tx) }}
                        className="text-[11px] font-semibold text-primary-600 hover:text-primary-800 hover:underline cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination / Load more */}
      {filtered.length > showCount && (
        <div className="p-3 border-t border-slate-100 bg-slate-50/40 text-center">
          <button
            type="button"
            onClick={() => setShowCount(c => c + 30)}
            className="text-xs font-bold text-primary-700 hover:text-primary-800 bg-white hover:bg-slate-50 border border-slate-200 px-4 py-1.5 rounded-xl transition shadow-2xs cursor-pointer"
          >
            Load More Records ({filtered.length - showCount} remaining)
          </button>
        </div>
      )}

      {/* Transaction Modal Popover */}
      {selectedTx && (
        <TransactionModal
          tx={selectedTx}
          teacher={teacherMap[selectedTx.teacher_id]}
          teacherMap={teacherMap}
          open={!!selectedTx}
          onClose={() => setSelectedTx(null)}
        />
      )}
    </div>
  )
}
