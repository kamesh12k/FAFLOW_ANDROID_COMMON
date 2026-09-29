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
import { RoleBadge } from '../ui'
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
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className="absolute inset-y-0 right-0 w-80 max-w-[85vw] bg-white text-slate-800 flex flex-col shadow-dialog border-l border-[#E6E8EC]"
        style={{ animation: 'mobileDrawerSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Drawer header */}
        <div className="h-14 px-4 border-b border-[#E6E8EC] flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <FacultyFlowLogo variant="mark" size={24} />
            <p className="font-bold text-sm text-slate-900 tracking-tight truncate">
              {app_name || BRAND_CONFIG.appName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            aria-label="Close menu"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* User Identity Card */}
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-lg bg-primary-50 border border-primary-200 text-primary-700 flex items-center justify-center text-xs font-bold">
                {userInitial}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 truncate leading-tight">{user?.name}</p>
              <div className="mt-1">
                <RoleBadge role={user?.role} className="text-[10px] py-0 px-2" />
              </div>
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
                    className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 transition-colors select-none"
                    aria-expanded={!isCollapsed}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <ChevronDownIcon
                        className={`w-3 h-3 text-slate-400 transition-transform duration-200 shrink-0 ${
                          isCollapsed ? '-rotate-90' : 'rotate-0'
                        }`}
                      />
                      <span className="truncate">{group.section}</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
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
                          `relative flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all group ${
                            isActive
                              ? 'bg-primary-50 text-primary-700 font-bold border border-primary-200/80 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && (
                              <span
                                className="absolute left-0 top-1 bottom-1 w-1 rounded-r-full bg-primary-600"
                                aria-hidden="true"
                              />
                            )}
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className={`w-4.5 h-4.5 shrink-0 flex items-center justify-center [&>svg]:w-4.5 [&>svg]:h-4.5 [&>svg]:shrink-0 ${
                                  isActive ? 'text-primary-600' : 'text-slate-500 group-hover:text-slate-800'
                                }`}
                              >
                                {item.icon}
                              </span>
                              <span className="truncate">{item.label}</span>
                            </div>
                            {item.to === '/announcements' && unreadCount > 0 && (
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-600 text-white shrink-0 shadow-2xs">
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
        <div className="px-3 border-t border-[#E6E8EC] py-3 space-y-1 shrink-0 bg-white pb-[max(20px,env(safe-area-inset-bottom))]">
          {isAdmin && !isPrincipal && (
            <NavLink
              to="/admin/settings"
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 font-bold border border-primary-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`
              }
            >
              <SettingsIcon className="w-4.5 h-4.5 shrink-0 text-slate-500" style={{ width: '1.125rem', height: '1.125rem' }} />
              <span>Settings</span>
            </NavLink>
          )}

          {!isAdmin && !isManager && !isStaff && (
            <NavLink
              to="/teacher/preferences"
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 font-bold border border-primary-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`
              }
            >
              <SettingsIcon className="w-4.5 h-4.5 shrink-0 text-slate-500" style={{ width: '1.125rem', height: '1.125rem' }} />
              <span>Substitution Preferences</span>
            </NavLink>
          )}

          <button
            type="button"
            onClick={() => {
              onClose()
              if (onOpenHelp) onOpenHelp()
            }}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-colors text-left"
          >
            <HelpCircleIcon className="w-4.5 h-4.5 shrink-0 text-slate-500" style={{ width: '1.125rem', height: '1.125rem' }} />
            <span>Help & Guides</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogoutIcon className="w-4.5 h-4.5 shrink-0 text-rose-500" style={{ width: '1.125rem', height: '1.125rem' }} />
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
