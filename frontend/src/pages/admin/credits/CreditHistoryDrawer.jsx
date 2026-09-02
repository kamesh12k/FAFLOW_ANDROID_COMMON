import { useEffect, useState, useMemo } from 'react'
import { avatarColors, initialsOf, getCategoryConfig, formatRelativeTime, formatTransactionReason } from './utils'
import { generateCreditPdfReport } from './pdfReportGenerator'
import TransactionModal from './TransactionModal'

function parseTransactionDetails(reasonText, category) {
  const details = {
    classText: null,
    dayOrder: null,
    period: null,
    subject: null,
  }
  if (!reasonText) return details

  const doMatch = reasonText.match(/Day Order\s+(\d+)/i) || reasonText.match(/DO\s*(\d+)/i)
  if (doMatch) details.dayOrder = `Day Order ${doMatch[1]}`

  const pMatch = reasonText.match(/period\s+(\d+)/i) || reasonText.match(/P\s*(\d+)/i)
  if (pMatch) details.period = `Period ${pMatch[1]}`

  const classMatch = reasonText.match(/in\s+([I|V|X\d\s\w\.\-]+?)(?:\s+Period|\s+Day|\s+DO|$)/i) ||
                     reasonText.match(/for\s+([I|V|X\d\s\w\.\-]+?)(?:\s+Period|\s+Day|\s+DO|$)/i)
  if (classMatch && !classMatch[1].toLowerCase().includes('teacher') && !classMatch[1].toLowerCase().includes('leave')) {
    details.classText = classMatch[1].trim()
  }

  const subjectMatch = reasonText.match(/subject\s+([\w\s\-\d]+)/i) || reasonText.match(/for\s+([\w\s\-\d]+)\s+class/i)
  if (subjectMatch) details.subject = subjectMatch[1].trim()

  return details
}

