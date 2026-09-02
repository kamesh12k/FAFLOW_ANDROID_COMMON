import { useState, useMemo } from 'react'
import { exportToCSV } from './utils'
import { generateCreditPdfReport } from './pdfReportGenerator'
import { useAuth } from '../../../context/AuthContext'
import { PrinterIcon, DownloadIcon, CalIcon } from '../../../components/icons'

function ExportButton({ icon, label, desc, onClick, loading, variant = 'default' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left min-w-[220px] flex-1 shadow-2xs cursor-pointer disabled:opacity-60 ${
        variant === 'emerald'
          ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-700 text-white shadow-xs'
          : variant === 'primary'
          ? 'bg-primary-50/80 border-primary-200 text-primary-900 hover:bg-primary-100 hover:border-primary-300'
          : variant === 'slate'
          ? 'bg-slate-900 hover:bg-slate-800 border-slate-900 text-white shadow-xs'
          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 hover:border-slate-300'
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
        variant === 'emerald'
          ? 'bg-emerald-500/30 text-white border-emerald-400/30'
          : variant === 'primary'
          ? 'bg-primary-600 text-white border-primary-700'
          : variant === 'slate'
          ? 'bg-slate-800 text-white border-slate-700'
          : 'bg-slate-100 text-slate-700 border-slate-200'
      }`}>
        {loading ? (
          <svg className="w-4 h-4 animate-spin text-current" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          icon
        )}
      </div>
      <div>
        <div className={`text-xs font-bold ${variant === 'emerald' || variant === 'slate' ? 'text-white' : 'text-slate-900'}`}>{label}</div>
        <div className={`text-[11px] mt-0.5 ${variant === 'emerald' || variant === 'slate' ? 'text-emerald-100/90' : 'text-slate-500'}`}>{desc}</div>
      </div>
    </button>
  )
}

export default function ExportBar({ report = [], transactions = [], allTeachers = [] }) {
  const { user } = useAuth()
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // Filter transactions by date range
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (fromDate) {
        const txDate = tx.created_at ? tx.created_at.split('T')[0] : ''
        if (txDate < fromDate) return false
      }
      if (toDate) {
        const txDate = tx.created_at ? tx.created_at.split('T')[0] : ''
        if (txDate > toDate) return false
      }
      return true
    })
  }, [transactions, fromDate, toDate])

  // Duration analytics
  const durationStats = useMemo(() => {
    let earned = 0
    let deducted = 0
    let subsCount = 0
    let leavesCount = 0
    let adjustmentsCount = 0

    filteredTransactions.forEach(tx => {
      const ch = Number(tx.change) || 0
      if (ch > 0) {
        earned += ch
        subsCount++
      } else if (ch < 0) {
        deducted += Math.abs(ch)
        leavesCount++
      } else {
        adjustmentsCount++
      }
    })

    return {
      earned,
      deducted,
      netChange: earned - deducted,
      count: filteredTransactions.length,
      subsCount,
      leavesCount,
      adjustmentsCount,
    }
  }, [filteredTransactions])

  // Export Master Credit Data for the selected duration
  function handleExportMasterDataCSV() {
    const teacherMap = {}
    for (const r of report) {
      teacherMap[r.teacher_id] = {
        id: r.teacher_id,
        name: r.name,
        dept: r.department || 'General',
        currentBalance: r.balance || 0,
        earnedInDuration: 0,
        deductedInDuration: 0,
        txCountInDuration: 0,
        subCountInDuration: 0,
        leaveCountInDuration: 0,
        adjCountInDuration: 0,
      }
    }
    for (const t of allTeachers) {
      if (!teacherMap[t.id]) {
        teacherMap[t.id] = {
          id: t.id,
          name: t.name,
          dept: t.department || 'General',
          currentBalance: 0,
          earnedInDuration: 0,
          deductedInDuration: 0,
          txCountInDuration: 0,
          subCountInDuration: 0,
          leaveCountInDuration: 0,
          adjCountInDuration: 0,
        }
      }
    }

    filteredTransactions.forEach(tx => {
      const rec = teacherMap[tx.teacher_id]
      if (rec) {
        rec.txCountInDuration++
        const ch = Number(tx.change) || 0
        if (ch > 0) {
          rec.earnedInDuration += ch
          rec.subCountInDuration++
        } else if (ch < 0) {
          rec.deductedInDuration += Math.abs(ch)
          rec.leaveCountInDuration++
        } else {
          rec.adjCountInDuration++
        }
      }
    })

    const headers = [
      'Faculty ID',
      'Faculty Name',
      'Department',
      'Lifetime Current Balance',
      'Duration Earned Credits',
      'Duration Deducted Credits',
      'Duration Net Change',
      'Duration Substitutions',
      'Duration Leave Deductions',
      'Duration Adjustments',
      'Duration Total Transactions',
      'Selected Duration'
    ]

    const durationLabel = fromDate && toDate ? `${fromDate} to ${toDate}` : fromDate ? `From ${fromDate}` : toDate ? `Up to ${toDate}` : 'All Time'

    const rows = Object.values(teacherMap)
      .sort((a, b) => (b.earnedInDuration - b.deductedInDuration) - (a.earnedInDuration - a.deductedInDuration))
      .map(t => {
        const netDuration = t.earnedInDuration - t.deductedInDuration
        return [
          `#${t.id}`,
          t.name,
          t.dept,
          t.currentBalance >= 0 ? `+${t.currentBalance}` : `${t.currentBalance}`,
          `+${t.earnedInDuration}`,
          `-${t.deductedInDuration}`,
          netDuration >= 0 ? `+${netDuration}` : `${netDuration}`,
          t.subCountInDuration,
          t.leaveCountInDuration,
          t.adjCountInDuration,
          t.txCountInDuration,
          durationLabel
        ]
      })

    const metadata = [
      `# ==========================================================`,
      `# INSTITUTIONAL MASTER CREDIT DATA FOR SELECTED DURATION`,
      `# ==========================================================`,
      `# Duration Range: ${durationLabel}`,
      `# Generated By: ${user?.name || 'Administrator'} (Admin)`,
      `# Generated On: ${new Date().toLocaleString()}`,
      `# Total Faculty: ${rows.length}`,
      `# Total Transactions in Duration: ${durationStats.count}`,
      `# Total Credits Earned in Duration: +${durationStats.earned}`,
      `# Total Credits Deducted in Duration: -${durationStats.deducted}`,
      `# Net Duration Balance Impact: ${durationStats.netChange >= 0 ? '+' : ''}${durationStats.netChange}`,
      `# ==========================================================`,
      ''
    ].join('\n')

    const csvContent = "\uFEFF" + metadata + '\n' + [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    const dateSuffix = fromDate && toDate ? `${fromDate}_to_${toDate}` : new Date().toISOString().slice(0, 10)
    link.setAttribute('download', `Master_Credit_Data_${dateSuffix}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setFeedback({
      type: 'success',
      message: `Master Credit Data for "${durationLabel}" (${rows.length} faculty members, ${durationStats.count} transactions) downloaded successfully.`
    })
  }

  function handleExportBalanceExcel() {
    const headers = ['Teacher Name', 'Department', 'Current Balance', 'Health Status']
    const rows = [...report]
      .sort((a, b) => b.balance - a.balance)
      .map(r => {
        let status = 'Neutral'
        if (r.balance >= 10) status = 'Excellent'
        else if (r.balance >= 5) status = 'Good'
        else if (r.balance >= 1) status = 'Average'
        else if (r.balance >= -3) status = 'Needs Attention'
        else if (r.balance < -3) status = 'Critical'
        return [r.name, r.department || '', r.balance, status]
      })
    exportToCSV(`faculty-credits-balance-report-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
  }

  function handleExportAuditLedgerCSV() {
    const headers = ['Record ID', 'Timestamp', 'Faculty Name', 'Department', 'Event Category', 'Credit Change', 'Reason / Context', 'Related Leave ID']
    const teacherMap = {}
    for (const r of report) teacherMap[r.teacher_id] = { name: r.name, dept: r.department }
    for (const t of allTeachers) {
      if (!teacherMap[t.id]) teacherMap[t.id] = { name: t.name, dept: t.department }
    }

    const rows = [...filteredTransactions]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(tx => {
        const tInfo = teacherMap[tx.teacher_id] || {}
        return [
          `TX-${tx.id}`,
          new Date(tx.created_at).toLocaleString('en-IN'),
          tInfo.name || `Teacher #${tx.teacher_id}`,
          tInfo.dept || 'N/A',
          tx.category || 'general',
          tx.change >= 0 ? `+${tx.change}` : tx.change,
          tx.reason || '',
          tx.related_leave_id ? `#${tx.related_leave_id}` : 'N/A'
        ]
      })

    const dateSuffix = fromDate && toDate ? `${fromDate}_to_${toDate}` : new Date().toISOString().slice(0, 10)
    exportToCSV(`institutional-credit-audit-ledger-${dateSuffix}.csv`, headers, rows)
  }

  function handlePrintStatement() {
    window.print()
  }

  async function handleGeneratePdf() {
    setGeneratingPdf(true)
    setFeedback(null)
    try {
      const res = await generateCreditPdfReport({
        report,
        transactions: filteredTransactions,
        allTeachers,
        filterScope: { fromDate, toDate },
        currentUser: user || {},
      })

      if (!res.success && res.reason === 'NO_DATA') {
        setFeedback({
          type: 'error',
          message: 'No credit data available for the selected date range.',
        })
      } else {
        setFeedback({
          type: 'success',
          message: `Official credit PDF report "${res.fileName}" generated successfully.`,
        })
      }
    } catch (err) {
      console.error('PDF generation error:', err)
      setFeedback({
        type: 'error',
        message: 'Failed to generate PDF report. Please try again.',
      })
    } finally {
      setGeneratingPdf(false)
      setTimeout(() => setFeedback(null), 6000)
    }
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Accounting Reports & Master Credit Exporter
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Select a custom date range (From Date &amp; To Date) and export complete master credit data, audit ledgers, or print PDF statements.
          </p>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs no-print">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <CalIcon className="w-3.5 h-3.5 text-slate-400" /> Select Duration:
          </span>
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 shadow-xs">
            <span className="text-[10px] text-slate-400 font-bold uppercase">From</span>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="text-xs text-slate-800 bg-transparent font-semibold focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 shadow-xs">
            <span className="text-[10px] text-slate-400 font-bold uppercase">To</span>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="text-xs text-slate-800 bg-transparent font-semibold focus:outline-none"
            />
          </div>
          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={() => { setFromDate(''); setToDate('') }}
              className="text-[11px] font-bold text-rose-700 hover:text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md transition cursor-pointer"
            >
              Clear Dates
            </button>
          )}
        </div>

        {/* Quick Date Presets */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const now = new Date()
              const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
              const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
              setFromDate(firstDay)
              setToDate(lastDay)
            }}
            className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-[11px] font-semibold text-slate-700 transition shadow-xs cursor-pointer"
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date()
              const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
              const today = now.toISOString().split('T')[0]
              setFromDate(past)
              setToDate(today)
            }}
            className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-[11px] font-semibold text-slate-700 transition shadow-xs cursor-pointer"
          >
            Last 30 Days
          </button>
          <button
            type="button"
            onClick={() => { setFromDate(''); setToDate('') }}
            className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-[11px] font-semibold text-slate-700 transition shadow-xs cursor-pointer"
          >
            All Time
          </button>
        </div>
      </div>

      {/* Selected Duration Preview KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-900 text-white text-xs no-print">
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Selected Duration</span>
          <p className="font-bold text-white text-xs truncate">
            {fromDate && toDate ? `${fromDate} → ${toDate}` : fromDate ? `From ${fromDate}` : toDate ? `Up to ${toDate}` : 'All Time Records'}
          </p>
        </div>
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Credits Earned</span>
          <p className="font-bold text-emerald-300 font-mono text-sm">+{durationStats.earned}</p>
        </div>
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">Credits Deducted</span>
          <p className="font-bold text-rose-300 font-mono text-sm">-{durationStats.deducted}</p>
        </div>
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">Net Duration Impact</span>
          <p className="font-bold text-cyan-300 font-mono text-sm">
            {durationStats.netChange >= 0 ? `+${durationStats.netChange}` : durationStats.netChange} ({durationStats.count} tx)
          </p>
        </div>
      </div>

      {feedback && (
        <div className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between border ${
          feedback.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 no-print">
        {/* Master Credit Data Exporter */}
        <ExportButton
          icon={<DownloadIcon className="w-4 h-4" />}
          label="Export Master Credit Data"
          desc={`Complete faculty dataset for duration (${durationStats.count} tx)`}
          onClick={handleExportMasterDataCSV}
          variant="emerald"
        />
        <ExportButton
          icon={<PrinterIcon className="w-4 h-4" />}
          label="Print to PDF"
          desc="Print or save statement to PDF"
          onClick={handlePrintStatement}
          variant="primary"
        />
        <ExportButton
          icon={<DownloadIcon className="w-4 h-4" />}
          label={`Audit Ledger CSV (${filteredTransactions.length})`}
          desc={fromDate || toDate ? `Line items from ${fromDate || 'start'} to ${toDate || 'present'}` : "Full line-item transaction audit log"}
          onClick={handleExportAuditLedgerCSV}
        />
        <ExportButton
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          label="Official PDF Report"
          desc="Formatted publication report"
          onClick={handleGeneratePdf}
          loading={generatingPdf}
        />
      </div>
    </div>
  )
}
