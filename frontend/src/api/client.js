import axios from 'axios'

const isPort5173 = window.location.port === '5173';
const api = axios.create({
  baseURL: import.meta.env.DEV
    ? '/api'
    : (isPort5173
        ? `${window.location.protocol}//${window.location.hostname}:8000`
        : '/api')
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('credits_token')
  if (token) config.headers.Authorization = `Bearer ${token}`

  // System Admin department workspace context — the backend reads this
  // header in get_tenant_department_id to scope queries to the selected
  // department. When null/absent, system_admin sees everything.
  const deptId = localStorage.getItem('active_department_id')
  if (deptId) config.headers['X-Department-ID'] = deptId

  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      // Only redirect to /login when NOT already there.
      // If the user is on /login, the 401 is from a bad-credentials attempt;
      // let the login page's own catch block handle it and display the error.
      localStorage.removeItem('credits_token')
      localStorage.removeItem('credits_user')
      window.location.href = '/login?reason=session_expired'
    }
    return Promise.reject(err)
  }
)

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
