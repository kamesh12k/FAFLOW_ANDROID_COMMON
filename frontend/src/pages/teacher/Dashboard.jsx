import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { leavesApi, timetableApi, academicCalendarApi, creditsApi, teachersApi, attendanceApi, policyEnforcementApi } from '../../api/services'
import { DayTypeBadge, CreditChip, Card, Timeline } from '../../components/ui'
import { PlusIcon, CalIcon, DocIcon } from '../../components/icons'

// ── Period time labels ────────────────────────────────────────────────────────
const PERIOD_TIMES = {
  1: '9:20 – 10:20',
  2: '10:20 – 11:15',
  3: '11:40 – 12:35',
  4: '13:35 – 14:30',
  5: '14:55 – 15:50',
}

function formatShiftTime(isoString) {
  if (!isoString) return '--:--'
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '--:--'
  }
}

// ── Skeleton primitives ───────────────────────────────────────────────────────
function SkeletonLine({ w = 'w-full', h = 'h-4' }) {
  return <div className={`${w} ${h} bg-slate-100 rounded-lg animate-pulse`} />
}

function SkeletonCard({ rows = 3 }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 space-y-3 shadow-sm">
      <SkeletonLine w="w-1/3" h="h-3.5" />
      <div className="pt-1 space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonLine key={i} w={i % 2 === 0 ? 'w-full' : 'w-3/4'} />
        ))}
      </div>
    </div>
  )
}

function SkeletonHero() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 shadow-md animate-pulse p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-slate-200 shrink-0" />
        <div className="space-y-2 flex-1">
          <SkeletonLine w="w-1/2" h="h-5" />
          <SkeletonLine w="w-1/3" h="h-3" />
        </div>
      </div>
    </div>
  )
}

