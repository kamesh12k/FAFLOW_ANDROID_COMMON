import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { leavesApi } from '../../api/services'
import { Spinner, StatusBadge, EmptyState, Modal } from '../../components/ui'
import { PlusIcon, SearchIcon, FilterIcon, XCircleIcon, AlertTriangleIcon } from '../../components/icons'

const PERIOD_TIMES = {
  1: '8:00–9:00',
  2: '9:00–10:00',
  3: '10:15–11:15',
  4: '11:15–12:15',
  5: '1:00–2:00',
}

function formatDate(isoStr) {
  if (!isoStr) return '—'
  try {
    const [y, m, d] = isoStr.split('-')
    if (!y || !m || !d) return isoStr
    const dt = new Date(Number(y), Number(m) - 1, Number(d))
    return dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return isoStr
  }
}

export default function LeaveHistory() {
  const [leaves, setLeaves] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [viewDetailTarget, setViewDetailTarget] = useState(null)
  const [disabledReasonModal, setDisabledReasonModal] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)
  const [error, setError] = useState('')

  // Filters & search
  const [statusFilter, setStatusFilter] = useState('all')
  const [dayOrderFilter, setDayOrderFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)

  const load = () => {
    setLoading(true)
    return leavesApi.myLeaves()
      .then(r => setLeaves(r.data))
      .catch(() => setError('Failed to load leave history.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCancel = async () => {
    if (!cancelTarget) return
    setActionLoading(cancelTarget.id)
    setError('')
    try {
      await leavesApi.cancel(cancelTarget.id)
      setCancelTarget(null)
      if (viewDetailTarget?.id === cancelTarget.id) setViewDetailTarget(null)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to cancel leave.')
    } finally {
      setActionLoading(null)
    }
  }

  const getCancelability = (leave) => {
    if (!leave) return { allowed: false }
    if (leave.status === 'cancelled' || leave.status === 'rejected') {
      return { allowed: false }
    }
    const now = new Date()
    const leaveDate = new Date(leave.date + 'T00:00:00')
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    if (leaveDate < today) {
      return { allowed: false, reason: 'Past leaves cannot be cancelled.' }
    }
    if (leaveDate.getTime() === today.getTime()) {
      if (now.getHours() >= 10) {
        return {
          allowed: false,
          reason: 'Same-day leave cancellation is only available before 10:00 AM.',
        }
      }
    }
    return { allowed: true }
  }

  const counts = useMemo(() => {
    const total = leaves.length
    const approved = leaves.filter(l => l.status === 'approved').length
    const pending = leaves.filter(l => l.status === 'pending').length
    const rejected = leaves.filter(l => l.status === 'rejected').length
    const cancelled = leaves.filter(l => l.status === 'cancelled').length

    // Unique days count
    const totalDays = new Set(leaves.map(l => l.date)).size
    const approvedDays = new Set(leaves.filter(l => l.status === 'approved').map(l => l.date)).size
    const pendingDays = new Set(leaves.filter(l => l.status === 'pending').map(l => l.date)).size
    const rejectedDays = new Set(leaves.filter(l => l.status === 'rejected').map(l => l.date)).size
    const cancelledDays = new Set(leaves.filter(l => l.status === 'cancelled').map(l => l.date)).size

    return {
      total,
      approved,
      pending,
      rejected,
      cancelled,
      totalDays,
      approvedDays,
      pendingDays,
      rejectedDays,
      cancelledDays,
    }
  }, [leaves])

  const filteredLeaves = useMemo(() => {
    return leaves.filter(l => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false
      if (dayOrderFilter !== 'all' && String(l.day_order) !== dayOrderFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return (
          l.reason?.toLowerCase().includes(q) ||
          l.date?.includes(q) ||
          l.status?.toLowerCase().includes(q) ||
          l.alter_assignment?.substitute?.name?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [leaves, statusFilter, dayOrderFilter, searchQuery])

  const sortedFilteredLeaves = useMemo(() => {
    const list = [...filteredLeaves]
    list.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return a.period_number - b.period_number
    })
    return list
  }, [filteredLeaves])

  const groupedLeavesByDate = useMemo(() => {
    const map = new Map()
    for (const leave of filteredLeaves) {
      const createdDate = leave.created_at ? leave.created_at.split('T')[0] : ''
      const key = `${leave.date}__${createdDate}__${leave.status}__${leave.reason || ''}`
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          date: leave.date,
          day_order: leave.day_order,
          created_at: leave.created_at,
          status: leave.status,
          reason: leave.reason,
          is_emergency: leave.is_emergency,
          leaves: [],
        })
      }
      const group = map.get(key)
      group.leaves.push(leave)
      if (leave.is_emergency) group.is_emergency = true
    }
    const list = Array.from(map.values()).map(group => {
      group.leaves.sort((a, b) => a.period_number - b.period_number)
      return group
    })
    list.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return new Date(b.created_at || 0) - new Date(a.created_at || 0)
    })
    return list
  }, [filteredLeaves])

  const activeFiltersCount = (statusFilter !== 'all' ? 1 : 0) + (dayOrderFilter !== 'all' ? 1 : 0)

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* ── Top Bar / Primary Action ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Leave Management</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Track leave approval status, review timetable coverages, and manage cancellations.
          </p>
        </div>

        <Link
          to="/teacher/leave/apply"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-xs shrink-0 min-h-[42px]"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Apply for Leave</span>
        </Link>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs sm:text-sm text-rose-700 font-semibold flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 text-xs font-bold ml-2">✕</button>
        </div>
      )}

      {/* ── Status Summary Counter Bar (Enterprise Tabs) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {[
          { key: 'all', label: 'All Requests', count: counts.total, daysCount: counts.totalDays, color: 'text-slate-900', border: 'hover:border-slate-300' },
          { key: 'pending', label: 'Pending', count: counts.pending, daysCount: counts.pendingDays, color: 'text-amber-700', border: 'hover:border-amber-300' },
          { key: 'approved', label: 'Approved', count: counts.approved, daysCount: counts.approvedDays, color: 'text-emerald-700', border: 'hover:border-emerald-300' },
          { key: 'rejected', label: 'Rejected', count: counts.rejected, daysCount: counts.rejectedDays, color: 'text-rose-700', border: 'hover:border-rose-300' },
          { key: 'cancelled', label: 'Cancelled', count: counts.cancelled, daysCount: counts.cancelledDays, color: 'text-slate-600', border: 'hover:border-slate-300' },
        ].map(item => {
          const isActive = statusFilter === item.key
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setStatusFilter(item.key)}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                isActive
                  ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                  : `bg-white border-slate-200 text-slate-700 ${item.border}`
              }`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                {item.label}
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                {/* On mobile: display days count exclusively */}
                <span className={`text-xl font-bold block sm:hidden ${isActive ? 'text-white' : item.color}`}>
                  {item.daysCount} <span className="text-[11px] font-semibold opacity-80">{item.daysCount === 1 ? 'day' : 'days'}</span>
                </span>
                {/* On desktop: display total count and days */}
                <span className={`text-xl font-bold hidden sm:block ${isActive ? 'text-white' : item.color}`}>
                  {item.count}
                </span>
                <span className={`text-[10px] hidden sm:inline font-semibold ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                  ({item.daysCount}d)
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Search & Filter Controls Strip ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by reason, date, or substitute teacher…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Day Order Filter */}
          <select
            value={dayOrderFilter}
            onChange={e => setDayOrderFilter(e.target.value)}
            className="hidden sm:block px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary-600"
          >
            <option value="all">All Day Orders</option>
            {[1, 2, 3, 4, 5, 6].map(d => (
              <option key={d} value={String(d)}>Day Order {d}</option>
            ))}
          </select>

          {/* Reset button if active */}
          {(statusFilter !== 'all' || dayOrderFilter !== 'all' || searchQuery) && (
            <button
              type="button"
              onClick={() => { setStatusFilter('all'); setDayOrderFilter('all'); setSearchQuery('') }}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2 py-1 transition"
            >
              Reset
            </button>
          )}

          {/* Mobile Filter Trigger */}
          <button
            type="button"
            onClick={() => setShowFilterDrawer(true)}
            className="sm:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <FilterIcon className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-primary-600 text-white text-[10px] flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Main Data View (Zero-Scroll Linear Table Card - Grouped by Day) ── */}
      <div className="card overflow-hidden bg-white border border-slate-200 shadow-xs rounded-xl">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : groupedLeavesByDate.length === 0 ? (
          <div className="py-12">
            <EmptyState message={leaves.length === 0 ? 'No leave requests yet.' : 'No leaves match the selected filters.'} />
          </div>
        ) : (
          <>
            {/* Desktop Full-Width No-Scroll Table */}
            <div className="hidden md:block w-full">
              <table className="w-full text-sm text-left border-collapse table-auto">
                <thead className="bg-gray-50/90 border-b border-gray-100 select-none text-gray-500">
                  <tr>
                    <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider">Date & Applied</th>
                    <th className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wider">Periods</th>
                    <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider">Reason</th>
                    <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider">Substitute Coverage</th>
                    <th className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {groupedLeavesByDate.map(dayGroup => {
                    const cancellableLeaves = dayGroup.leaves.filter(l => getCancelability(l).allowed)
                    const isTerminal = dayGroup.leaves.every(l => l.status === 'cancelled' || l.status === 'rejected')
                    const coveredLeaves = dayGroup.leaves.filter(l => l.alter_assignment?.substitute)

                    return (
                      <tr key={dayGroup.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 text-sm">{formatDate(dayGroup.date)}</span>
                            <span className="text-[10px] text-slate-500 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
                              DO {dayGroup.day_order}
                            </span>
                          </div>
                          <span className="block text-[11px] text-slate-400 mt-0.5">
                            Applied {new Date(dayGroup.created_at).toLocaleDateString()}
                          </span>
                        </td>

                        <td className="px-3 py-3.5 whitespace-nowrap">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="font-bold text-gray-800 text-xs mr-1">
                              {dayGroup.leaves.length} {dayGroup.leaves.length === 1 ? 'Period' : 'Periods'}
                            </span>
                            {dayGroup.leaves.map(l => (
                              <button
                                key={l.id}
                                type="button"
                                onClick={() => setViewDetailTarget(l)}
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded transition ${
                                  l.alter_assignment?.substitute
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/70 hover:bg-indigo-100'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                                title={`Period ${l.period_number} (${PERIOD_TIMES[l.period_number] || ''})`}
                              >
                                P{l.period_number}
                              </button>
                            ))}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <p className="text-xs sm:text-sm font-medium text-gray-800 line-clamp-2" title={dayGroup.reason}>
                            {dayGroup.reason || '-'}
                          </p>
                          {dayGroup.is_emergency && (
                            <span className="inline-block mt-0.5 text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded">
                              Emergency
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          {coveredLeaves.length > 0 ? (
                            <div className="space-y-0.5">
                              {coveredLeaves.map(l => (
                                <div key={l.id} className="text-xs truncate max-w-[180px]">
                                  <span className="font-bold text-gray-700">P{l.period_number}:</span>{' '}
                                  <span className="font-semibold text-gray-900" title={l.alter_assignment.substitute.name}>
                                    {l.alter_assignment.substitute.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : dayGroup.status === 'approved' ? (
                            <div className="flex items-center gap-1 text-amber-500 font-medium text-xs">
                              <AlertTriangleIcon className="w-3.5 h-3.5 shrink-0" />
                              <span>Needs Coverage</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs italic">No substitute</span>
                          )}
                        </td>

                        <td className="px-3 py-3.5 whitespace-nowrap">
                          <StatusBadge status={dayGroup.status} />
                        </td>

                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewDetailTarget(dayGroup.leaves[0])}
                              className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                            >
                              Details
                            </button>
                            {!isTerminal && (
                              cancellableLeaves.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setCancelTarget(cancellableLeaves[0])}
                                  disabled={actionLoading !== null}
                                  className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-lg transition disabled:opacity-40"
                                >
                                  Cancel
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const firstDisabled = dayGroup.leaves.map(l => getCancelability(l)).find(c => c.reason)
                                    setDisabledReasonModal({ leave: dayGroup.leaves[0], reason: firstDisabled?.reason || 'Cannot be cancelled.' })
                                  }}
                                  className="px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-slate-600 rounded transition"
                                  title="Cancellation Info"
                                >
                                  Info
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Full-Width Linear Cards (No horizontal scroll) */}
            <div className="block md:hidden divide-y divide-gray-100">
              {groupedLeavesByDate.map(dayGroup => {
                const cancellableLeaves = dayGroup.leaves.filter(l => getCancelability(l).allowed)
                const isTerminal = dayGroup.leaves.every(l => l.status === 'cancelled' || l.status === 'rejected')
                const coveredLeaves = dayGroup.leaves.filter(l => l.alter_assignment?.substitute)

                return (
                  <div key={dayGroup.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 text-sm">{formatDate(dayGroup.date)}</span>
                          <span className="text-[10px] text-slate-500 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
                            DO {dayGroup.day_order}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          Applied {new Date(dayGroup.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <StatusBadge status={dayGroup.status} />
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-gray-800 text-xs mr-1">
                        {dayGroup.leaves.length} {dayGroup.leaves.length === 1 ? 'Period' : 'Periods'}:
                      </span>
                      {dayGroup.leaves.map(l => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => setViewDetailTarget(l)}
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded transition ${
                            l.alter_assignment?.substitute
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/70'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          P{l.period_number}
                        </button>
                      ))}
                    </div>

                    {dayGroup.reason && (
                      <p className="text-xs text-gray-700 font-medium">
                        <span className="text-gray-400 font-bold uppercase text-[9px] mr-1">Reason:</span>
                        {dayGroup.reason}
                      </p>
                    )}

                    {coveredLeaves.length > 0 && (
                      <div className="p-2 bg-indigo-50/70 border border-indigo-100 rounded-lg text-xs space-y-0.5">
                        <span className="text-[9px] font-bold text-indigo-800 uppercase tracking-wider block">Assigned Substitute</span>
                        {coveredLeaves.map(l => (
                          <div key={l.id} className="text-xs text-indigo-950 font-medium">
                            <span>Period {l.period_number}: <strong>{l.alter_assignment.substitute.name}</strong></span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setViewDetailTarget(dayGroup.leaves[0])}
                        className="px-3 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                      >
                        Details
                      </button>
                      {!isTerminal && (
                        cancellableLeaves.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setCancelTarget(cancellableLeaves[0])}
                            disabled={actionLoading !== null}
                            className="px-3 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-lg transition disabled:opacity-40"
                          >
                            Cancel
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const firstDisabled = dayGroup.leaves.map(l => getCancelability(l)).find(c => c.reason)
                              setDisabledReasonModal({ leave: dayGroup.leaves[0], reason: firstDisabled?.reason || 'Cannot be cancelled.' })
                            }}
                            className="px-2.5 py-1 text-[11px] font-medium text-slate-400 hover:text-slate-600 rounded transition"
                            title="Cancellation Info"
                          >
                            Info
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Mobile Filter Modal ── */}
      <Modal open={showFilterDrawer} onClose={() => setShowFilterDrawer(false)} title="Filter Leaves">
        <div className="space-y-4 text-slate-800">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wider">Leave Status</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'all', label: 'All Statuses' },
                { id: 'pending', label: 'Pending' },
                { id: 'approved', label: 'Approved' },
                { id: 'rejected', label: 'Rejected' },
                { id: 'cancelled', label: 'Cancelled' },
              ].map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStatusFilter(s.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition text-left ${
                    statusFilter === s.id
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wider">Day Order</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDayOrderFilter('all')}
                className={`px-3 py-2 rounded-xl text-xs font-bold border ${
                  dayOrderFilter === 'all' ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                All Days
              </button>
              {[1, 2, 3, 4, 5, 6].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDayOrderFilter(String(d))}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border ${
                    dayOrderFilter === String(d) ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  Day Order {d}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => { setStatusFilter('all'); setDayOrderFilter('all'); setSearchQuery('') }}
              className="text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              Reset Filters
            </button>
            <button
              type="button"
              onClick={() => setShowFilterDrawer(false)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>

      {/* ── View Details Modal ── */}
      <Modal open={!!viewDetailTarget} onClose={() => setViewDetailTarget(null)} title="Leave Request Details">
        {viewDetailTarget && (() => {
          const sameDayLeaves = leaves.filter(l => l.date === viewDetailTarget.date).sort((a, b) => a.period_number - b.period_number)
          return (
            <div className="space-y-4 text-slate-800">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <p className="text-base font-bold text-slate-900">{formatDate(viewDetailTarget.date)}</p>
                  <p className="text-xs text-slate-500">Day Order {viewDetailTarget.day_order} &middot; Period {viewDetailTarget.period_number} ({PERIOD_TIMES[viewDetailTarget.period_number]})</p>
                </div>
                <StatusBadge status={viewDetailTarget.status} />
              </div>

              {sameDayLeaves.length > 1 && (
                <div className="flex items-center gap-1.5 pb-1 overflow-x-auto">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Switch Period:</span>
                  {sameDayLeaves.map(l => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setViewDetailTarget(l)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                        viewDetailTarget.id === l.id
                          ? 'bg-slate-900 border-slate-900 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Period {l.period_number}
                    </button>
                  ))}
                </div>
              )}
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Reason for Leave</span>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 leading-relaxed">
                {viewDetailTarget.reason}
              </div>
            </div>
            {viewDetailTarget.alter_assignment && (
              <div className="p-3 bg-indigo-50/80 border border-indigo-100 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider block">Assigned Substitute</span>
                <p className="text-xs font-bold text-indigo-950">
                  {viewDetailTarget.alter_assignment.substitute?.name || 'Substitute Teacher'}
                </p>
                {viewDetailTarget.alter_assignment.substitute?.department && (
                  <p className="text-[11px] text-indigo-700">
                    Department of {viewDetailTarget.alter_assignment.substitute.department}
                  </p>
                )}
              </div>
            )}
            <div className="text-xs text-slate-500 space-y-1">
              <p>Submitted: <strong className="text-slate-700">{new Date(viewDetailTarget.created_at).toLocaleString()}</strong></p>
              {viewDetailTarget.is_emergency && <p className="text-rose-600 font-bold">⚠️ Submitted as emergency leave</p>}
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewDetailTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                Close
              </button>
              {getCancelability(viewDetailTarget).allowed && (
                <button
                  type="button"
                  onClick={() => {
                    setCancelTarget(viewDetailTarget)
                    setViewDetailTarget(null)
                  }}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                >
                  Cancel Request
                </button>
              )}
            </div>
          </div>
        )
      })()}
    </Modal>

      {/* ── Cancellation Policy Info Modal ── */}
      <Modal open={!!disabledReasonModal} onClose={() => setDisabledReasonModal(null)} title="Cancellation Policy">
        {disabledReasonModal && (
          <div className="space-y-3 text-slate-700 text-xs">
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 leading-relaxed font-medium">
              {disabledReasonModal.reason}
            </div>
            <p className="text-slate-500">
              For emergency adjustments, please contact your Department Head (HOD) or Academic Administrator directly.
            </p>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setDisabledReasonModal(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold"
              >
                Understood
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Cancel Confirmation Modal ── */}
      <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)} title="Cancel Leave Request">
        {cancelTarget && (
          <div className="space-y-4 text-xs sm:text-sm text-slate-700">
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-1">
              <p className="font-bold text-rose-900">Are you sure you want to cancel this leave?</p>
              <p className="text-rose-700 text-xs font-semibold">
                {formatDate(cancelTarget.date)} &middot; Day Order {cancelTarget.day_order} &middot; Period {cancelTarget.period_number}
              </p>
              <p className="text-rose-600 text-xs italic">"{cancelTarget.reason}"</p>
            </div>
            {cancelTarget.alter_assignment && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-0.5">
                <p className="font-bold">A substitute is currently assigned:</p>
                <p className="font-extrabold text-amber-950">{cancelTarget.alter_assignment.substitute?.name || 'Unknown'}</p>
                <p className="text-amber-700 text-[11px]">This substitute assignment will be released and credit adjustments will be reverted.</p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCancelTarget(null)}
                className="text-xs px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold"
              >
                Keep Leave
              </button>
              <button
                onClick={handleCancel}
                disabled={actionLoading !== null}
                className="text-xs px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 font-bold"
              >
                {actionLoading ? 'Cancelling…' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

