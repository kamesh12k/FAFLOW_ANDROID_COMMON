import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { BRAND_CONFIG } from '../../config/branding'
import { leavesApi, timetableApi, academicCalendarApi, subjectsApi, classesApi, roomsApi, creditsApi, teachersApi } from '../../api/services'
import { StatusBadge, Spinner, DayTypeBadge, CreditChip, Card, StatCard, Timeline, Badge, EmptyState } from '../../components/ui'
import { PlusIcon, CalIcon, DocIcon, AttendanceNavIcon, UsersIcon } from '../../components/icons'

export default function TeacherDashboard() {
  const { user } = useAuth()
  const [summary, setSummary] = useState(null)
  const [leaves, setLeaves] = useState([])
  const [slots, setSlots] = useState([])
  const [subjects, setSubjects] = useState({})
  const [classes, setClasses] = useState({})
  const [rooms, setRooms] = useState({})
  const [creditBalance, setCreditBalance] = useState(0)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      academicCalendarApi.myTodaySummary().catch(() => ({ data: null })),
      leavesApi.myLeaves().catch(() => ({ data: [] })),
      timetableApi.getByTeacher(user.id).catch(() => ({ data: [] })),
      subjectsApi.list(true).catch(() => ({ data: [] })),
      classesApi.list().catch(() => ({ data: [] })),
      roomsApi.list().catch(() => ({ data: [] })),
      creditsApi.myTransactions().catch(() => ({ data: [] })),
      teachersApi.credits(user.id).catch(() => ({ data: { balance: 0 } })),
    ]).then(([sumRes, leavesRes, slotsRes, subjRes, classRes, roomRes, txRes, credRes]) => {
      setSummary(sumRes?.data || null)
      setLeaves(leavesRes?.data || [])
      setSlots(slotsRes?.data || [])
      setSubjects(Object.fromEntries((subjRes?.data || []).map(s => [s.id, s])))
      setClasses(Object.fromEntries((classRes?.data || []).map(c => [c.id, c])))
      setRooms(Object.fromEntries((roomRes?.data || []).map(r => [r.id, r])))
      setTransactions(txRes?.data || [])
      setCreditBalance(credRes?.data?.balance ?? 0)
    }).catch(err => console.error('Failed to load teacher dashboard', err))
      .finally(() => setLoading(false))
  }, [user.id])

  // Compute balance
  const balance = useMemo(() => {
    if (creditBalance !== null && creditBalance !== undefined && !isNaN(Number(creditBalance))) {
      return Number(creditBalance)
    }
    if (!transactions || transactions.length === 0) return 0
    return transactions.reduce((acc, curr) => acc + (Number(curr.change) || 0), 0)
  }, [creditBalance, transactions])

  // Unique dates count for approved & pending leaves (day-based)
  const pendingDays = useMemo(() => {
    return new Set(leaves.filter(l => l.status === 'pending').map(l => l.date)).size
  }, [leaves])

  const approvedDays = useMemo(() => {
    return new Set(leaves.filter(l => l.status === 'approved').map(l => l.date)).size
  }, [leaves])

  const todaySlots = useMemo(() => {
    if (!summary || summary.day_order === null) return []
    return slots
      .filter(s => s.day_order === summary.day_order)
      .sort((a, b) => a.period_number - b.period_number)
  }, [slots, summary])

  const nextHoliday = summary?.upcoming_non_working_days?.[0]

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  // Timeline representation of today's classes
  const scheduleTimelineItems = todaySlots.map(slot => {
    const subject = subjects[slot.subject_id]
    const cls = classes[slot.class_id]
    const room = rooms[slot.room_id]
    return {
      title: `Period ${slot.period_number} • ${subject ? subject.name : 'Class'}`,
      date: `P${slot.period_number}`,
      description: `${cls ? `${cls.name} (${cls.section})` : 'Class Session'} ${room ? `• Room ${room.name}` : ''}`,
    }
  })

  // Credits transaction timeline
  const creditsTimelineItems = transactions.slice(0, 5).map(tx => {
    const ch = Number(tx.change) || 0
    return {
      title: `${ch > 0 ? '+' : ''}${ch} Credits`,
      date: new Date(tx.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      description: tx.reason || (ch > 0 ? 'Substitution coverage bonus' : 'Leave penalty deduction'),
    }
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 pb-10">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-6 sm:space-y-8">

        {/* Header with greeting */}
        <div className="space-y-1.5">
          <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
            Welcome back, {user.name.split(' ')[0]}
          </h1>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {user.department || 'Faculty Member'} · Personal Dashboard
          </p>
        </div>

        {/* Today's Status Hero Section */}
        {summary && (
          <div className="relative overflow-hidden rounded-2xl border border-slate-100 shadow-md">
            {summary.blocks_operations ? (
              <div className="bg-gradient-to-br from-amber-50/80 via-amber-50/20 to-white px-4 py-5 sm:px-8 sm:py-8">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <DayTypeBadge dayType={summary.day_type} />
                  </div>
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

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Link
            to="/teacher/student-attendance"
            className="group rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
          >
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

          <Link
            to="/teacher/leave/apply"
            className="group rounded-2xl border border-slate-100 bg-white p-5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
          >
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

          <Link
            to="/teacher/timetable"
            className="group rounded-2xl border border-slate-100 bg-white p-5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
          >
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

          <Link
            to="/teacher/leaves"
            className="group rounded-2xl border border-slate-100 bg-white p-5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
          >
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

        {/* Dashboard Story Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Today's Schedule timeline */}
          <div className="lg:col-span-2 space-y-8">
            <Card
              title="Today's Schedule"
              headerAction={
                <Link to="/teacher/timetable" className="text-[11px] font-bold text-primary-600 hover:text-primary-700 transition-colors">Full timetable →</Link>
              }
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

            {/* Leave balance panel */}
            <Card
              title="Leave & Substitution Summary"
              headerAction={
                <Link to="/teacher/leaves" className="text-[11px] font-bold text-primary-600 hover:text-primary-700 transition-colors">View all →</Link>
              }
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

              {/* Credit details info */}
              <div className="pt-3.5 flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Earned {transactions.filter(t => (Number(t.change) || 0) > 0).length} coverage credits</span>
                <span>Used {transactions.filter(t => (Number(t.change) || 0) < 0).length} leave deductions</span>
              </div>
            </Card>
          </div>

          {/* Credits Summary Card */}
          <div className="space-y-6">
            <Card
              title="Credits Balance"
              headerAction={
                <Link to="/teacher/credits" className="text-[11px] font-bold text-primary-600 hover:text-primary-700 transition-colors">Details →</Link>
              }
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
              
              {/* Transaction Logs inside card */}
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

            {/* Upcoming Holiday */}
            {nextHoliday && (
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