export default function TeacherDashboard() {
  const { user } = useAuth()

  // ── Staged state — each section loads independently ────────────────────────
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(true)

  const [slots, setSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(true)

  const [leaves, setLeaves] = useState([])
  const [leavesLoading, setLeavesLoading] = useState(true)

  const [creditBalance, setCreditBalance] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [creditsLoading, setCreditsLoading] = useState(true)

  const [todayAttendance, setTodayAttendance] = useState(null)
  const [attendanceLoading, setAttendanceLoading] = useState(true)

  const [enforcementMode, setEnforcementMode] = useState(null)

  useEffect(() => {
    policyEnforcementApi.getMode()
      .then(res => setEnforcementMode(res?.data || null))
      .catch(() => setEnforcementMode(null))
  }, [])

  // Stage 0: Staff Attendance (today shift status)
  useEffect(() => {
    attendanceApi.getToday()
      .then(res => setTodayAttendance(res?.data || null))
      .catch(() => setTodayAttendance(null))
      .finally(() => setAttendanceLoading(false))
  }, [])

  // Stage 1: Academic summary (fast — determines day order for hero card)
  useEffect(() => {
    academicCalendarApi.myTodaySummary()
      .then(res => setSummary(res?.data || null))
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false))
  }, [])

  // Stage 2: Timetable — enriched (subject_name, class_name, room_number in response)
  useEffect(() => {
    if (!user?.id) return
    timetableApi.getByTeacher(user.id)
      .then(res => setSlots(res?.data || []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false))
  }, [user?.id])

  // Stage 3: Leaves (fully independent)
  useEffect(() => {
    leavesApi.myLeaves()
      .then(res => setLeaves(res?.data || []))
      .catch(() => setLeaves([]))
      .finally(() => setLeavesLoading(false))
  }, [])

  // Stage 4: Credits (two calls, but only to credits endpoints)
  useEffect(() => {
    if (!user?.id) return
    Promise.all([
      teachersApi.credits(user.id).catch(() => ({ data: { balance: 0 } })),
      creditsApi.myTransactions().catch(() => ({ data: [] })),
    ]).then(([credRes, txRes]) => {
      setCreditBalance(credRes?.data?.balance ?? 0)
      setTransactions(txRes?.data || [])
    }).finally(() => setCreditsLoading(false))
  }, [user?.id])

  // ── Derived values ─────────────────────────────────────────────────────────
  const balance = useMemo(() => {
    if (creditBalance !== null && !isNaN(Number(creditBalance))) return Number(creditBalance)
    return transactions.reduce((acc, t) => acc + (Number(t.change) || 0), 0)
  }, [creditBalance, transactions])

  const pendingDays = useMemo(() =>
    new Set(leaves.filter(l => l.status === 'pending').map(l => l.date)).size,
    [leaves])

  const approvedDays = useMemo(() =>
    new Set(leaves.filter(l => l.status === 'approved').map(l => l.date)).size,
    [leaves])

  // Today slots filtered by day order — uses enriched names from the API directly
  const todaySlots = useMemo(() => {
    if (!summary || summary.day_order === null) return []
    return slots
      .filter(s => s.day_order === summary.day_order)
      .sort((a, b) => a.period_number - b.period_number)
  }, [slots, summary])

  const nextHoliday = summary?.upcoming_non_working_days?.[0]

  // Build timeline items using enriched names — no local lookups needed
  const scheduleTimelineItems = useMemo(() => todaySlots.map(slot => ({
    title: slot.subject_name || `Period ${slot.period_number}`,
    date: `P${slot.period_number} · ${PERIOD_TIMES[slot.period_number] || ''}`,
    description: [
      slot.class_name
        ? `${slot.class_name}${slot.class_section ? ` – ${slot.class_section}` : ''}`
        : 'Class session',
      slot.room_number ? `Room ${slot.room_number}` : null,
    ].filter(Boolean).join(' · '),
  })), [todaySlots])

  const creditsTimelineItems = useMemo(() => transactions.slice(0, 5).map(tx => {
    const ch = Number(tx.change) || 0
    return {
      title: `${ch > 0 ? '+' : ''}${ch} Credits`,
      date: new Date(tx.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      description: tx.reason || (ch > 0 ? 'Substitution coverage bonus' : 'Leave penalty deduction'),
    }
  }), [transactions])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 pb-10">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-6 sm:space-y-8">

        {/* Header — always visible immediately */}
        <div className="space-y-1.5">
          <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
            Welcome back, {user.name.split(' ')[0]}
          </h1>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {user.department || 'Faculty Member'} · Personal Dashboard
          </p>
        </div>

        {/* Hero — skeleton until summary resolves */}
        {summaryLoading ? (
          <SkeletonHero />
        ) : summary && (
          <div className="relative overflow-hidden rounded-2xl border border-slate-100 shadow-md">
            {summary.blocks_operations ? (
              <div className="bg-gradient-to-br from-amber-50/80 via-amber-50/20 to-white px-4 py-5 sm:px-8 sm:py-8">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0"><DayTypeBadge dayType={summary.day_type} /></div>
                  <div>
                    <h2 className="text-lg font-bold text-amber-900">No classes today</h2>
                    <p className="text-xs text-amber-700 mt-1 font-medium">{summary.day_type.replace('_', ' ')} — Take it easy</p>
                  </div>
                </div>
              </div>
            ) : summary.is_on_leave_today ? (
              <div className="bg-gradient-to-br from-emerald-50/80 via-emerald-50/20 to-white px-4 py-5 sm:px-8 sm:py-8">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-extrabold text-lg shadow-md shrink-0">
                    DO {summary.day_order}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-emerald-900">You're on approved leave</h2>
                    <p className="text-xs text-emerald-700 mt-1 font-medium">Enjoy your day off — Make it count</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-blue-50/80 via-indigo-50/10 to-white px-4 py-5 sm:px-8 sm:py-8">
                <div className="flex items-start justify-between gap-4 sm:gap-6 flex-wrap md:flex-nowrap">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center font-extrabold text-lg shadow-md shrink-0">
                      DO {summary.day_order}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-blue-900">Today is Day Order {summary.day_order}</h2>
                      <p className="text-xs text-slate-650 mt-1.5 font-semibold leading-relaxed">
                        You have <span className="font-extrabold text-slate-800">{summary.periods_today}</span> period{summary.periods_today === 1 ? '' : 's'} scheduled for today.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link to="/teacher/student-attendance" className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all active:scale-95">
                      Take Attendance
                    </Link>
                    <Link to="/teacher/timetable" className="px-4 py-2.5 bg-white hover:bg-slate-50 text-blue-700 font-bold text-xs rounded-xl border border-slate-200/80 transition-all shadow-sm active:scale-95">
                      Full Timetable
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Actions — always visible */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Link to="/teacher/student-attendance" className="group rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
            <div className="flex flex-col items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" strokeWidth={1.8} />
                  <polyline points="16 11 18 13 22 9" strokeWidth={1.8} />
                </svg>
              </div>
              <div>
                <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Take Attendance</h4>
                <p className="text-[10px] text-indigo-600/70 mt-0.5 font-bold">Mark today's classes</p>
              </div>
            </div>
          </Link>

          <Link to="/teacher/leave/apply" className="group rounded-2xl border border-slate-100 bg-white p-5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
            <div className="flex flex-col items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center border border-teal-100">
                <PlusIcon className="w-5 h-5 text-teal-700" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Apply Leave</h4>
                <p className="text-[10px] text-slate-400 mt-0.5 font-bold">Takes less than a minute</p>
              </div>
            </div>
          </Link>

          <Link to="/teacher/timetable" className="group rounded-2xl border border-slate-100 bg-white p-5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
            <div className="flex flex-col items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
                <CalIcon className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">My Timetable</h4>
                <p className="text-[10px] text-slate-400 mt-0.5 font-bold">View full schedule</p>
              </div>
            </div>
          </Link>

          <Link to="/teacher/leaves" className="group rounded-2xl border border-slate-100 bg-white p-5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
            <div className="flex flex-col items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center border border-amber-100">
                <DocIcon className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Leave History</h4>
                <p className="text-[10px] text-slate-400 mt-0.5 font-bold">
                  {pendingDays > 0 ? `${pendingDays} pending` : 'View all requests'}
                </p>
              </div>
            </div>
          </Link>
        </div>

        {/* Policy Enforcement Mode Indicator Banner */}
        {enforcementMode && (
          <div className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
            enforcementMode.mode === 'STRICT'
              ? 'bg-slate-50 border-slate-200 text-slate-800'
              : 'bg-amber-50/80 border-amber-200 text-amber-900'
          }`}>
            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider shrink-0 ${
                enforcementMode.mode === 'STRICT'
                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                  : 'bg-amber-200/90 text-amber-900 border border-amber-300'
              }`}>
                {enforcementMode.mode === 'STRICT' ? 'Strict Enforcement Active' : 'Advisory Mode Active'}
              </span>
              <p className="text-xs font-medium">
                {enforcementMode.mode === 'STRICT'
                  ? 'Institutional policy requires full compliance. Leave requests exceeding balance or quota are blocked.'
                  : 'Policy violations will generate an advisory warning with mandatory acknowledgement before HOD review.'}
              </p>
            </div>
            <Link
              to="/teacher/leave/apply"
              className="text-xs font-bold text-primary-600 hover:text-primary-700 whitespace-nowrap self-start sm:self-auto"
            >
              Apply Leave →
            </Link>
          </div>
        )}

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          <div className="lg:col-span-2 space-y-8">
            {/* Schedule Card */}
            {summaryLoading || slotsLoading ? (
              <SkeletonCard rows={4} />
            ) : (
              <Card
                title="Today's Schedule"
                headerAction={<Link to="/teacher/timetable" className="text-[11px] font-bold text-primary-600 hover:text-primary-700 transition-colors">Full timetable →</Link>}
              >
                {scheduleTimelineItems.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-sm font-bold text-slate-600">No classes scheduled for today</p>
                    <p className="text-xs text-slate-400 font-medium mt-1">
                      {summary?.blocks_operations ? 'This is a non-working day.' : 'Your timetable has no periods for this Day Order.'}
                    </p>
                  </div>
                ) : (
                  <Timeline items={scheduleTimelineItems} />
                )}
              </Card>
            )}

            {/* Leaves Card */}
            {leavesLoading ? (
              <SkeletonCard rows={3} />
            ) : (
              <Card
                title="Leave & Substitution Summary"
                headerAction={<Link to="/teacher/leaves" className="text-[11px] font-bold text-primary-600 hover:text-primary-700 transition-colors">View all →</Link>}
              >
                <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-100">
                  <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Approved</p>
                    <p className="text-2xl font-extrabold text-emerald-800 mt-1">{approvedDays}</p>
                    <p className="text-[10px] text-emerald-600/70 font-medium">{approvedDays === 1 ? 'day off' : 'days off'}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-100">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Pending</p>
                    <p className="text-2xl font-extrabold text-amber-800 mt-1">{pendingDays}</p>
                    <p className="text-[10px] text-amber-600/70 font-medium">{pendingDays === 1 ? 'request' : 'requests'}</p>
                  </div>
                </div>
                <div className="pt-3.5 flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>Earned {transactions.filter(t => (Number(t.change) || 0) > 0).length} coverage credits</span>
                  <span>Used {transactions.filter(t => (Number(t.change) || 0) < 0).length} leave deductions</span>
                </div>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            {/* Staff Attendance Status Card */}
            {attendanceLoading ? (
              <SkeletonCard rows={2} />
            ) : (
              <Card title="Today's Attendance">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-full ${todayAttendance?.is_checked_out ? 'bg-slate-400' : todayAttendance?.is_checked_in ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                    <div>
                      <p className="text-xs font-bold text-slate-850">
                        {todayAttendance?.is_checked_out
                          ? 'Shift Completed'
                          : todayAttendance?.is_checked_in
                          ? 'Checked In (Active)'
                          : 'Not Checked In'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {todayAttendance?.is_checked_out
                          ? `Out at ${formatShiftTime(todayAttendance.check_out_time)}`
                          : todayAttendance?.is_checked_in
                          ? `In at ${formatShiftTime(todayAttendance.check_in_time)}`
                          : 'Mobile biometrics required'}
                      </p>
                    </div>
                  </div>
                  {todayAttendance?.record?.verification_mode && (
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md capitalize">
                      {todayAttendance.record.verification_mode.replace('_', ' ')}
                    </span>
                  )}
                </div>

                <div className="pt-3 grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Check In</span>
                    <span className="font-extrabold text-slate-700">{formatShiftTime(todayAttendance?.check_in_time)}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Check Out</span>
                    <span className="font-extrabold text-slate-700">{formatShiftTime(todayAttendance?.check_out_time)}</span>
                  </div>
                </div>

                {todayAttendance?.working_duration && (
                  <p className="text-[10px] text-center text-slate-500 font-semibold mt-2.5">
                    Shift Duration: <span className="font-bold text-slate-700">{todayAttendance.working_duration}</span>
                  </p>
                )}
              </Card>
            )}

            {/* Credits Card */}
            {creditsLoading ? (
              <SkeletonCard rows={5} />
            ) : (
              <Card
                title="Credits Balance"
                headerAction={<Link to="/teacher/credits" className="text-[11px] font-bold text-primary-600 hover:text-primary-700 transition-colors">Details →</Link>}
              >
                <div className="flex items-center justify-between pb-5 border-b border-slate-100">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Running Balance</p>
                    <p className={`text-4xl font-extrabold tracking-tight ${balance > 0 ? 'text-emerald-700' : balance < 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                      {balance > 0 ? `+${balance}` : balance}
                    </p>
                  </div>
                  <CreditChip value={balance} />
                </div>
                <div className="pt-5 space-y-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Recent Activity</p>
                  {creditsTimelineItems.length === 0 ? (
                    <p className="text-xs text-slate-400 font-semibold text-center py-4">No credit logs available</p>
                  ) : (
                    <div className="space-y-3.5">
                      {creditsTimelineItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start text-xs font-semibold text-slate-700">
                          <div>
                            <p className="font-bold">{item.title}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{item.description}</p>
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold shrink-0">{item.date}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Upcoming Holiday */}
            {!summaryLoading && nextHoliday && (
              <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/60 to-indigo-50/10 px-6 py-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <DayTypeBadge dayType={nextHoliday.day_type} small />
                    <div>
                      <p className="text-sm font-bold text-blue-950">
                        {nextHoliday.label || nextHoliday.day_type.replace('_', ' ')}
                      </p>
                      <p className="text-xs text-blue-700 mt-0.5 font-medium">{nextHoliday.date}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-blue-600 shrink-0 bg-white px-2.5 py-1 rounded-lg shadow-sm border border-blue-100/30">
                    {nextHoliday.days_away === 0 ? 'Today' : nextHoliday.days_away === 1 ? 'Tomorrow' : `In ${nextHoliday.days_away} days`}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
