import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { announcementApi } from '../../api/announcements'
import {
  GridIcon, CalIcon, DocIcon, PlusIcon, ChartIcon, MenuIcon,
  DoorIcon, UsersIcon, BookIcon, SwapIcon, AttendanceNavIcon, DatabaseIcon,
  MegaphoneIcon,
} from '../icons'

const ADMIN_TABS = [
  { to: '/admin/dashboard', label: 'Home', icon: GridIcon, end: true },
  { to: '/announcements', label: 'Notices', icon: MegaphoneIcon, badgeKey: 'announcements' },
  { to: '/admin/academic-calendar', label: 'Calendar', icon: CalIcon },
  { to: '/admin/leaves', label: 'Leaves', icon: DocIcon },
]

const TEACHER_TABS = [
  { to: '/teacher/dashboard', label: 'Home', icon: GridIcon, end: true },
  { to: '/announcements', label: 'Notices', icon: MegaphoneIcon, badgeKey: 'announcements' },
  { to: '/teacher/student-attendance', label: 'Attendance', icon: AttendanceNavIcon },
  { to: '/teacher/leaves', label: 'Leaves', icon: DocIcon },
]

const SYSTEM_ADMIN_TABS = [
  { to: '/admin/dashboard', label: 'Home', icon: GridIcon, end: true },
  { to: '/admin/departments', label: 'Depts', icon: UsersIcon },
  { to: '/admin/teachers', label: 'Teachers', icon: UsersIcon },
  { to: '/admin/backup', label: 'Backup', icon: DatabaseIcon },
]

const PRINCIPAL_TABS = [
  { to: '/principal/dashboard', label: 'Home', icon: GridIcon, end: true },
  { to: '/principal/student-attendance', label: 'Attendance', icon: AttendanceNavIcon },
  { to: '/principal/class-timetable', label: 'Timetable', icon: CalIcon },
]

const MANAGER_TABS = [
  { to: '/manager/dashboard', label: 'Home', icon: GridIcon, end: true },
  { to: '/manager/lab-staff', label: 'Lab Staff', icon: DoorIcon },
  { to: '/manager/leaves', label: 'Leaves', icon: DocIcon },
  { to: '/manager/directory', label: 'Directory', icon: BookIcon },
]

const STAFF_TABS = [
  { to: '/staff/dashboard', label: 'Workspace', icon: GridIcon, end: true },
  { to: '/staff/leaves', label: 'My Leaves', icon: DocIcon },
]

const GOVERNANCE_TABS = [
  { to: '/governance', label: 'Home', icon: GridIcon, end: true },
  { to: '/governance/student-attendance', label: 'Students', icon: UsersIcon },
  { to: '/admin/today-substitutions', label: 'Live', icon: SwapIcon },
]

export default function BottomNav({ onMoreClick }) {
  const { user, isAdmin, isSystemAdmin, isPrincipal, isGovernance, isManager, isStaff } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) return
    const fetchUnread = () => {
      announcementApi.getUnreadCount()
        .then((res) => setUnreadCount(res.data?.count || 0))
        .catch(() => {})
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 30000)
    return () => clearInterval(interval)
  }, [user])

  const tabs = isGovernance
    ? GOVERNANCE_TABS
    : (isSystemAdmin
      ? SYSTEM_ADMIN_TABS
      : (isPrincipal
        ? PRINCIPAL_TABS
        : (isManager
          ? MANAGER_TABS
          : (isStaff
            ? STAFF_TABS
            : (isAdmin ? ADMIN_TABS : TEACHER_TABS)))))

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-sm border-t border-slate-100 pb-[env(safe-area-inset-bottom)]"
      aria-label="Mobile navigation"
    >
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}
      >
        {tabs.map(({ to, label, icon: Icon, end, badgeKey }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-semibold transition-colors ${
                isActive ? 'text-primary-600' : 'text-slate-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`w-5 h-5 transition-transform relative ${isActive ? 'scale-110' : ''}`}>
                  <Icon className="w-full h-full" />
                  {badgeKey === 'announcements' && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[15px] h-3.5 px-1 rounded-full bg-rose-600 text-white text-[8px] font-black flex items-center justify-center shadow-xs">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </span>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button
          onClick={onMoreClick}
          className="flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Open navigation menu"
        >
          <MenuIcon className="w-5 h-5" />
          More
        </button>
      </div>
    </nav>
  )
}
