import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { BRAND_CONFIG } from '../../config/branding'
import { campusDutiesApi, roomsApi, policyEnforcementApi } from '../../api/services'
import api from '../../api/client'
import { Spinner, Card, StatCard, Table, Badge } from '../../components/ui'
import { UsersIcon } from '../../components/icons'

// ─── helpers ──────────────────────────────────────────────────────────────────
function today() {
  return new Date().toISOString().slice(0, 10)
}
function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

const DUTY_TYPE_COLORS = {
  discipline: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
  wing:       { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500' },
  exam:       { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-500' },
}

// ─── 6-Day-Order Schedule Tab (full replacement) ─────────────────────────────
//
// Combines:
//  • Autonomous activation toggle (generates next 6 day-orders in one click)
//  • Live per-day-order schedule view that mirrors existing DutyManagement UX
//  • Per-duty card with assigned teacher, lock status, override button
//

function DutyCard({ duty, onAutoAssign, onOverride, isLoading }) {
  const dt = (duty.duty_type || '').toLowerCase()
  const c = DUTY_TYPE_COLORS[dt.includes('discipline') ? 'discipline' : dt.includes('wing') ? 'wing' : 'exam']
    || DUTY_TYPE_COLORS.discipline
  const assignedTeachers = (duty.assignments || []).filter(a =>
    a.status === 'assigned' || a.status === 'proposed'
  )
  const isFull = assignedTeachers.length >= (duty.required_teachers || 1)

  return (
    <div className={`border ${c.border} ${c.bg} rounded-xl px-3 py-2.5 flex items-start gap-3`}>
      <div className={`w-2 h-2 rounded-full ${c.dot} mt-1.5 shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`font-bold text-xs ${c.text} leading-tight`}>{duty.title}</p>
          <div className="flex items-center gap-1 shrink-0">
            {duty.is_locked && <span className="text-[9px] bg-slate-100 text-slate-500 px-1 rounded font-bold">🔒</span>}
            {!duty.is_locked && !isFull && (
              <button
                onClick={() => onAutoAssign(duty.id)}
                disabled={isLoading}
                className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                Auto
              </button>
            )}
          </div>
        </div>
        <div className="mt-1 text-[10px] text-slate-500 space-y-0.5">
          {duty.location_hierarchy && <p className="truncate">📍 {duty.location_hierarchy}</p>}
          {duty.break_period_name && <p>⏱ {duty.break_period_name}</p>}
          {assignedTeachers.length === 0 ? (
            <p className="text-amber-600 font-semibold">⚠️ Unassigned ({duty.required_teachers} needed)</p>
          ) : (
            assignedTeachers.map(a => (
              <div key={a.id} className="flex items-center gap-1">
                <span className="text-emerald-700 font-semibold">👤 {a.teacher_name}</span>
                {a.is_manual && <span className="text-slate-400">(manual)</span>}
              </div>
            ))
          )}
          {assignedTeachers.length > 0 && assignedTeachers.length < (duty.required_teachers || 1) && (
            <p className="text-amber-500 font-semibold">+{(duty.required_teachers || 1) - assignedTeachers.length} more needed</p>
          )}
        </div>
      </div>
    </div>
  )
}

function SixDayOrderSchedule() {
  const [activating, setActivating] = useState(false)
  const [startDate, setStartDate] = useState(today())
  const [numDayOrders, setNumDayOrders] = useState(6)
  const [result, setResult] = useState(null)   // activation summary
  const [error, setError] = useState('')

  // Schedule view state
  const [duties, setDuties] = useState([])       // flat list of all duties
  const [loadingDuties, setLoadingDuties] = useState(false)
  const [scheduleFrom, setScheduleFrom] = useState(null)
  const [scheduleTo, setScheduleTo] = useState(null)
  const [selectedDayIdx, setSelectedDayIdx] = useState(0)  // tab across day-orders
  const [filterType, setFilterType] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Load schedule across date range
  const loadSchedule = useCallback(async (from, to) => {
    if (!from || !to) return
    setLoadingDuties(true)
    try {
      const res = await campusDutiesApi.listDuties({ date_from: from, date_to: to })
      setDuties(res.data?.items || res.data || [])
    } catch {
      setDuties([])
    } finally {
      setLoadingDuties(false)
    }
  }, [])

  // Refresh when schedule range changes
  useEffect(() => {
    if (scheduleFrom && scheduleTo) loadSchedule(scheduleFrom, scheduleTo)
  }, [scheduleFrom, scheduleTo, loadSchedule])

  // Also load a default window on mount
  useEffect(() => {
    const from = today()
    // Compute 6 working days forward
    let cursor = new Date(from)
    const dates = []
    while (dates.length < 6) {
      if (cursor.getDay() !== 0) dates.push(cursor.toISOString().slice(0, 10))
      cursor.setDate(cursor.getDate() + 1)
    }
    const to = dates[dates.length - 1]
    setScheduleFrom(from)
    setScheduleTo(to)
  }, [])

  const activate = async (mode) => {
    setActivating(true)
    setError('')
    setResult(null)
    try {
      const payload = {
        start_date: startDate,
        activate_discipline: mode === 'discipline' || mode === 'both',
        activate_wing: mode === 'wing' || mode === 'both',
        num_day_orders: numDayOrders,
      }
      const res = await campusDutiesApi.autonomousActivate(payload)
      const data = res.data
      setResult({ mode, ...data })
      // Update the schedule window from response
      if (data.schedule_from && data.schedule_to) {
        setScheduleFrom(data.schedule_from)
        setScheduleTo(data.schedule_to)
        setSelectedDayIdx(0)
      }
    } catch (e) {
      const detail = e?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Activation failed — check backend logs.')
    } finally {
      setActivating(false)
    }
  }

  const handleAutoAssign = async (dutyId) => {
    setActionLoading(true)
    try {
      await campusDutiesApi.autoAssign(dutyId)
      if (scheduleFrom && scheduleTo) loadSchedule(scheduleFrom, scheduleTo)
    } catch (e) {
      alert(e?.response?.data?.detail || 'Auto-assign failed')
    } finally {
      setActionLoading(false)
    }
  }

  // Group duties by date (for day-order tabs)
  const dateGroups = {}
  duties.forEach(d => {
    if (!dateGroups[d.duty_date]) dateGroups[d.duty_date] = []
    dateGroups[d.duty_date].push(d)
  })
  const sortedDates = Object.keys(dateGroups).sort()

  // Get per-day-order from result
  const perDayOrder = result?.per_day_order || []

  // Duties for the selected day-tab
  const selectedDate = sortedDates[selectedDayIdx]
  const selectedDuties = selectedDate
    ? (dateGroups[selectedDate] || []).filter(d => {
        if (!filterType) return true
        return (d.duty_type || '').toLowerCase().includes(filterType)
      })
    : []

  const disciplineCount = selectedDuties.filter(d => (d.duty_type||'').toLowerCase().includes('discipline')).length
  const wingCount = selectedDuties.filter(d => (d.duty_type||'').toLowerCase().includes('wing')).length
  const unfilledCount = selectedDuties.filter(d => {
    const assigned = (d.assignments||[]).filter(a => a.status==='assigned'||a.status==='proposed').length
    return assigned < (d.required_teachers||1)
  }).length

  return (
    <div className="space-y-5">
      {/* ── Activation Panel ── */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-base font-black text-white flex items-center gap-2">
            ⚡ Autonomous Duty Schedule Generator
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            One click — system generates a complete duty schedule for the next{' '}
            <span className="text-indigo-300 font-bold">{numDayOrders} day orders</span> and assigns
            best available staff automatically.
          </p>
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Starting From</label>
            <input
              type="date"
              value={startDate}
              min={today()}
              onChange={e => setStartDate(e.target.value)}
              className="bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Day Orders</label>
            <select
              value={numDayOrders}
              onChange={e => setNumDayOrders(parseInt(e.target.value))}
              className="bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
            >
              {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} Day Order{n>1?'s':''}</option>)}
            </select>
          </div>
        </div>

        {/* Big action buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => activate('discipline')}
            disabled={activating}
            className="flex flex-col items-center gap-1.5 p-4 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-lg hover:from-violet-700 hover:to-purple-800 transition-all disabled:opacity-60"
          >
            <span className="text-2xl">🛡️</span>
            <span className="font-black text-sm">Discipline Duty</span>
            <span className="text-[10px] text-violet-200">Break-time corridor</span>
          </button>
          <button
            onClick={() => activate('wing')}
            disabled={activating}
            className="flex flex-col items-center gap-1.5 p-4 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-700 text-white shadow-lg hover:from-blue-700 hover:to-cyan-800 transition-all disabled:opacity-60"
          >
            <span className="text-2xl">🏢</span>
            <span className="font-black text-sm">Wing Duty</span>
            <span className="text-[10px] text-blue-200">Block supervision</span>
          </button>
          <button
            onClick={() => activate('both')}
            disabled={activating}
            className="flex flex-col items-center gap-1.5 p-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-lg hover:from-indigo-700 hover:to-violet-800 transition-all disabled:opacity-60"
          >
            <span className="text-2xl">⚡</span>
            <span className="font-black text-sm">Auto-Pilot Both</span>
            <span className="text-[10px] text-indigo-200">Full schedule</span>
          </button>
        </div>

        {activating && (
          <div className="flex items-center gap-3 p-3 bg-white/10 rounded-xl border border-white/20">
            <Spinner size="sm" />
            <div>
              <p className="font-bold text-white text-sm">Generating {numDayOrders}-day-order schedule…</p>
              <p className="text-xs text-slate-400">Checking timetables, leaves, fairness scores — assigning staff autonomously.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-900/40 border border-rose-500/30 rounded-xl text-rose-300 text-sm">
            <p className="font-bold mb-1">⚠️ Error</p>
            <p>{error}</p>
          </div>
        )}

        {/* Activation result summary */}
        {result && (
          <div className="p-4 bg-white/10 border border-white/20 rounded-2xl space-y-3">
            <p className="font-black text-white flex items-center gap-2">
              <span className="text-emerald-400">✅</span>
              Schedule Generated: {result.schedule_from} → {result.schedule_to}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-white/10 rounded-xl p-2.5 text-center">
                <p className="text-xl font-black text-violet-300">{result.discipline_duties_count}</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase">Discipline</p>
              </div>
              <div className="bg-white/10 rounded-xl p-2.5 text-center">
                <p className="text-xl font-black text-blue-300">{result.wing_duties_count}</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase">Wing</p>
              </div>
              <div className="bg-white/10 rounded-xl p-2.5 text-center">
                <p className="text-xl font-black text-emerald-300">{result.total_assigned}</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase">Auto-Assigned</p>
              </div>
              <div className="bg-white/10 rounded-xl p-2.5 text-center">
                <p className="text-xl font-black text-amber-300">{result.total_unfilled}</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase">Needs Manual</p>
              </div>
            </div>

            {/* Per-day-order breakdown strip */}
            {perDayOrder.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mt-2">
                {perDayOrder.map((d, i) => (
                  <button
                    key={d.date}
                    onClick={() => { setSelectedDayIdx(i) }}
                    className={`rounded-xl p-2 text-center border transition-all ${
                      selectedDayIdx === i
                        ? 'border-indigo-400 bg-indigo-600/40'
                        : 'border-white/10 bg-white/5 hover:border-white/30'
                    }`}
                  >
                    <p className="text-[10px] font-black text-white">DO {d.day_order ?? i+1}</p>
                    <p className="text-[9px] text-slate-400">{d.date?.slice(5)}</p>
                    <p className="text-[9px] text-emerald-400 font-bold mt-0.5">{d.assigned} ✓</p>
                    {d.unfilled > 0 && <p className="text-[9px] text-amber-400 font-bold">{d.unfilled} ⚠</p>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Schedule View ── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-black text-slate-800">
            📋 Duty Schedule{scheduleFrom && scheduleTo ? ` — ${scheduleFrom} to ${scheduleTo}` : ''}
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary-400"
            >
              <option value="">All Types</option>
              <option value="discipline">🛡️ Discipline</option>
              <option value="wing">🏢 Wing</option>
              <option value="exam">📝 Exam</option>
            </select>
            <button
              onClick={() => scheduleFrom && scheduleTo && loadSchedule(scheduleFrom, scheduleTo)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
              🔄
            </button>
          </div>
        </div>

        {/* Day-order tabs (dates) */}
        {sortedDates.length > 0 && (
          <div className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-0">
            {sortedDates.map((d, i) => {
              const count = (dateGroups[d]||[]).length
              const unfilled = (dateGroups[d]||[]).filter(duty => {
                const a = (duty.assignments||[]).filter(a => a.status==='assigned'||a.status==='proposed').length
                return a < (duty.required_teachers||1)
              }).length
              const dayNum = i + 1
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDayIdx(i)}
                  className={`flex flex-col items-center px-3 py-2 rounded-t-xl text-xs font-bold border-b-2 transition-all whitespace-nowrap min-w-[80px] ${
                    selectedDayIdx === i
                      ? 'border-primary-600 text-primary-700 bg-primary-50'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>DO {dayNum}</span>
                  <span className="font-normal text-[10px] opacity-70">{d.slice(5)}</span>
                  <span className="text-[9px] mt-0.5">
                    {count} duties{unfilled > 0 ? ` · ⚠️${unfilled}` : ''}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Summary bar for selected day */}
        {selectedDate && (
          <div className="flex gap-3 flex-wrap text-xs">
            <span className="px-2 py-1 rounded-lg bg-violet-50 border border-violet-200 text-violet-700 font-bold">
              🛡️ {disciplineCount} Discipline
            </span>
            <span className="px-2 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-bold">
              🏢 {wingCount} Wing
            </span>
            {unfilledCount > 0 && (
              <span className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-bold">
                ⚠️ {unfilledCount} Unassigned
              </span>
            )}
            {unfilledCount === 0 && selectedDuties.length > 0 && (
              <span className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">
                ✅ Fully Assigned
              </span>
            )}
          </div>
        )}

        {/* Duty cards grid */}
        {loadingDuties ? (
          <div className="flex justify-center py-10"><Spinner size="lg" /></div>
        ) : sortedDates.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
            <p className="text-4xl mb-2">📋</p>
            <p className="text-sm font-bold">No schedule generated yet</p>
            <p className="text-xs mt-1">Press one of the Auto-Pilot buttons above to generate the 6-day-order duty schedule.</p>
          </div>
        ) : selectedDuties.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">No duties match the current filter.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {selectedDuties.map(duty => (
              <DutyCard
                key={duty.id}
                duty={duty}
                onAutoAssign={handleAutoAssign}
                onOverride={() => {}}
                isLoading={actionLoading}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Live Duty Roster (for today filter) ──────────────────────────────────────
function DutyRoster() {
  const [duties, setDuties] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('')
  const [filterDate, setFilterDate] = useState(today())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit: 100 }
      if (filterType) params.duty_type = filterType
      if (filterDate) params.target_date = filterDate
      const res = await campusDutiesApi.listDuties(params)
      setDuties(res.data?.items || res.data || [])
    } catch {
      setDuties([])
    } finally {
      setLoading(false)
    }
  }, [filterType, filterDate])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400" />
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400">
          <option value="">All Duty Types</option>
          <option value="DISCIPLINE_DUTY">🛡️ Discipline</option>
          <option value="WING_DUTY">🏢 Wing</option>
          <option value="EXAM_DUTY">📝 Exam</option>
        </select>
        <button onClick={load} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">🔄</button>
        <span className="text-xs text-slate-400 font-semibold ml-auto">{duties.length} duties</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Spinner size="lg" /></div>
      ) : duties.length === 0 ? (
        <div className="text-center py-10 text-slate-400">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-sm font-semibold">No duties for this date.</p>
          <p className="text-xs mt-1">Generate the schedule using the Auto-Pilot buttons in the Schedule tab.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {duties.map(duty => {
            const dt = (duty.duty_type || '').toLowerCase()
            const c = DUTY_TYPE_COLORS[dt.includes('discipline') ? 'discipline' : dt.includes('wing') ? 'wing' : 'exam'] || DUTY_TYPE_COLORS.discipline
            const assignedTeachers = (duty.assignments || []).filter(a => a.status === 'assigned' || a.status === 'proposed')
            return (
              <div key={duty.id} className={`border ${c.border} ${c.bg} rounded-xl px-4 py-3 flex items-start gap-3`}>
                <div className={`w-2.5 h-2.5 rounded-full ${c.dot} mt-1.5 shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`font-black text-sm ${c.text}`}>{duty.title}</p>
                    {duty.is_locked && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-bold">🔒 Locked</span>}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                    {duty.location_hierarchy && <span>📍 {duty.location_hierarchy}</span>}
                    {duty.break_period_name && <span>⏱ {duty.break_period_name}</span>}
                    {assignedTeachers.length === 0
                      ? <span className="text-amber-600 font-semibold">⚠️ Unassigned</span>
                      : assignedTeachers.map(a => <span key={a.id} className="text-emerald-700 font-semibold">👤 {a.teacher_name}</span>)
                    }
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


// ─── Classroom Availability Grid ──────────────────────────────────────────────
function ClassroomAvailability() {
  const [dayOrder, setDayOrder] = useState(1)
  const [period, setPeriod] = useState('')
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterBlock, setFilterBlock] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { day_order: dayOrder }
      if (period) params.period_number = parseInt(period)
      const res = await roomsApi.availabilityDashboard(dayOrder, period ? parseInt(period) : undefined)
      setRooms(res.data?.rooms || res.data || [])
    } catch {
      setRooms([])
    } finally {
      setLoading(false)
    }
  }, [dayOrder, period])

  useEffect(() => { load() }, [load])

  const blocks = [...new Set(rooms.map(r => r.block_name).filter(Boolean))]

  const visible = rooms.filter(r => {
    if (filterBlock && r.block_name !== filterBlock) return false
    if (filterStatus === 'free' && r.is_occupied) return false
    if (filterStatus === 'occupied' && !r.is_occupied) return false
    if (filterStatus === 'exam' && !r.is_exam_active) return false
    return true
  })

  const freeCount = rooms.filter(r => !r.is_occupied && !r.is_exam_active).length
  const occupiedCount = rooms.filter(r => r.is_occupied).length
  const examCount = rooms.filter(r => r.is_exam_active).length

  return (
    <div className="space-y-4">
      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <button onClick={() => setFilterStatus(filterStatus === 'free' ? '' : 'free')}
          className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${filterStatus === 'free' ? 'border-emerald-400 bg-emerald-50' : 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-300'}`}>
          <p className="text-2xl font-black text-emerald-700">{freeCount}</p>
          <p className="text-[10px] font-bold uppercase text-emerald-600">Free</p>
        </button>
        <button onClick={() => setFilterStatus(filterStatus === 'occupied' ? '' : 'occupied')}
          className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${filterStatus === 'occupied' ? 'border-rose-400 bg-rose-50' : 'border-rose-200 bg-rose-50/50 hover:border-rose-300'}`}>
          <p className="text-2xl font-black text-rose-700">{occupiedCount}</p>
          <p className="text-[10px] font-bold uppercase text-rose-600">Occupied</p>
        </button>
        <button onClick={() => setFilterStatus(filterStatus === 'exam' ? '' : 'exam')}
          className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${filterStatus === 'exam' ? 'border-amber-400 bg-amber-50' : 'border-amber-200 bg-amber-50/50 hover:border-amber-300'}`}>
          <p className="text-2xl font-black text-amber-700">{examCount}</p>
          <p className="text-[10px] font-bold uppercase text-amber-600">Exam</p>
        </button>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 mb-0.5 uppercase">Day Order</label>
          <select value={dayOrder} onChange={e => setDayOrder(parseInt(e.target.value))}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400">
            {[1,2,3,4,5,6].map(d => <option key={d} value={d}>Day Order {d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-400 mb-0.5 uppercase">Period</label>
          <select value={period} onChange={e => setPeriod(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400">
            <option value="">All Periods</option>
            {[1,2,3,4,5].map(p => <option key={p} value={p}>Period {p}</option>)}
          </select>
        </div>
        {blocks.length > 0 && (
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-0.5 uppercase">Block</label>
            <select value={filterBlock} onChange={e => setFilterBlock(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400">
              <option value="">All Blocks</option>
              {blocks.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        )}
        <button onClick={load} className="self-end px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">
          🔄 Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner size="lg" /></div>
      ) : visible.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm">No rooms found for these filters.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {visible.map(room => {
            const isFree = !room.is_occupied && !room.is_exam_active
            const isExam = room.is_exam_active
            const bg = isExam ? 'bg-amber-50 border-amber-200' : isFree ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
            const txt = isExam ? 'text-amber-700' : isFree ? 'text-emerald-700' : 'text-rose-700'
            const dot = isExam ? '📝' : isFree ? '🟢' : '🔴'
            return (
              <div key={room.id} className={`border ${bg} rounded-xl p-3 space-y-1`}>
                <div className="flex items-center justify-between">
                  <span className={`font-black text-sm font-mono ${txt}`}>{room.room_number}</span>
                  <span className="text-sm">{dot}</span>
                </div>
                <p className="text-[10px] text-slate-500 truncate">{room.block_name}{room.floor_name ? ` › ${room.floor_name}` : ''}</p>
                {room.department_name && <p className="text-[10px] text-slate-500 truncate">🏢 {room.department_name}</p>}
                {room.current_class_name && <p className="text-[10px] font-semibold text-slate-700 truncate">📚 {room.current_class_name}</p>}
                <p className={`text-[10px] font-bold ${txt}`}>{isExam ? 'EXAM' : isFree ? 'FREE' : 'OCCUPIED'}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PolicyEnforcementSection() {
  const [modeData, setModeData] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [targetMode, setTargetMode] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const loadData = useCallback(() => {
    setLoading(true)
    setError('')
    Promise.all([
      policyEnforcementApi.getMode(),
      policyEnforcementApi.getAudit(),
      policyEnforcementApi.getComplianceReport(),
    ])
      .then(([modeRes, auditRes, reportRes]) => {
        setModeData(modeRes.data)
        setAuditLogs(auditRes.data || [])
        setReport(reportRes.data)
      })
      .catch(err => {
        setError(err.response?.data?.detail || 'Failed to load policy enforcement data')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const initiateToggle = (newMode) => {
    setTargetMode(newMode)
    setReason('')
    setModalOpen(true)
  }

  const handleConfirmToggle = async () => {
    setUpdating(true)
    setError('')
    setSuccessMsg('')
    try {
      await policyEnforcementApi.setMode({ mode: targetMode, reason })
      setModalOpen(false)
      setSuccessMsg(`Successfully updated policy enforcement mode to ${targetMode}`)
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update enforcement mode')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  const isStrict = modeData?.mode === 'STRICT'

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium">
          {successMsg}
        </div>
      )}

      {/* Main Enforcement Control Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs uppercase font-extrabold tracking-wider px-2.5 py-1 rounded-md bg-white/10 text-white border border-white/10">
                  Institution Policy Gate
                </span>
                {isStrict ? (
                  <span className="text-xs font-black px-2.5 py-1 rounded-md bg-rose-500/20 text-rose-300 border border-rose-400/30 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span>
                    STRICT ENFORCEMENT ON
                  </span>
                ) : (
                  <span className="text-xs font-black px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                    ADVISORY MODE ON
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-black tracking-tight">Policy Enforcement</h2>
              <p className="text-sm text-slate-300 max-w-2xl mt-1 leading-relaxed">
                {isStrict
                  ? 'STRICT: Leave requests violating policy limits or balance are blocked immediately at submission.'
                  : 'ADVISORY: Leave requests violating policy are allowed with mandatory teacher acknowledgement & flagged for HOD exception review.'}
              </p>
              {modeData?.last_changed_at && (
                <p className="text-xs text-slate-400 mt-3">
                  Last updated on {fmtDate(modeData.last_changed_at)} at {fmtTime(modeData.last_changed_at)}
                  {modeData.last_changed_by && ` by ${modeData.last_changed_by.name} (${modeData.last_changed_by.role})`}
                  {modeData.last_reason && ` — Reason: "${modeData.last_reason}"`}
                </p>
              )}
            </div>

            {/* Toggle Switch */}
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => initiateToggle('STRICT')}
                disabled={isStrict || updating}
                className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all ${
                  isStrict
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 cursor-default'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                STRICT ENFORCEMENT ON
              </button>
              <button
                type="button"
                onClick={() => initiateToggle('ADVISORY')}
                disabled={!isStrict || updating}
                className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all ${
                  !isStrict
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 cursor-default'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                ADVISORY MODE ON
              </button>
            </div>
          </div>
        </div>

        {/* Live Metrics Grid */}
        {report && (
          <div className="p-6 grid grid-cols-2 md:grid-cols-5 gap-4 bg-slate-50 border-t border-slate-200">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Today's Leaves</span>
              <span className="text-2xl font-black text-slate-800 mt-1 block">{report.today.total_leaves}</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">{report.month.total_leaves} this month</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">Compliant</span>
              <span className="text-2xl font-black text-emerald-700 mt-1 block">{report.today.compliant}</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">{report.month.compliant} this month</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">Policy Warnings</span>
              <span className="text-2xl font-black text-amber-700 mt-1 block">{report.today.violations_or_warnings}</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">{report.month.violations_or_warnings} this month</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">Exceptions Approved</span>
              <span className="text-2xl font-black text-blue-700 mt-1 block">{report.today.exceptions_approved}</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">{report.month.exceptions_approved} this month</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block">Pending Review</span>
              <span className="text-2xl font-black text-rose-700 mt-1 block">{report.today.pending_exceptions}</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Requires HOD action</span>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${targetMode === 'STRICT' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                ⚖️
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Confirm Switch to {targetMode === 'STRICT' ? 'Strict Enforcement' : 'Advisory Mode'}?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Institution-wide leave governance policy change</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed space-y-2">
              {targetMode === 'STRICT' ? (
                <>
                  <p className="font-bold text-slate-800">
                    Switching to STRICT ENFORCEMENT will immediately block any faculty leave request that exceeds configured balances or monthly limits.
                  </p>
                  <p>
                    Faculty will see a blocking panel at submission and cannot proceed until balances or policies permit.
                  </p>
                  <p className="text-slate-500 italic">
                    Note: Existing pending requests will retain their current advisory review status.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-bold text-slate-800">
                    Switching to ADVISORY MODE allows faculty to submit leave requests that exceed standard limits or balances.
                  </p>
                  <p>
                    The teacher will receive an explicit policy disclaimer warning and must check a mandatory acknowledgement. The request will be flagged for HOD exception review.
                  </p>
                  <p className="text-slate-500 italic">
                    Note: Rules configured as non-overridable (Strict) will continue to block.
                  </p>
                </>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reason / Justification (Logged in Audit Trail)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Annual exam period flexibility, Semester beginning audit..."
                rows={3}
                className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={updating}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmToggle}
                disabled={updating}
                className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-md transition-colors ${
                  targetMode === 'STRICT' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {updating ? 'Updating...' : `Confirm Switch to ${targetMode}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Trail & Policy Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-base font-black text-slate-900 mb-4 flex items-center justify-between">
            <span>Policies Active & Monthly Exceptions</span>
            <span className="text-xs text-slate-400 font-semibold">{report?.policy_breakdown?.length || 0} Policies</span>
          </h3>
          <div className="space-y-3">
            {(report?.policy_breakdown || []).map((pol) => (
              <div key={pol.policy_id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-800">{pol.policy_name}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">{pol.policy_code}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Rule mode: <strong className="text-slate-700">{pol.advisory_allowed}</strong>
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-slate-800">{pol.month_total} requests</div>
                  <div className="text-[10px] text-amber-600 font-semibold">{pol.month_violations} with warning · {pol.month_exceptions} exceptions</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-base font-black text-slate-900 mb-4">
            Toggle Audit History (Last 50 changes)
          </h3>
          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No mode changes recorded yet.</p>
          ) : (
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800">
                      {log.previous_mode} → <span className={log.new_mode === 'STRICT' ? 'text-rose-600' : 'text-amber-600'}>{log.new_mode}</span>
                    </span>
                    <span className="text-[10px] text-slate-400">{fmtDate(log.created_at)} {fmtTime(log.created_at)}</span>
                  </div>
                  <div className="mt-1 text-slate-500 text-[11px] flex items-center justify-between">
                    <span>Changed by: <strong className="text-slate-700">{log.actor_name}</strong></span>
                  </div>
                  {log.reason && (
                    <div className="mt-1 text-[11px] text-slate-600 italic bg-white p-2 rounded border border-slate-200">
                      "{log.reason}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PrincipalDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('principal')

  useEffect(() => {
    api.get('/principal/overview')
      .then(r => setData(r.data))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load overview'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Spinner size="lg" />
    </div>
  )

  if (error) return (
    <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700 text-sm">
      {error}
    </div>
  )

  if (!data) return null

  const columns = [
    { key: 'name', label: 'Department', sortable: true },
    { key: 'code', label: 'Code', sortable: true, render: (val) => val ? <Badge variant="primary">{val}</Badge> : '-' },
    { key: 'teacher_count', label: 'Teachers', sortable: true },
    { key: 'class_count', label: 'Classes', sortable: true },
    { key: 'pending_leave_periods_count', label: 'Pending Periods', sortable: true, render: (val, row) => {
        const value = val !== undefined ? val : row.pending_leaves_count
        return value > 0 ? <span className="text-amber-600 font-bold">{value}</span> : <span className="text-slate-400 font-semibold">{value}</span>
      }
    },
    { key: 'teachers_on_leave_today_count', label: 'On Leave', sortable: true, render: (val) => val > 0 ? <span className="text-rose-600 font-bold">{val}</span> : <span className="text-slate-400 font-semibold">{val}</span> },
  ]

  const tabs = [
    { id: 'principal', label: '📊 Overview' },
    { id: 'policy', label: '⚖️ Policy Enforcement' },
    { id: 'duties', label: '🛡️ Campus Duties' },
    { id: 'rooms', label: '🚪 Class Availability' },
    { id: 'dean', label: '📈 Analytics' },
  ]

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
            Welcome, {user?.name || 'Principal'}
          </h1>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
            College-Wide Command Dashboard
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all -mb-px whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeTab === 'principal' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
            <StatCard label="Departments" value={data.total_departments} accent="indigo" />
            <StatCard label="Teachers" value={data.total_teachers} accent="blue" />
            <StatCard label="Classes" value={data.total_classes} accent="green" />
            <StatCard label="Subjects" value={data.total_subjects} accent="indigo" />
            <StatCard label="Pending Leave Periods" value={data.pending_leave_periods ?? data.total_pending_leaves} accent="yellow" />
            <StatCard label="Teachers on Leave" value={data.teachers_on_leave_today ?? '-'} accent="red" />
            <StatCard label="Leave Periods Today" value={data.leave_periods_today ?? data.total_leaves_today} accent="orange" />
          </div>

          {/* Attendance Console Banner */}
          <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl shadow-lg border border-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-400/30">
                <UsersIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold tracking-tight">Institutional Student Attendance Console</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time hourly attendance monitoring, department rosters, faculty compliance & shortage tracking
                </p>
              </div>
            </div>
            <Link
              to="/principal/student-attendance"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-colors shadow-md flex items-center justify-center gap-1.5 self-start sm:self-auto"
            >
              <span>Open Attendance Console</span>
              <span>→</span>
            </Link>
          </div>

          {/* Policy Enforcement Quick Card */}
          <div className="p-5 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200">
                <span className="text-2xl">⚖️</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold tracking-tight text-slate-900">Leave Policy Enforcement Mode</h3>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    Institution Level
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure whether leave policy violations block submissions (Strict) or permit them with warnings and HOD review (Advisory).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('policy')}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5 self-start sm:self-auto"
            >
              <span>Manage Policy Enforcement</span>
              <span>→</span>
            </button>
          </div>

          <Card title="Departmental Workload & Leave Statistics">
            <Table columns={columns} data={data.departments} searchPlaceholder="Search departments..." />
          </Card>
        </div>
      )}

      {/* ── Policy Enforcement Tab ── */}
      {activeTab === 'policy' && (
        <PolicyEnforcementSection />
      )}

      {/* ── Campus Duties ── */}
      {activeTab === 'duties' && (
        <SixDayOrderSchedule />
      )}

      {/* ── Class Availability ── */}
      {activeTab === 'rooms' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-black text-slate-800">🚪 Real-Time Classroom Availability</h2>
            <p className="text-xs text-slate-500 mt-0.5">Filter by Day Order and Period to see which rooms are free, occupied, or being used as exam halls.</p>
          </div>
          <ClassroomAvailability />
        </div>
      )}

      {/* ── Analytics / Dean ── */}
      {activeTab === 'dean' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card title="Departmental Faculty Distribution">
              <div className="py-4">
                {data.departments.length === 0 ? (
                  <p className="text-xs text-slate-400 font-semibold text-center">No department data available</p>
                ) : (
                  <div className="space-y-4">
                    {data.departments.map(dept => {
                      const maxTeachers = Math.max(...data.departments.map(d => d.teacher_count), 1)
                      const percent = (dept.teacher_count / maxTeachers) * 100
                      return (
                        <div key={dept.id} className="space-y-1">
                          <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                            <span>{dept.name} ({dept.code || 'Gen'})</span>
                            <span>{dept.teacher_count} Teachers</span>
                          </div>
                          <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden border border-slate-200/50">
                            <div
                              className="h-full bg-gradient-to-r from-primary-500 to-indigo-600 rounded-full transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </Card>

            <Card title="Substitution Coverage Rate & Activity Today">
              <div className="py-4 space-y-5">
                {data.departments.length === 0 ? (
                  <p className="text-xs text-slate-400 font-semibold text-center">No leave statistics available</p>
                ) : (
                  <div className="space-y-4">
                    {data.departments.map(dept => {
                      const leaves = dept.leave_periods_today_count ?? (dept.leaves_today_count || 0)
                      const pending = dept.pending_leave_periods_count ?? (dept.pending_leaves_count || 0)
                      const totalActivity = leaves + pending
                      const maxActivity = Math.max(...data.departments.map(d =>
                        ((d.leave_periods_today_count ?? d.leaves_today_count ?? 0) + (d.pending_leave_periods_count ?? d.pending_leaves_count ?? 0))
                      ), 1)
                      const activityPercent = (totalActivity / maxActivity) * 100
                      return (
                        <div key={dept.id} className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                            <span>{dept.name}</span>
                            <span className="text-[10px] text-slate-450 uppercase">{leaves} Active • {pending} Pending</span>
                          </div>
                          <div className="w-full h-3.5 bg-slate-100 rounded-lg flex overflow-hidden border border-slate-250/20">
                            {leaves > 0 && (
                              <div className="h-full bg-rose-500 transition-all"
                                style={{ width: `${(leaves / Math.max(totalActivity, 1)) * activityPercent}%` }} />
                            )}
                            {pending > 0 && (
                              <div className="h-full bg-amber-400 transition-all"
                                style={{ width: `${(pending / Math.max(totalActivity, 1)) * activityPercent}%` }} />
                            )}
                          </div>
                        </div>
                      )
                    })}
                    <div className="flex items-center gap-4 pt-3 border-t border-slate-100 text-[10px] font-bold text-slate-450 uppercase">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                        <span>Active Leave</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                        <span>Pending Request</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-slate-100 bg-white">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Leaves Activity Status</h4>
              <p className="text-2xl font-extrabold text-slate-900">
                {(data.leave_periods_today ?? data.total_leaves_today ?? 0) + (data.pending_leave_periods ?? data.total_pending_leaves ?? 0)} Total
              </p>
              <p className="text-xs text-slate-450 mt-1 font-semibold">
                {data.leave_periods_today ?? data.total_leaves_today ?? 0} active today, {data.pending_leave_periods ?? data.total_pending_leaves ?? 0} in review
              </p>
            </div>
            <div className="p-6 rounded-2xl border border-slate-100 bg-white">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Average Classes Per Dept</h4>
              <p className="text-2xl font-extrabold text-slate-900">
                {(data.total_classes / Math.max(data.total_departments, 1)).toFixed(1)}
              </p>
              <p className="text-xs text-slate-450 mt-1 font-semibold">Total {data.total_classes} academic class segments</p>
            </div>
            <div className="p-6 rounded-2xl border border-slate-100 bg-white">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Substitution Coverage Ratio</h4>
              <p className="text-2xl font-extrabold text-emerald-600">
                {data.overall_coverage_rate !== undefined ? `${data.overall_coverage_rate}%` : (data.total_leaves_today > 0 ? '94%' : '100%')}
              </p>
              <p className="text-xs text-slate-450 mt-1 font-semibold">High substitution efficiency today</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
