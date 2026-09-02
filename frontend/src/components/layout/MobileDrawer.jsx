import { useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ADMIN_NAV, TEACHER_NAV, SYSTEM_ADMIN_NAV, PRINCIPAL_NAV, MANAGER_NAV, STAFF_NAV, GOVERNANCE_NAV } from './navConfig'
import { SettingsIcon, LogoutIcon, CloseIcon } from '../icons'

export default function MobileDrawer({ open, onClose }) {
  const { user, isAdmin, isSystemAdmin, isPrincipal, isGovernance, isManager, isStaff, logout } = useAuth()
  const navigate = useNavigate()

  
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

  const handleLogout = () => { logout(); navigate('/login'); onClose() }

  return (
    <div className="lg:hidden fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Navigation menu">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" 
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer panel — slides in from right */}
      <div className="absolute inset-y-0 right-0 w-72 max-w-[88vw] bg-primary-900 flex flex-col shadow-2xl"
        style={{ animation: 'mobileDrawerSlideIn 0.2s cubic-bezier(0.25,0.46,0.45,0.94)' }}
      >
        {/* Drawer header */}
        <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">{user?.name}</p>
            <p className="text-primary-100/50 text-xs capitalize">{user?.role?.replace('_', ' ')}</p>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors shrink-0 ml-2"
            aria-label="Close menu"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto" aria-label="Main navigation">
          {nav.map((group, i) => (
            <div key={i}>
              {group.section && (
                <p className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-200/90">
                  {group.section}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                        isActive ? 'bg-primary-600 text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'
                      }`
                    }
                  >
                    <span className="w-5 h-5 shrink-0">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Drawer footer */}
        <div className="px-3 border-t border-white/10 pt-3 space-y-0.5 shrink-0 pb-[max(24px,env(safe-area-inset-bottom))]">
          {isAdmin && !isPrincipal && (
            <NavLink
              to="/admin/settings"
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? 'bg-primary-600 text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`
              }
            >
              <SettingsIcon className="w-5 h-5 shrink-0" />
              <span>Settings</span>
            </NavLink>
          )}
          {!isAdmin && !isManager && !isStaff && (
            <NavLink
              to="/teacher/preferences"
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? 'bg-primary-600 text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`
              }
            >
              <SettingsIcon className="w-5 h-5 shrink-0" />
              <span>Substitution Preferences</span>
            </NavLink>
          )}

          <button 
            onClick={handleLogout} 
            className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <LogoutIcon className="w-5 h-5 shrink-0" />
            Sign out
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
