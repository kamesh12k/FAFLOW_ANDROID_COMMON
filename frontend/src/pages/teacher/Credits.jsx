import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { creditsApi, teachersApi, leavesApi } from '../../api/services'
import { Spinner, EmptyState } from '../../components/ui'
import { SearchIcon, SwapIcon, PlusIcon, PrinterIcon, DownloadIcon, CalIcon } from '../../components/icons'

function formatDateTime(isoStr) {
  if (!isoStr) return { date: '—', time: '' }
  try {
    const dt = new Date(isoStr)
    return {
      date: dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
      time: dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  } catch {
    return { date: isoStr, time: '' }
  }
}

function getActivityLabel(tx) {
  const ch = Number(tx.change) || 0
  if (tx.category === 'manual_adjustment') return 'Manual Adjustment'
  if (tx.category === 'quota_adjustment') return 'Quota Adjustment'
  if (ch > 0) return 'Substitution'
  if (ch < 0) return 'Leave Deduction'
  return 'Adjustment'
}

export default function MyCredits() {
  const { user } = useAuth()
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  // Filter & Search states
  const [activeTypeTab, setActiveTypeTab] = useState('all') // 'all', 'earned', 'deducted', 'adjustments'
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState('latest') // 'latest', 'oldest'
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    Promise.all([
      teachersApi.credits(user.id),
      creditsApi.myTransactions(),
      leavesApi.myLeaves().catch(() => ({ data: [] })),
    ])
      .then(([b, t]) => {
        setBalance(b.data.balance || 0)
        setTransactions(t.data || [])
      })
      .finally(() => setLoading(false))
  }, [user.id])

  // Process transaction stats
  const stats = useMemo(() => {
    let earned = 0
    let deducted = 0
    let adjustments = 0

    transactions.forEach(t => {
      const ch = Number(t.change) || 0
      if (ch > 0) {
        earned += ch
      } else if (ch < 0) {
        deducted += Math.abs(ch)
      } else {
        adjustments += 1
      }
    })

    return {
      earned,
      deducted,
      adjustments,
      totalCount: transactions.length,
    }
  }, [transactions])

  // Running balance calculation in chronological order
  const enhancedTransactions = useMemo(() => {
    const chronological = [...transactions].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    )

    let current = 0
    const withRunning = chronological.map(t => {
      current += Number(t.change) || 0
      return {
        ...t,
        running_balance: current,
      }
    })

    return withRunning.reverse()
  }, [transactions])

  // Filter & Search
  const filteredTransactions = useMemo(() => {
    return enhancedTransactions.filter(t => {
      const ch = Number(t.change) || 0
      const r = (t.reason || '').toLowerCase()
      const q = searchQuery.toLowerCase()

      if (activeTypeTab === 'earned' && ch <= 0) return false
      if (activeTypeTab === 'deducted' && ch >= 0) return false
      if (activeTypeTab === 'adjustments' && t.category !== 'manual_adjustment' && t.category !== 'quota_adjustment' && ch !== 0) return false

      if (q && !r.includes(q)) return false

      // Date range filtering
      if (fromDate) {
        const txDate = t.created_at ? t.created_at.split('T')[0] : ''
        if (txDate < fromDate) return false
      }
      if (toDate) {
        const txDate = t.created_at ? t.created_at.split('T')[0] : ''
        if (txDate > toDate) return false
      }

      return true
    }).sort((a, b) => {
      if (sortOrder === 'oldest') {
        return new Date(a.created_at) - new Date(b.created_at)
      }
      return new Date(b.created_at) - new Date(a.created_at)
    })
  }, [enhancedTransactions, activeTypeTab, searchQuery, sortOrder, fromDate, toDate])

  // Print to PDF
  const handlePrint = () => {
    window.print()
  }

  // Download filtered records as CSV
  const handleDownloadCsv = () => {
    if (filteredTransactions.length === 0) return

    const headers = [
      'Date',
      'Time',
      'Activity',
      'Details / Reason',
      'Credit Change',
      'Running Balance',
      'Related Leave ID'
    ]

    const rows = filteredTransactions.map(tx => {
      const { date, time } = formatDateTime(tx.created_at)
      const ch = Number(tx.change) || 0
      return [
        date,
        time,
        getActivityLabel(tx),
        tx.reason || 'Substitution credit update',
        ch > 0 ? `+${ch}` : `${ch}`,
        tx.running_balance !== undefined ? (tx.running_balance >= 0 ? `+${tx.running_balance}` : `${tx.running_balance}`) : '',
        tx.related_leave_id ? `#${tx.related_leave_id}` : ''
      ]
    })

    const metadata = [
      `# Faculty Credit Statement: ${user?.name || 'Faculty'}`,
      `# Department: ${user?.department || 'N/A'} (ID: #${user?.id})`,
      `# Generated On: ${new Date().toLocaleString()}`,
      `# Current Balance: ${balance >= 0 ? '+' : ''}${balance}`,
      `# Date Range: ${fromDate || 'Start'} to ${toDate || 'Present'}`,
      `# Total Filtered Records: ${rows.length}`,
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
    link.setAttribute('download', `Credit_Statement_${(user?.name || 'faculty').replace(/\s+/g, '_')}_${dateSuffix}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Custom print styling */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          aside, nav, header, .no-print, button {
            display: none !important;
          }
          .print-header {
            display: block !important;
          }
          .card, .bg-white {
            border: 1px solid #e2e8f0 !important;
            box-shadow: none !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            border: 1px solid #cbd5e1 !important;
            padding: 6px 8px !important;
          }
        }
      `}</style>

      {/* ── Print Document Header (Visible only when printing) ── */}
      <div className="hidden print:block pb-4 mb-4 border-b-2 border-slate-900 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              FACULTY CREDIT STATEMENT & ACCOUNTABILITY RECORD
            </h1>
            <p className="text-xs text-slate-600 mt-0.5 font-medium">
              Institutional Timetable & Substitution Credit Ledger
            </p>
          </div>
          <div className="text-right text-xs">
            <span className="font-bold text-slate-900 block text-sm">Running Balance</span>
            <span className="text-2xl font-extrabold font-mono text-slate-900">
              {balance >= 0 ? `+${balance}` : balance} Credits
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-200 text-xs">
          <div>
            <span className="text-slate-400 block font-bold text-[10px] uppercase">Faculty Member</span>
            <span className="font-bold text-slate-900">{user.name}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-bold text-[10px] uppercase">Department & ID</span>
            <span className="font-bold text-slate-900">{user.department || 'General'} (ID: #{user.id})</span>
          </div>
          <div>
            <span className="text-slate-400 block font-bold text-[10px] uppercase">Statement Date Range</span>
            <span className="font-bold text-slate-900">
              {fromDate || 'All Records'} to {toDate || 'Present'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Page Header & Quick Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Credits & Transactions
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            View your current credit balance and review your credit activity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Print / PDF Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition shadow-xs"
            title="Print to PDF / Print Report"
          >
            <PrinterIcon className="w-3.5 h-3.5 text-slate-600" />
            <span>Print to PDF</span>
          </button>

          {/* Download CSV Button */}
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={filteredTransactions.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download Filtered Records as CSV"
          >
            <DownloadIcon className="w-3.5 h-3.5 text-white" />
            <span>Download Records</span>
          </button>

          <Link
            to="/teacher/today-coverage"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition shadow-xs"
          >
            <SwapIcon className="w-3.5 h-3.5" />
            <span>Available Substitutions</span>
          </Link>
          <Link
            to="/teacher/leave/apply"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs transition shadow-xs"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>Apply for Leave</span>
          </Link>
        </div>
      </div>

      {/* ── Current Credit Balance Panel ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 block">
              Current Credit Balance
            </span>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl sm:text-4xl font-bold tracking-tight font-mono ${
                balance >= 0 ? 'text-slate-900' : 'text-rose-600'
              }`}>
                {balance >= 0 ? `+${balance}` : balance}
              </span>
              <span className="text-sm font-semibold text-slate-500">
                Credit{Math.abs(balance) === 1 ? '' : 's'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Current institutional credit balance
            </p>
          </div>

          <div className="sm:text-right text-xs text-slate-400">
            <span>Faculty Account ID: #{user.id}</span>
          </div>
        </div>
      </div>

      {/* ── Summary Metrics Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Current Balance */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Current Balance
          </span>
          <span className={`text-xl font-bold font-mono block ${balance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
            {balance >= 0 ? `+${balance}` : balance}
          </span>
          <span className="text-[11px] text-slate-400 block truncate">
            {balance >= 0 ? 'Active positive balance' : 'Negative balance'}
          </span>
        </div>

        {/* Metric 2: Credits Earned */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Credits Earned
          </span>
          <span className="text-xl font-bold font-mono text-emerald-700 block">
            +{stats.earned}
          </span>
          <span className="text-[11px] text-slate-400 block truncate">
            From covered classes
          </span>
        </div>

        {/* Metric 3: Credits Deducted */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Credits Deducted
          </span>
          <span className="text-xl font-bold font-mono text-slate-800 block">
            -{stats.deducted}
          </span>
          <span className="text-[11px] text-slate-400 block truncate">
            From leave periods
          </span>
        </div>

        {/* Metric 4: Adjustments */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Adjustments
          </span>
          <span className="text-xl font-bold font-mono text-slate-800 block">
            {stats.adjustments}
          </span>
          <span className="text-[11px] text-slate-400 block truncate">
            Administrative revisions
          </span>
        </div>
      </div>

      {/* ── Credit Policy Panel ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Credit Policy
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1">
            <div className="flex justify-between items-center font-semibold">
              <span className="text-slate-800">Substitution</span>
              <span className="font-mono text-emerald-700 font-bold">+1</span>
            </div>
            <p className="text-[11px] text-slate-500">Per eligible teaching period covered</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1">
            <div className="flex justify-between items-center font-semibold">
              <span className="text-slate-800">Leave</span>
              <span className="font-mono text-rose-700 font-bold">-1</span>
            </div>
            <p className="text-[11px] text-slate-500">Per applicable teaching period taken</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1">
            <div className="flex justify-between items-center font-semibold">
              <span className="text-slate-800">Non-working Day</span>
              <span className="font-mono text-slate-600 font-bold">0</span>
            </div>
            <p className="text-[11px] text-slate-500">Scheduled holidays generate no change</p>
          </div>
        </div>
      </div>

      {/* ── Transaction History Section ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Section Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-slate-900">
              Transaction History
            </h2>
            <p className="text-xs text-slate-500">
              Review all credit additions, deductions and adjustments.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search transactions…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary-600 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sort Toggle */}
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary-600"
            >
              <option value="latest">Latest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>

        {/* Filter Segmented Control */}
        <div className="px-4 py-2 bg-slate-50/60 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 no-print">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: 'all', label: `All (${transactions.length})` },
              { key: 'earned', label: `Earned (+${stats.earned})` },
              { key: 'deducted', label: `Deducted (-${stats.deducted})` },
              { key: 'adjustments', label: `Adjustments (${stats.adjustments})` },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTypeTab(tab.key)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  activeTypeTab === tab.key
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="text-[11px] font-semibold text-slate-500">
            Showing <strong className="text-slate-900">{filteredTransactions.length}</strong> records
          </span>
        </div>

        {/* Date Range Filter Bar */}
        <div className="px-4 py-2.5 bg-slate-50/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs no-print">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <CalIcon className="w-3.5 h-3.5 text-slate-400" /> Date Range:
            </span>
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">From</span>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="text-xs text-slate-800 bg-transparent font-semibold focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-xs">
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
                className="text-[11px] font-bold text-rose-700 hover:text-rose-800 bg-rose-50 border border-rose-200 px-2 py-1 rounded-md transition"
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
              className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-[11px] font-semibold text-slate-600 transition shadow-xs"
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
              className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-[11px] font-semibold text-slate-600 transition shadow-xs"
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => { setFromDate(''); setToDate('') }}
              className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-[11px] font-semibold text-slate-600 transition shadow-xs"
            >
              All Time
            </button>
          </div>
        </div>

        {/* Transactions Table (Desktop) & List (Mobile) */}
        {filteredTransactions.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            {transactions.length === 0 ? (
              <EmptyState
                message="No credit transactions recorded yet."
              />
            ) : (
              <div className="space-y-2">
                <p className="font-semibold text-slate-700">No matching transactions found.</p>
                <button
                  type="button"
                  onClick={() => { setActiveTypeTab('all'); setSearchQuery('') }}
                  className="text-primary-600 hover:text-primary-700 font-bold underline"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table (md and up) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-500 select-none">
                  <tr>
                    <th className="px-4 py-3 font-bold uppercase tracking-wider text-[11px]">Date & Time</th>
                    <th className="px-4 py-3 font-bold uppercase tracking-wider text-[11px]">Activity</th>
                    <th className="px-4 py-3 font-bold uppercase tracking-wider text-[11px]">Details</th>
                    <th className="px-4 py-3 font-bold uppercase tracking-wider text-[11px] text-center">Credit Change</th>
                    <th className="px-4 py-3 font-bold uppercase tracking-wider text-[11px] text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredTransactions.map(tx => {
                    const ch = Number(tx.change) || 0
                    const { date, time } = formatDateTime(tx.created_at)
                    const activity = getActivityLabel(tx)

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Date & Time */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-bold text-slate-900 block">{date}</span>
                          <span className="text-[10px] text-slate-400">{time}</span>
                        </td>

                        {/* Activity */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
                            ch > 0
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : ch < 0
                              ? 'bg-rose-50 text-rose-800 border border-rose-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {activity}
                          </span>
                        </td>

                        {/* Details */}
                        <td className="px-4 py-3.5 max-w-md">
                          <p className="text-slate-800 leading-relaxed font-medium">
                            {tx.reason || 'Substitution credit update'}
                          </p>
                          {tx.related_leave_id && (
                            <span className="text-[10px] text-slate-400 font-medium mt-0.5 inline-block">
                              Leave #{tx.related_leave_id}
                            </span>
                          )}
                        </td>

                        {/* Credit Change */}
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          <span className={`font-mono font-bold text-xs ${
                            ch > 0
                              ? 'text-emerald-700'
                              : ch < 0
                              ? 'text-rose-700'
                              : 'text-slate-600'
                          }`}>
                            {ch > 0 ? `+${ch}` : ch}
                          </span>
                        </td>

                        {/* Balance */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <span className="font-mono font-bold text-xs text-slate-900">
                            {tx.running_balance !== undefined
                              ? (tx.running_balance >= 0 ? `+${tx.running_balance}` : tx.running_balance)
                              : '—'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile List View (below md) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredTransactions.map(tx => {
                const ch = Number(tx.change) || 0
                const { date, time } = formatDateTime(tx.created_at)
                const activity = getActivityLabel(tx)

                return (
                  <div key={tx.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${
                          ch > 0
                            ? 'bg-emerald-50 text-emerald-800'
                            : ch < 0
                            ? 'bg-rose-50 text-rose-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {activity}
                        </span>
                        <p className="text-xs font-semibold text-slate-900 mt-1 leading-snug">
                          {tx.reason}
                        </p>
                        {tx.related_leave_id && (
                          <span className="text-[10px] text-slate-400">Leave #{tx.related_leave_id}</span>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`font-mono font-bold text-xs block ${
                          ch > 0 ? 'text-emerald-700' : (ch < 0 ? 'text-rose-700' : 'text-slate-600')
                        }`}>
                          {ch > 0 ? `+${ch}` : ch}
                        </span>
                        {tx.running_balance !== undefined && (
                          <span className="font-mono text-[10px] text-slate-400 font-semibold block mt-0.5">
                            Bal: {tx.running_balance >= 0 ? `+${tx.running_balance}` : tx.running_balance}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 font-medium">
                      {date} · {time}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

