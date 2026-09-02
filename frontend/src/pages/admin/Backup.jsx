import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { backupApi } from '../../api/services'
import { getApiErrorMessage } from '../../api/client'

/* ── Local icon set (line-weight matches existing Settings.jsx icons) ───── */
function DatabaseIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  )
}
function DownloadIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}
function UploadIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}
function RefreshIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}
function ShieldIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z" />
    </svg>
  )
}
function TrashIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}
function CheckCircleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}
function AlertTriangleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}
function ClockIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
function SpinnerIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="animate-spin" {...props}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}


/* ── Style constants (matches Settings.jsx exactly) ──────────────────────── */
const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 active:scale-[0.98] transition disabled:opacity-40 disabled:pointer-events-none'
const btnSecondary = 'inline-flex items-center justify-center gap-2 rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 active:scale-[0.98] transition disabled:opacity-40 disabled:pointer-events-none'
const btnDanger = 'inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 active:scale-[0.98] transition disabled:opacity-40 disabled:pointer-events-none'
const btnGhost = 'inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 active:scale-[0.97] transition disabled:opacity-40 disabled:pointer-events-none'

/* ── Utility ─────────────────────────────────────────────────────────────── */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDateTime(iso) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function timeAgo(iso) {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

/* ── Validation badge ────────────────────────────────────────────────────── */
function ValidationBadge({ status }) {
  const map = {
    valid: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Valid' },
    invalid: { cls: 'bg-red-50 text-red-700 border-red-200', label: 'Invalid' },
    not_validated: { cls: 'bg-gray-100 text-gray-500 border-gray-200', label: 'Not Validated' },
    validation_failed: { cls: 'bg-orange-50 text-orange-700 border-orange-200', label: 'Failed' },
    checking: { cls: 'bg-blue-50 text-blue-600 border-blue-200', label: 'Checking…' },
  }
  const { cls, label } = map[status] || map.not_validated
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}>
      {label}
    </span>
  )
}

