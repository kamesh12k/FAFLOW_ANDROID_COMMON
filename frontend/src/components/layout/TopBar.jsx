import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useDepartment } from '../../context/DepartmentContext'
import { useTheme } from '../../context/ThemeContext'
import { BRAND_CONFIG } from '../../config/branding'
import FacultyFlowLogo from '../brand/FacultyFlowLogo'
import { academicCalendarApi } from '../../api/services'
import { DayTypeBadge } from '../ui'
import { SearchIcon, ChevronDownIcon } from '../icons'
import NotificationBell from './NotificationBell'
import QuickSearch from './QuickSearch'

function pad(n) { return String(n).padStart(2, '0') }
function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function TopBar() {
  const { user, isAdmin, isSystemAdmin } = useAuth()
  const dept = useDepartment()
  const { app_name, activeTheme, changeTheme, THEMES } = useTheme() || {}
  const [today, setToday] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    academicCalendarApi.resolve(todayIso()).then(r => setToday(r.data)).catch(() => {})
  }, [])

  // Ctrl + K keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Handle click outside theme dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setThemeDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between px-4 lg:px-6 py-3.5 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="lg:hidden font-extrabold text-slate-900 dark:text-white text-base truncate flex items-center gap-2">
              <FacultyFlowLogo variant="mark" size={24} />
              <span>{app_name || BRAND_CONFIG.appName}</span>
            </span>
            {today && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-bold uppercase tracking-wider">
                <span className="hidden md:inline text-[10px] text-slate-400 font-bold">Today</span>
                {today.day_type === 'working' && today.day_order ? (
                  <span className="inline-flex items-center rounded-lg font-bold bg-green-50 text-green-700 border border-green-150 px-2 py-0.5 text-[10px]">
                    Day Order {today.day_order}
                  </span>
                ) : (
                  <DayTypeBadge dayType={today.day_type} small />
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Department Switcher — System Admin only */}
            {isSystemAdmin && dept && (
              <div className="relative">
                <select
                  value={dept.activeDepartmentId ?? ''}
                  onChange={(e) => dept.setActiveDepartmentId(e.target.value || null)}
                  className="text-xs font-bold border border-slate-200 rounded-xl pl-2.5 pr-7 py-2 bg-white text-slate-700 outline-none focus:border-primary-500 appearance-none max-w-[110px] sm:max-w-[180px] truncate cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                  title="Switch department workspace"
                >
                  <option value="">🏛️ All Depts</option>
                  {dept.departments.map(d => (
                    <option key={d.id} value={d.id}>📂 {d.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-slate-400">
                  <ChevronDownIcon className="w-3.5 h-3.5" />
                </div>
              </div>
            )}
            
            {/* Command Palette Trigger */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 p-2 sm:px-3.5 sm:py-2 rounded-xl border border-slate-200 bg-slate-50/20 text-slate-400 hover:text-slate-600 hover:bg-slate-50 hover:border-slate-350 transition-all text-xs font-bold shadow-[0_1px_2px_rgba(0,0,0,0.01)] min-h-[36px] min-w-[36px] justify-center"
              aria-label="Search"
            >
              <SearchIcon className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden md:inline-flex h-4.5 select-none items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 font-mono text-[9px] font-medium text-slate-400">
                <span className="text-[10px]">Ctrl</span>K
              </kbd>
            </button>

            {/* Notification Bell */}
            <NotificationBell />
          </div>
        </div>
      </header>

      <QuickSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
