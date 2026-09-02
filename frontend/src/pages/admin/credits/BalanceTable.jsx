import { useState, useMemo } from 'react'
import { avatarColors, initialsOf, getTeacherStatus, formatRelativeTime } from './utils'

function Avatar({ name }) {
  const c = avatarColors(name)
  return (
    <div className={`h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[9px] font-bold ${c.bg} ${c.text}`}>
      {initialsOf(name)}
    </div>
  )
}

function BalanceChip({ value }) {
  if (value > 0) return (
    <span className="inline-flex items-center font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
      +{value}
    </span>
  )
  if (value < 0) return (
    <span className="inline-flex items-center font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
      {value}
    </span>
  )
  return (
    <span className="inline-flex items-center font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
      0
    </span>
  )
}

function StatusDot({ balance }) {
  const s = getTeacherStatus(balance)
  let dotColor = 'bg-slate-400'
  if (s.label === 'Excellent' || s.label === 'Good') dotColor = 'bg-emerald-500'
  else if (s.label === 'Average') dotColor = 'bg-sky-500'
  else if (s.label === 'Needs Attention') dotColor = 'bg-amber-500'
  else if (s.label === 'Critical') dotColor = 'bg-rose-500'

  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-medium">
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {s.label}
    </span>
  )
}

const SortIcon = ({ active, dir }) => (
  <span className={`ml-1 text-[10px] ${active ? 'text-primary-600 font-bold' : 'text-slate-300'}`}>
    {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
  </span>
)

export default function BalanceTable({
  report = [],
  transactions = [],
  onViewHistory,
  onAdjust,
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // all | positive | negative | flagged
  const [selectedDept, setSelectedDept] = useState('')
  const [sortKey, setSortKey] = useState('balance')
  const [sortDir, setSortDir] = useState('desc')

  const departments = useMemo(() => {
    return Array.from(new Set(report.map(r => r.department).filter(Boolean))).sort()
  }, [report])

  // Aggregate teacher-level transactional stats
  const statsByTeacher = useMemo(() => {
    const map = {}
    for (const r of report) {
      map[r.teacher_id] = {
        earned: 0,
        deducted: 0,
        substitutions: 0,
        lastActivity: null,
      }
    }

    for (const tx of transactions) {
      if (!map[tx.teacher_id]) {
        map[tx.teacher_id] = {
          earned: 0,
          deducted: 0,
          substitutions: 0,
          lastActivity: null,
        }
      }

      const entry = map[tx.teacher_id]
      const change = Number(tx.change) || 0
      const cat = (tx.category || '').toLowerCase()

      if (change > 0) {
        entry.earned += change
        if (cat.includes('substitut')) entry.substitutions += 1
      } else {
        entry.deducted += Math.abs(change)
      }

      if (!entry.lastActivity || new Date(tx.created_at) > new Date(entry.lastActivity)) {
        entry.lastActivity = tx.created_at
      }
    }

    return map
  }, [report, transactions])

  const rows = useMemo(() => {
    return report.map((r) => {
      const stats = statsByTeacher[r.teacher_id] || {
        earned: 0,
        deducted: 0,
        substitutions: 0,
        lastActivity: null,
      }

      return {
        ...r,
        earned: stats.earned,
        deducted: stats.deducted,
        substitutions: stats.substitutions,
        lastActivity: stats.lastActivity,
      }
    })
  }, [report, statsByTeacher])

  const filtered = useMemo(() => {
    let out = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(r => r.name.toLowerCase().includes(q) || (r.department || '').toLowerCase().includes(q))
    }
    if (selectedDept) {
      out = out.filter(r => r.department === selectedDept)
    }
    if (filter === 'positive') out = out.filter(r => r.balance > 0)
    else if (filter === 'negative') out = out.filter(r => r.balance < 0)
    else if (filter === 'flagged') {
      out = out.filter(r => {
        const s = getTeacherStatus(r.balance)
        return s.label === 'Critical' || s.label === 'Needs Attention'
      })
    }

    return [...out].sort((a, b) => {
      let av, bv
      if (sortKey === 'balance') { av = a.balance; bv = b.balance }
      else if (sortKey === 'name') { av = a.name; bv = b.name }
      else if (sortKey === 'earned') { av = a.earned; bv = b.earned }
      else if (sortKey === 'deducted') { av = a.deducted; bv = b.deducted }
      else if (sortKey === 'substitutions') { av = a.substitutions; bv = b.substitutions }
      else if (sortKey === 'lastActivity') { av = a.lastActivity ? new Date(a.lastActivity).getTime() : 0; bv = b.lastActivity ? new Date(b.lastActivity).getTime() : 0 }
      else { av = a.balance; bv = b.balance }

      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [rows, search, filter, selectedDept, sortKey, sortDir])

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const resetFilters = () => {
    setSearch('')
    setFilter('all')
    setSelectedDept('')
  }

  const TH = ({ label, sortable, col, className = '' }) => (
    <th
      className={`px-3 py-2 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider ${sortable ? 'cursor-pointer hover:text-slate-900 select-none' : ''} ${className}`}
      onClick={sortable ? () => toggleSort(col) : undefined}
    >
      <span className="inline-flex items-center">
        {label}
        {sortable && <SortIcon active={sortKey === col} dir={sortDir} />}
      </span>
    </th>
  )

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Controls Bar */}
      <div className="p-3 sm:p-3.5 border-b border-slate-100 bg-slate-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-slate-900">Faculty Credit Overview</h3>
            <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
              {filtered.length} faculty
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-[160px]">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search faculty..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-7 pr-6 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Department Dropdown */}
            {departments.length > 0 && (
              <select
                className="py-1 px-2 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:outline-none text-slate-700 cursor-pointer"
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
              >
                <option value="">All Depts</option>
                {departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}

            {/* Filter Tabs */}
            <div className="flex rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 text-xs font-semibold">
              {[
                ['all', 'All'],
                ['positive', 'Positive (+)'],
                ['negative', 'Negative (-)'],
                ['flagged', 'Attention'],
              ].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setFilter(val)}
                  className={`px-2 py-0.5 rounded text-[11px] transition-all cursor-pointer ${
                    filter === val
                      ? 'bg-white text-slate-900 font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Compact Responsive Table — No horizontal scrollbars */}
      {filtered.length === 0 ? (
        <div className="py-8 text-center text-slate-400 space-y-1">
          <p className="text-xs font-bold text-slate-700">No matching faculty records found</p>
          {(search || filter !== 'all' || selectedDept) && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-[11px] font-bold text-primary-600 hover:text-primary-700 underline cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="w-full">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 select-none">
              <tr>
                <TH label="Faculty Member" sortable col="name" className="pl-4" />
                <TH label="Net Balance" sortable col="balance" className="text-center" />
                <TH label="Earned / Deducted" sortable col="earned" className="hidden sm:table-cell" />
                <TH label="Substitutions" sortable col="substitutions" className="text-center hidden md:table-cell" />
                <TH label="Last Activity" sortable col="lastActivity" className="hidden lg:table-cell" />
                <th className="px-3 py-2 text-right pr-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.teacher_id} className="hover:bg-slate-50/70 transition-colors">
                  {/* Faculty Member & Status */}
                  <td className="px-3 py-2 pl-4">
                    <div className="flex items-center gap-2">
                      <Avatar name={r.name} />
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-xs truncate leading-tight">{r.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-slate-400 truncate">{r.department || 'Faculty'}</span>
                          <span className="text-slate-300 text-[10px]">•</span>
                          <StatusDot balance={r.balance} />
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Net Balance */}
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    <BalanceChip value={r.balance} />
                  </td>

                  {/* Earned / Deducted */}
                  <td className="px-3 py-2 whitespace-nowrap hidden sm:table-cell">
                    <span className="font-mono font-bold text-emerald-700">+{r.earned}</span>
                    <span className="text-slate-300 mx-1">/</span>
                    <span className="font-mono font-bold text-rose-700">{r.deducted > 0 ? `-${r.deducted}` : '0'}</span>
                  </td>

                  {/* Substitutions */}
                  <td className="px-3 py-2 text-center whitespace-nowrap hidden md:table-cell">
                    <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                      {r.substitutions}
                    </span>
                  </td>

                  {/* Last Activity */}
                  <td className="px-3 py-2 text-slate-500 text-[11px] whitespace-nowrap hidden lg:table-cell">
                    {r.lastActivity ? formatRelativeTime(r.lastActivity) : '—'}
                  </td>

                  {/* Quick Actions */}
                  <td className="px-3 py-2 text-right pr-4 whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onViewHistory(r)}
                        className="text-[11px] font-bold text-primary-700 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 px-2 py-0.5 rounded transition border border-primary-200 shadow-2xs cursor-pointer"
                      >
                        Review
                      </button>
                      {onAdjust && (
                        <button
                          type="button"
                          onClick={() => onAdjust(r)}
                          className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 px-1.5 py-0.5 rounded transition border border-slate-200 shadow-2xs cursor-pointer"
                        >
                          Adjust
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
