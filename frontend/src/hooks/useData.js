import { useState, useEffect, useCallback } from 'react'
import { teachersApi, classesApi, departmentsApi, roomsApi, subjectsApi } from '../api/services'
import { getApiErrorMessage } from '../api/client'

export function useFetch(fetcher, dependencies = []) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetcher()
      setData(res.data || res)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, dependencies)

  useEffect(() => {
    reload()
  }, [reload])

  return { data, loading, error, reload }
}

export function useTeachers() {
  return useFetch(() => teachersApi.list())
}

export function useClasses() {
  return useFetch(() => classesApi.list())
}

export function useDepartments() {
  return useFetch(() => departmentsApi.list())
}

export function useRooms() {
  return useFetch(() => roomsApi.list())
}

export function useSubjects() {
  return useFetch(() => subjectsApi.list())
}
