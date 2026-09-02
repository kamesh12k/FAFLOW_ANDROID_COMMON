import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { dataRetentionApi } from '../../api/services'
import { getApiErrorMessage } from '../../api/client'
import { useToast } from '../../components/ui/Toast'

/* ── Local icon set ───────────────────────────────────────────────────────── */
function DatabaseIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
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
function ShieldCheckIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
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
function ClockIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
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
function FilterIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  )
}
function LayersIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}
function PlayIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="5 3 19 12 5 21 5 3" />
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

/* ── Style helpers ─────────────────────────────────────────────────────────── */
const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 active:scale-[0.98] transition disabled:opacity-40 disabled:pointer-events-none'
const btnSecondary = 'inline-flex items-center justify-center gap-2 rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 active:scale-[0.98] transition disabled:opacity-40 disabled:pointer-events-none'
const btnDanger = 'inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 active:scale-[0.98] transition disabled:opacity-40 disabled:pointer-events-none'
const cardCls = 'rounded-[24px] bg-white border border-gray-100 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden'

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

const TARGET_ENTITIES = [
  { id: 'audit_logs', label: 'Audit Trail Logs', description: 'System events, login history, and admin action logs', icon: '📋', defaultDays: 90 },
  { id: 'notifications', label: 'In-app Notifications', description: 'Faculty and admin alerts, read/unread notifications', icon: '🔔', defaultDays: 30 },
  { id: 'traffic_metrics', label: 'Live Traffic & Performance Logs', description: 'In-memory request records and performance statistics', icon: '📊', defaultDays: 30 },
  { id: 'backups', label: 'System Backup Files', description: 'Old snapshot JSON archives stored on disk', icon: '💾', defaultDays: 60 },
  { id: 'leaves', label: 'Leave Requests & Substitutions', description: 'Historical leave applications and substitute records', icon: '🏖️', defaultDays: 365 },
  { id: 'credits', label: 'Credit Ledger Transactions', description: 'Historical faculty credit balance adjustments', icon: '💳', defaultDays: 365 },
  { id: 'staff_leaves', label: 'Operational Staff Leaves', description: 'Lab and non-teaching staff leave records', icon: '👥', defaultDays: 365 },
  { id: 'timetable_submissions', label: 'Timetable Submissions', description: 'Past teacher timetable submission reviews', icon: '📅', defaultDays: 180 },
]

