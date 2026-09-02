import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute() {
  const { token, user } = useAuth()
  return (token && user) ? <Outlet /> : <Navigate to="/login" replace />
}

export function GovernanceRoute() {
  const { token, user, isGovernance, isSystemAdmin } = useAuth()
  if (!token || !user) return <Navigate to="/login" replace />
  if (!isGovernance && !isSystemAdmin) return <Navigate to="/login" replace />
  return <Outlet />
}

export function AdminRoute() {
  const { token, user, isAdmin, isPrincipal } = useAuth()
  if (!token || !user) return <Navigate to="/login" replace />
  if (isPrincipal) return <Navigate to="/principal/dashboard" replace />
  if (!isAdmin) return <Navigate to="/teacher/dashboard" replace />
  return <Outlet />
}

export function SystemAdminRoute() {
  const { token, user, isSystemAdmin } = useAuth()
  if (!token || !user) return <Navigate to="/login" replace />
  if (!isSystemAdmin) return <Navigate to="/admin/dashboard" replace />
  return <Outlet />
}

export function PrincipalRoute() {
  const { token, user, isPrincipal } = useAuth()
  if (!token || !user) return <Navigate to="/login" replace />
  if (!isPrincipal) return <Navigate to="/login" replace />
  return <Outlet />
}

export function ManagerRoute() {
  const { token, user, isManager } = useAuth()
  if (!token || !user) return <Navigate to="/login" replace />
  if (!isManager) return <Navigate to="/login" replace />
  return <Outlet />
}

export function StaffRoute() {
  const { token, user, isStaff, isManager, isAdmin } = useAuth()
  if (!token || !user) return <Navigate to="/login" replace />
  if (!isStaff && !isManager && !isAdmin) return <Navigate to="/login" replace />
  return <Outlet />
}


export function TeacherRoute() {
  const { token, user, isPrincipal, isGovernance, isManager, isStaff, isAdmin } = useAuth()
  if (!token || !user) return <Navigate to="/login" replace />
  if (isGovernance) return <Navigate to="/governance" replace />
  if (isPrincipal) return <Navigate to="/principal/dashboard" replace />
  if (isManager) return <Navigate to="/manager/dashboard" replace />
  if (isStaff) return <Navigate to="/staff/dashboard" replace />
  return <Outlet />
}


export function GuestRoute() {
  const { token, user, isAdmin, isPrincipal, isGovernance, isManager, isStaff, mustChangeCredentials } = useAuth()
  if (!token || !user) return <Outlet />
  if (mustChangeCredentials) return <Navigate to="/first-login-setup" replace />
  if (isGovernance) return <Navigate to="/governance" replace />
  if (isPrincipal) return <Navigate to="/principal/dashboard" replace />
  if (isManager) return <Navigate to="/manager/dashboard" replace />
  if (isStaff) return <Navigate to="/staff/dashboard" replace />
  return <Navigate to={isAdmin ? '/admin/dashboard' : '/teacher/dashboard'} replace />
}

/** Sits between AdminRoute/TeacherRoute/ManagerRoute/StaffRoute and AppShell. Bounces anyone still
 * on default/reset credentials to the forced setup screen before they can
 * reach any dashboard route. */
export function RequireCredentialsSet() {
  const { mustChangeCredentials } = useAuth()
  if (mustChangeCredentials) return <Navigate to="/first-login-setup" replace />
  return <Outlet />
}

/** The setup screen itself: needs a token, but is the one place explicitly
 * exempt from the credentials gate (and irrelevant once credentials are
 * already set, so it bounces forward instead of back). */
export function FirstLoginSetupRoute() {
  const { token, user, isAdmin, isPrincipal, isGovernance, isManager, isStaff, mustChangeCredentials } = useAuth()
  if (!token || !user) return <Navigate to="/login" replace />
  if (!mustChangeCredentials) {
    if (isGovernance) return <Navigate to="/governance" replace />
    if (isPrincipal) return <Navigate to="/principal/dashboard" replace />
    if (isManager) return <Navigate to="/manager/dashboard" replace />
    if (isStaff) return <Navigate to="/staff/dashboard" replace />
    return <Navigate to={isAdmin ? '/admin/dashboard' : '/teacher/dashboard'} replace />
  }
  return <Outlet />
}



