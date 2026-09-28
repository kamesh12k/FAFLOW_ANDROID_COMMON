import { useState, useEffect, useCallback, useRef } from 'react'
import { teachersApi, classesApi, departmentsApi, roomsApi, subjectsApi } from '../api/services'
import { getApiErrorMessage } from '../api/client'

export function useFetch(fetcher, dependencies = [], options = {}) {
  const [data, setData] = useState(options.initialData ?? [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const abortControllerRef = useRef(null)

  const reload = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const res = await fetcher({ signal: controller.signal })
      setData(res.data || res)
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        return // Superseded or unmounted
      }
      setError(getApiErrorMessage(err))
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, dependencies)

  useEffect(() => {
    reload()
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [reload])

  return { data, loading, error, reload }
}

export function useTeachers() {
  return useFetch((opts) => teachersApi.list(opts))
}

export function useClasses() {
  return useFetch((opts) => classesApi.list(opts))
}

export function useDepartments() {
  return useFetch((opts) => departmentsApi.list(opts))
}

export function useRooms() {
  return useFetch((opts) => roomsApi.list(opts))
}

export function useSubjects() {
  return useFetch((opts) => subjectsApi.list(opts))
}

