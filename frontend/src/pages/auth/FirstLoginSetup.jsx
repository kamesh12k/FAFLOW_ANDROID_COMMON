import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { adminApi } from '../../api/services'
import { ErrorAlert, Spinner } from '../../components/ui'

export default function FirstLoginSetup() {
  const { user, login, logout } = useAuth()
  const navigate = useNavigate()

  const isTeacher = user?.role === 'teacher'

  const [form, setForm] = useState({
    new_username: '',
    new_email: isTeacher ? (user?.email || '') : '',
    new_password: '',
    confirm_password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (form.new_password !== form.confirm_password) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const payload = {
        new_password: form.new_password,
        confirm_password: form.confirm_password,
        ...(isTeacher ? { new_email: form.new_email } : { new_username: form.new_username }),
      }
      const { data } = await adminApi.firstLoginSetup(payload)
      login(data.access_token, data.user)
      const role = data.user.role
      if (role === 'principal') {
        navigate('/principal/dashboard')
      } else if (role === 'admin' || role === 'system_admin') {
        navigate('/admin/dashboard')
      } else if (role === 'manager') {
        navigate('/manager/dashboard')
      } else if (role === 'staff') {
        navigate('/staff/dashboard')
      } else {
        navigate('/teacher/dashboard')
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update credentials.')
    } finally {
      setLoading(false)
    }
  }

  const roleLabel = isTeacher ? 'faculty' : 'account'

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-xl mb-4">
            <svg className="w-6 h-6 text-yellow-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Set your real credentials</h1>
          <p className="text-sm text-gray-500 mt-1">
            {user?.name ? `Welcome, ${user.name}. ` : ''}
            You're signed in with default/temporary credentials. Please choose your own {isTeacher ? 'email address' : 'username'} and
            password before continuing — your {roleLabel} cannot access anything else until you do.
          </p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <ErrorAlert message={error} />
            {isTeacher ? (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Your Email Address</label>
                <input
                  type="email"
                  required
                  className="input"
                  value={form.new_email}
                  onChange={set('new_email')}
                  placeholder="your.name@college.edu"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  You will use this email address to log in.
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">New Username</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  className="input"
                  value={form.new_username}
                  onChange={set('new_username')}
                  placeholder="Choose a unique username (not 'admin')"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">New password</label>
              <input
                type="password"
                required
                minLength={8}
                className="input"
                value={form.new_password}
                onChange={set('new_password')}
                placeholder="At least 8 characters, 1 letter + 1 number"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Confirm password</label>
              <input
                type="password"
                required
                minLength={8}
                className="input"
                value={form.confirm_password}
                onChange={set('confirm_password')}
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <Spinner size="sm" /> : null}
              {loading ? 'Saving…' : 'Save and continue'}
            </button>
            <button type="button" onClick={logout} className="text-xs text-gray-400 hover:text-gray-600 w-full text-center">
              Sign out instead
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