/* ── Summary card ────────────────────────────────────────────────────────── */
function SummaryCard({ label, value, sub, tint }) {
  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-1 ${tint}`}>
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-black text-gray-900">{value}</p>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  )
}

/* ── Section wrapper (mirrors Settings.jsx SettingsSection) ─────────────── */
function Section({ icon: Icon, tint, title, description, action, children }) {
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

/* ── Restore Confirmation Modal ──────────────────────────────────────────── */
function RestoreModal({ backup, onConfirm, onCancel, loading }) {
  const REQUIRED = 'I understand that the current data will be replaced'
  const [text, setText] = useState('')
  const ready = text === REQUIRED

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-lg p-8 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-red-50 flex items-center justify-center shrink-0">
            <ShieldIcon className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-gray-900">Restore Backup</h3>
            <p className="text-[12px] text-gray-500">This is a high-risk operation</p>
          </div>
        </div>

        {/* Backup info */}
        <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 space-y-1.5 text-[13px]">
          <div className="flex justify-between"><span className="text-gray-500">Backup</span><span className="font-semibold text-gray-800 truncate max-w-[250px]">{backup?.filename}</span></div>
          {backup?.department_name ? (
            <div className="flex justify-between"><span className="text-gray-500">Scope</span><span className="font-bold text-primary-700">{backup.department_name} Department Only</span></div>
          ) : (
            <div className="flex justify-between"><span className="text-gray-500">Scope</span><span className="font-medium text-gray-700">Full Database</span></div>
          )}
          <div className="flex justify-between"><span className="text-gray-500">Created</span><span className="text-gray-700">{formatDateTime(backup?.created_at)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Created by</span><span className="text-gray-700">{backup?.created_by || '—'}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Size</span><span className="text-gray-700">{formatBytes(backup?.file_size_bytes)}</span></div>
        </div>

        {/* Warning */}
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex gap-3">
          <AlertTriangleIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-[13px] text-amber-800 leading-snug space-y-1">
            <p className="font-bold">
              {backup?.department_name
                ? `Restoring will replace data for ${backup.department_name} Department only.`
                : 'Restoring will replace the current database state.'}
            </p>
            <p>
              Before continuing, the system will automatically create a <strong>safety backup of the current {backup?.department_name ? `${backup.department_name} data` : 'database'}</strong>. If that safety backup cannot be created, the restore will be aborted.
            </p>
          </div>
        </div>

        {/* Confirmation input */}
        <div>
          <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
            Type the following to confirm:
          </label>
          <p className="font-mono text-[11px] bg-gray-100 rounded-xl px-3 py-2 mb-2 text-gray-700 select-all break-all">
            {REQUIRED}
          </p>
          <input
            id="restore-confirm-input"
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Type exactly as shown above…"
            className="w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400 transition"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button className={btnSecondary} onClick={onCancel} disabled={loading}>Cancel</button>
          <button
            id="restore-confirm-btn"
            className={btnDanger}
            disabled={!ready || loading}
            onClick={() => onConfirm(REQUIRED)}
          >
            {loading ? <SpinnerIcon className="w-4 h-4" /> : <ShieldIcon className="w-4 h-4" />}
            {loading ? 'Restoring…' : 'Restore Backup'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Delete Confirmation Modal ───────────────────────────────────────────── */
function DeleteModal({ backup, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-sm p-8 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-red-50 flex items-center justify-center shrink-0">
            <TrashIcon className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-gray-900">Delete Backup</h3>
            <p className="text-[12px] text-gray-500">This cannot be undone</p>
          </div>
        </div>
        <p className="text-[13px] text-gray-600 leading-snug">
          Delete <span className="font-semibold text-gray-900">{backup?.filename}</span>?<br />
          The file will be permanently removed from the server.
        </p>
        <div className="flex gap-3 justify-end">
          <button className={btnSecondary} onClick={onCancel} disabled={loading}>Cancel</button>
          <button className={btnDanger} onClick={onConfirm} disabled={loading}>
            {loading ? <SpinnerIcon className="w-4 h-4" /> : <TrashIcon className="w-4 h-4" />}
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Inline toast ────────────────────────────────────────────────────────── */
function Toast({ message, type, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000)
    return () => clearTimeout(t)
  }, [message])

  const cls = type === 'error'
    ? 'bg-red-50 border-red-200 text-red-800'
    : 'bg-emerald-50 border-emerald-200 text-emerald-800'

  return (
    <div className={`fixed bottom-6 right-6 z-[60] max-w-sm rounded-2xl border px-5 py-3.5 shadow-xl text-[13px] font-medium flex items-start gap-3 ${cls}`}>
      {type === 'error'
        ? <AlertTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" />
        : <CheckCircleIcon className="w-4 h-4 shrink-0 mt-0.5" />
      }
      <span>{message}</span>
      <button onClick={onDismiss} className="ml-auto text-current opacity-60 hover:opacity-100 font-bold text-base leading-none">×</button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main page
══════════════════════════════════════════════════════════════════════════════ */
export default function BackupRestore() {
  const { isSystemAdmin } = useAuth()

  const [backups, setBackups] = useState([])
  const [summary, setSummary] = useState(null)
  const [schedule, setSchedule] = useState({ enabled: true, interval_days: 7, last_auto_backup_at: null, next_scheduled_at: null })
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef(null)
  const [validating, setValidating] = useState({}) // { backupId: true/false }
  const [restoreTarget, setRestoreTarget] = useState(null)
  const [restoring, setRestoring] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
  }, [])

  const dismissToast = useCallback(() => setToast(null), [])

  /* ── Fetch ────────────────────────────────────────────────────────────── */
  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, sumRes, schedRes] = await Promise.all([
        backupApi.list(),
        backupApi.summary(),
        backupApi.getSchedule().catch(() => ({ data: { enabled: true, interval_days: 7 } })),
      ])
      setBackups(listRes.data)
      setSummary(sumRes.data)
      if (schedRes?.data) setSchedule(schedRes.data)
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to load backups.'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { fetchAll() }, [fetchAll])

  const [customDays, setCustomDays] = useState('')
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [runningAuto, setRunningAuto] = useState(false)

  /* ── Guard ────────────────────────────────────────────────────────────── */
  if (!isSystemAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-2">
          <AlertTriangleIcon className="w-12 h-12 text-red-400 mx-auto" />
          <p className="text-gray-700 font-semibold">Access Denied</p>
          <p className="text-[13px] text-gray-500">Backup & Restore is restricted to System Administrators.</p>
        </div>
      </div>
    )
  }

  /* ── Schedule Actions ─────────────────────────────────────────────────── */
  const handleUpdateInterval = async (days) => {
    setSavingSchedule(true)
    try {
      const res = await backupApi.updateSchedule({
        enabled: schedule?.enabled ?? true,
        interval_days: days,
      })
      setSchedule(res.data)
      setCustomDays('')
      showToast(`Automatic backup interval updated to every ${days} days.`)
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to update backup interval.'), 'error')
    } finally {
      setSavingSchedule(false)
    }
  }

  const handleToggleSchedule = async () => {
    setSavingSchedule(true)
    try {
      const nextState = !schedule?.enabled
      const res = await backupApi.updateSchedule({
        enabled: nextState,
        interval_days: schedule?.interval_days || 7,
      })
      setSchedule(res.data)
      showToast(`Automatic backup ${nextState ? 'enabled' : 'disabled'}.`)
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to toggle backup schedule.'), 'error')
    } finally {
      setSavingSchedule(false)
    }
  }

  const handleRunAutoNow = async () => {
    setRunningAuto(true)
    try {
      const res = await backupApi.runAutoBackupNow()
      setBackups(prev => [res.data, ...prev])
      const schedRes = await backupApi.getSchedule()
      setSchedule(schedRes.data)
      showToast(`Auto-backup executed successfully: ${res.data.filename}`)
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Auto backup execution failed.'), 'error')
    } finally {
      setRunningAuto(false)
    }
  }

  /* ── Actions ──────────────────────────────────────────────────────────── */
  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await backupApi.create()
      setBackups(prev => [res.data, ...prev])
      setSummary(prev => prev ? {
        ...prev,
        backup_count: (prev.backup_count || 0) + 1,
        last_backup_at: res.data.created_at,
        total_storage_bytes: (prev.total_storage_bytes || 0) + res.data.file_size_bytes,
      } : null)
      showToast(`Backup created: ${res.data.filename}`)
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Backup creation failed.'), 'error')
    } finally {
      setCreating(false)
    }
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.json')) {
      showToast('Please select a valid .json backup file.', 'error')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setImporting(true)
    try {
      const res = await backupApi.importBackup(file)
      setBackups(prev => [res.data, ...prev])
      setSummary(prev => prev ? {
        ...prev,
        backup_count: (prev.backup_count || 0) + 1,
        total_storage_bytes: (prev.total_storage_bytes || 0) + res.data.file_size_bytes,
      } : null)
      showToast(`Backup imported successfully: ${res.data.filename}`)
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to import backup.'), 'error')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDownload = async (backup) => {
    try {
      const res = await backupApi.download(backup.backup_id)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = backup.filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      showToast(`Downloading ${backup.filename}`)
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Download failed.'), 'error')
    }
  }

  const handleValidate = async (backup) => {
    setValidating(v => ({ ...v, [backup.backup_id]: true }))
    try {
      const res = await backupApi.validate(backup.backup_id)
      setBackups(prev => prev.map(b =>
        b.backup_id === backup.backup_id ? { ...b, ...res.data } : b
      ))
      const status = res.data.validation_status
      showToast(
        status === 'valid' ? `Backup is valid ✓` : `Backup validation failed: ${(res.data.validation_errors || []).join(', ')}`,
        status === 'valid' ? 'success' : 'error'
      )
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Validation failed.'), 'error')
    } finally {
      setValidating(v => ({ ...v, [backup.backup_id]: false }))
    }
  }

  const handleRestoreConfirm = async (confirmationText) => {
    setRestoring(true)
    try {
      const res = await backupApi.restore(restoreTarget.backup_id, confirmationText)
      setRestoreTarget(null)
      showToast(res.data.message || 'Restore completed. A pre-restore safety backup was saved.')
      await fetchAll()
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Restore failed.'), 'error')
    } finally {
      setRestoring(false)
    }
  }

  const handleDeleteConfirm = async () => {
    setDeleting(true)
    try {
      await backupApi.delete(deleteTarget.backup_id)
      setBackups(prev => prev.filter(b => b.backup_id !== deleteTarget.backup_id))
      setSummary(prev => prev ? {
        ...prev,
        backup_count: Math.max(0, (prev.backup_count || 1) - 1),
        total_storage_bytes: Math.max(0, (prev.total_storage_bytes || 0) - deleteTarget.file_size_bytes),
      } : null)
      showToast(`Deleted ${deleteTarget.filename}`)
      setDeleteTarget(null)
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Delete failed.'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  /* ── Render ───────────────────────────────────────────────────────────── */
  const userBackups = backups.filter(b => !b.is_pre_restore)
  const preRestoreBackups = backups.filter(b => !b.is_pre_restore && b.backup_type === 'auto')

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Backup & Restore</h1>
          <p className="text-[13px] text-gray-500 mt-1">Create, manage, and restore database backups. Department HOD & Administrator.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".json,application/json"
            className="hidden"
          />
          <Link
            to="/admin/data-retention"
            className={btnSecondary}
            title="Manage automated retention policies and selective data cleansing"
          >
            <TrashIcon className="w-4 h-4 text-red-600" />
            Retention & Purge
          </Link>
          <button
            id="backup-refresh-btn"
            className={btnSecondary}
            onClick={fetchAll}
            disabled={loading || creating || importing}
          >
            <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            id="backup-import-btn"
            className={btnSecondary}
            onClick={() => fileInputRef.current?.click()}
            disabled={importing || creating || loading}
            title="Import a backup JSON file from your computer"
          >
            {importing ? <SpinnerIcon className="w-4 h-4" /> : <UploadIcon className="w-4 h-4" />}
            {importing ? 'Importing…' : 'Import from Local'}
          </button>
          <button
            id="backup-create-btn"
            className={btnPrimary}
            onClick={handleCreate}
            disabled={creating || loading || importing}
          >
            {creating ? <SpinnerIcon className="w-4 h-4" /> : <DatabaseIcon className="w-4 h-4" />}
            {creating ? 'Creating backup…' : 'Create Backup'}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            label="Total Backups"
            value={summary.backup_count}
            tint="bg-indigo-50 border-indigo-100"
          />
          <SummaryCard
            label="Storage Used"
            value={formatBytes(summary.total_storage_bytes)}
            tint="bg-violet-50 border-violet-100"
          />
          <SummaryCard
            label="Last Backup"
            value={timeAgo(summary.last_backup_at)}
            sub={summary.last_backup_at ? formatDateTime(summary.last_backup_at) : null}
            tint="bg-sky-50 border-sky-100"
          />
          <SummaryCard
            label="Last Restore"
            value={summary.last_restore_at ? timeAgo(summary.last_restore_at) : 'Never'}
            sub={summary.last_restore_at ? formatDateTime(summary.last_restore_at) : null}
            tint="bg-teal-50 border-teal-100"
          />
        </div>
      )}

      {/* Automated Backup Schedule Section */}
      <Section
        icon={ClockIcon}
        tint="bg-emerald-50 text-emerald-600"
        title="Automated Backup Schedule & Retention"
        description="Configure periodic background database snapshots. The system automatically creates a full database backup every 7 days by default (customizable below)."
      >
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">Automatic Background Backups</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                  schedule?.enabled
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-gray-100 text-gray-600 border-gray-200'
                }`}>
                  {schedule?.enabled ? `Active · Every ${schedule.interval_days} Days` : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                The system automatically backs up data every {schedule?.interval_days || 7} days. Admins can customize the frequency below.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleToggleSchedule}
                disabled={savingSchedule}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  schedule?.enabled ? 'bg-emerald-600' : 'bg-gray-200'
                }`}
                title="Toggle Automatic Backups"
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    schedule?.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-xs font-bold text-gray-700">
                {schedule?.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {/* Interval Configuration */}
            <div className="space-y-2 md:col-span-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Backup Interval Frequency
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { days: 1, label: '1 Day (Daily)' },
                  { days: 3, label: '3 Days' },
                  { days: 7, label: '7 Days (Default)' },
                  { days: 14, label: '14 Days (Bi-weekly)' },
                  { days: 30, label: '30 Days (Monthly)' },
                ].map(preset => (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => handleUpdateInterval(preset.days)}
                    disabled={savingSchedule}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border cursor-pointer ${
                      schedule?.interval_days === preset.days
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Custom Interval Input */}
              <div className="flex items-center gap-2 pt-2">
                <span className="text-xs text-gray-500 font-medium">Or custom days:</span>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={customDays}
                  onChange={e => setCustomDays(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-24 px-2.5 py-1 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-900 focus:outline-none focus:border-primary-600 font-semibold"
                />
                <button
                  type="button"
                  onClick={() => {
                    const d = parseInt(customDays, 10)
                    if (d >= 1 && d <= 365) {
                      handleUpdateInterval(d)
                    } else {
                      showToast('Please enter a valid interval between 1 and 365 days.', 'error')
                    }
                  }}
                  disabled={savingSchedule || !customDays}
                  className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 cursor-pointer"
                >
                  {savingSchedule ? 'Saving…' : 'Set Custom Interval'}
                </button>
              </div>
            </div>

            {/* Schedule Status Box */}
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Last Auto Backup</span>
                <span className="font-semibold text-gray-800">
                  {schedule?.last_auto_backup_at ? formatDateTime(schedule.last_auto_backup_at) : 'None recorded yet'}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Next Scheduled Backup</span>
                <span className="font-semibold text-emerald-700">
                  {schedule?.enabled && schedule?.next_scheduled_at
                    ? formatDateTime(schedule.next_scheduled_at)
                    : schedule?.enabled ? 'Due immediately' : 'Schedule paused'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleRunAutoNow}
                disabled={runningAuto || creating}
                className="w-full mt-1 px-2.5 py-1.5 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-semibold rounded-lg transition shadow-2xs text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {runningAuto ? <SpinnerIcon className="w-3.5 h-3.5" /> : <RefreshIcon className="w-3.5 h-3.5 text-gray-500" />}
                <span>{runningAuto ? 'Running Auto Backup…' : 'Run Auto-Backup Now'}</span>
              </button>
            </div>
          </div>
        </div>
      </Section>

      {/* Backups table */}
      <Section
        icon={DatabaseIcon}
        tint="bg-indigo-50 text-indigo-600"
        title="Database Backups"
        description="Full application data snapshots. Download or restore any backup."
      >
        <div className="px-0 pb-2">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
              <SpinnerIcon className="w-6 h-6" />
              <span className="text-sm">Loading backups…</span>
            </div>
          ) : userBackups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <DatabaseIcon className="w-10 h-10 opacity-30" />
              <p className="text-sm font-medium">No backups yet</p>
              <p className="text-xs text-gray-400">Create a snapshot now or import an existing backup from your device.</p>
              <div className="flex items-center gap-3 mt-2">
                <button
                  className={btnSecondary}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing || creating || loading}
                >
                  <UploadIcon className="w-4 h-4" />
                  Import from Local
                </button>
                <button
                  className={btnPrimary}
                  onClick={handleCreate}
                  disabled={creating || loading || importing}
                >
                  <DatabaseIcon className="w-4 h-4" />
                  Create Backup
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Backup</th>
                    <th className="text-left px-3 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Created</th>
                    <th className="text-left px-3 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wide">By</th>
                    <th className="text-left px-3 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Size</th>
                    <th className="text-left px-3 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Validation</th>
                    <th className="text-right px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {userBackups.map(backup => (
                    <tr key={backup.backup_id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-800 truncate max-w-[240px]">{backup.filename}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-gray-400 font-mono">{backup.backup_id.slice(0, 8)}…</span>
                          {backup.backup_type === 'auto' && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold border bg-teal-50 text-teal-700 border-teal-200">
                              Auto
                            </span>
                          )}
                          {backup.department_name && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold border bg-blue-50 text-blue-700 border-blue-200">
                              {backup.department_name}
                            </span>
                          )}
                          {backup.backup_scope === 'full' && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                              Full DB
                            </span>
                          )}
                          {backup.backup_type === 'imported' && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold border bg-purple-50 text-purple-700 border-purple-200">
                              Imported
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-gray-600 whitespace-nowrap">
                        {formatDateTime(backup.created_at)}
                      </td>
                      <td className="px-3 py-4 text-gray-600 whitespace-nowrap">
                        {backup.created_by || '—'}
                      </td>
                      <td className="px-3 py-4 text-gray-600 whitespace-nowrap">
                        {formatBytes(backup.file_size_bytes)}
                      </td>
                      <td className="px-3 py-4">
                        {validating[backup.backup_id]
                          ? <ValidationBadge status="checking" />
                          : <ValidationBadge status={backup.validation_status} />
                        }
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {/* Validate */}
                          <button
                            id={`validate-btn-${backup.backup_id}`}
                            className={btnGhost}
                            onClick={() => handleValidate(backup)}
                            disabled={!!validating[backup.backup_id]}
                            title="Validate backup integrity"
                          >
                            <CheckCircleIcon className="w-3.5 h-3.5" />
                            Validate
                          </button>
                          {/* Download */}
                          <button
                            id={`download-btn-${backup.backup_id}`}
                            className={btnGhost}
                            onClick={() => handleDownload(backup)}
                            title="Download backup file"
                          >
                            <DownloadIcon className="w-3.5 h-3.5" />
                            Download
                          </button>
                          {/* Restore */}
                          <button
                            id={`restore-btn-${backup.backup_id}`}
                            className={`${btnGhost} text-amber-600 hover:bg-amber-50`}
                            onClick={() => setRestoreTarget(backup)}
                            title="Restore this backup"
                          >
                            <ShieldIcon className="w-3.5 h-3.5" />
                            Restore
                          </button>
                          {/* Delete */}
                          <button
                            id={`delete-btn-${backup.backup_id}`}
                            className={`${btnGhost} text-red-500 hover:bg-red-50`}
                            onClick={() => setDeleteTarget(backup)}
                            title="Delete backup"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>

      {/* Pre-restore safety backups (collapsible) */}
      {preRestoreBackups.length > 0 && (
        <Section
          icon={ShieldIcon}
          tint="bg-amber-50 text-amber-600"
          title="Pre-Restore Safety Backups"
          description="Automatically created before every restore. Use these to recover if a restore had an unexpected result."
        >
          <div className="overflow-x-auto pb-2">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wide">File</th>
                  <th className="text-left px-3 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Created</th>
                  <th className="text-left px-3 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Size</th>
                  <th className="text-right px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {preRestoreBackups.map(backup => (
                  <tr key={backup.backup_id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-700 truncate max-w-[240px]">{backup.filename}</p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-200 mt-1">Safety Backup</span>
                    </td>
                    <td className="px-3 py-4 text-gray-600 whitespace-nowrap">{formatDateTime(backup.created_at)}</td>
                    <td className="px-3 py-4 text-gray-600">{formatBytes(backup.file_size_bytes)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className={btnGhost}
                          onClick={() => handleDownload(backup)}
                          title="Download safety backup"
                        >
                          <DownloadIcon className="w-3.5 h-3.5" />
                          Download
                        </button>
                        <button
                          className={`${btnGhost} text-red-500 hover:bg-red-50`}
                          onClick={() => setDeleteTarget(backup)}
                          title="Delete safety backup"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Security note */}
      <div className="rounded-2xl bg-slate-50 border border-slate-100 px-5 py-4 flex gap-3">
        <AlertTriangleIcon className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-[12px] text-slate-500 leading-snug">
          <span className="font-bold text-slate-600">Security:</span> Backup files contain all application data including user records.
          Restrict access to authorized administrators only. Backup files are stored on the server and are not accessible to the public.
          All backup and restore actions are recorded in the system audit log.
        </p>
      </div>

      {/* Modals */}
      {restoreTarget && (
        <RestoreModal
          backup={restoreTarget}
          onConfirm={handleRestoreConfirm}
          onCancel={() => setRestoreTarget(null)}
          loading={restoring}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          backup={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />
      )}
    </div>
  )
}
