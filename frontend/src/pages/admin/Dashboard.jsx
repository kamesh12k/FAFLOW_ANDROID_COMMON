import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { academicCalendarApi, teachersApi, adminApi, departmentsApi, campusOperationsApi } from '../../api/services'
import { Spinner, DayTypeBadge, Card, StatCard, Table, Timeline, Button } from '../../components/ui'
import { UsersIcon, DocIcon, CalIcon, SwapIcon, PlusIcon, SettingsIcon } from '../../components/icons'

const RefreshIcon = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" />
  </svg>
)

const AVATAR_PALETTE = [
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-sky-100', text: 'text-sky-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
]

function hashStr(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) { h = str.charCodeAt(i) + ((h << 5) - h); h |= 0 }
  return Math.abs(h)
}

function initialsOf(name) {
  return (name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('') || '?'
}

function Avatar({ name }) {
  const c = AVATAR_PALETTE[hashStr(name || '') % AVATAR_PALETTE.length]
  return (
    <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold ${c.bg} ${c.text}`}>
      {initialsOf(name)}
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function AdminDashboard() {
  const { user, isSystemAdmin } = useAuth()
  const { themePreset } = useTheme() || {}

  // HOD (Department Admin) States
  const [summary, setSummary] = useState(null)
  const [teacherCount, setTeacherCount] = useState(null)
  
  // Super Admin (System Admin) States
  const [globalUsers, setGlobalUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [systemAnalytics, setSystemAnalytics] = useState(null)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  const load = (silent = false) => {
    if (silent) setRefreshing(true)
    
    if (isSystemAdmin) {
      // Load Super Admin Data
      return Promise.all([
        adminApi.listGlobalUsers(),
        departmentsApi.list(),
        adminApi.auditLogs(),
        campusOperationsApi.getSystemAnalytics()
      ])
        .then(([usersRes, deptsRes, auditRes, analyticsRes]) => {
          setGlobalUsers(usersRes.data)
          setDepartments(deptsRes.data)
          setAuditLogs(auditRes.data)
          setSystemAnalytics(analyticsRes.data)
          setLastUpdated(new Date())
        })
        .catch(err => console.error('Failed to load system admin data', err))
        .finally(() => {
          setLoading(false)
          setRefreshing(false)
        })
    } else {
      // Load Department Admin Data
      return Promise.all([
        academicCalendarApi.todaySummary(), 
        teachersApi.list()
      ])
        .then(([s, t]) => {
          setSummary(s.data)
          setTeacherCount(t.data.length)
          setLastUpdated(new Date())
        })
        .finally(() => {
          setLoading(false)
          setRefreshing(false)
        })
    }
  }

  useEffect(() => {
    load()
    const id = setInterval(() => load(true), 3 * 60 * 1000)
    return () => clearInterval(id)
  }, [isSystemAdmin])

  const teachersOnLeave = summary?.teachers_on_leave || []
  const needingSub = useMemo(() => teachersOnLeave.filter(t => !t.has_substitute), [teachersOnLeave])
  
  const groupedOnLeave = useMemo(() => {
    const groups = {}
    teachersOnLeave.forEach(t => {
      if (!groups[t.teacher_id]) {
        groups[t.teacher_id] = {
          teacher_id: t.teacher_id,
          name: t.name,
          department: t.department,
          periods: [],
          substitutes: [],
          has_substitute: true,
        }
      }
      const g = groups[t.teacher_id]
      g.periods.push(t.period_number)
      if (t.has_substitute) {
        if (t.substitute_name && !g.substitutes.includes(t.substitute_name)) {
          g.substitutes.push(t.substitute_name)
        }
      } else {
        g.has_substitute = false
      }
    })
    return Object.values(groups).map(g => {
      g.periods.sort((a, b) => a - b)
      return g
    })
  }, [teachersOnLeave])

  const sortedOnLeave = useMemo(
    () => [...groupedOnLeave].sort((a, b) => Number(a.has_substitute) - Number(b.has_substitute)),
    [groupedOnLeave]
  )

  const actionItems = useMemo(() => {
    if (!summary) return []
    const items = []
    if (!summary.blocks_operations && needingSub.length > 0) {
      items.push({
        key: 'sub',
        tone: 'amber',
        icon: SwapIcon,
        text: `${needingSub.length} Period${needingSub.length === 1 ? '' : 's'} Still Need${needingSub.length === 1 ? 's' : ''} a Substitute Today`,
        cta: 'Assign Now',
        to: '/admin/today-substitutions',
      })
    }
    const pendingFaculty = summary.pending_faculty_count ?? summary.pending_leave_count ?? 0
    if (pendingFaculty > 0) {
      items.push({
        key: 'leave',
        tone: 'yellow',
        icon: DocIcon,
        text: `${pendingFaculty} Faculty Member${pendingFaculty === 1 ? '' : 's'} Awaiting Leave Approval`,
        cta: 'Review',
        to: '/admin/leaves',
      })
    }
    return items
  }, [summary, needingSub])

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  const firstName = user?.name?.split(' ')[0]
  const formattedToday = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  // --- Render Super Admin Dashboard ---
  if (isSystemAdmin) {
    const timelineItems = auditLogs.slice(0, 8).map(log => ({
      title: log.actor_name || 'System Action',
      date: new Date(log.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      description: `${log.action} • ${log.target_type || 'System'}`,
    }))

    return (
      <div className="space-y-8 max-w-5xl mx-auto pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">System Admin Console</h1>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
              Global Platform Controls • Live Server Operations
              {lastUpdated && <span className="text-slate-400 font-normal"> · Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center p-2.5 border border-slate-200 rounded-xl text-slate-500 bg-white hover:bg-slate-50 hover:text-slate-800 transition shadow-sm active:scale-95 disabled:opacity-50 shrink-0"
          >
            <RefreshIcon className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Global System Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Total Departments" value={departments.length} sub="Active departments" accent="indigo" />
          <StatCard label="Today's Coverage Rate" value={systemAnalytics ? `${systemAnalytics.overall_coverage_rate}%` : '0%'} sub={`${systemAnalytics?.covered_periods_today !== undefined ? systemAnalytics.covered_periods_today : (systemAnalytics?.covered_leaves_today || 0)}/${systemAnalytics?.leave_periods_today !== undefined ? systemAnalytics.leave_periods_today : (systemAnalytics?.active_leaves_today || 0)} periods covered`} accent="green" />
          <StatCard label="Recent Credits Activity" value={systemAnalytics?.recent_transactions_count || 0} sub="Transactions (last 30 days)" accent="blue" />
          <StatCard label="Auto Assignment Rate" value={systemAnalytics ? `${systemAnalytics.auto_assigned_percentage}%` : '0%'} sub="System auto-subbed percentage" accent="yellow" />
        </div>

        {/* Quick Management Shortcuts */}
        <div>
          <h2 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-3">Resource & Setup Shortcuts</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4 flex flex-col justify-between space-y-3 bg-white border border-slate-200/80 hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-lg">🏫</span>
                <div>
                  <h3 className="text-xs font-extrabold text-slate-800">Classes</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Single & Bulk Range</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Link to="/admin/classes" className="btn-primary text-[11px] py-1.5 px-3 flex-1 text-center font-bold">
                  + Create Classes
                </Link>
              </div>
            </div>

            <div className="card p-4 flex flex-col justify-between space-y-3 bg-white border border-slate-200/80 hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-lg">🚪</span>
                <div>
                  <h3 className="text-xs font-extrabold text-slate-800">Rooms & Labs</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Single & Bulk Range</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Link to="/admin/rooms" className="btn-primary text-[11px] py-1.5 px-3 flex-1 text-center font-bold">
                  + Create Rooms
                </Link>
              </div>
            </div>

            <div className="card p-4 flex flex-col justify-between space-y-3 bg-white border border-slate-200/80 hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-lg">📂</span>
                <div>
                  <h3 className="text-xs font-extrabold text-slate-800">Departments</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Depts & HOD Accounts</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Link to="/admin/departments" className="btn-secondary text-[11px] py-1.5 px-3 flex-1 text-center font-bold">
                  Manage Depts
                </Link>
              </div>
            </div>

            <div className="card p-4 flex flex-col justify-between space-y-3 bg-white border border-slate-200/80 hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-lg">📚</span>
                <div>
                  <h3 className="text-xs font-extrabold text-slate-800">Subjects</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Course Catalog</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Link to="/admin/subjects" className="btn-secondary text-[11px] py-1.5 px-3 flex-1 text-center font-bold">
                  View Subjects
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Live Departments Overview Table */}
        <Card title="Live Departments Overview">
          {systemAnalytics?.department_summaries?.length === 0 ? (
            <p className="text-xs text-slate-400 font-medium py-8 text-center">No department summaries available.</p>
          ) : (
            <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-xs text-left" style={{ minWidth: '540px' }}>
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Department</th>
                    <th className="px-5 py-3.5">Operations Mode</th>
                    <th className="px-5 py-3.5">Self-Management</th>
                    <th className="px-5 py-3.5">Today's Leaves</th>
                    <th className="px-5 py-3.5">Coverage Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {systemAnalytics?.department_summaries?.map(dept => {
                    const leaves = dept.active_leaves_count
                    const covered = dept.covered_leaves_count
                    const rate = leaves > 0 ? Math.round((covered / leaves) * 100) : 100
                    return (
                      <tr key={dept.department_id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-4 font-bold text-slate-800">
                          {dept.department_name}
                          <span className="block text-[10px] font-mono font-normal text-slate-400 mt-0.5">{dept.department_code || '—'}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                            dept.mode === 'autonomous' ? 'bg-indigo-50 text-indigo-700' :
                            dept.mode === 'assisted' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {dept.mode}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            dept.teacher_self_management_enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {dept.teacher_self_management_enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-600">
                          {leaves > 0 ? (
                            dept.teachers_on_leave_today_count !== undefined ? (
                              <div>
                                <span>{dept.teachers_on_leave_today_count} teacher{dept.teachers_on_leave_today_count === 1 ? '' : 's'}</span>
                                <span className="block text-[10px] text-slate-400 mt-0.5">{leaves} period{leaves === 1 ? '' : 's'} ({covered} covered)</span>
                              </div>
                            ) : (
                              `${leaves} leaves (${covered} covered)`
                            )
                          ) : '0 leaves'}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-full rounded-full ${rate === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${rate}%` }} />
                            </div>
                            <span className="font-bold text-slate-700">{rate}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Audit Logs Timeline */}
          <div className="lg:col-span-2">
            <Card title="System Activity Log">
              {timelineItems.length === 0 ? (
                <p className="text-xs text-slate-400 font-medium py-8 text-center">No system logs available yet.</p>
              ) : (
                <Timeline items={timelineItems} />
              )}
            </Card>
          </div>

          {/* Quick Actions Controls */}
          <div className="space-y-6">
            <Card title="Global Controls">
              <div className="space-y-2.5">
                <Link to="/admin/classes" className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors font-bold text-xs text-slate-700">
                  <span>🏫 Manage & Create Classes</span>
                  <span className="text-indigo-600 font-extrabold">+</span>
                </Link>
                <Link to="/admin/rooms" className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors font-bold text-xs text-slate-700">
                  <span>🚪 Manage & Create Rooms</span>
                  <span className="text-indigo-600 font-extrabold">+</span>
                </Link>
                <Link to="/admin/departments" className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors font-bold text-xs text-slate-700">
                  <span>📂 Manage Departments</span>
                  <span>→</span>
                </Link>
                <Link to="/admin/settings" className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors font-bold text-xs text-slate-700">
                  <span>⚙️ System Configuration</span>
                  <span>→</span>
                </Link>
                <div className="pt-3 border-t border-slate-100 mt-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Quick Setup</p>
                  <Link to="/admin/settings" className="block text-center px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all">
                    Launch Setup wizard
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // --- Render HOD (Department Admin) Dashboard ---
  const nextHoliday = summary?.upcoming_non_working_days?.[0]

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
            {getGreeting()}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
            {formattedToday} · {user?.department || 'Department'} Overview
            {lastUpdated && <span className="text-slate-400 font-normal"> · Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center p-2.5 border border-slate-200 rounded-xl text-slate-500 bg-white hover:bg-slate-50 hover:text-slate-800 transition shadow-sm active:scale-95 disabled:opacity-50 shrink-0"
        >
          <RefreshIcon className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Action items */}
      {actionItems.length > 0 && (
        <div className="space-y-3">
          {actionItems.map(item => (
            <Link
              key={item.key}
              to={item.to}
              className={`rounded-2xl border p-5 flex items-center justify-between gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 bg-white ${
                item.tone === 'amber' ? 'border-amber-200/60' : 'border-yellow-250/60'
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  item.tone === 'amber' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-yellow-50 text-yellow-700 border border-yellow-100'
                }`}>
                  <item.icon className="w-5 h-5" />
                </span>
                <p className="text-xs font-bold text-slate-700 truncate">{item.text}</p>
              </div>
              <span className="text-[11px] font-bold text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg shrink-0 hover:bg-primary-100 transition-colors">{item.cta} →</span>
            </Link>
          ))}
        </div>
      )}

      {/* Working day status banner */}
      {summary?.blocks_operations ? (
        <div className="rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50/60 to-orange-50/30 p-6">
          <div className="flex items-center gap-4">
            <DayTypeBadge dayType={summary.day_type} />
            <div>
              <p className="text-sm font-bold text-amber-900">Operations Suspended</p>
              <p className="text-xs text-amber-700 mt-0.5 font-medium">
                No classes, substitutions, or credits are scheduled today ({summary.day_type.replace('_', ' ')}).
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50/60 via-teal-50/20 to-white p-6 flex items-center justify-between flex-wrap gap-4 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
          <div className="flex items-center gap-4">
            <span className="w-14 h-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center font-extrabold text-lg shadow-md shrink-0">
              DO {summary?.day_order}
            </span>
            <div>
              <p className="text-sm font-extrabold text-slate-800">Working Calendar Day</p>
              <p className="text-xs text-slate-500 mt-1 font-semibold">
                Day Order {summary?.day_order} · {groupedOnLeave.length} Faculty on Leave
                {teachersOnLeave.length > 0 && (
                  <span className={needingSub.length > 0 ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold'}>
                    {' '}· {teachersOnLeave.length - needingSub.length}/{teachersOnLeave.length} Periods Covered
                  </span>
                )}
              </p>
            </div>
          </div>
          <Link to="/admin/leaves" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-250/20 transition-all active:scale-[0.98]">Review Leaves</Link>
        </div>
      )}

      {/* Quick controls grid */}
      <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Link to="/admin/today-substitutions" className="rounded-2xl border border-slate-100 bg-white p-3 sm:p-5 flex flex-col items-center gap-2.5 sm:gap-3.5 text-center hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <span className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center border ${
            needingSub.length > 0 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
          }`}>
            <SwapIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </span>
          <div>
            <span className="block text-lg sm:text-xl font-extrabold text-slate-800 leading-none">{needingSub.length > 0 ? needingSub.length : '✓'}</span>
            <span className="block text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 sm:mt-1.5">{needingSub.length > 0 ? 'Needs Sub' : 'Covered'}</span>
          </div>
        </Link>
        <Link to="/admin/leaves" className="rounded-2xl border border-slate-100 bg-white p-3 sm:p-5 flex flex-col items-center gap-2.5 sm:gap-3.5 text-center hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <span className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-yellow-50 text-yellow-700 flex items-center justify-center border border-yellow-100">
            <DocIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </span>
          <div>
            <span className="block text-lg sm:text-xl font-extrabold text-slate-800 leading-none">{summary?.pending_faculty_count ?? summary?.pending_leave_count ?? 0}</span>
            <span className="block text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 sm:mt-1.5">Pending</span>
          </div>
        </Link>
        <Link to="/admin/teachers" className="rounded-2xl border border-slate-100 bg-white p-3 sm:p-5 flex flex-col items-center gap-2.5 sm:gap-3.5 text-center hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <span className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
            <UsersIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </span>
          <div>
            <span className="block text-lg sm:text-xl font-extrabold text-slate-800 leading-none">{teacherCount || 0}</span>
            <span className="block text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 sm:mt-1.5">Faculty</span>
          </div>
        </Link>
        <Link to="/admin/academic-calendar" className="rounded-2xl border border-slate-100 bg-white p-3 sm:p-5 flex flex-col items-center gap-2.5 sm:gap-3.5 text-center hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <span className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-indigo-50 text-indigo-750 flex items-center justify-center border border-indigo-100">
            <CalIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </span>
          <div>
            <span className="block text-[10px] sm:text-[11px] font-bold text-slate-800 leading-none mt-1">Calendar</span>
            <span className="block text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 sm:mt-1.5">Schedule</span>
          </div>
        </Link>
        <Link to="/admin/timetable" className="rounded-2xl border border-slate-100 bg-white p-3 sm:p-5 flex flex-col items-center gap-2.5 sm:gap-3.5 text-center hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
          <span className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100">
            <PlusIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </span>
          <div>
            <span className="block text-[10px] sm:text-[11px] font-bold text-slate-800 leading-none mt-1">Timetable</span>
            <span className="block text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 sm:mt-1.5">Add Slot</span>
          </div>
        </Link>
      </div>

      {/* Leave Directory Table */}
      {!summary?.blocks_operations && (
        <Card title="Leave Directory (Today)">
          {teachersOnLeave.length === 0 ? (
            <p className="py-8 text-xs font-semibold text-slate-450 text-center">Nobody is on approved leave today.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {sortedOnLeave.map((t) => (
                <div key={t.teacher_id} className="flex items-center justify-between py-3.5 gap-4 hover:bg-slate-50/20 transition-colors">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <Avatar name={t.name} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{t.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                        {t.department || 'General'} · {t.periods.length === 1 ? `Period ${t.periods[0]}` : `Periods ${t.periods.join(', ')}`}
                      </p>
                    </div>
                  </div>
                  {t.has_substitute ? (
                    <span className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {t.substitutes.join(', ')}
                    </span>
                  ) : (
                    <Link to="/admin/today-substitutions" className="text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-100 hover:bg-amber-100/60 px-3 py-1 rounded-full shrink-0 transition-colors">
                      Needs Substitute
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Upcoming Holidays */}
      {nextHoliday && (
        <Link
          to="/admin/academic-calendar"
          className="rounded-2xl bg-gradient-to-r from-blue-50/60 to-indigo-50/20 border border-blue-100 px-5 py-4 flex items-center justify-between gap-3 text-sm text-blue-800 hover:border-blue-200 transition-all duration-200 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <DayTypeBadge dayType={nextHoliday.day_type} small />
            <span className="font-bold text-blue-950">
              {nextHoliday.label || nextHoliday.day_type.replace('_', ' ')} on {nextHoliday.date}
            </span>
          </div>
          <span className="text-xs font-bold text-blue-600 shrink-0 bg-white px-2.5 py-1 rounded-lg shadow-sm border border-blue-100/30">
            {nextHoliday.days_away === 0 ? 'Today' : nextHoliday.days_away === 1 ? 'Tomorrow' : `In ${nextHoliday.days_away} days`}
          </span>
        </Link>
      )}
    </div>
  )
}