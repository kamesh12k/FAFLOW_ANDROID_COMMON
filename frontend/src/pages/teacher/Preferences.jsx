import { useEffect, useState } from 'react'
import { campusOperationsApi } from '../../api/services'
import { Spinner, ErrorAlert } from '../../components/ui'

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-primary-600' : 'bg-gray-200'
      } disabled:opacity-50`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function PreferenceRow({ title, description, checked, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-gray-800">{title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}

export default function SubstitutionPreferences() {
  const [prefs, setPrefs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState(null)
  const [capInput, setCapInput] = useState('')

  useEffect(() => {
    campusOperationsApi.myPreferences().then(r => {
      setPrefs(r.data)
      setCapInput(r.data.max_weekly_substitutions ?? '')
    }).finally(() => setLoading(false))
  }, [])

  const save = async (patch) => {
    setError('')
    setSaving(true)
    try {
      const { data } = await campusOperationsApi.updateMyPreferences(patch)
      setPrefs(data)
      setSavedAt(Date.now())
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save preference.')
    } finally {
      setSaving(false)
    }
  }

  const toggle = (key) => (value) => {
    setPrefs(p => ({ ...p, [key]: value }))
    save({ [key]: value })
  }

  const saveCap = () => {
    const trimmed = String(capInput).trim()
    const value = trimmed === '' ? null : Number(trimmed)
    if (value !== null && (!Number.isInteger(value) || value < 0)) {
      setError('Enter a whole number of 0 or more, or leave blank for no limit.')
      return
    }
    save({ max_weekly_substitutions: value })
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Substitution Preferences</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Control how the system can assign you as a substitute when a colleague takes leave.
        </p>
      </div>

      <ErrorAlert message={error} />

      <div className="card p-5 divide-y divide-gray-50">
        <PreferenceRow
          title="Accept automatic assignments"
          description="When this is off, the system will never assign you as a substitute without an admin choosing you directly."
          checked={prefs.accept_auto_assignments}
          onChange={toggle('accept_auto_assignments')}
          disabled={saving}
        />
        <PreferenceRow
          title="Allow emergency assignments"
          description="Permits assignment even when a leave is submitted shortly before the affected class. Only matters if automatic assignments are on."
          checked={prefs.allow_emergency_assignments}
          onChange={toggle('allow_emergency_assignments')}
          disabled={saving || !prefs.accept_auto_assignments}
        />
        <PreferenceRow
          title="Only substitute for my regularly assigned classes"
          description="When this is on, your name will only appear as a substitute candidate for a class that is already assigned to you in the timetable. This is a hard restriction — you will never be shown for any other class, regardless of other settings."
          checked={prefs.only_my_classes}
          onChange={toggle('only_my_classes')}
          disabled={saving}
        />
        {/* Commented out as they no longer affect scoring
        <PreferenceRow
          title="Prefer morning classes"
          description="Nudges the system to favor you for periods 1-2 over later periods. A soft preference — it never blocks an assignment on its own."
          checked={prefs.prefer_morning_classes}
          onChange={toggle('prefer_morning_classes')}
          disabled={saving}
        />
        <PreferenceRow
          title="Prefer same department"
          description="Nudges the system to favor classes in your own department. Also a soft preference, not a hard restriction."
          checked={prefs.prefer_same_department}
          onChange={toggle('prefer_same_department')}
          disabled={saving}
        />
        */}
      </div>

      <div className="card p-5">
        <p className="text-sm font-medium text-gray-800">Maximum substitutions per week</p>
        <p className="text-xs text-gray-400 mt-0.5 mb-3">
          Once you reach this number in a 7-day window, the system will skip you for further automatic assignments. Leave blank for no limit.
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            placeholder="No limit"
            className="input max-w-[140px]"
            value={capInput}
            onChange={e => setCapInput(e.target.value)}
            disabled={saving}
          />
          <button onClick={saveCap} disabled={saving} className="btn-secondary text-sm disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {savedAt && !error && (
        <p className="text-xs text-green-600 text-center">Saved.</p>
      )}
    </div>
  )
}