function Avatar({ name }) {
  const c = avatarColors(name)
  return (
    <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${c.bg} ${c.text} border border-slate-200 shadow-2xs`}>
      {initialsOf(name)}
    </div>
  )
}

function CreditChange({ value }) {
  if (value > 0) return <span className="font-mono font-bold text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">+{value}</span>
  return <span className="font-mono font-bold text-xs text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">{value}</span>
}

const FILTER_TABS = ['All', 'Earned', 'Deducted', 'Substitutions', 'Leaves', 'Exam Duty', 'Manual']

export default function CreditHistoryDrawer({
  teacher,
  transactions = [],
  allTeachers = [],
  onClose,
  onAdjust,
}) {
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [dateFilter, setDateFilter] = useState('all')
  const [selectedTx, setSelectedTx] = useState(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  const teacherMap = useMemo(() => {
    const m = {}
    for (const t of allTeachers) m[t.id] = t
    return m
  }, [allTeachers])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const teacherTxs = useMemo(() => {
    if (!teacher) return []
    return transactions
      .filter(tx => tx.teacher_id === (teacher.teacher_id ?? teacher.id))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [teacher, transactions])

  const filteredTxs = useMemo(() => {
    let out = teacherTxs
    const now = new Date()

    if (dateFilter === 'today') {
      const todayStr = now.toDateString()
      out = out.filter(tx => new Date(tx.created_at).toDateString() === todayStr)
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7)
      out = out.filter(tx => new Date(tx.created_at) >= weekAgo)
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1)
      out = out.filter(tx => new Date(tx.created_at) >= monthAgo)
    }

    if (categoryFilter === 'Earned') out = out.filter(tx => tx.change > 0)
    else if (categoryFilter === 'Deducted') out = out.filter(tx => tx.change < 0)
    else if (categoryFilter === 'Substitutions') out = out.filter(tx => getCategoryConfig(tx).label.includes('Substitution'))
    else if (categoryFilter === 'Leaves') out = out.filter(tx => getCategoryConfig(tx).label.includes('Leave'))
    else if (categoryFilter === 'Exam Duty') out = out.filter(tx => getCategoryConfig(tx).label.includes('Exam'))
    else if (categoryFilter === 'Manual') out = out.filter(tx => getCategoryConfig(tx).label.includes('Admin'))

    return out
  }, [teacherTxs, categoryFilter, dateFilter])

  // Compute breakdown statistics
  const breakdown = useMemo(() => {
    let earned = 0
    let deducted = 0
    let subsCount = 0
    let otherDutiesCount = 0
    let leavesCount = 0
    let adjustmentsCount = 0

    for (const tx of teacherTxs) {
      const change = Number(tx.change) || 0
      const cat = (tx.category || '').toLowerCase()

      if (change > 0) {
        earned += change
        if (cat.includes('substitut')) subsCount += 1
        else otherDutiesCount += 1
      } else {
        deducted += Math.abs(change)
        if (cat.includes('leave')) leavesCount += 1
        else adjustmentsCount += 1
      }
    }

    return { earned, deducted, subsCount, otherDutiesCount, leavesCount, adjustmentsCount }
  }, [teacherTxs])

  const handleExportPdf = async () => {
    setGeneratingPdf(true)
    try {
      await generateCreditPdfReport({
        report: [teacher],
        transactions,
        filterScope: { teacherId: teacher.teacher_id ?? teacher.id },
      })
    } finally {
      setGeneratingPdf(false)
    }
  }

  if (!teacher) return null

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-40 transition-opacity" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white z-50 shadow-2xl flex flex-col transition-transform duration-200 border-l border-slate-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar name={teacher.name} />
              <div>
                <h2 className="text-base font-bold text-slate-900 leading-snug">{teacher.name}</h2>
                <p className="text-xs text-slate-500 font-medium">{teacher.department || 'Faculty'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 transition p-1 rounded-lg hover:bg-slate-200/60 cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Explainable Balance Equation Card */}
          <div className="mt-3.5 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-center divide-x divide-slate-100">
              <div className="flex-1 px-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Earned</span>
                <span className="text-sm font-mono font-bold text-emerald-700 block mt-0.5">+{breakdown.earned}</span>
              </div>
              <div className="flex-1 px-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Deducted</span>
                <span className="text-sm font-mono font-bold text-rose-700 block mt-0.5">-{breakdown.deducted}</span>
              </div>
              <div className="flex-1 px-1 bg-slate-50/80 rounded-lg py-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Net Balance</span>
                <span className={`text-base font-mono font-extrabold block ${
                  teacher.balance >= 0 ? 'text-slate-900' : 'text-rose-700'
                }`}>
                  {teacher.balance >= 0 ? '+' : ''}{teacher.balance}
                </span>
              </div>
            </div>

            {/* Contextual Summary Badges */}
            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap text-[10px]">
              <span className="bg-emerald-50 text-emerald-800 font-semibold px-2 py-0.5 rounded border border-emerald-200">
                {breakdown.subsCount} Substitutions Covered
              </span>
              {breakdown.otherDutiesCount > 0 && (
                <span className="bg-sky-50 text-sky-800 font-semibold px-2 py-0.5 rounded border border-sky-200">
                  {breakdown.otherDutiesCount} Other Duties
                </span>
              )}
              {breakdown.leavesCount > 0 && (
                <span className="bg-rose-50 text-rose-800 font-semibold px-2 py-0.5 rounded border border-rose-200">
                  {breakdown.leavesCount} Leaves Deducted
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 py-2 border-b border-slate-100 bg-white shrink-0 space-y-1.5">
          <div className="flex gap-1.5 overflow-x-auto">
            {[['all', 'All Time'], ['today', 'Today'], ['week', 'This Week'], ['month', 'This Month']].map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setDateFilter(val)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                  dateFilter === val ? 'bg-primary-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 flex-wrap">
            {FILTER_TABS.map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setCategoryFilter(tab)}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all cursor-pointer ${
                  categoryFilter === tab ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Chronological Transaction List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredTxs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <p className="text-xs font-bold text-slate-600">No records found matching filters</p>
            </div>
          ) : (
            filteredTxs.map((tx) => {
              const cat = getCategoryConfig(tx)
              const formattedReason = formatTransactionReason(tx.reason, teacherMap)
              const details = parseTransactionDetails(formattedReason, tx.category)

              return (
                <div
                  key={tx.id}
                  onClick={() => setSelectedTx(tx)}
                  className="p-3 bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl transition shadow-2xs cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="text-base shrink-0 mt-0.5">{cat.icon}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${cat.pillClass}`}>
                            {cat.label}
                          </span>
                          <CreditChange value={tx.change} />
                        </div>
                        <p className="text-xs font-medium text-slate-800 mt-1 leading-snug">{formattedReason}</p>
                        
                        {/* Context pills */}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap text-[10px]">
                          <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                            {formatRelativeTime(tx.created_at)}
                          </span>
                          {details.classText && (
                            <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-semibold border border-indigo-100">
                              {details.classText}
                            </span>
                          )}
                          {tx.related_leave_id && (
                            <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-semibold border border-amber-200">
                              Leave #{tx.related_leave_id}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono text-slate-400 font-bold shrink-0">
                      #TX-{tx.id}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Drawer Action Footer */}
        <div className="p-4 border-t border-slate-150 bg-slate-50/80 shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={generatingPdf}
            className="flex-1 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 py-2.5 rounded-xl transition shadow-2xs text-center flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {generatingPdf ? (
              <svg className="w-3.5 h-3.5 animate-spin text-primary-600" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            Export PDF Statement
          </button>
          {onAdjust && (
            <button
              type="button"
              onClick={() => onAdjust(teacher)}
              className="flex-1 text-xs font-bold text-center text-white bg-primary-600 hover:bg-primary-700 py-2.5 rounded-xl transition shadow-xs cursor-pointer"
            >
              + Adjust Credits
            </button>
          )}
        </div>
      </div>

      {/* Transaction Modal Popover */}
      {selectedTx && (
        <TransactionModal
          tx={selectedTx}
          teacher={teacher}
          teacherMap={teacherMap}
          open={!!selectedTx}
          onClose={() => setSelectedTx(null)}
        />
      )}
    </>
  )
}
