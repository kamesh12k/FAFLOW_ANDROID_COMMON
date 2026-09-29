import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import FacultyFlowLogo from '../brand/FacultyFlowLogo'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { BRAND_CONFIG } from '../../config/branding'
import { announcementApi } from '../../api/announcements'
import {
  SettingsIcon,
  LogoutIcon,
  HelpCircleIcon,
  SearchIcon,
  ChevronDownIcon,
} from '../icons'
import {
  ADMIN_NAV,
  TEACHER_NAV,
  SYSTEM_ADMIN_NAV,
  PRINCIPAL_NAV,
  MANAGER_NAV,
  STAFF_NAV,
  GOVERNANCE_NAV,
} from './navConfig'

/**
 * Individual navigation link with active pill indicator, responsive hover states,
 * and high-contrast tooltip in collapsed mode.
 */
const NavItem = memo(function NavItem({ to, icon, label, end, collapsed, unreadCount, isDark, sectionName }) {
  const isAnnouncement = to === '/announcements'

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative flex items-center justify-between rounded-lg text-xs font-semibold transition-all duration-150 group outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-1 ${
          collapsed
            ? 'w-10 h-9 mx-auto justify-center'
            : 'px-3 py-2'
        } ${
          isActive
            ? isDark
              ? 'bg-primary-500/15 text-primary-200 font-bold border border-primary-500/30 shadow-2xs'
              : 'bg-primary-50 text-primary-700 font-bold border border-primary-200/80 shadow-2xs'
            : isDark
            ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* Active Accent Indicator Bar */}
          {isActive && (
            <span
              className={`absolute rounded-r-full bg-primary-600 transition-all ${
                collapsed
                  ? 'left-0 top-1.5 bottom-1.5 w-1'
                  : 'left-0 top-1 bottom-1 w-1'
              }`}
              aria-hidden="true"
            />
          )}

          {/* Icon & Label */}
          <div className={`flex items-center gap-2.5 min-w-0 ${collapsed ? 'justify-center' : ''}`}>
            <span
              className={`w-4.5 h-4.5 shrink-0 flex items-center justify-center transition-colors [&>svg]:w-4.5 [&>svg]:h-4.5 [&>svg]:shrink-0 ${
                isActive
                  ? isDark ? 'text-primary-300' : 'text-primary-600'
                  : isDark
                  ? 'text-slate-400 group-hover:text-slate-200'
                  : 'text-slate-500 group-hover:text-slate-800'
              }`}
            >
              {icon}
            </span>
            {!collapsed && <span className="truncate">{label}</span>}
          </div>

          {/* Announcements Unread Count Badge */}
          {isAnnouncement && unreadCount > 0 && (
            <span
              className={`${
                collapsed ? 'absolute -top-1 -right-1' : ''
              } px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white shrink-0 shadow-2xs`}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}

          {/* Collapsed Mode Floating Tooltip */}
          {collapsed && (
            <div className="absolute left-[68px] top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900/95 backdrop-blur-md text-white text-xs rounded-lg shadow-2xl border border-slate-700/80 z-50 whitespace-nowrap pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 flex flex-col gap-0.5">
              {sectionName && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  {sectionName}
                </span>
              )}
              <div className="flex items-center gap-2 font-medium">
                <span>{label}</span>
                {isAnnouncement && unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-500 text-white">
                    {unreadCount}
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </NavLink>
  )
})

export default function Sidebar({ onOpenHelp }) {
  const { user, isAdmin, isSystemAdmin, isPrincipal, isGovernance, isManager, isStaff, logout } = useAuth()
  const { app_name, themePreset } = useTheme() || {}
  const navigate = useNavigate()
  const location = useLocation()

  // Sidebar collapse toggle state
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('faflow_sidebar_collapsed') === 'true'
  })

  // Collapsed sections management (stores names of collapsed section headers)
  const [collapsedSections, setCollapsedSections] = useState(() => {
    try {
      const stored = localStorage.getItem('faflow_collapsed_sections')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  const [unreadCount, setUnreadCount] = useState(0)

  // Fetch unread announcements
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

  // Keyboard shortcut Ctrl+B / Cmd+B to toggle sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setCollapsed((prev) => {
          const next = !prev
          localStorage.setItem('faflow_sidebar_collapsed', String(next))
          return next
        })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const nextVal = !prev
      localStorage.setItem('faflow_sidebar_collapsed', String(nextVal))
      return nextVal
    })
  }, [])

  // Section toggle handler
  const toggleSection = useCallback((sectionTitle) => {
    setCollapsedSections((prev) => {
      const exists = prev.includes(sectionTitle)
      const next = exists ? prev.filter((s) => s !== sectionTitle) : [...prev, sectionTitle]
      try {
        localStorage.setItem('faflow_collapsed_sections', JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])

  // Resolve navigation hierarchy for the active user role
  const nav = useMemo(() => {
    if (isGovernance) return GOVERNANCE_NAV
    if (isSystemAdmin) return SYSTEM_ADMIN_NAV
    if (isPrincipal) return PRINCIPAL_NAV
    if (isManager) return MANAGER_NAV
    if (isStaff) return STAFF_NAV
    if (isAdmin) return ADMIN_NAV
    return TEACHER_NAV
  }, [isGovernance, isSystemAdmin, isPrincipal, isManager, isStaff, isAdmin])

  // Auto-expand any section that contains the current active route
  useEffect(() => {
    const currentPath = location.pathname
    for (const group of nav) {
      if (group.section && collapsedSections.includes(group.section)) {
        const hasActiveItem = group.items.some((item) => {
          if (item.end) return item.to === currentPath
          return currentPath.startsWith(item.to)
        })
        if (hasActiveItem) {
          setCollapsedSections((prev) => {
            const next = prev.filter((s) => s !== group.section)
            try {
              localStorage.setItem('faflow_collapsed_sections', JSON.stringify(next))
            } catch {}
            return next
          })
        }
      }
    }
  }, [location.pathname, nav, collapsedSections])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleOpenSearch = () => {
    window.dispatchEvent(new CustomEvent('faflow:open-search'))
  }

  const isDark = themePreset?.sidebarStyle === 'dark' || Boolean(themePreset?.isDarkMode)

  const sidebarCls = isDark
    ? 'bg-slate-950 border-slate-800 text-white'
    : 'bg-white border-[#E6E8EC] text-slate-800 shadow-[1px_0_3px_0_rgba(16,24,40,0.04)]'

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U'

  return (
    <aside
      className={`hidden lg:flex shrink-0 border-r sticky top-0 h-screen max-h-screen overflow-hidden flex-col transition-all duration-200 ${
        collapsed ? 'w-[72px]' : 'w-64'
      } ${sidebarCls}`}
      aria-label="Main Sidebar Navigation"
    >
      {/* ─── Header: 56px (h-14) strictly aligned with TopBar ─── */}
      <div
        className={`h-14 shrink-0 px-3.5 border-b flex items-center justify-between gap-2.5 ${
          isDark ? 'border-slate-800 bg-slate-950' : 'border-[#E6E8EC] bg-white'
        }`}
      >
        {!collapsed ? (
          <>
            <div className="flex items-center gap-2.5 min-w-0">
              <FacultyFlowLogo variant="mark" size={26} />
              <p className="font-bold text-sm tracking-tight truncate">
                {app_name || BRAND_CONFIG.appName}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleCollapse}
              aria-label="Collapse sidebar (Ctrl+B)"
              title="Collapse sidebar (Ctrl+B)"
              className={`p-1.5 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${
                isDark
                  ? 'hover:bg-slate-800 text-slate-400 hover:text-white'
                  : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </>
        ) : (
          <button
            type="button"
            className="mx-auto cursor-pointer p-1.5 rounded-lg hover:bg-slate-800 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            onClick={toggleCollapse}
            title="Expand sidebar (Ctrl+B)"
            aria-label="Expand sidebar (Ctrl+B)"
          >
            <FacultyFlowLogo variant="mark" size={24} />
          </button>
        )}
      </div>

      {/* ─── Quick Jump / Command Palette Search Affordance ─── */}
      <div className={`shrink-0 ${collapsed ? 'px-2 py-2 flex justify-center' : 'px-3 pt-2.5 pb-1'}`}>
        {!collapsed ? (
          <button
            type="button"
            onClick={handleOpenSearch}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${
              isDark
                ? 'bg-slate-900/60 border-slate-800/90 text-slate-400 hover:text-slate-200 hover:border-slate-700 hover:bg-slate-900'
                : 'bg-slate-50 border-slate-200/90 text-slate-500 hover:text-slate-800 hover:border-slate-300 hover:bg-slate-100/70'
            }`}
          >
            <div className="flex items-center gap-2">
              <SearchIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>Quick search...</span>
            </div>
            <kbd
              className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                isDark
                  ? 'bg-slate-800 text-slate-400 border border-slate-700/60'
                  : 'bg-white text-slate-500 border border-slate-200 shadow-2xs'
              }`}
            >
              Ctrl K
            </kbd>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleOpenSearch}
            className={`w-10 h-9 flex items-center justify-center rounded-lg transition-all group relative outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${
              isDark
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
            aria-label="Quick search (Ctrl+K)"
          >
            <SearchIcon className="w-4.5 h-4.5" />
            <div className="absolute left-[68px] top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900/95 backdrop-blur-md text-white text-xs font-medium rounded-md shadow-xl border border-slate-800 z-50 whitespace-nowrap pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              Quick search (Ctrl+K)
            </div>
          </button>
        )}
      </div>

      {/* ─── Navigation Groups ─── */}
      <nav
        className="flex-1 min-h-0 px-2.5 py-2 space-y-2 overflow-y-auto overflow-x-hidden sidebar-scrollbar overscroll-contain"
        aria-label="Main Navigation"
      >
        {nav.map((group, idx) => {
          const isSectionCollapsed = group.section && collapsedSections.includes(group.section)

          return (
            <div key={group.section || `sec-${idx}`} className="space-y-0.5">
              {/* Section Header (Expanded Mode) */}
              {!collapsed && group.section && (
                <div className="pt-2 pb-0.5">
                  <button
                    type="button"
                    onClick={() => toggleSection(group.section)}
                    className={`w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md transition-colors select-none group/sec outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 ${
                      isDark
                        ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
                    }`}
                    aria-expanded={!isSectionCollapsed}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <ChevronDownIcon
                        className={`w-3 h-3 text-slate-500 transition-transform duration-200 shrink-0 ${
                          isSectionCollapsed ? '-rotate-90' : 'rotate-0'
                        }`}
                      />
                      <span className="truncate">{group.section}</span>
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-normal transition-colors ${
                        isDark
                          ? 'text-slate-500 group-hover/sec:text-slate-400'
                          : 'text-slate-400 group-hover/sec:text-slate-600'
                      }`}
                    >
                      {group.items.length}
                    </span>
                  </button>
                </div>
              )}

              {/* Section Divider (Collapsed Mode) */}
              {collapsed && idx > 0 && (
                <div className="w-6 h-px bg-slate-800/80 mx-auto my-1.5" aria-hidden="true" />
              )}

              {/* Items Container */}
              {(!isSectionCollapsed || collapsed) && (
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavItem
                      key={item.to}
                      {...item}
                      collapsed={collapsed}
                      unreadCount={unreadCount}
                      isDark={isDark}
                      sectionName={group.section}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* ─── Footer: Secondary Actions & User Profile Card ─── */}
      <div
        className={`shrink-0 px-2.5 py-2.5 border-t space-y-1 mt-auto z-10 ${
          isDark ? 'border-slate-800 bg-slate-950' : 'border-[#E6E8EC] bg-white'
        }`}
      >
        {/* Settings link for Admin */}
        {isAdmin && !isPrincipal && (
          <NavLink
            to="/admin/settings"
            className={({ isActive }) =>
              `relative flex items-center gap-2.5 rounded-lg text-xs font-medium transition-all group outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${
                collapsed
                  ? 'w-10 h-9 mx-auto justify-center'
                  : 'px-2.5 py-1.5'
              } ${
                isActive
                  ? isDark
                    ? 'bg-primary-500/15 text-primary-200 font-semibold border border-primary-500/30'
                    : 'bg-primary-50 text-primary-900 font-semibold border border-primary-200/80'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
              }`
            }
          >
            <SettingsIcon className="w-4.5 h-4.5 shrink-0" style={{ width: '1.125rem', height: '1.125rem' }} />
            {!collapsed && <span>Settings</span>}
            {collapsed && (
              <div className="absolute left-[68px] top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 text-white text-xs font-medium rounded-md shadow-xl border border-slate-800 z-50 whitespace-nowrap pointer-events-none">
                Settings
              </div>
            )}
          </NavLink>
        )}

        {/* Teacher/staff substitution preferences */}
        {!isAdmin && !isManager && !isStaff && !isGovernance && (
          <NavLink
            to="/teacher/preferences"
            className={({ isActive }) =>
              `relative flex items-center gap-2.5 rounded-lg text-xs font-medium transition-all group outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${
                collapsed
                  ? 'w-10 h-9 mx-auto justify-center'
                  : 'px-2.5 py-1.5'
              } ${
                isActive
                  ? isDark
                    ? 'bg-primary-500/15 text-primary-200 font-semibold border border-primary-500/30'
                    : 'bg-primary-50 text-primary-900 font-semibold border border-primary-200/80'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
              }`
            }
          >
            <SettingsIcon className="w-4.5 h-4.5 shrink-0" style={{ width: '1.125rem', height: '1.125rem' }} />
            {!collapsed && <span>Preferences</span>}
            {collapsed && (
              <div className="absolute left-[68px] top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 text-white text-xs font-medium rounded-md shadow-xl border border-slate-800 z-50 whitespace-nowrap pointer-events-none">
                Preferences
              </div>
            )}
          </NavLink>
        )}

        {/* Help & Guides Modal Trigger */}
        <button
          type="button"
          onClick={onOpenHelp}
          className={`flex items-center gap-2.5 rounded-lg text-xs font-medium transition-all group relative text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${
            collapsed
              ? 'w-10 h-9 mx-auto justify-center'
              : 'w-full px-2.5 py-1.5'
          } ${
            isDark
              ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          aria-label="Help and Documentation"
        >
          <HelpCircleIcon className="w-4.5 h-4.5 shrink-0" style={{ width: '1.125rem', height: '1.125rem' }} />
          {!collapsed && <span>Help & Guides</span>}
          {collapsed && (
            <div className="absolute left-[68px] top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 text-white text-xs font-medium rounded-md shadow-xl border border-slate-800 z-50 whitespace-nowrap pointer-events-none">
              Help & Guides
            </div>
          )}
        </button>

        {/* User Identity Card */}
        {!collapsed ? (
          <div
            className={`p-2 rounded-xl mt-1.5 flex items-center justify-between border ${
              isDark
                ? 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900'
                : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100/70'
            } transition-colors`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                    isDark
                      ? 'bg-primary-600/15 border border-primary-500/30 text-primary-400'
                      : 'bg-primary-50 border border-primary-200 text-primary-700'
                  }`}
                >
                  {userInitial}
                </div>
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white"
                  title="Online"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate leading-tight text-slate-900">{user?.name}</p>
                <p
                  className={`text-[10px] uppercase font-bold tracking-wider mt-0.5 leading-none ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {user?.role?.replace(/_/g, ' ')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 rounded-lg transition-colors hover:bg-rose-50 text-slate-400 hover:text-rose-600 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogoutIcon className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sign out"
            title="Sign out"
            className="w-10 h-9 mx-auto flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all group relative mt-1 outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50"
          >
            <LogoutIcon className="w-4.5 h-4.5 shrink-0" />
            <div className="absolute left-[68px] top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 text-white text-xs font-medium rounded-md shadow-xl border border-slate-800 z-50 whitespace-nowrap pointer-events-none">
              Sign out
            </div>
          </button>
        )}
      </div>
    </aside>
  )
}
