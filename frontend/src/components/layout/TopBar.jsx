import { useEffect, useState, useRef } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useDepartment } from '../../context/DepartmentContext'
import { useTheme } from '../../context/ThemeContext'
import { BRAND_CONFIG } from '../../config/branding'
import FacultyFlowLogo from '../brand/FacultyFlowLogo'
import { academicCalendarApi } from '../../api/services'
import { DayTypeBadge, RoleBadge } from '../ui'
import { 
  SearchIcon, 
  ChevronDownIcon, 
  BuildingIcon, 
  MenuIcon, 
  LogoutIcon, 
  SettingsIcon, 
  HelpCircleIcon 
} from '../icons'
import NotificationBell from './NotificationBell'
import QuickSearch from './QuickSearch'

function pad(n) { return String(n).padStart(2, '0') }
function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const ROUTE_LABELS = {
  '/admin/dashboard': ['Dashboard', 'Overview'],
  '/admin/teachers': ['Faculty', 'Teacher Directory'],
  '/admin/leaves': ['Leaves', 'Requests & Approvals'],
  '/admin/attendance': ['Attendance', 'Live Shift Monitor'],
  '/admin/academic-calendar': ['Academic', 'Calendar & Terms'],
  '/admin/classes': ['Campus', 'Classes & Sections'],
  '/admin/rooms': ['Campus', 'Rooms & Facilities'],
  '/admin/departments': ['Campus', 'Departments'],
  '/admin/subjects': ['Academics', 'Subject Catalog'],
  '/admin/settings': ['System', 'Configuration'],
  '/admin/backup': ['System', 'Backups & Storage'],
  '/admin/biometrics': ['Security', 'Biometric Enrollment'],
  '/admin/duty-management': ['Operations', 'Duty Rosters'],
  '/teacher/dashboard': ['Teacher', 'Workspace'],
  '/teacher/student-attendance': ['Classroom', 'Student Attendance'],
  '/teacher/leaves': ['Leaves', 'My Requests'],
  '/teacher/apply-leave': ['Leaves', 'Apply for Leave'],
  '/teacher/substitution': ['Duties', 'Substitutions'],
  '/teacher/timetable': ['Schedule', 'My Timetable'],
  '/teacher/preferences': ['Settings', 'Preferences'],
  '/principal/dashboard': ['Principal', 'Executive Dashboard'],
  '/principal/student-attendance': ['Institution', 'Student Attendance'],
  '/governance': ['Governance', 'Compliance & Audits'],
  '/governance/student-attendance': ['Governance', 'Student Attendance'],
  '/manager/dashboard': ['Manager', 'Dashboard'],
  '/staff/dashboard': ['Staff', 'Workspace'],
  '/announcements': ['Communications', 'Announcements'],
}

