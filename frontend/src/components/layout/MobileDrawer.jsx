import { useEffect, useState, useMemo, useCallback } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  ADMIN_NAV,
  TEACHER_NAV,
  SYSTEM_ADMIN_NAV,
  PRINCIPAL_NAV,
  MANAGER_NAV,
  STAFF_NAV,
  GOVERNANCE_NAV,
} from './navConfig'
import { announcementApi } from '../../api/announcements'
import {
  SettingsIcon,
  LogoutIcon,
  CloseIcon,
  HelpCircleIcon,
  ChevronDownIcon,
} from '../icons'
import FacultyFlowLogo from '../brand/FacultyFlowLogo'
import { BRAND_CONFIG } from '../../config/branding'
import { useTheme } from '../../context/ThemeContext'

export default function MobileDrawer({ open, onClose, onOpenHelp }) {
  const { user, isAdmin, isSystemAdmin, isPrincipal, isGovernance, isManager, isStaff, logout } = useAuth()
  const { app_name } = useTheme() || {}
  const navigate = useNavigate()
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)

  // Collapsed sections management
  const [collapsedSections, setCollapsedSections] = useState([])

  useEffect(() => {
    if (!open || !user) return
    announcementApi.getUnreadCount()
      .then((res) => setUnreadCount(res.data?.count || 0))
      .catch(() => {})
  }, [open, user])

  // Resolve navigation hierarchy for active user
  const nav = useMemo(() => {
    if (isGovernance) return GOVERNANCE_NAV
    if (isSystemAdmin) return SYSTEM_ADMIN_NAV
    if (isPrincipal) return PRINCIPAL_NAV
    if (isManager) return MANAGER_NAV
    if (isStaff) return STAFF_NAV
    if (isAdmin) return ADMIN_NAV
    return TEACHER_NAV
  }, [isGovernance, isSystemAdmin, isPrincipal, isManager, isStaff, isAdmin])

  // Toggle collapsible section
  const toggleSection = useCallback((sectionTitle) => {
    setCollapsedSections((prev) =>
      prev.includes(sectionTitle) ? prev.filter((s) => s !== sectionTitle) : [...prev, sectionTitle]
    )
  }, [])

  // Auto-expand section containing active path
  useEffect(() => {
    const currentPath = location.pathname
    for (const group of nav) {
      if (group.section && collapsedSections.includes(group.section)) {
        const hasActiveItem = group.items.some((item) => {
          if (item.end) return item.to === currentPath
          return currentPath.startsWith(item.to)
        })
        if (hasActiveItem) {
          setCollapsedSections((prev) => prev.filter((s) => s !== group.section))
        }
      }
    }
  }, [location.pathname, nav, collapsedSections])

  // Close drawer on Escape key
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const handleLogout = () => {
    logout()
    navigate('/login')
    onClose()
  }

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U'

  return (
    <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Navigation menu">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className="absolute inset-y-0 right-0 w-80 max-w-[85vw] bg-slate-950 text-white flex flex-col shadow-2xl border-l border-slate-800"
        style={{ animation: 'mobileDrawerSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Drawer header */}
        <div className="h-14 px-4 border-b border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-950">
          <div className="flex items-center gap-2.5 min-w-0">
            <FacultyFlowLogo variant="mark" size={24} />
            <p className="font-bold text-sm tracking-tight truncate">
              {app_name || BRAND_CONFIG.appName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="Close menu"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="px-4 py-3 border-b border-slate-800/60 bg-slate-900/40 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-lg bg-primary-600/20 border border-primary-500/30 text-primary-400 flex items-center justify-center text-xs font-bold">
                {userInitial}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-slate-950" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate leading-tight">{user?.name}</p>
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-0.5 leading-none">
                {user?.role?.replace(/_/g, ' ')}
              </p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav
          className="flex-1 min-h-0 px-3 py-3 space-y-3 overflow-y-auto sidebar-scrollbar overscroll-contain"
          aria-label="Mobile Navigation"
        >
          {nav.map((group, idx) => {
            const isCollapsed = group.section && collapsedSections.includes(group.section)

            return (
              <div key={group.section || `sec-${idx}`} className="space-y-0.5">
                {group.section && (
                  <button
                    type="button"
                    onClick={() => toggleSection(group.section)}
                    className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors select-none"
                    aria-expanded={!isCollapsed}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <ChevronDownIcon
                        className={`w-3 h-3 text-slate-500 transition-transform duration-200 shrink-0 ${
                          isCollapsed ? '-rotate-90' : 'rotate-0'
                        }`}
                      />
                      <span className="truncate">{group.section}</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {group.items.length}
                    </span>
                  </button>
                )}

                {!isCollapsed && (
                  <div className="space-y-0.5">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `relative flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group ${
                            isActive
                              ? 'bg-primary-500/15 text-primary-200 font-semibold border border-primary-500/30 shadow-2xs'
                              : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && (
                              <span
                                className="absolute left-0.5 top-1.5 bottom-1.5 w-1 rounded-full bg-primary-500"
                                aria-hidden="true"
                              />
                            )}
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className={`w-4.5 h-4.5 shrink-0 ${
                                  isActive ? 'text-primary-400' : 'text-slate-400 group-hover:text-slate-200'
                                }`}
                              >
                                {item.icon}
                              </span>
                              <span className="truncate">{item.label}</span>
                            </div>
                            {item.to === '/announcements' && unreadCount > 0 && (
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white shrink-0 shadow-2xs">
                                {unreadCount > 99 ? '99+' : unreadCount}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Drawer footer */}
        <div className="px-3 border-t border-slate-800/80 py-3 space-y-1 shrink-0 bg-slate-950 pb-[max(20px,env(safe-area-inset-bottom))]">
          {isAdmin && !isPrincipal && (
            <NavLink
              to="/admin/settings"
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-500/15 text-primary-200 font-semibold border border-primary-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              <SettingsIcon className="w-4.5 h-4.5 shrink-0" />
              <span>Settings</span>
            </NavLink>
          )}

          {!isAdmin && !isManager && !isStaff && (
            <NavLink
              to="/teacher/preferences"
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-500/15 text-primary-200 font-semibold border border-primary-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              <SettingsIcon className="w-4.5 h-4.5 shrink-0" />
              <span>Substitution Preferences</span>
            </NavLink>
          )}

          <button
            type="button"
            onClick={() => {
              onClose()
              if (onOpenHelp) onOpenHelp()
            }}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors text-left"
          >
            <HelpCircleIcon className="w-4.5 h-4.5 shrink-0" />
            <span>Help & Guides</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <LogoutIcon className="w-4.5 h-4.5 shrink-0" />
            <span>Sign out</span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes mobileDrawerSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