export default function DataRetention() {
  const { isSuperAdmin, isSystemAdmin } = useAuth()
  const toast = useToast()

  const [activeTab, setActiveTab] = useState('selective') // 'selective' | 'policy' | 'storage'
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [policy, setPolicy] = useState(null)
  const [policyForm, setPolicyForm] = useState(null)
  const [savingPolicy, setSavingPolicy] = useState(false)
  const [runningAuto, setRunningAuto] = useState(false)

  // Selective Purge State
  const [selectedTargets, setSelectedTargets] = useState(['audit_logs', 'notifications'])
  const [filterType, setFilterType] = useState('older_than_days') // 'older_than_days' | 'date_range' | 'all_records'
  const [olderThanDays, setOlderThanDays] = useState(90)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [createBackupFirst, setCreateBackupFirst] = useState(true)

  // Preview & Modal State
  const [previewing, setPreviewing] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmInput, setConfirmInput] = useState('')
  const [purging, setPurging] = useState(false)
  const [lastPurgeResult, setLastPurgeResult] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, policyRes] = await Promise.all([
        dataRetentionApi.getStats(),
        dataRetentionApi.getPolicy(),
      ])
      setStats(statsRes.data)
      setPolicy(policyRes.data)
      setPolicyForm(policyRes.data)
    } catch (err) {
      console.error(err)
      toast?.error?.(getApiErrorMessage(err, 'Failed to load retention data'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleTarget = (targetId) => {
    setSelectedTargets((prev) =>
      prev.includes(targetId) ? prev.filter((id) => id !== targetId) : [...prev, targetId]
    )
    setPreviewData(null)
  }

  const handleSelectAllTargets = () => {
    if (selectedTargets.length === TARGET_ENTITIES.length) {
      setSelectedTargets([])
    } else {
      setSelectedTargets(TARGET_ENTITIES.map((t) => t.id))
    }
    setPreviewData(null)
  }

  const handleSavePolicy = async (e) => {
    e.preventDefault()
    setSavingPolicy(true)
    try {
      const res = await dataRetentionApi.updatePolicy(policyForm)
      setPolicy(res.data)
      setPolicyForm(res.data)
      toast?.success?.('Data retention policy updated successfully')
    } catch (err) {
      toast?.error?.(getApiErrorMessage(err, 'Failed to save policy'))
    } finally {
      setSavingPolicy(false)
    }
  }

  const handleRunAutoCleanupNow = async () => {
    if (!window.confirm('Run automated retention cleanup now? Expired records will be permanently removed.')) {
      return
    }
    setRunningAuto(true)
    try {
      const res = await dataRetentionApi.runAutoCleanupNow()
      toast?.success?.(res.data.message || 'Auto-cleanup completed successfully')
      fetchData()
    } catch (err) {
      toast?.error?.(getApiErrorMessage(err, 'Failed to run auto cleanup'))
    } finally {
      setRunningAuto(false)
    }
  }

  const handlePreviewPurge = async () => {
    if (selectedTargets.length === 0) {
      toast?.error?.('Please select at least one dataset to purge')
      return
    }
    setPreviewing(true)
    try {
      const res = await dataRetentionApi.previewPurge({
        targets: selectedTargets,
        filter_type: filterType,
        older_than_days: filterType === 'older_than_days' ? parseInt(olderThanDays, 10) : null,
        start_date: filterType === 'date_range' ? startDate : null,
        end_date: filterType === 'date_range' ? endDate : null,
      })
      setPreviewData(res.data)
      if (res.data.total_records === 0) {
        toast?.info?.('No records matched the selected criteria')
      } else {
        toast?.success?.(`Found ${res.data.total_records} record(s) matching criteria`)
      }
    } catch (err) {
      toast?.error?.(getApiErrorMessage(err, 'Failed to calculate purge preview'))
    } finally {
      setPreviewing(false)
    }
  }

  const handleExecutePurge = async () => {
    if (confirmInput.trim().toUpperCase() !== 'PURGE DATA') {
      toast?.error?.("Please type 'PURGE DATA' to confirm")
      return
    }
    setPurging(true)
    try {
      const res = await dataRetentionApi.executePurge({
        targets: selectedTargets,
        filter_type: filterType,
        older_than_days: filterType === 'older_than_days' ? parseInt(olderThanDays, 10) : null,
        start_date: filterType === 'date_range' ? startDate : null,
        end_date: filterType === 'date_range' ? endDate : null,
        create_backup_first: createBackupFirst,
        confirmation_phrase: confirmInput,
      })
      setLastPurgeResult(res.data)
      setShowConfirmModal(false)
      setConfirmInput('')
      setPreviewData(null)
      toast?.success?.(res.data.message || 'Selective data purge executed successfully')
      fetchData()
    } catch (err) {
      toast?.error?.(getApiErrorMessage(err, 'Purge execution failed'))
    } finally {
      setPurging(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
              <TrashIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-[28px] font-bold text-gray-900 tracking-tight">Data Retention & Purge</h1>
              <p className="text-sm text-gray-500">
                Automated older data clearing, scheduled retention policies, and selective data management
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className={btnSecondary}
            title="Refresh statistics"
          >
            <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link to="/admin/backup" className={btnSecondary}>
            <DatabaseIcon className="w-4 h-4 text-emerald-600" />
            Backups & Snapshots
          </Link>
        </div>
      </div>

      {/* ── Summary Stats Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[22px] border border-gray-100 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Live Records</span>
            <span className="p-1.5 rounded-xl bg-blue-50 text-blue-600"><LayersIcon className="w-4 h-4" /></span>
          </div>
          <p className="text-2xl font-black text-gray-900 mt-2">
            {stats ? stats.total_records.toLocaleString() : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Across all database tables</p>
        </div>

        <div className="rounded-[22px] border border-gray-100 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Disk Backups</span>
            <span className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600"><DatabaseIcon className="w-4 h-4" /></span>
          </div>
          <p className="text-2xl font-black text-gray-900 mt-2">
            {stats ? `${stats.backup_count} (${stats.backup_total_size_human})` : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Stored snapshot archives</p>
        </div>

        <div className="rounded-[22px] border border-gray-100 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Auto-Retention</span>
            <span className={`p-1.5 rounded-xl ${policy?.auto_cleanup_enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
              <ShieldCheckIcon className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-gray-900 mt-2">
            {policy ? (policy.auto_cleanup_enabled ? `Every ${policy.cleanup_frequency_days}d` : 'Disabled') : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Automated scheduled pruning</p>
        </div>

        <div className="rounded-[22px] border border-gray-100 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Last Cleanup</span>
            <span className="p-1.5 rounded-xl bg-purple-50 text-purple-600"><ClockIcon className="w-4 h-4" /></span>
          </div>
          <p className="text-sm font-bold text-gray-900 mt-3 truncate" title={policy?.last_auto_cleanup_at}>
            {policy?.last_auto_cleanup_at ? formatDateTime(policy.last_auto_cleanup_at) : 'Never executed'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {policy?.next_scheduled_cleanup_at ? `Next: ${formatDateTime(policy.next_scheduled_cleanup_at)}` : 'On demand'}
          </p>
        </div>
      </div>

      {/* ── Navigation Tabs ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-gray-200/80 pb-px">
        <button
          onClick={() => setActiveTab('selective')}
          className={`pb-3 px-4 text-sm font-bold transition relative ${
            activeTab === 'selective'
              ? 'text-red-600 border-b-2 border-red-600'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <FilterIcon className="w-4 h-4" />
            <span>Selective Data Purge</span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('policy')}
          className={`pb-3 px-4 text-sm font-bold transition relative ${
            activeTab === 'policy'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <ClockIcon className="w-4 h-4" />
            <span>Automated Retention Policies</span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('storage')}
          className={`pb-3 px-4 text-sm font-bold transition relative ${
            activeTab === 'storage'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <LayersIcon className="w-4 h-4" />
            <span>Table & Storage Inspector</span>
          </div>
        </button>
      </div>

      {/* ── TAB 1: SELECTIVE DATA PURGE ──────────────────────────────────────── */}
      {activeTab === 'selective' && (
        <div className="space-y-6">
          {/* Last purge execution result alert */}
          {lastPurgeResult && (
            <div className="rounded-[20px] bg-emerald-50 border border-emerald-200 p-5 text-emerald-900 flex items-start justify-between gap-4">
              <div>
                <h4 className="font-bold flex items-center gap-2 text-emerald-900">
                  <ShieldCheckIcon className="w-5 h-5 text-emerald-600 shrink-0" />
                  {lastPurgeResult.message}
                </h4>
                <div className="text-xs text-emerald-700 mt-2 space-y-1">
                  <p>
                    <strong>Timestamp:</strong> {formatDateTime(lastPurgeResult.purged_at)} | <strong>Executed by:</strong> {lastPurgeResult.purged_by}
                  </p>
                  {lastPurgeResult.backup_filename && (
                    <p className="font-medium text-emerald-800">
                      🛡️ Pre-purge backup snapshot saved: <code>{lastPurgeResult.backup_filename}</code>
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2 pt-1">
                    {Object.entries(lastPurgeResult.purged_counts || {}).map(([key, count]) => (
                      <span key={key} className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-semibold">
                        {key}: {count.toLocaleString()} deleted
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setLastPurgeResult(null)}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 px-2 py-1"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Selective Purge Main Panel */}
          <div className={cardCls}>
            <div className="p-6 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Select Datasets to Cleanse</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Choose which data categories to target for selective or historical deletion.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSelectAllTargets}
                  className="text-xs font-bold text-primary-600 hover:text-primary-700 underline self-start sm:self-auto"
                >
                  {selectedTargets.length === TARGET_ENTITIES.length ? 'Deselect All' : 'Select All Datasets'}
                </button>
              </div>

              {/* Target Entity Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                {TARGET_ENTITIES.map((entity) => {
                  const isChecked = selectedTargets.includes(entity.id)
                  const count = stats?.tables?.find((t) => t.table_name === entity.id || t.table_name.startsWith(entity.id))?.record_count
                  return (
                    <label
                      key={entity.id}
                      className={`cursor-pointer border rounded-2xl p-3.5 flex flex-col justify-between transition ${
                        isChecked
                          ? 'bg-red-50/60 border-red-200 ring-2 ring-red-500/20'
                          : 'bg-gray-50/50 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{entity.icon}</span>
                          <span className="text-xs font-bold text-gray-900 leading-tight">{entity.label}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleTarget(entity.id)}
                          className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                        />
                      </div>
                      <p className="text-[11px] text-gray-500 mt-2 leading-relaxed line-clamp-2">
                        {entity.description}
                      </p>
                      {count !== undefined && (
                        <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                          <span>Live records:</span>
                          <span className="font-bold text-gray-800">{count.toLocaleString()}</span>
                        </div>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Filter Criteria Section */}
            <div className="p-6 bg-gray-50/40 space-y-5 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <FilterIcon className="w-4 h-4 text-gray-500" />
                Filter Criteria
              </h3>

              {/* Filter Type Tabs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className={`cursor-pointer border rounded-2xl p-4 flex items-center gap-3 transition ${
                  filterType === 'older_than_days' ? 'bg-white border-primary-500 ring-2 ring-primary-500/20' : 'bg-white border-gray-200'
                }`}>
                  <input
                    type="radio"
                    name="filterType"
                    checked={filterType === 'older_than_days'}
                    onChange={() => { setFilterType('older_than_days'); setPreviewData(null) }}
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-gray-900">Older than X Days</p>
                    <p className="text-[11px] text-gray-500">Delete records created before a relative age threshold</p>
                  </div>
                </label>

                <label className={`cursor-pointer border rounded-2xl p-4 flex items-center gap-3 transition ${
                  filterType === 'date_range' ? 'bg-white border-primary-500 ring-2 ring-primary-500/20' : 'bg-white border-gray-200'
                }`}>
                  <input
                    type="radio"
                    name="filterType"
                    checked={filterType === 'date_range'}
                    onChange={() => { setFilterType('date_range'); setPreviewData(null) }}
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-gray-900">Custom Date Range</p>
                    <p className="text-[11px] text-gray-500">Delete records within a start and end calendar range</p>
                  </div>
                </label>

                <label className={`cursor-pointer border rounded-2xl p-4 flex items-center gap-3 transition ${
                  filterType === 'all_records' ? 'bg-white border-red-500 ring-2 ring-red-500/20' : 'bg-white border-gray-200'
                }`}>
                  <input
                    type="radio"
                    name="filterType"
                    checked={filterType === 'all_records'}
                    onChange={() => { setFilterType('all_records'); setPreviewData(null) }}
                    className="text-red-600 focus:ring-red-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-red-600">All Records (Wipe Category)</p>
                    <p className="text-[11px] text-gray-500">Wipe all records in the selected categories</p>
                  </div>
                </label>
              </div>

              {/* Filter Parameters */}
              {filterType === 'older_than_days' && (
                <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <label className="text-xs font-bold text-gray-700">
                      Delete records older than: <span className="text-primary-600 font-extrabold">{olderThanDays} days</span>
                    </label>
                    {/* Quick Presets */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[7, 30, 60, 90, 180, 365].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => { setOlderThanDays(d); setPreviewData(null) }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                            olderThanDays === d
                              ? 'bg-primary-600 text-white shadow-sm'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {d}d
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="730"
                    step="1"
                    value={olderThanDays}
                    onChange={(e) => { setOlderThanDays(Number(e.target.value)); setPreviewData(null) }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                </div>
              )}

              {filterType === 'date_range' && (
                <div className="bg-white rounded-2xl border border-gray-200 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Start Date (From)</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => { setStartDate(e.target.value); setPreviewData(null) }}
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">End Date (To)</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => { setEndDate(e.target.value); setPreviewData(null) }}
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                  </div>
                </div>
              )}

              {/* Safety Option: Pre-purge Backup Toggle */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🛡️</span>
                  <div>
                    <p className="text-xs font-bold text-emerald-950">Create Automatic Snapshot Backup Before Purging</p>
                    <p className="text-[11px] text-emerald-700">
                      Recommended. Automatically saves a full database JSON archive so any deleted data can be restored if needed.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={createBackupFirst}
                  onChange={(e) => setCreateBackupFirst(e.target.checked)}
                  className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Action Bar & Preview Output */}
            <div className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handlePreviewPurge}
                  disabled={previewing || selectedTargets.length === 0}
                  className={btnSecondary}
                >
                  {previewing ? <SpinnerIcon className="w-4 h-4 text-gray-500" /> : <FilterIcon className="w-4 h-4 text-gray-600" />}
                  <span>Preview Impact & Record Count</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={selectedTargets.length === 0}
                  className={btnDanger}
                >
                  <TrashIcon className="w-4 h-4 text-white" />
                  <span>Execute Selective Purge</span>
                </button>
              </div>

              {/* Preview Box */}
              {previewData && (
                <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-5 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2.5">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Purge Simulation Preview</h4>
                      <p className="text-xs text-gray-700 font-semibold mt-0.5">{previewData.filter_description}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-gray-500">Impacted: </span>
                      <span className="text-base font-black text-red-600">{previewData.total_records.toLocaleString()} records</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {Object.entries(previewData.targets_summary || {}).map(([key, count]) => (
                      <div key={key} className="bg-white rounded-xl border border-gray-200 p-2.5 text-center">
                        <p className="text-[10px] font-bold uppercase text-gray-400 truncate">{key}</p>
                        <p className="text-sm font-black text-gray-900 mt-0.5">{count.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>

                  {previewData.warning_messages?.length > 0 && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-start gap-2">
                      <AlertTriangleIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        {previewData.warning_messages.map((w, idx) => (
                          <p key={idx}>{w}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: AUTOMATED RETENTION POLICIES ───────────────────────────────── */}
      {activeTab === 'policy' && policyForm && (
        <form onSubmit={handleSavePolicy} className="space-y-6">
          <div className={cardCls}>
            <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Automated Data Lifecycle Policies</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Configure automatic background deletion policies to keep the system fast and compliant.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRunAutoCleanupNow}
                disabled={runningAuto}
                className={btnSecondary}
              >
                {runningAuto ? <SpinnerIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4 text-primary-600" />}
                Run Auto-Cleanup Now
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Master Toggle */}
              <div className="flex items-center justify-between p-4 rounded-2xl border border-gray-200 bg-gray-50/50">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Enable Automated Scheduled Cleanup</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    When active, the system automatically purges expired records based on configured retention thresholds.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={policyForm.auto_cleanup_enabled}
                  onChange={(e) => setPolicyForm({ ...policyForm, auto_cleanup_enabled: e.target.checked })}
                  className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                />
              </div>

              {/* Execution Frequency */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700">
                  Cleanup Frequency (Days between automatic runs)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={policyForm.cleanup_frequency_days}
                    onChange={(e) => setPolicyForm({ ...policyForm, cleanup_frequency_days: parseInt(e.target.value || '1', 10) })}
                    className="w-32 rounded-xl border border-gray-200 px-3.5 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                  <span className="text-xs text-gray-500">Days (Default: 7 days)</span>
                </div>
              </div>

              {/* Entity Retention Windows Grid */}
              <div className="pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">
                  Retention Thresholds (0 = Retain Indefinitely)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl border border-gray-200 bg-white space-y-2">
                    <label className="block text-xs font-bold text-gray-800">📋 Audit Logs</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={policyForm.retention_audit_logs_days}
                        onChange={(e) => setPolicyForm({ ...policyForm, retention_audit_logs_days: parseInt(e.target.value || '0', 10) })}
                        className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm"
                      />
                      <span className="text-xs text-gray-500">days</span>
                    </div>
                    <p className="text-[11px] text-gray-400">Default: 90 days</p>
                  </div>

                  <div className="p-4 rounded-2xl border border-gray-200 bg-white space-y-2">
                    <label className="block text-xs font-bold text-gray-800">🔔 Notifications</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={policyForm.retention_notifications_days}
                        onChange={(e) => setPolicyForm({ ...policyForm, retention_notifications_days: parseInt(e.target.value || '0', 10) })}
                        className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm"
                      />
                      <span className="text-xs text-gray-500">days</span>
                    </div>
                    <p className="text-[11px] text-gray-400">Default: 30 days</p>
                  </div>

                  <div className="p-4 rounded-2xl border border-gray-200 bg-white space-y-2">
                    <label className="block text-xs font-bold text-gray-800">💾 Backups (Max Count)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={policyForm.retention_backups_max_count}
                        onChange={(e) => setPolicyForm({ ...policyForm, retention_backups_max_count: parseInt(e.target.value || '1', 10) })}
                        className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm"
                      />
                      <span className="text-xs text-gray-500">backups</span>
                    </div>
                    <p className="text-[11px] text-gray-400">Keep newest {policyForm.retention_backups_max_count} backups</p>
                  </div>

                  <div className="p-4 rounded-2xl border border-gray-200 bg-white space-y-2">
                    <label className="block text-xs font-bold text-gray-800">💾 Backups (Max Age)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={policyForm.retention_backups_days}
                        onChange={(e) => setPolicyForm({ ...policyForm, retention_backups_days: parseInt(e.target.value || '0', 10) })}
                        className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm"
                      />
                      <span className="text-xs text-gray-500">days</span>
                    </div>
                    <p className="text-[11px] text-gray-400">Default: 60 days</p>
                  </div>

                  <div className="p-4 rounded-2xl border border-gray-200 bg-white space-y-2">
                    <label className="block text-xs font-bold text-gray-800">🏖️ Completed Leave Records</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={policyForm.retention_leaves_days}
                        onChange={(e) => setPolicyForm({ ...policyForm, retention_leaves_days: parseInt(e.target.value || '0', 10) })}
                        className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm"
                      />
                      <span className="text-xs text-gray-500">days</span>
                    </div>
                    <p className="text-[11px] text-gray-400">Approved/Rejected past leaves</p>
                  </div>

                  <div className="p-4 rounded-2xl border border-gray-200 bg-white space-y-2">
                    <label className="block text-xs font-bold text-gray-800">💳 Credit Transactions</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={policyForm.retention_credits_days}
                        onChange={(e) => setPolicyForm({ ...policyForm, retention_credits_days: parseInt(e.target.value || '0', 10) })}
                        className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm"
                      />
                      <span className="text-xs text-gray-500">days</span>
                    </div>
                    <p className="text-[11px] text-gray-400">Historical transaction logs</p>
                  </div>

                  <div className="p-4 rounded-2xl border border-gray-200 bg-white space-y-2">
                    <label className="block text-xs font-bold text-gray-800">📅 Timetable Submissions</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={policyForm.retention_timetable_submissions_days}
                        onChange={(e) => setPolicyForm({ ...policyForm, retention_timetable_submissions_days: parseInt(e.target.value || '0', 10) })}
                        className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm"
                      />
                      <span className="text-xs text-gray-500">days</span>
                    </div>
                    <p className="text-[11px] text-gray-400">Historical review requests</p>
                  </div>

                  <div className="p-4 rounded-2xl border border-gray-200 bg-white space-y-2">
                    <label className="block text-xs font-bold text-gray-800">📊 Traffic Logs</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={policyForm.retention_traffic_days}
                        onChange={(e) => setPolicyForm({ ...policyForm, retention_traffic_days: parseInt(e.target.value || '0', 10) })}
                        className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm"
                      />
                      <span className="text-xs text-gray-500">days</span>
                    </div>
                    <p className="text-[11px] text-gray-400">Default: 30 days</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex items-center justify-end">
              <button
                type="submit"
                disabled={savingPolicy}
                className={btnPrimary}
              >
                {savingPolicy ? <SpinnerIcon className="w-4 h-4" /> : <ShieldCheckIcon className="w-4 h-4" />}
                Save Retention Policy
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── TAB 3: TABLE & STORAGE INSPECTOR ──────────────────────────────────── */}
      {activeTab === 'storage' && stats && (
        <div className="space-y-6">
          <div className={cardCls}>
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Database Table & Storage Inspector</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Overview of all tables, record counts, and oldest/newest timestamps across the application database.
              </p>
            </div>

            <div className="divide-y divide-gray-100">
              {stats.tables?.map((table) => (
                <div key={table.table_name} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/60 transition">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-bold text-gray-900">{table.display_name}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">
                        {table.category}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{table.table_name}</p>
                  </div>

                  <div className="flex items-center gap-6 text-xs text-gray-500">
                    {table.oldest_record_at && (
                      <div>
                        <span className="text-gray-400 block text-[10px] uppercase font-bold">Oldest Record</span>
                        <span className="font-medium text-gray-700">{formatDateTime(table.oldest_record_at)}</span>
                      </div>
                    )}
                    <div className="text-right min-w-[80px]">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Records</span>
                      <span className="text-sm font-black text-gray-900">{table.record_count.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRMATION MODAL FOR SELECTIVE PURGE ───────────────────────────── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[28px] max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangleIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Confirm Destructive Selective Purge</h3>
                <p className="text-xs text-gray-500 mt-1">
                  You are about to permanently delete records matching your filter from{' '}
                  <strong>{selectedTargets.length} dataset(s)</strong>.
                </p>
              </div>
            </div>

            {createBackupFirst ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
                <span>🛡️</span>
                <span>An automatic snapshot backup will be created immediately before data is deleted.</span>
              </div>
            ) : (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-800 flex items-center gap-2">
                <AlertTriangleIcon className="w-4 h-4 text-red-600 shrink-0" />
                <span>Caution: Snapshot backup is disabled. Deleted records cannot be restored!</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700">
                To confirm, type <span className="font-extrabold text-red-600">PURGE DATA</span> below:
              </label>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="PURGE DATA"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowConfirmModal(false); setConfirmInput('') }}
                disabled={purging}
                className={btnSecondary}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecutePurge}
                disabled={purging || confirmInput.trim().toUpperCase() !== 'PURGE DATA'}
                className={btnDanger}
              >
                {purging ? <SpinnerIcon className="w-4 h-4" /> : <TrashIcon className="w-4 h-4" />}
                <span>{purging ? 'Purging Records…' : 'Confirm & Purge Records'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
