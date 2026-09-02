import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { GridIcon, CalIcon, DocIcon, PlusIcon, ChartIcon, MenuIcon, DoorIcon, UsersIcon, BookIcon, SwapIcon } from '../icons'

const ADMIN_TABS = [
  { to: '/admin/dashboard', label: 'Home', icon: GridIcon, end: true },
  { to: '/admin/academic-calendar', label: 'Calendar', icon: CalIcon },
  { to: '/admin/leaves', label: 'Leaves', icon: DocIcon },
  { to: '/admin/credits', label: 'Credits', icon: ChartIcon },
]

const TEACHER_TABS = [
  { to: '/teacher/dashboard', label: 'Home', icon: GridIcon, end: true },
  { to: '/teacher/timetable', label: 'Timetable', icon: CalIcon },
  { to: '/teacher/leave/apply', label: 'Apply', icon: PlusIcon },
  { to: '/teacher/leaves', label: 'Leaves', icon: DocIcon },
]

const SYSTEM_ADMIN_TABS = [
  { to: '/admin/departments', label: 'Departments', icon: GridIcon, end: true },
]

const PRINCIPAL_TABS = [
  { to: '/principal/dashboard', label: 'Home', icon: GridIcon, end: true },
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
  { to: '/admin/today-substitutions', label: 'Alerts', icon: SwapIcon },
]

export default function BottomNav({ onMoreClick }) {
  const { isAdmin, isSystemAdmin, isPrincipal, isGovernance, isManager, isStaff } = useAuth()
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
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-100 pb-[env(safe-area-inset-bottom)]">
      <div 
        className="grid" 
        style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}
      >
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium ${
                isActive ? 'text-primary-600' : 'text-gray-400'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
        <button
          onClick={onMoreClick}
          className="flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium text-gray-400"
        >
          <MenuIcon className="w-5 h-5" />
          More
        </button>
      </div>
    </nav>
  )
}
