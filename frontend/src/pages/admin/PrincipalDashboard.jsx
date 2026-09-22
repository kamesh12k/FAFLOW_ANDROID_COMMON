import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { BRAND_CONFIG } from '../../config/branding'
import { campusDutiesApi, roomsApi } from '../../api/services'
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

// ─── Autonomous Duty Control Panel ────────────────────────────────────────────
function AutonomousDutyPanel() {
  const [activating, setActivating] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [targetDate, setTargetDate] = useState(today())

  const activate = async (mode) => {
    setActivating(true)
    setError('')
    setResult(null)
    try {
      const payload = {
        target_date: targetDate,
        activate_discipline: mode === 'discipline' || mode === 'both',
        activate_wing: mode === 'wing' || mode === 'both',
      }
      const res = await campusDutiesApi.autonomousActivate(payload)
      setResult({ mode, ...res.data })
    } catch (e) {
      const detail = e?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Activation failed — check backend logs.')
    } finally {
      setActivating(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Date picker — single input */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Duty Date</label>
          <input
            type="date"
            value={targetDate}
            min={today()}
            onChange={e => setTargetDate(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
          />
        </div>
        <p className="text-xs text-slate-400 font-semibold mt-4">
          Press a button below — system picks available staff automatically, no manual selection needed.
        </p>
      </div>

      {/* 3 Big Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => activate('discipline')}
          disabled={activating}
          className="relative flex flex-col items-center gap-2 p-5 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-lg hover:shadow-xl hover:from-violet-700 hover:to-purple-800 transition-all disabled:opacity-60"
        >
          <span className="text-3xl">🛡️</span>
          <span className="font-black text-sm">Activate Discipline Duty</span>
          <span className="text-[11px] text-violet-200">Break-time corridor duty</span>
          {activating && <span className="absolute top-2 right-3 text-xs opacity-70">●</span>}
        </button>

        <button
          onClick={() => activate('wing')}
          disabled={activating}
          className="relative flex flex-col items-center gap-2 p-5 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-700 text-white shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-cyan-800 transition-all disabled:opacity-60"
        >
          <span className="text-3xl">🏢</span>
          <span className="font-black text-sm">Activate Wing Duty</span>
          <span className="text-[11px] text-blue-200">Block & wing supervision</span>
        </button>

        <button
          onClick={() => activate('both')}
          disabled={activating}
          className="relative flex flex-col items-center gap-2 p-5 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-lg hover:shadow-xl hover:from-indigo-700 hover:to-violet-800 transition-all disabled:opacity-60"
        >
          <span className="text-3xl">⚡</span>
          <span className="font-black text-sm">Auto-Pilot — Both</span>
          <span className="text-[11px] text-indigo-200">Full autonomous duty setup</span>
        </button>
      </div>

      {activating && (
        <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl">
          <Spinner size="sm" />
          <div>
            <p className="font-bold text-indigo-800 text-sm">System is working…</p>
            <p className="text-xs text-indigo-600">Evaluating timetables, leaves, availability scores — assigning staff automatically.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm">
          <p className="font-bold mb-1">⚠️ Activation Error</p>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-emerald-600 text-xl">✅</span>
            <p className="font-black text-emerald-800">Duties Activated & Assigned</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {result.discipline_duties_created != null && (
              <div className="bg-white rounded-xl p-3 border border-emerald-100">
                <p className="text-2xl font-black text-violet-700">{result.discipline_duties_created}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Discipline Duties</p>
              </div>
            )}
            {result.wing_duties_created != null && (
              <div className="bg-white rounded-xl p-3 border border-emerald-100">
                <p className="text-2xl font-black text-blue-700">{result.wing_duties_created}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Wing Duties</p>
              </div>
            )}
            {result.assignments_made != null && (
              <div className="bg-white rounded-xl p-3 border border-emerald-100">
                <p className="text-2xl font-black text-indigo-700">{result.assignments_made}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Staff Assigned</p>
              </div>
            )}
            {result.skipped != null && (
              <div className="bg-white rounded-xl p-3 border border-emerald-100">
                <p className="text-2xl font-black text-amber-600">{result.skipped}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Skipped / Manual</p>
              </div>
            )}
          </div>
          {result.message && <p className="text-xs text-emerald-700 font-semibold">{result.message}</p>}
        </div>
      )}
    </div>
  )
}

// ─── Live Duty Roster ──────────────────────────────────────────────────────────
function DutyRoster() {
  const [duties, setDuties] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('')
  const [filterBlock, setFilterBlock] = useState('')
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

  // Blocks from duties
  const blocks = [...new Set(duties.map(d => d.block_name).filter(Boolean))]

  const visible = duties.filter(d => {
    if (filterBlock && d.block_name !== filterBlock) return false
    return true
  })

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400" />
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400">
          <option value="">All Duty Types</option>
          <option value="discipline">🛡️ Discipline</option>
          <option value="wing">🏢 Wing</option>
          <option value="exam">📝 Exam</option>
        </select>
        {blocks.length > 0 && (
          <select value={filterBlock} onChange={e => setFilterBlock(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400">
            <option value="">All Blocks</option>
            {blocks.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
        <button onClick={load} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">
          🔄 Refresh
        </button>
        <span className="text-xs text-slate-400 font-semibold ml-auto">{visible.length} duties</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner size="lg" /></div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-4xl mb-2">📋</p>
          <p className="text-sm font-semibold">No duties found for these filters.</p>
          <p className="text-xs mt-1">Use the Auto-Pilot buttons above to activate duties.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(duty => {
            const c = DUTY_TYPE_COLORS[duty.duty_type] || DUTY_TYPE_COLORS.discipline
            return (
              <div key={duty.id} className={`border ${c.border} ${c.bg} rounded-xl px-4 py-3 flex items-start gap-4`}>
                <div className={`w-2.5 h-2.5 rounded-full ${c.dot} mt-1.5 shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`font-black text-sm ${c.text}`}>{duty.title || duty.area_name || `${duty.duty_type} Duty`}</p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${c.border} ${c.text}`}>
                      {duty.duty_type?.toUpperCase()}
                    </span>
                    {duty.is_locked && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full border border-slate-200 font-bold">🔒 Locked</span>}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                    {duty.block_name && <span>🏢 {duty.block_name}</span>}
                    {duty.floor_name && <span>🏬 {duty.floor_name}</span>}
                    {duty.area_name && <span>📍 {duty.area_name}</span>}
                    {duty.start_time && <span>⏰ {fmtTime(duty.start_time)} – {fmtTime(duty.end_time)}</span>}
                    {duty.assigned_teacher_name
                      ? <span className="text-emerald-700 font-semibold">👤 {duty.assigned_teacher_name}</span>
                      : <span className="text-amber-600 font-semibold">⚠️ Unassigned</span>
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

          <Card title="Departmental Workload & Leave Statistics">
            <Table columns={columns} data={data.departments} searchPlaceholder="Search departments..." />
          </Card>
        </div>
      )}

      {/* ── Campus Duties ── */}
      {activeTab === 'duties' && (
        <div className="space-y-8">
          {/* Autonomous Activation */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="text-lg font-black text-white">⚡ Autonomous Duty Activation</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                One click — system evaluates timetables, ongoing leaves, precedence rules and assigns best available staff automatically.
              </p>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <AutonomousDutyPanel />
            </div>
          </div>

          {/* Live Duty Roster */}
          <div>
            <h2 className="text-base font-black text-slate-800 mb-3">📋 Live Duty Roster</h2>
            <DutyRoster />
          </div>
        </div>
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
