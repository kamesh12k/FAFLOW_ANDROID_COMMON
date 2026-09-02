import { createContext, useContext, useState, useCallback } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('credits_user')) } catch { return null }
  })
  const [token, setToken] = useState(() => localStorage.getItem('credits_token') || null)

  const login = useCallback((tokenStr, userData) => {
    localStorage.setItem('credits_token', tokenStr)
    localStorage.setItem('credits_user', JSON.stringify(userData))
    setToken(tokenStr)
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('credits_token')
    localStorage.removeItem('credits_user')
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      logout,
      isAdmin: user?.role === 'admin' || user?.role === 'system_admin' || user?.role === 'principal' || user?.role === 'governance',
      isSystemAdmin: user?.role === 'system_admin',
      isPrincipal: user?.role === 'principal',
      isGovernance: user?.role === 'governance',
      isManager: user?.role === 'manager',
      isLabStaff: user?.role === 'lab_staff',
      isNonTeachingStaff: user?.role === 'non_teaching_staff',
      isStaff: user?.role === 'lab_staff' || user?.role === 'non_teaching_staff',
      isSuperAdmin: user?.admin_level === 'super_admin' || user?.role === 'system_admin',
      isSecondaryAdmin: user?.admin_level === 'secondary_admin',
      mustChangeCredentials: !!user?.must_change_credentials,
    }}>


      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
