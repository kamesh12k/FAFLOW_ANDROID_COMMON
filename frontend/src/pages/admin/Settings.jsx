import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useDepartment } from '../../context/DepartmentContext'
import { adminApi, campusOperationsApi, teachersModeApi, timetableApi, teachersApi, departmentsApi } from '../../api/services'
import { Spinner, ErrorAlert, EmptyState, Modal } from '../../components/ui'
import { SparklesIcon } from '../../components/icons'

/* ── Local icon set (outline, matches SparklesIcon's line weight) ───────── */
function UsersIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
      <circle cx="10" cy="7" r="4" />
      <path d="M22 20v-1a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
function ShieldIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z" />
      <path d="M9.5 12l1.8 1.8L15 10" />
    </svg>
  )
}
function HistoryIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 8v4l3 2" />
    </svg>
  )
}
function AlertTriangleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 9v4" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 17h.01" />
    </svg>
  )
}
function CheckCircleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="M22 4 12 14.01l-3-3" />
    </svg>
  )
}
function PlusIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

/* ── Shared building blocks ───────────────────────────────────────────── */
function SettingsSection({ icon: Icon, tint, title, description, action, children }) {
  return (
    <section className="rounded-[28px] bg-white border border-gray-100 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="flex items-start gap-3.5 px-6 pt-6 pb-5">
        <div className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center ${tint}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-gray-900 tracking-tight">{title}</h2>
            {action}
          </div>
          {description && <p className="text-[13px] text-gray-500 mt-1 leading-snug">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-300 ease-out focus:outline-none ${checked ? 'bg-primary-600' : 'bg-gray-200'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ease-out ${checked ? 'translate-x-6' : 'translate-x-1'
          }`}
      />
    </button>
  )
}

const btnPrimary = 'inline-flex items-center justify-center rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 active:scale-[0.98] transition disabled:opacity-40 disabled:pointer-events-none'
const btnSecondary = 'inline-flex items-center justify-center rounded-full bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 active:scale-[0.98] transition'
const btnDanger = 'inline-flex items-center justify-center rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 active:scale-[0.98] transition disabled:opacity-40 disabled:pointer-events-none'
const inputCls = 'w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition'
const labelCls = 'block text-xs font-medium text-gray-700 mb-1.5'

/* ── Campus Operations Mode ──────────────────────────────────────────── */
const MODE_INFO = {
  manual: {
    label: 'Manual',
    description: 'You handle every leave approval and substitute assignment yourself. The system makes no recommendations and takes no automatic action.',
  },
  assisted: {
    label: 'Assisted',
    description: 'The system ranks substitute candidates by current workload (today\'s periods and this week\'s periods) when you open the assign-substitute panel. You always click to approve — nothing happens automatically.',
  },
  autonomous: {
    label: 'Autonomous',
    description: 'The moment a leave is approved, the system immediately assigns the best eligible substitute with no click required. It will never assign a teacher who is on leave, already teaching, has opted out, or is over their weekly cap — but it does act without waiting for you. You can still override, undo, or lock any assignment afterward.',
  },
}

function CampusOperationsModePanel({ isSuperAdmin, modeConfig, onModeChange, loading }) {
  const { activeDepartmentId, activeDepartmentName } = useDepartment()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmMode, setConfirmMode] = useState(null)

  const applyMode = async (newMode) => {
    setError('')
    setSaving(true)
    try {
      await onModeChange(newMode)
      setConfirmMode(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to change mode.')
    } finally {
      setSaving(false)
    }
  }

  const handleSelect = (newMode) => {
    if (newMode === modeConfig.configured_mode) return
    if (newMode === 'autonomous') {
      setConfirmMode(newMode)
    } else {
      applyMode(newMode)
    }
  }

  const title = activeDepartmentId
    ? `Campus Operations Mode (${activeDepartmentName})`
    : "Default Campus Operations Mode"

  const description = activeDepartmentId
    ? `Controls how much the system does automatically for ${activeDepartmentName} leaves`
    : "Controls the default fallback mode when a department has not set its own mode"

  return (
    <SettingsSection
      icon={SparklesIcon}
      tint="bg-indigo-50 text-indigo-600"
      title={title}
      description={description}
    >
      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (
        <>
          {error && <div className="px-6 pb-3"><ErrorAlert message={error} /></div>}
          
          {modeConfig.is_overridden && (
            <div className="mx-6 mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800 text-[13px] leading-snug flex items-start gap-2.5">
              <AlertTriangleIcon className="w-4.5 h-4.5 shrink-0 text-amber-500 mt-0.5" />
              <div>
                <span className="font-semibold">System-wide Override Active:</span> All departments are currently forced to <span className="font-semibold capitalize">{modeConfig.global_override}</span> mode by the system administrator. Your department settings are overridden.
              </div>
            </div>
          )}

          <div className="border-t border-gray-100 divide-y divide-gray-100 mt-4">
            {Object.entries(MODE_INFO).map(([value, info]) => {
              const active = modeConfig.configured_mode === value
              return (
                <button
                  key={value}
                  onClick={() => isSuperAdmin && handleSelect(value)}
                  disabled={!isSuperAdmin || saving}
                  className={`w-full flex items-start gap-3 px-6 py-4 text-left transition-colors ${active ? 'bg-primary-50/70' : 'hover:bg-gray-50'
                    } ${!isSuperAdmin ? 'cursor-default' : ''} disabled:opacity-60`}
                >
                  <span
                    className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${active ? 'border-primary-600 bg-primary-600' : 'border-gray-300'
                      }`}
                  >
                    {active && <span className="w-2 h-2 rounded-full bg-white" />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-semibold ${active ? 'text-primary-700' : 'text-gray-800'}`}>{info.label}</span>
                      {active && (
                        <span className="text-[11px] font-semibold text-primary-600 bg-primary-100 px-2.5 py-0.5 rounded-full shrink-0">
                          {modeConfig.is_overridden ? 'Configured' : 'Active'}
                        </span>
                      )}
                    </span>
                    <span className="block text-[13px] text-gray-500 mt-0.5 leading-snug">{info.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
          {!isSuperAdmin && (
            <p className="px-6 py-3 text-xs text-gray-400 border-t border-gray-100 bg-gray-50/60">Only an Admin can change this setting.</p>
          )}
        </>
      )}

      <Modal open={!!confirmMode} onClose={() => setConfirmMode(null)} title="Switch to Autonomous mode?">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            From now on, approving a leave will immediately assign a substitute with no
            approval click — the system will pick the best eligible teacher on its own.
            You can still override, undo, or lock any assignment afterward, and you can
            switch back to Manual or Assisted at any time.
          </p>
          <div className="flex gap-2.5">
            <button onClick={() => setConfirmMode(null)} className={`${btnSecondary} flex-1`}>Cancel</button>
            <button onClick={() => applyMode('autonomous')} disabled={saving} className={`${btnPrimary} flex-1`}>
              {saving ? 'Switching…' : 'Switch to Autonomous'}
            </button>
          </div>
        </div>
      </Modal>
    </SettingsSection>
  )
}

const OVERRIDE_INFO = {
  none: {
    label: 'No Override',
    description: 'Each department operates in its own configured campus mode.',
  },
  manual: {
    label: 'Force Manual',
    description: 'System-wide override. All departments are forced to Manual mode. HODs cannot automate substitutions.',
  },
  assisted: {
    label: 'Force Assisted',
    description: 'System-wide override. All departments are forced to Assisted mode.',
  },
  autonomous: {
    label: 'Force Autonomous',
    description: 'System-wide override. All departments are forced to Autonomous mode. Substitutions are automated system-wide.',
  },
}

function GlobalOverridePanel({ isSystemAdmin, globalOverride, onOverrideChange }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSelect = async (newOverride) => {
    if (newOverride === globalOverride) return
    setError('')
    setSaving(true)
    try {
      await onOverrideChange(newOverride)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update system-wide override.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsSection
      icon={ShieldIcon}
      tint="bg-rose-50 text-rose-600"
      title="System-wide Mode Override"
      description="Forces all departments to run in a single operations mode, overriding individual department settings"
    >
      {error && <div className="px-6 pb-3"><ErrorAlert message={error} /></div>}
      <div className="border-t border-gray-100 divide-y divide-gray-100">
        {Object.entries(OVERRIDE_INFO).map(([value, info]) => {
          const active = globalOverride === value
          return (
            <button
              key={value}
              onClick={() => isSystemAdmin && handleSelect(value)}
              disabled={!isSystemAdmin || saving}
              className={`w-full flex items-start gap-3 px-6 py-4 text-left transition-colors ${active ? 'bg-rose-50/40' : 'hover:bg-gray-50'
                } ${!isSystemAdmin ? 'cursor-default' : ''} disabled:opacity-60`}
            >
              <span
                className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${active ? 'border-rose-500 bg-rose-500' : 'border-gray-300'
                  }`}
              >
                {active && <span className="w-2 h-2 rounded-full bg-white" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-semibold ${active ? 'text-rose-700' : 'text-gray-800'}`}>{info.label}</span>
                  {active && (
                    <span className="text-[11px] font-semibold text-rose-600 bg-rose-100 px-2.5 py-0.5 rounded-full shrink-0">Active</span>
                  )}
                </span>
                <span className="block text-[13px] text-gray-500 mt-0.5 leading-snug">{info.description}</span>
              </span>
            </button>
          )
        })}
      </div>
    </SettingsSection>
  )
}

/* ── Teacher Self-Management ─────────────────────────────────────────── */
function TeachersModeSettings({ isSuperAdmin, campusMode }) {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    teachersModeApi.getConfig()
      .then(r => {
        setEnabled(r.data.teacher_self_management_enabled)
      })
      .catch(err => {
        setError(err.response?.data?.detail || 'Failed to load teacher settings.')
      })
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async (val) => {
    setError('')
    setSuccess(false)
    setSaving(true)
    try {
      const { data } = await teachersModeApi.updateConfig({ teacher_self_management_enabled: val })
      setEnabled(data.teacher_self_management_enabled)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update settings.')
    } finally {
      setSaving(false)
    }
  }

  const isBypassed = campusMode === 'autonomous'

  return (
    <SettingsSection
      icon={UsersIcon}
      tint="bg-blue-50 text-blue-600"
      title="Teacher Self-Management"
      description="Allows teachers to manage substitute assignments for their own approved leaves"
    >
      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (
        <div className="px-6 pb-6 space-y-4 border-t border-gray-100 pt-5">
          <ErrorAlert message={error} />
          {success && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-green-50 border border-green-100 text-green-700 text-[13px] animate-fade-in">
              <CheckCircleIcon className="w-4 h-4 shrink-0" />
              Settings saved successfully.
            </div>
          )}

          {isBypassed && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800 text-[13px] leading-snug">
              <AlertTriangleIcon className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
              <div>
                <span className="font-semibold">Bypassed:</span> Campus Operations Mode is currently set to Autonomous. Teachers cannot manually manage assignments in Autonomous mode.
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-sm font-semibold text-gray-800">Teacher Self-Management Permission</span>
              <p className="text-[13px] text-gray-500 mt-0.5 leading-snug">
                {enabled
                  ? 'Teachers can manually select substitutes and override assignments for their leaves.'
                  : 'Teachers cannot assign substitutes or modify coverage assignments.'}
              </p>
            </div>
            <ToggleSwitch
              checked={enabled && !isBypassed}
              onChange={(val) => isSuperAdmin && !isBypassed && handleToggle(val)}
              disabled={!isSuperAdmin || isBypassed || saving}
            />
          </div>

          {!isSuperAdmin && (
            <p className="text-xs text-gray-400 -mb-2">Only a Super Admin can change this setting.</p>
          )}
        </div>
      )}
    </SettingsSection>
  )
}

/* ── Admin Accounts ───────────────────────────────────────────────────── */
function initials(name) {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function AdminsPanel({ isSuperAdmin }) {
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', username: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => adminApi.listSecondaryAdmins().then(r => setAdmins(r.data)).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const activeSecondaryCount = admins.filter(a => a.admin_level === 'secondary_admin' && a.is_active).length

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await adminApi.createSecondaryAdmin(form)
      setModalOpen(false)
      setForm({ name: '', username: '', password: '' })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create Secondary Admin.')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (admin) => {
    if (admin.is_active) await adminApi.disableAdmin(admin.id)
    else await adminApi.enableAdmin(admin.id)
    load()
  }

  return (
    <SettingsSection
      icon={ShieldIcon}
      tint="bg-slate-100 text-slate-600"
      title="Admin Accounts"
      description={`${activeSecondaryCount}/3 active Secondary Admins`}
      action={isSuperAdmin && (
        <button
          onClick={() => { setError(''); setModalOpen(true) }}
          disabled={activeSecondaryCount >= 3}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary-600 pl-3 pr-4 py-2 text-xs font-semibold text-white hover:bg-primary-700 active:scale-[0.98] transition disabled:opacity-40 disabled:pointer-events-none shrink-0"
        >
          <PlusIcon className="w-3.5 h-3.5" /> Add Admin
        </button>
      )}
    >
      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : admins.length === 0 ? (
        <div className="border-t border-gray-100"><EmptyState message="No admin accounts yet." /></div>
      ) : (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {admins.map(a => (
            <div key={a.id} className="flex items-center gap-3.5 px-6 py-3.5 hover:bg-gray-50/60 transition-colors">
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-500 shrink-0">
                {initials(a.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-800 truncate">{a.name}</span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${a.admin_level === 'super_admin' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                    {a.admin_level === 'super_admin' ? 'Super Admin' : 'Secondary Admin'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">{a.username}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-xs font-medium ${a.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                  {a.is_active ? 'Active' : 'Disabled'}
                </span>
                {isSuperAdmin && a.admin_level === 'secondary_admin' && (
                  <button onClick={() => toggleActive(a)} className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors">
                    {a.is_active ? 'Disable' : 'Enable'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Secondary Admin">
        <form onSubmit={handleCreate} className="space-y-4">
          <ErrorAlert message={error} />
          <p className="text-xs text-gray-500">
            They'll be required to set their own username and password on first login.
          </p>
          <div>
            <label className={labelCls}>Full name</label>
            <input type="text" required className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Temporary username</label>
            <input type="text" required minLength={3} className={inputCls} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Temporary password</label>
            <input type="password" required minLength={8} className={inputCls} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="flex gap-2.5 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className={`${btnSecondary} flex-1`}>Cancel</button>
            <button type="submit" disabled={saving} className={`${btnPrimary} flex-1`}>{saving ? 'Creating…' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </SettingsSection>
  )
}

/* ── Bulk Department Configuration ────────────────────────────────────── */
function BulkConfigPanel({ isSystemAdmin, onConfigUpdate }) {
  const { departments } = useDepartment()
  const [selectedDepts, setSelectedDepts] = useState([])
  const [mode, setMode] = useState('assisted')
  const [selfMgmt, setSelfMgmt] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleToggleDept = (id) => {
    setSelectedDepts(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selectedDepts.length === departments.length) {
      setSelectedDepts([])
    } else {
      setSelectedDepts(departments.map(d => d.id))
    }
  }

  const handleApply = async (e) => {
    e.preventDefault()
    if (selectedDepts.length === 0) {
      setError('Please select at least one department.')
      return
    }
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      await campusOperationsApi.bulkConfigure({
        department_ids: selectedDepts,
        mode: mode,
        teacher_self_management_enabled: selfMgmt
      })
      setSuccess('Successfully updated settings for selected departments!')
      setSelectedDepts([])
      if (onConfigUpdate) onConfigUpdate()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to bulk configure.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsSection
      icon={UsersIcon}
      tint="bg-blue-50 text-blue-600"
      title="Bulk Department Configuration"
      description="Apply modes and self-management permissions to multiple departments at once"
    >
      <form onSubmit={handleApply} className="px-6 pb-6 pt-4 border-t border-gray-100 space-y-4">
        {error && <ErrorAlert message={error} />}
        {success && (
          <div className="p-3.5 bg-green-50 text-green-700 text-xs font-bold rounded-2xl border border-green-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            {success}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Select Departments</label>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs font-bold text-primary-600 hover:text-primary-700"
            >
              {selectedDepts.length === departments.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto border border-gray-100 rounded-2xl p-3 bg-gray-50/50">
            {departments.map(d => {
              const checked = selectedDepts.includes(d.id)
              return (
                <label key={d.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-gray-100/50 cursor-pointer transition text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggleDept(d.id)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span>{d.name} ({d.code || '—'})</span>
                </label>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <label className={labelCls}>Target Operations Mode</label>
            <select
              value={mode}
              onChange={e => setMode(e.target.value)}
              className={inputCls}
            >
              <option value="manual">Manual</option>
              <option value="assisted">Assisted</option>
              <option value="autonomous">Autonomous</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Teacher Self-Management</label>
            <div className="flex items-center justify-between h-[42px] px-4 border border-gray-200 rounded-2xl bg-white">
              <span className="text-xs font-semibold text-gray-700">Allow Self-Management</span>
              <ToggleSwitch
                checked={selfMgmt}
                onChange={setSelfMgmt}
                disabled={saving}
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || selectedDepts.length === 0}
          className={`${btnPrimary} w-full mt-2`}
        >
          {saving ? 'Applying settings…' : `Apply configuration to ${selectedDepts.length} departments`}
        </button>
      </form>
    </SettingsSection>
  )
}

/* ── Autonomous Mode Dry Run ────────────────────────────────────────── */
function DryRunPanel() {
  const { departments } = useDepartment()
  const [deptId, setDeptId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState(null)

  const handleRun = async (e) => {
    e.preventDefault()
    if (!startDate || !endDate) {
      setError('Please specify both start and end dates.')
      return
    }
    setError('')
    setReport(null)
    setLoading(true)
    try {
      const { data } = await campusOperationsApi.runDryRun({
        department_id: deptId ? parseInt(deptId, 10) : null,
        start_date: startDate,
        end_date: endDate
      })
      setReport(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Simulation run failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SettingsSection
      icon={SparklesIcon}
      tint="bg-amber-50 text-amber-600"
      title="Autonomous Mode Dry Run (Simulation)"
      description="Simulate autonomous substitute coverages for a future date range to verify compatibility and caps"
    >
      <form onSubmit={handleRun} className="px-6 pb-6 pt-4 border-t border-gray-100 space-y-4">
        {error && <ErrorAlert message={error} />}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Department Scope (Optional)</label>
            <select
              value={deptId}
              onChange={e => setDeptId(e.target.value)}
              className={inputCls}
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Start Date</label>
            <input
              type="date"
              required
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>End Date</label>
            <input
              type="date"
              required
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`${btnSecondary} w-full text-primary-655 hover:bg-slate-205/60 font-semibold`}
        >
          {loading ? 'Running simulation engine…' : 'Execute Dry Run Simulation'}
        </button>

        {loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-2 border border-dashed border-gray-200 rounded-2xl">
            <Spinner />
            <span className="text-xs text-gray-500 font-semibold animate-pulse">Running compatibility checks sequentially...</span>
          </div>
        )}

        {report && (
          <div className="space-y-4 border border-gray-200 rounded-3xl p-5 bg-gray-50/50 animate-fade-in">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Simulation Report</h4>
              <span className="text-[10px] font-bold text-emerald-650 bg-emerald-100 px-2 py-0.5 rounded-full">Dry Run Completed</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="bg-white border border-gray-100 p-3 rounded-2xl shadow-sm text-center">
                <span className="text-2xl font-extrabold text-gray-800">{report.leaves_processed}</span>
                <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">Leaves Analyzed</p>
              </div>
              <div className="bg-white border border-gray-100 p-3 rounded-2xl shadow-sm text-center">
                <span className="text-2xl font-extrabold text-green-600">
                  {report.leaves_processed > 0
                    ? `${Math.round((report.simulated_successful_assignments / report.leaves_processed) * 100)}%`
                    : '100%'}
                </span>
                <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">Coverage Rate</p>
              </div>
              <div className="bg-white border border-gray-100 p-3 rounded-2xl shadow-sm text-center">
                <span className="text-2xl font-extrabold text-red-600">{report.simulated_failed_assignments}</span>
                <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">Coverage Failures</p>
              </div>
              <div className="bg-white border border-gray-100 p-3 rounded-2xl shadow-sm text-center">
                <span className="text-2xl font-extrabold text-indigo-650">{report.estimated_credit_transactions}</span>
                <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">Credit Trxs</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Simulated Assignments Trace</label>
              <div className="border border-gray-100 rounded-2xl bg-white max-h-48 overflow-y-auto divide-y divide-gray-150">
                {report.simulated_assignments.length === 0 ? (
                  <p className="text-xs text-gray-400 py-6 text-center font-medium">No approved leaves scheduled in this range.</p>
                ) : (
                  report.simulated_assignments.map((item, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between gap-4 text-xs">
                      <div>
                        <div className="flex items-center gap-2 font-semibold text-gray-700">
                          <span>{item.date}</span>
                          <span className="text-[10px] text-gray-400">Period {item.period_number}</span>
                        </div>
                        <p className="text-[10px] text-gray-505 mt-0.5">
                          Leave: <span className="font-semibold text-gray-700">{item.leave_teacher_name}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        {item.status === 'success' ? (
                          <>
                            <span className="text-[10px] font-bold text-emerald-650 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                              Covered
                            </span>
                            <p className="text-[10px] text-gray-500 font-semibold mt-1">
                              Sub: <span className="text-gray-700 font-bold">{item.substitute_teacher_name}</span>
                            </p>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] font-bold text-red-650 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                              Failure
                            </span>
                            <p className="text-[10px] text-red-500 mt-1 font-semibold">
                              {item.reason}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </form>
    </SettingsSection>
  )
}

/* ── Bulk Teacher Preferences Override ────────────────────────────────── */
function BulkTeacherPreferencesPanel() {
  const [prefForm, setPrefForm] = useState({
    accept_auto_assignments: true,
    allow_emergency_assignments: true,
    max_weekly_substitutions: 3,
    prefer_morning_classes: false,
    prefer_same_department: true
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleApply = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const { data } = await campusOperationsApi.bulkUpdateTeacherPreferences(prefForm)
      setSuccess(data.message || 'Successfully updated preferences for all teachers!')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to bulk configure teacher preferences.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsSection
      icon={UsersIcon}
      tint="bg-amber-50 text-amber-600"
      title="Bulk Teacher Preferences Override"
      description="Apply substitution preferences in bulk to all active teachers in your department"
    >
      <form onSubmit={handleApply} className="px-6 pb-6 pt-4 border-t border-gray-100 space-y-4">
        {error && <ErrorAlert message={error} />}
        {success && (
          <div className="p-3 bg-green-50 text-green-700 text-xs font-bold rounded-2xl border border-green-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={prefForm.accept_auto_assignments}
              onChange={e => setPrefForm({ ...prefForm, accept_auto_assignments: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <div>
              <p>Opt-in to Auto-Assignments</p>
              <span className="block text-[10px] text-gray-450 font-normal">Eligible for automatic substitutions</span>
            </div>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={prefForm.allow_emergency_assignments}
              onChange={e => setPrefForm({ ...prefForm, allow_emergency_assignments: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <div>
              <p>Allow Emergency Assignments</p>
              <span className="block text-[10px] text-gray-450 font-normal">Permit short-notice substitutions</span>
            </div>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={prefForm.prefer_morning_classes}
              onChange={e => setPrefForm({ ...prefForm, prefer_morning_classes: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <div>
              <p>Prefer Morning Classes</p>
              <span className="block text-[10px] text-gray-450 font-normal">Prioritize morning classes</span>
            </div>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={prefForm.prefer_same_department}
              onChange={e => setPrefForm({ ...prefForm, prefer_same_department: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <div>
              <p>Prefer Same Department</p>
              <span className="block text-[10px] text-gray-450 font-normal">Prioritize department colleagues</span>
            </div>
          </label>
        </div>

        <div className="pt-2">
          <label className="block text-xs font-bold text-gray-750 mb-1">Max Weekly Substitutions</label>
          <input
            type="number"
            min="0"
            required
            className="input"
            value={prefForm.max_weekly_substitutions}
            onChange={e => setPrefForm({ ...prefForm, max_weekly_substitutions: parseInt(e.target.value, 10) || 0 })}
          />
          <span className="block text-[10px] text-gray-450 mt-1">Maximum substitution allocations allowed within any 7-day window</span>
        </div>

        <button
          type="submit"
          disabled={saving}
          className={`${btnPrimary} w-full mt-2`}
        >
          {saving ? 'Applying overrides…' : 'Apply bulk override preferences to all teachers'}
        </button>
      </form>
    </SettingsSection>
  )
}

/* ── Audit Log ────────────────────────────────────────────────────────── */
function AuditLogPanel() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { adminApi.auditLogs().then(r => setLogs(r.data)).finally(() => setLoading(false)) }, [])

  return (
    <SettingsSection
      icon={HistoryIcon}
      tint="bg-amber-50 text-amber-600"
      title="Audit Log"
      description="Admin-management and calendar actions. Cleared by Factory Reset."
    >
      {loading ? (
        <div className="flex justify-center py-10 border-t border-gray-100"><Spinner /></div>
      ) : logs.length === 0 ? (
        <div className="border-t border-gray-100"><EmptyState message="No audit events yet." /></div>
      ) : (
        <div className="border-t border-gray-100 divide-y divide-gray-100 max-h-72 overflow-y-auto">
          {logs.map(l => (
            <div key={l.id} className="px-6 py-3 flex items-center justify-between gap-3 text-[13px] hover:bg-gray-50/50 transition-colors">
              <span className="text-gray-700 truncate"><span className="font-semibold text-gray-800">{l.actor_name || 'System'}</span> — {l.action}</span>
              <span className="text-gray-400 text-xs shrink-0">{new Date(l.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </SettingsSection>
  )
}

/* ── Factory Reset ────────────────────────────────────────────────────── */
function FactoryResetPanel() {
  const { logout, isSystemAdmin } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await adminApi.factoryReset({ password, confirmation_text: confirmText })
      setDone(data)
      setTimeout(() => {
        logout()
        navigate('/login')
      }, 4000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Factory reset failed.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <section className="rounded-[28px] bg-green-50/60 border border-green-100 p-7 flex items-start gap-4">
        <div className="w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center bg-green-100 text-green-600">
          <CheckCircleIcon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-green-800">{done.message}</p>
          <p className="text-[13px] text-green-700 mt-1">Backup saved: {done.backup_file}</p>
          <p className="text-xs text-gray-500 mt-3">Signing you out…</p>
        </div>
      </section>
    )
  }

  return (
    <SettingsSection
      icon={AlertTriangleIcon}
      tint="bg-red-50 text-red-600"
      title="Factory Reset"
      description="Wipes everything and starts fresh — irreversible"
    >
      <div className="px-6 pb-6 border-t border-gray-100 pt-5">
        <p className="text-[13px] text-gray-500 leading-relaxed mb-5">
          {isSystemAdmin ? (
            <>
              Permanently deletes all faculty data, accounts, history, and the entire Academic Calendar
              (academic years, semesters, holidays, Day Order assignments), then recreates a single
              Super Admin (username/password <code className="font-mono text-gray-600">admin</code> / <code className="font-mono text-gray-600">admin</code>,
              forced to change on next login).
            </>
          ) : (
            <>
              Permanently deletes all faculty data, accounts, history, classes, subjects, and settings 
              <strong> for your department</strong>, then resets your administrator account to a default 
              bootstrapped state (username/password based on your department code, forced to change on next login).
            </>
          )}{' '}
          A timestamped backup is taken automatically first, but restoring it is a manual database operation — this is not an undo button.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <ErrorAlert message={error} />
          <div>
            <label className={labelCls}>Your current password</label>
            <input type="password" required className={inputCls} value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Type <span className="font-mono font-semibold text-gray-700">RESET EVERYTHING</span> to confirm</label>
            <input type="text" required className={inputCls} value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="RESET EVERYTHING" />
          </div>
          <button type="submit" disabled={loading || confirmText !== 'RESET EVERYTHING'} className={`${btnDanger} w-full`}>
            {loading ? 'Resetting…' : 'Factory Reset Everything'}
          </button>
        </form>
      </div>
    </SettingsSection>
  )
}

/* ── Reset Timetable Panel ────────────────────────────────────────────── */
function TimetableResetPanel() {
  const { user, isSystemAdmin } = useAuth()
  const [scope, setScope] = useState('department')
  const [departmentId, setDepartmentId] = useState('')
  const [departments, setDepartments] = useState([])
  const [teachers, setTeachers] = useState([])
  const [selectedTeacherIds, setSelectedTeacherIds] = useState([])
  const [teacherSearch, setTeacherSearch] = useState('')
  const [clearSubmissions, setClearSubmissions] = useState(false)
  const [confirmAllText, setConfirmAllText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    departmentsApi.list(isSystemAdmin).then(r => {
      setDepartments(r.data || [])
      if (!isSystemAdmin && user?.department_id) {
        setDepartmentId(String(user.department_id))
      } else if (r.data?.length > 0) {
        setDepartmentId(String(r.data[0].id))
      }
    }).catch(() => {})

    teachersApi.list(isSystemAdmin).then(r => {
      setTeachers(r.data || [])
    }).catch(() => {})
  }, [isSystemAdmin, user])

  const filteredTeachers = teachers.filter(t => {
    if (!isSystemAdmin && user?.department_id && t.department_id !== user.department_id) return false
    if (scope === 'department' && departmentId && t.department_id !== Number(departmentId)) return false
    if (!teacherSearch) return true
    const q = teacherSearch.toLowerCase()
    return (t.name || '').toLowerCase().includes(q) || (t.department || '').toLowerCase().includes(q)
  })

  const handleReset = async () => {
    setError('')
    setSuccessMessage('')

    if (scope === 'teachers' && selectedTeacherIds.length === 0) {
      setError('Please select at least one teacher to reset.')
      return
    }
    if (scope === 'department' && !departmentId) {
      setError('Please select a department to reset.')
      return
    }
    if (scope === 'all' && confirmAllText !== 'RESET ALL TIMETABLES') {
      setError('Please type "RESET ALL TIMETABLES" to confirm institution-wide reset.')
      return
    }

    setLoading(true)
    try {
      const payload = {
        scope,
        department_id: scope === 'department' ? Number(departmentId) : null,
        teacher_ids: scope === 'teachers' ? selectedTeacherIds : null,
        clear_submissions: clearSubmissions,
      }
      const res = await timetableApi.reset(payload)
      setSuccessMessage(res.data?.message || 'Timetable reset successfully.')
      setSelectedTeacherIds([])
      setConfirmAllText('')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reset timetable.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SettingsSection
      icon={AlertTriangleIcon}
      tint="bg-rose-50 text-rose-600"
      title="Reset Timetable"
      description="Selectively clear timetable slots for all teachers, a particular department, or specific teachers."
    >
      <div className="px-6 pb-6 border-t border-gray-100 pt-5 space-y-4">
        {error && <ErrorAlert message={error} />}
        {successMessage && (
          <div className="p-3 bg-emerald-50 text-emerald-700 text-sm rounded-xl border border-emerald-100 font-medium">
            {successMessage}
          </div>
        )}

        {/* Scope selector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-1 bg-gray-100/80 rounded-xl">
          {isSystemAdmin && (
            <button
              type="button"
              onClick={() => { setScope('all'); setError(''); setSuccessMessage('') }}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all text-center ${
                scope === 'all' ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🌐 All Teachers
            </button>
          )}
          <button
            type="button"
            onClick={() => { setScope('department'); setError(''); setSuccessMessage('') }}
            className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all text-center ${
              scope === 'department' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            } ${!isSystemAdmin ? 'col-span-1' : ''}`}
          >
            🏢 By Department
          </button>
          <button
            type="button"
            onClick={() => { setScope('teachers'); setError(''); setSuccessMessage('') }}
            className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all text-center ${
              scope === 'teachers' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            } ${!isSystemAdmin ? 'col-span-1' : ''}`}
          >
            👨‍🏫 Specific Teacher(s)
          </button>
        </div>

        {/* Scope All Warning */}
        {scope === 'all' && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 space-y-3">
            <p className="text-xs text-red-800 leading-relaxed">
              <strong>Institution-Wide Action:</strong> This will delete <strong>ALL scheduled timetable slots across every department and faculty member</strong>. Classes, subjects, and teachers will remain intact.
            </p>
            <div>
              <label className="block text-[11px] font-semibold text-red-900 mb-1">
                Type <span className="font-mono bg-red-100 px-1 py-0.5 rounded">RESET ALL TIMETABLES</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmAllText}
                onChange={e => setConfirmAllText(e.target.value)}
                placeholder="RESET ALL TIMETABLES"
                className="w-full text-xs px-3 py-2 rounded-lg border border-red-300 focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
              />
            </div>
          </div>
        )}

        {/* Scope Department */}
        {scope === 'department' && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-700">Select Department</label>
            <select
              value={departmentId}
              onChange={e => setDepartmentId(e.target.value)}
              disabled={!isSystemAdmin && Boolean(user?.department_id)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            >
              <option value="">Choose department…</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.code || 'Dept'})</option>
              ))}
            </select>
            {departmentId && (
              <p className="text-[11px] text-gray-500">
                Target: <strong>{teachers.filter(t => t.department_id === Number(departmentId)).length}</strong> teacher(s) in selected department.
              </p>
            )}
          </div>
        )}

        {/* Scope Teachers */}
        {scope === 'teachers' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-gray-700">
                Select Teacher(s) ({selectedTeacherIds.length} selected)
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTeacherIds(filteredTeachers.map(t => t.id))}
                  className="text-[11px] text-indigo-600 hover:underline font-semibold"
                >
                  Select All Filtered
                </button>
                <span className="text-gray-300">·</span>
                <button
                  type="button"
                  onClick={() => setSelectedTeacherIds([])}
                  className="text-[11px] text-gray-500 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            <input
              type="text"
              placeholder="Search teacher by name or department…"
              value={teacherSearch}
              onChange={e => setTeacherSearch(e.target.value)}
              className="w-full text-xs px-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />

            <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 p-1 bg-gray-50/50">
              {filteredTeachers.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No teachers found.</p>
              ) : (
                filteredTeachers.map(t => {
                  const isChecked = selectedTeacherIds.includes(t.id)
                  return (
                    <label
                      key={t.id}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                        isChecked ? 'bg-indigo-50/70 text-indigo-900 font-semibold' : 'hover:bg-gray-100/70 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedTeacherIds(prev =>
                              isChecked ? prev.filter(id => id !== t.id) : [...prev, t.id]
                            )
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                        />
                        <span className="truncate">{t.name}</span>
                      </div>
                      {t.department && (
                        <span className="text-[10px] text-gray-400 bg-white border border-gray-200 px-1.5 py-0.5 rounded ml-2 shrink-0">
                          {t.department}
                        </span>
                      )}
                    </label>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* Clear Submissions Option */}
        <label className="flex items-start gap-2 cursor-pointer text-xs text-gray-600 pt-1">
          <input
            type="checkbox"
            checked={clearSubmissions}
            onChange={e => setClearSubmissions(e.target.checked)}
            className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 mt-0.5"
          />
          <span>Also clear pending and submitted timetable proposals for the target(s).</span>
        </label>

        {/* Submit */}
        <button
          type="button"
          onClick={handleReset}
          disabled={
            loading ||
            (scope === 'all' && confirmAllText !== 'RESET ALL TIMETABLES') ||
            (scope === 'department' && !departmentId) ||
            (scope === 'teachers' && selectedTeacherIds.length === 0)
          }
          className={`${btnDanger} w-full`}
        >
          {loading ? 'Resetting Timetable…' : 'Execute Timetable Reset'}
        </button>
      </div>
    </SettingsSection>
  )
}

/* ── Clear History ────────────────────────────────────────────────────── */
function ClearHistoryPanel() {
  const { isSystemAdmin } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const handleClearCredits = async () => {
    if (!window.confirm("Are you sure you want to permanently clear all credit transactions and reset all teacher credit balances? This action cannot be undone.")) {
      return
    }
    setError('')
    setSuccessMessage('')
    setLoading('credits')
    try {
      await adminApi.clearCreditsHistory()
      setSuccessMessage('Successfully cleared all credit transactions and balances.')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to clear credits history.')
    } finally {
      setLoading(null)
    }
  }

  const handleClearLeaves = async () => {
    if (!window.confirm("Are you sure you want to permanently delete all leave requests and substitution assignments? This action cannot be undone.")) {
      return
    }
    setError('')
    setSuccessMessage('')
    setLoading('leaves')
    try {
      await adminApi.clearLeavesHistory()
      setSuccessMessage('Successfully cleared all leave requests and substitution assignments.')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to clear leaves history.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <SettingsSection
      icon={AlertTriangleIcon}
      tint="bg-orange-50 text-orange-600"
      title="Clear History"
      description="Selectively clear leaves or credits history. Action is irreversible."
    >
      <div className="px-6 pb-6 border-t border-gray-100 pt-5 space-y-4">
        {error && <ErrorAlert message={error} />}
        {successMessage && (
          <div className="p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-100">
            {successMessage}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleClearLeaves}
            disabled={loading !== null}
            className={`${btnDanger} flex-1`}
          >
            {loading === 'leaves' ? 'Clearing Leaves…' : 'Clear Leaves History'}
          </button>
          <button
            onClick={handleClearCredits}
            disabled={loading !== null}
            className={`${btnDanger} flex-1`}
          >
            {loading === 'credits' ? 'Clearing Credits…' : 'Clear Credits History'}
          </button>
        </div>

        {isSystemAdmin && (
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">Need advanced date filters, automated cleanup policies, or selective datasets?</p>
            <button
              type="button"
              onClick={() => navigate('/admin/data-retention')}
              className="text-xs font-bold text-primary-600 hover:text-primary-700 underline"
            >
              Open Data Retention & Purge Console →
            </button>
          </div>
        )}
      </div>
    </SettingsSection>
  )
}

/* ── Page ─────────────────────────────────────────────────────────────── */
export default function AdminSettings() {
  const { isSuperAdmin, isSystemAdmin } = useAuth()
  const { activeDepartmentId } = useDepartment()
  
  const [loading, setLoading] = useState(true)
  const [modeConfig, setModeConfig] = useState({
    mode: 'assisted',
    configured_mode: 'assisted',
    global_override: 'none',
    is_overridden: false
  })
  const [crossDepartment, setCrossDepartment] = useState(false)

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const r = await campusOperationsApi.getMode()
      setModeConfig(r.data)
      if (isSuperAdmin || isSystemAdmin) {
        const policy = await campusOperationsApi.getCrossDepartmentSubstitutions()
        setCrossDepartment(policy.data.enabled)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [activeDepartmentId])

  const handleModeChange = async (newMode) => {
    const { data } = await campusOperationsApi.setMode({ mode: newMode })
    setModeConfig(data)
  }

  const handleOverrideChange = async (newOverride) => {
    const { data } = await campusOperationsApi.setMode({ global_override: newOverride })
    setModeConfig(data)
  }

  const toggleCrossDepartment = async (enabled) => {
    await campusOperationsApi.setCrossDepartmentSubstitutions(enabled)
    setCrossDepartment(enabled)
  }

  const downloadMasterExport = async () => {
    const { data } = await adminApi.masterExport()
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url; a.download = 'FAFLOW_Master_Accountability.xlsx'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-10">
      <div className="pt-1 pb-1">
        <h1 className="text-[32px] font-bold text-gray-900 tracking-tight">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Admin accounts, audit history, and system reset</p>
      </div>

      <CampusOperationsModePanel 
        isSuperAdmin={isSuperAdmin || isSystemAdmin} 
        modeConfig={modeConfig} 
        onModeChange={handleModeChange} 
        loading={loading}
      />

      {(isSuperAdmin || isSystemAdmin) && (
        <SettingsSection
          icon={UsersIcon}
          tint="bg-blue-50 text-blue-600"
          title="Cross-department substitutions"
          description="Allow eligible faculty from another department to be selected for automatic substitutions and appear in substitute recommendations."
        >
          <div className="px-6 pb-6 border-t border-gray-100 pt-4 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-600">
              When turned OFF, automatic substitutions and recommendations strictly select faculty from the same department only.
            </p>
            <ToggleSwitch checked={crossDepartment} onChange={toggleCrossDepartment} />
          </div>
        </SettingsSection>
      )}


      {isSystemAdmin && <SettingsSection icon={HistoryIcon} tint="bg-emerald-50 text-emerald-600" title="Master accountability export" description="Download the institution-wide class faculty and substitution accountability workbook."><div className="px-6 pb-6 border-t border-gray-100 pt-4"><button className={btnPrimary} onClick={downloadMasterExport}>Download master export (.xlsx)</button></div></SettingsSection>}
      
      {isSystemAdmin && activeDepartmentId === null && (
        <GlobalOverridePanel 
          isSystemAdmin={isSystemAdmin}
          globalOverride={modeConfig.global_override}
          onOverrideChange={handleOverrideChange}
        />
      )}
      {isSystemAdmin && activeDepartmentId === null && (
        <BulkConfigPanel 
          isSystemAdmin={isSystemAdmin}
          onConfigUpdate={fetchConfig}
        />
      )}

      {isSystemAdmin && activeDepartmentId === null && (
        <DryRunPanel />
      )}

      <TeachersModeSettings isSuperAdmin={isSuperAdmin} campusMode={modeConfig.mode} />
      {(isSuperAdmin || isSystemAdmin) && (
        <BulkTeacherPreferencesPanel />
      )}
      {isSuperAdmin && <AdminsPanel isSuperAdmin={isSuperAdmin} />}
      <AuditLogPanel />
      <TimetableResetPanel />
      <ClearHistoryPanel />
      {isSuperAdmin && <FactoryResetPanel />}
    </div>
  )
}

