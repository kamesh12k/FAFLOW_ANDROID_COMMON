import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useDepartment } from '../../context/DepartmentContext'
import { useTheme } from '../../context/ThemeContext'
import { BRAND_CONFIG } from '../../config/branding'
import FacultyFlowLogo from '../brand/FacultyFlowLogo'
import { academicCalendarApi } from '../../api/services'
import { DayTypeBadge } from '../ui'
import { SearchIcon, ChevronDownIcon, BuildingIcon } from '../icons'
import NotificationBell from './NotificationBell'
import QuickSearch from './QuickSearch'

function pad(n) { return String(n).padStart(2, '0') }
function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function TopBar({ onOpenHelp }) {
  const { isSystemAdmin } = useAuth()
  const dept = useDepartment()
  const { app_name } = useTheme() || {}
  const [today, setToday] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)

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

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors">
        <div className="flex items-center justify-between px-4 lg:px-6 h-14 gap-3">
          {/* Left section: Branding on mobile & Day order academic status */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="lg:hidden font-bold text-slate-900 dark:text-white text-base truncate flex items-center gap-2">
              <FacultyFlowLogo variant="mark" size={24} />
              <span className="tracking-tight">{app_name || BRAND_CONFIG.appName}</span>
            </span>

            {today && (
              <div data-tour="topbar-calendar" className="hidden sm:flex items-center gap-2">
                {today.day_type === 'working' && today.day_order ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Day Order {today.day_order}
                  </span>
                ) : (
                  <DayTypeBadge dayType={today.day_type} small />
                )}
              </div>
            )}
          </div>

          {/* Right section: Department switcher, Quick search, and Notification Bell */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Department Switcher — System Admin workspace scope */}
            {isSystemAdmin && dept && (
              <div className="relative flex items-center">
                <BuildingIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                <select
                  value={dept.activeDepartmentId ?? ''}
                  onChange={(e) => dept.setActiveDepartmentId(e.target.value || null)}
                  className="h-9 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-7 bg-slate-50/70 dark:bg-slate-800/70 hover:bg-slate-100/70 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 appearance-none max-w-[130px] sm:max-w-[200px] truncate cursor-pointer transition-colors shadow-2xs"
                  title="Switch department workspace"
                  aria-label="Switch department workspace"
                >
                  <option value="">All Departments</option>
                  {dept.departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-slate-400">
                  <ChevronDownIcon className="w-3.5 h-3.5" />
                </div>
              </div>
            )}
            
            {/* Quick Command & Search Trigger */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="h-9 flex items-center gap-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 transition-colors text-xs font-medium shadow-2xs group min-w-[36px] sm:min-w-[180px] justify-between"
              aria-label="Search anywhere (Press Ctrl+K)"
              title="Search anywhere (Press Ctrl+K)"
            >
              <div className="flex items-center gap-2 min-w-0">
                <SearchIcon className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors shrink-0" />
                <span className="hidden sm:inline text-xs text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 truncate">Quick search...</span>
              </div>
              <kbd className="hidden md:inline-flex items-center gap-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-0.5 font-mono text-[9px] font-medium text-slate-400 dark:text-slate-400 shadow-2xs">
                <span className="text-[10px]">Ctrl</span>K
              </kbd>
            </button>

            {/* Notification Bell */}
            <div data-tour="notification-bell">
              <NotificationBell />
            </div>
          </div>
        </div>
      </header>

      <QuickSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
