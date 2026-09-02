import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { BRAND_CONFIG } from '../../config/branding'
import FacultyFlowLogo from '../../components/brand/FacultyFlowLogo'
import { authApi } from '../../api/services'
import { EyeIcon, EyeOffIcon, Spinner, ShieldCheckIcon, AlertTriangleIcon } from '../../components/icons'

export default function Login() {
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const { app_name, themePreset } = useTheme() || {}
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sessionExpired = searchParams.get('reason') === 'session_expired'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      const { data } = await authApi.login(form)
      login(data.access_token, data.user)
      if (data.user.must_change_credentials) {
        navigate('/first-login-setup')
      } else {
        const role = data.user.role
        if (role === 'principal') {
          navigate('/principal/dashboard')
        } else if (role === 'admin' || role === 'system_admin') {
          navigate('/admin/dashboard')
        } else if (role === 'manager') {
          navigate('/manager/dashboard')
        } else if (role === 'lab_staff' || role === 'non_teaching_staff') {
          navigate('/staff/dashboard')
        } else {
          navigate('/teacher/dashboard')
        }
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid username or password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(79,70,229,0.15),rgba(255,255,255,0))] px-4 py-8 sm:py-12 selection:bg-indigo-500 selection:text-white transition-colors duration-300">
      {/* Top Space / Institution Context Badge */}
      <div className="w-full max-w-md mx-auto flex items-center justify-center">
        {BRAND_CONFIG.clientName && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-800/80 shadow-xs backdrop-blur-md">
            <FacultyFlowLogo variant="mark" size={18} dark />
            <span className="text-[11px] font-bold text-slate-300 tracking-wide truncate max-w-[280px]">
              {BRAND_CONFIG.clientName}
            </span>
          </div>
        )}
      </div>

      {/* Main Login Center Section */}
      <div className="w-full max-w-md mx-auto my-auto py-4">
        {/* Brand Header */}
        <div className="mb-6 sm:mb-8 text-center">
          {/* Logo mark — transparent SVG, no white box, premium glow on dark bg */}
          <div className="relative inline-block mb-4 group">
            <div
              className="absolute inset-0 rounded-2xl blur-2xl opacity-20 scale-150 group-hover:opacity-35 transition-opacity duration-300"
              style={{ background: '#4f46e5' }}
              aria-hidden="true"
            />
            <div className="relative hover:scale-[1.05] transition-transform duration-200">
              <FacultyFlowLogo variant="mark" size={60} dark />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {app_name || BRAND_CONFIG.appName}
          </h1>
          <p className="text-[11px] sm:text-xs font-bold text-indigo-300 uppercase tracking-widest mt-1.5">
            {BRAND_CONFIG.tagline}
          </p>
        </div>

        {/* Enterprise Login Card */}
        <div className="rounded-3xl border border-slate-800/90 bg-slate-900/90 backdrop-blur-xl shadow-2xl p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Sign In to Your Workspace
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              Enter your institutional credentials to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Session Expired Notice */}
            {sessionExpired && (
              <div
                role="alert"
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold"
              >
                <span className="text-sm">⏱</span>
                <span>Your session has expired. Please sign in again.</span>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold animate-fadeIn"
              >
                <AlertTriangleIcon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* Username or Email Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="identifier-input"
                className="block text-xs font-bold text-slate-300 uppercase tracking-wider"
              >
                Username or Email
              </label>
              <div className="relative">
                <input
                  id="identifier-input"
                  name="identifier"
                  type="text"
                  required
                  autoComplete="username"
                  value={form.identifier}
                  onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                  placeholder="e.g. admin or faculty@institution.edu"
                  className="w-full rounded-xl border border-slate-750 bg-slate-950/70 px-4 py-3 text-sm font-medium text-white placeholder:text-slate-500 outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 hover:border-slate-700 min-h-[44px]"
                />
              </div>
            </div>

            {/* Password Input with Visibility Toggle */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password-input"
                  className="block text-xs font-bold text-slate-300 uppercase tracking-wider"
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  id="password-input"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-750 bg-slate-950/70 pl-4 pr-11 py-3 text-sm font-medium text-white placeholder:text-slate-500 outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 hover:border-slate-700 min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOffIcon className="w-5 h-5" />
                  ) : (
                    <EyeIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[46px] flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-bold text-sm transition-all duration-200 shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
              >
                {loading ? (
                  <>
                    <Spinner size="sm" className="border-t-white" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </div>
          </form>

          {/* Security & System Info */}
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <div className="flex items-center gap-1.5">
              <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span>TLS 1.3 Encrypted Session</span>
            </div>
            <span>v5.0 Enterprise</span>
          </div>
        </div>
      </div>

      {/* Footer Copyright */}
      <div className="w-full max-w-md mx-auto text-center pt-4">
        <p className="text-[11px] text-slate-500 font-medium">
          {BRAND_CONFIG.footerText || `© 2026 ${BRAND_CONFIG.appName}. All rights reserved.`}
        </p>
      </div>
    </div>
  )
}