export default function TopBar({ onOpenHelp, onMenuClick }) {
  const { user, isAdmin, isPrincipal, isSystemAdmin, isManager, isStaff, isGovernance, logout } = useAuth()
  const dept = useDepartment()
  const { app_name } = useTheme() || {}
  const [today, setToday] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const profileDropdownRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    academicCalendarApi.resolve(todayIso()).then(r => setToday(r.data)).catch(() => {})
  }, [])

  // Ctrl + K keyboard shortcut handler & custom event listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    const handleOpenSearch = () => setSearchOpen(true)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('faflow:open-search', handleOpenSearch)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('faflow:open-search', handleOpenSearch)
    }
  }, [])

  // Click outside to close user profile dropdown
  useEffect(() => {
    if (!profileDropdownOpen) return
    const handleClickOutside = (e) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
        setProfileDropdownOpen(false)
      }
    }
    const handleEsc = (e) => {
      if (e.key === 'Escape') setProfileDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [profileDropdownOpen])

  const breadcrumbs = ROUTE_LABELS[location.pathname] || [
    'App',
    location.pathname.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'Page'
  ]

  const handleLogout = () => {
    setProfileDropdownOpen(false)
    logout()
    navigate('/login')
  }

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U'

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-[#E6E8EC] transition-colors">
        <div className="flex items-center justify-between px-3 sm:px-6 h-14 gap-2 sm:gap-3">
          {/* Left section: Mobile Menu button, Branding, Breadcrumbs & Day Order */}
          <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
            {/* Mobile Hamburger Drawer Trigger */}
            <button
              type="button"
              onClick={onMenuClick}
              className="lg:hidden p-2 -ml-1 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
              aria-label="Open mobile navigation menu"
            >
              <MenuIcon className="w-5 h-5" />
            </button>

            {/* Mobile Branding */}
            <span className="lg:hidden font-bold text-slate-900 text-sm sm:text-base truncate flex items-center gap-2">
              <FacultyFlowLogo variant="mark" size={24} />
              <span className="tracking-tight hidden xs:inline">{app_name || BRAND_CONFIG.appName}</span>
            </span>

            {/* Desktop Dynamic Breadcrumbs */}
            <nav aria-label="Breadcrumbs" className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span className="hover:text-slate-800 transition-colors">{breadcrumbs[0]}</span>
              <span className="text-slate-300 font-normal">/</span>
              <span className="text-slate-900 font-bold capitalize">{breadcrumbs[1]}</span>
            </nav>

            {/* Day Order Academic Indicator */}
            {today && (
              <div data-tour="topbar-calendar" className="hidden sm:flex items-center gap-2">
                {today.day_type === 'working' && today.day_order ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    Day Order {today.day_order}
                  </span>
                ) : (
                  <DayTypeBadge dayType={today.day_type} small />
                )}
              </div>
            )}
          </div>

          {/* Right section: Department switcher, Quick search, Notification Bell, User Profile Dropdown */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Department Switcher — System Admin workspace scope */}
            {isSystemAdmin && dept && (
              <div className="relative flex items-center">
                <BuildingIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                <select
                  value={dept.activeDepartmentId ?? ''}
                  onChange={(e) => dept.setActiveDepartmentId(e.target.value || null)}
                  className="h-9 text-xs font-semibold border border-[var(--color-border-control,#828C99)] rounded-xl pl-8 pr-7 bg-white hover:bg-slate-50 text-slate-700 outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100 appearance-none max-w-[120px] sm:max-w-[180px] truncate cursor-pointer transition-colors shadow-2xs"
                  title="Switch department workspace"
                  aria-label="Switch department workspace"
                >
                  <option value="">All Departments</option>
                  {dept.departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-slate-500">
                  <ChevronDownIcon className="w-3.5 h-3.5" />
                </div>
              </div>
            )}
            
            {/* Quick Command & Search Trigger */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="h-9 flex items-center gap-2 px-2.5 sm:px-3 rounded-xl border border-[var(--color-border-control,#828C99)] bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors text-xs font-semibold shadow-2xs group min-w-[36px] sm:min-w-[160px] justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
              aria-label="Search anywhere (Press Ctrl+K)"
              title="Search anywhere (Press Ctrl+K)"
            >
              <div className="flex items-center gap-2 min-w-0">
                <SearchIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-colors shrink-0" />
                <span className="hidden sm:inline text-xs text-slate-500 group-hover:text-slate-800 truncate">Quick search...</span>
              </div>
              <kbd className="hidden md:inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-500 shadow-2xs">
                <span>Ctrl</span>K
              </kbd>
            </button>

            {/* Notification Bell */}
            <div data-tour="notification-bell">
              <NotificationBell />
            </div>

            {/* User Profile Dropdown */}
            <div className="relative" ref={profileDropdownRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(prev => !prev)}
                className="h-9 flex items-center gap-2 pl-1.5 pr-2 rounded-xl hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                aria-expanded={profileDropdownOpen}
                aria-haspopup="true"
                aria-label="User profile and settings menu"
              >
                <div className="w-7 h-7 rounded-lg bg-primary-50 border border-primary-200 text-primary-700 flex items-center justify-center text-xs font-bold shrink-0">
                  {userInitial}
                </div>
                <div className="hidden md:flex flex-col items-start text-left">
                  <span className="text-xs font-bold text-slate-900 leading-tight max-w-[100px] truncate">{user?.name}</span>
                </div>
                <RoleBadge role={user?.role} className="hidden sm:inline-flex text-[10px] py-0 px-2" />
                <ChevronDownIcon className="w-3 h-3 text-slate-400" />
              </button>

              {/* Dropdown Menu Modal/Sheet */}
              {profileDropdownOpen && (
                <div 
                  className="absolute right-0 mt-1.5 w-64 rounded-2xl bg-white border border-slate-200 shadow-dialog p-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                  role="menu"
                  aria-orientation="vertical"
                >
                  {/* User Overview Section */}
                  <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50/70 rounded-xl mb-1.5">
                    <p className="text-xs font-bold text-slate-900 truncate">{user?.name}</p>
                    <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">{user?.email || 'Authorized User'}</p>
                    <div className="mt-2">
                      <RoleBadge role={user?.role} />
                    </div>
                  </div>

                  {/* Navigation & Action Links */}
                  <div className="space-y-0.5">
                    {isAdmin && !isPrincipal ? (
                      <Link
                        to="/admin/settings"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        role="menuitem"
                      >
                        <SettingsIcon className="w-4 h-4 text-slate-500" />
                        <span>System Settings</span>
                      </Link>
                    ) : (
                      <Link
                        to="/teacher/preferences"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        role="menuitem"
                      >
                        <SettingsIcon className="w-4 h-4 text-slate-500" />
                        <span>Preferences</span>
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false)
                        onOpenHelp?.()
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors text-left"
                      role="menuitem"
                    >
                      <HelpCircleIcon className="w-4 h-4 text-slate-500" />
                      <span>Help & Documentation</span>
                    </button>
                  </div>

                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-left"
                      role="menuitem"
                    >
                      <LogoutIcon className="w-4 h-4 text-rose-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <QuickSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
