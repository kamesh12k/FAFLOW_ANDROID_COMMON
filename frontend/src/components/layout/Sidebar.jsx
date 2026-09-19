import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import FacultyFlowLogo from '../brand/FacultyFlowLogo'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useDepartment } from '../../context/DepartmentContext'
import { BRAND_CONFIG } from '../../config/branding'
import { announcementApi } from '../../api/announcements'
import { SettingsIcon, LogoutIcon, ChevronDownIcon } from '../icons'
import { ADMIN_NAV, TEACHER_NAV, SYSTEM_ADMIN_NAV, PRINCIPAL_NAV, MANAGER_NAV, STAFF_NAV, GOVERNANCE_NAV } from './navConfig'

function NavItem({ to, icon, label, end, collapsed, unreadCount }) {
  const isAnnouncement = to === '/announcements'
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all group relative ${
          isActive
            ? 'bg-primary-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
        }`
      }
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-5 h-5 shrink-0 transition-transform group-hover:scale-105">{icon}</span>
        {!collapsed && <span className="truncate">{label}</span>}
      </div>

      {isAnnouncement && unreadCount > 0 && (
        <span className={`${collapsed ? 'absolute top-1 right-1' : ''} px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white shrink-0`}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}

      {/* Collapsed Tooltip */}
      {collapsed && (
        <div className="absolute left-16 top-1/2 -translate-y-1/2 ml-2 px-3 py-1.5 bg-slate-900 text-white text-[11px] font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-lg border border-slate-800 z-50 whitespace-nowrap flex items-center gap-2">
          <span>{label}</span>
          {isAnnouncement && unreadCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-600 text-white">
              {unreadCount}
            </span>
          )}
        </div>
      )}
    </NavLink>
  )
}

export default function Sidebar() {
  const { user, isAdmin, isSystemAdmin, isPrincipal, isGovernance, isManager, isStaff, logout } = useAuth()
  const { app_name, themePreset } = useTheme() || {}
  const { departments, activeDepartmentId, setActiveDepartmentId, activeDepartmentName } = useDepartment()
  const navigate = useNavigate()

  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('faflow_sidebar_collapsed') === 'true'
  })
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false)
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

  const toggleCollapse = () => {
    const nextVal = !collapsed
    setCollapsed(nextVal)
    localStorage.setItem('faflow_sidebar_collapsed', String(nextVal))
  }

  let nav = TEACHER_NAV
  if (isGovernance) {
    nav = GOVERNANCE_NAV
  } else if (isSystemAdmin) {
    nav = SYSTEM_ADMIN_NAV
  } else if (isPrincipal) {
    nav = PRINCIPAL_NAV
  } else if (isManager) {
    nav = MANAGER_NAV
  } else if (isStaff) {
    nav = STAFF_NAV
  } else if (isAdmin) {
    nav = ADMIN_NAV
  }

  const handleLogout = () => { logout(); navigate('/login') }

  const isDark = themePreset?.sidebarStyle === 'dark'

  const sidebarCls = isDark
    ? 'bg-slate-950 border-slate-800 text-white'
    : 'bg-white border-slate-100 text-slate-800'

  return (
    <aside className={`hidden lg:flex shrink-0 border-r sticky top-0 h-screen max-h-screen overflow-hidden flex-col transition-all duration-300 ${collapsed ? 'w-[76px]' : 'w-64'} ${sidebarCls}`}>
      {/* Sidebar Header */}
      <div className={`shrink-0 px-4 py-4 border-b flex items-center justify-between gap-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <FacultyFlowLogo variant="mark" size={30} />
            <p className="font-extrabold text-base tracking-tight truncate">{app_name || BRAND_CONFIG.appName}</p>
          </div>
        )}
        {collapsed && (
          <span className="mx-auto cursor-pointer" onClick={toggleCollapse} title="Expand sidebar">
            <FacultyFlowLogo variant="mark" size={28} />
          </span>
        )}
        {!collapsed && (
          <button
            onClick={toggleCollapse}
            aria-label="Collapse sidebar"
            className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Workspace / Department Switcher (System Admin only) */}
      {!collapsed && isSystemAdmin && departments.length > 0 && (
        <div className="shrink-0 px-4 py-3 relative border-b border-slate-100">
          <button
            onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
              isDark
                ? 'bg-slate-900/50 border-slate-800 text-slate-200 hover:bg-slate-900'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <FacultyFlowLogo variant="mark" size={18} />
              <span className="truncate">{activeDepartmentName || 'All Departments'}</span>
            </div>
            <ChevronDownIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>

          {showWorkspaceMenu && (
            <div className={`absolute left-4 right-4 z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border shadow-xl p-1.5 space-y-0.5 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <button
                onClick={() => { setActiveDepartmentId(null); setShowWorkspaceMenu(false) }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeDepartmentId === null
                    ? 'bg-primary-600 text-white'
                    : isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                All Departments
              </button>
              {departments.map(dept => (
                <button
                  key={dept.id}
                  onClick={() => { setActiveDepartmentId(dept.id); setShowWorkspaceMenu(false) }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all truncate ${
                    activeDepartmentId === dept.id
                      ? 'bg-primary-600 text-white'
                      : isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {dept.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 min-h-0 px-3 py-4 space-y-5 overflow-y-auto overflow-x-hidden sidebar-scrollbar overscroll-contain">
        {nav.map((group, i) => (
          <div key={i} className="space-y-1">
            {!collapsed && group.section && (
              <p className={`px-3.5 pb-1 text-[10px] font-bold uppercase tracking-widest ${
                isDark ? 'text-slate-500' : 'text-slate-400'
              }`}>{group.section}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem key={item.to} {...item} collapsed={collapsed} unreadCount={unreadCount} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={`shrink-0 px-3 pb-5 border-t pt-3 space-y-1 mt-auto z-10 ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-100 bg-white'}`}>

        {/* Expand button when collapsed */}
        {collapsed && (
          <button
            onClick={toggleCollapse}
            aria-label="Expand sidebar"
            className={`w-full flex items-center justify-center p-2 rounded-xl transition-all mb-1 ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Settings link */}
        {isAdmin && !isPrincipal && (
          <NavLink
            to="/admin/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all group relative ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : `${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`
              }`
            }
          >
            <SettingsIcon className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Settings</span>}
            {collapsed && (
              <div className="absolute left-16 top-1/2 -translate-y-1/2 ml-2 px-3 py-1.5 bg-slate-900 text-white text-[11px] font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-lg border border-slate-800 z-50 whitespace-nowrap">
                Settings
              </div>
            )}
          </NavLink>
        )}

        {/* Teacher/staff preferences */}
        {!isAdmin && !isManager && !isStaff && !isGovernance && (
          <NavLink
            to="/teacher/preferences"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all group relative ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : `${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`
              }`
            }
          >
            <SettingsIcon className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Preferences</span>}
            {collapsed && (
              <div className="absolute left-16 top-1/2 -translate-y-1/2 ml-2 px-3 py-1.5 bg-slate-900 text-white text-[11px] font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-lg border border-slate-800 z-50 whitespace-nowrap">
                Preferences
              </div>
            )}
          </NavLink>
        )}

        {/* User identity card */}
        {!collapsed ? (
          <div className={`px-3 py-2.5 rounded-xl mt-1 flex items-center justify-between border ${
            isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-100'
          }`}>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate">{user?.name}</p>
              <p className={`text-[10px] uppercase font-bold tracking-wider mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {user?.role?.replace(/_/g, ' ')}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg transition-colors hover:bg-rose-500/10 text-slate-400 hover:text-rose-500"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogoutIcon className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            aria-label="Sign out"
            className="w-full flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all group relative"
          >
            <LogoutIcon className="w-5 h-5 shrink-0" />
            <div className="absolute left-16 top-1/2 -translate-y-1/2 ml-2 px-3 py-1.5 bg-slate-900 text-white text-[11px] font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-lg border border-slate-800 z-50 whitespace-nowrap">
              Sign out
            </div>
          </button>
        )}
      </div>
    </aside>
  )
}
