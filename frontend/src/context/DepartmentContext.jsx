import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { departmentsApi } from '../api/services'

const DepartmentContext = createContext(null)

export function DepartmentProvider({ children }) {
  const { user, isSystemAdmin } = useAuth()
  const [departments, setDepartments] = useState([])
  const [activeDepartmentId, setActiveDepartmentIdState] = useState(() => {
    // System admins can switch departments; persisted across refreshes
    if (isSystemAdmin) {
      const stored = localStorage.getItem('active_department_id')
      return stored ? parseInt(stored, 10) : null
    }
    return null
  })

  const refreshDepartments = useCallback(() => {
    if (isSystemAdmin) {
      return departmentsApi.list(true)
        .then(r => setDepartments(r.data))
        .catch(() => setDepartments([]))
    }
  }, [isSystemAdmin])

  // Fetch departments list for system admin
  useEffect(() => {
    if (!user) return
    if (isSystemAdmin) {
      refreshDepartments()
    } else {
      setDepartments([])
    }
  }, [user, isSystemAdmin, refreshDepartments])

  const setActiveDepartmentId = useCallback((id) => {
    if (id === null || id === undefined || id === '') {
      localStorage.removeItem('active_department_id')
      setActiveDepartmentIdState(null)
    } else {
      const numId = parseInt(id, 10)
      localStorage.setItem('active_department_id', String(numId))
      setActiveDepartmentIdState(numId)
    }
  }, [])

  // The effective department ID: for system_admin, it's the one they selected
  // (null = "all departments" global view). For department admins/teachers,
  // it's their own department_id (already enforced server-side via the JWT).
  const effectiveDepartmentId = isSystemAdmin ? activeDepartmentId : (user?.department_id || null)

  return (
    <DepartmentContext.Provider value={{
      departments,
      refreshDepartments,
      activeDepartmentId,
      effectiveDepartmentId,
      setActiveDepartmentId,
      isSystemAdmin,
      activeDepartmentName: activeDepartmentId
        ? departments.find(d => d.id === activeDepartmentId)?.name || 'Unknown'
        : 'All Departments',
    }}>
      {children}
    </DepartmentContext.Provider>
  )
}

export function useDepartment() {
  const ctx = useContext(DepartmentContext)
  if (!ctx) throw new Error('useDepartment must be used within DepartmentProvider')
  return ctx
}
