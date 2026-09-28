import axios from 'axios'

const isPort5173 = window.location.port === '5173';
const api = axios.create({
  baseURL: import.meta.env.DEV
    ? '/api'
    : (isPort5173
        ? `${window.location.protocol}//${window.location.hostname}:8000`
        : '/api'),
  timeout: 30000,
})

// In-memory query cache & in-flight deduplication table
const queryCache = new Map() // key -> { data, timestamp, ttl }
const inFlightRequests = new Map() // key -> Promise

/**
 * Generate a deterministic cache key from request config
 */
function getCacheKey(url, params = {}) {
  const deptId = localStorage.getItem('active_department_id') || 'all'
  const paramStr = JSON.stringify(params, Object.keys(params).sort())
  return `${deptId}:${url}:${paramStr}`
}

/**
 * Invalidate cached entries matching a URL substring or regex
 */
export function invalidateCache(pattern) {
  if (!pattern) {
    queryCache.clear()
    return
  }
  const isRegex = pattern instanceof RegExp
  for (const key of queryCache.keys()) {
    if (isRegex ? pattern.test(key) : key.includes(pattern)) {
      queryCache.delete(key)
    }
  }
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('credits_token')
  if (token) config.headers.Authorization = `Bearer ${token}`

  // System Admin department workspace context
  const deptId = localStorage.getItem('active_department_id')
  if (deptId) config.headers['X-Department-ID'] = deptId

  return config
})

// Retry logic for idempotent requests (GET/HEAD) on transient errors
const MAX_RETRIES = 2
const RETRY_STATUS_CODES = [502, 503, 504]

api.interceptors.response.use(
  (res) => {
    // Invalidate relevant cache on mutations (POST, PUT, PATCH, DELETE)
    const method = res.config.method?.toUpperCase()
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const url = res.config.url || ''
      // Invalidate the entity path (e.g. /classes, /teachers, /leaves)
      const baseEntity = url.split('/')[1] || ''
      if (baseEntity) {
        invalidateCache(`/${baseEntity}`)
      }
    }
    return res
  },
  async (err) => {
    const config = err.config

    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('credits_token')
      localStorage.removeItem('credits_user')
      window.location.href = '/login?reason=session_expired'
      return Promise.reject(err)
    }

    // Auto-retry transient failures for idempotent GET requests
    if (config && config.method?.toUpperCase() === 'GET' && !config._isRetry) {
      config._retryCount = config._retryCount || 0

      const isNetworkError = !err.response && Boolean(err.message)
      const isTransientHttp = err.response && RETRY_STATUS_CODES.includes(err.response.status)

      if ((isNetworkError || isTransientHttp) && config._retryCount < MAX_RETRIES) {
        config._retryCount += 1
        const backoffDelay = Math.min(1000, Math.pow(2, config._retryCount) * 200 + Math.random() * 100)
        await new Promise((resolve) => setTimeout(resolve, backoffDelay))
        return api(config)
      }
    }

    return Promise.reject(err)
  }
)

/**
 * Enhanced GET with in-memory caching and concurrent request deduplication
 * @param {string} url - API endpoint
 * @param {object} config - Axios request config
 * @param {number} ttlMs - Cache duration in milliseconds (default: 15000ms = 15s)
 */
export async function cachedGet(url, config = {}, ttlMs = 15000) {
  const cacheKey = getCacheKey(url, config.params)
  const now = Date.now()

  // 1. Check valid cache entry
  const cached = queryCache.get(cacheKey)
  if (cached && now - cached.timestamp < cached.ttl) {
    return cached.data
  }

  // 2. Check in-flight deduplication
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey)
  }

  // 3. Initiate request with deduplication tracking
  const requestPromise = api.get(url, config)
    .then((res) => {
      queryCache.set(cacheKey, {
        data: res,
        timestamp: Date.now(),
        ttl: ttlMs,
      })
      return res
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey)
    })

  inFlightRequests.set(cacheKey, requestPromise)
  return requestPromise
}

export function getApiErrorMessage(err, fallbackMessage = 'An unexpected error occurred.') {
  if (!err) return fallbackMessage
  const detail = err.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object') {
    if (detail.title) return detail.title
    if (detail.reason) return detail.reason
    if (detail.message) return detail.message
  }
  if (err.message) return err.message
  return fallbackMessage
}

export default api

