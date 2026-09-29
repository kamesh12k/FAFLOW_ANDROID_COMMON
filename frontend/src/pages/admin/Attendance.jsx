import { useEffect, useState, useMemo, useCallback } from 'react'
import { attendanceApi, departmentsApi } from '../../api/services'
import { getApiErrorMessage } from '../../api/client'
import { 
  ErrorAlert, 
  EmptyState, 
  Modal, 
  Button, 
  StatusBadge, 
  SkeletonTable,
  Pagination,
  formatErrorMessage
} from '../../components/ui'

export default function AdminAttendance() {
  const [liveData, setLiveData] = useState(null)
  const [departments, setDepartments] = useState([])
  const [selectedDept, setSelectedDept] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL') // ALL, CHECKED_IN, CHECKED_OUT
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [lastRefreshed, setLastRefreshed] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [recordToDelete, setRecordToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const handleDeleteRecord = async () => {
    if (!recordToDelete) return
    setDeleting(true)
    setDeleteError('')
    try {
      await attendanceApi.deleteRecord(recordToDelete.id)
      setRecordToDelete(null)
      await loadData(true)
    } catch (err) {
      setDeleteError(getApiErrorMessage(err, 'Failed to delete attendance record.'))
    } finally {
      setDeleting(false)
    }
  }

  const loadData = useCallback(async (isSilent = false) => {
    if (isSilent) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      const [liveRes, deptRes] = await Promise.all([
        attendanceApi.getSupervisorLiveStatus(),
        departmentsApi.list(false),
      ])
      setLiveData(liveRes.data)
      setDepartments(deptRes.data || [])
      setLastRefreshed(new Date())
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to fetch real-time institutional attendance status.'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Auto-refresh timer every 20 seconds
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      loadData(true)
    }, 20000)
    return () => clearInterval(interval)
  }, [autoRefresh, loadData])

  const formatTime = (isoString) => {
    if (!isoString) return '—'
    try {
      const d = new Date(isoString)
      if (isNaN(d.getTime())) return isoString
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return isoString
    }
  }

  const records = useMemo(() => {
    const list = liveData?.all_shifts || liveData?.active_shifts || []
    return Array.isArray(list) ? list : []
  }, [liveData])

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const name = r.staff_name?.toLowerCase() || ''
      const dept = r.department_name?.toLowerCase() || ''
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch = !q || name.includes(q) || dept.includes(q)

      const matchesDept = !selectedDept || String(r.department_id) === String(selectedDept)

      let matchesStatus = true
      if (statusFilter === 'CHECKED_IN') {
        matchesStatus = r.check_in_time && !r.check_out_time
      } else if (statusFilter === 'CHECKED_OUT') {
        matchesStatus = Boolean(r.check_out_time)
      }

      return matchesSearch && matchesDept && matchesStatus
    })
  }, [records, searchQuery, selectedDept, statusFilter])

  // Paginated records
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRecords.slice(start, start + pageSize)
  }, [filteredRecords, currentPage, pageSize])

  // CSV Export handler
  const handleExportCsv = () => {
    if (filteredRecords.length === 0) return
    const headers = ['Record ID', 'User ID', 'Staff Name', 'Department', 'Date', 'Check In', 'Check Out', 'Working Hours', 'Geofence', 'Similarity %', 'Liveness']
    const rows = filteredRecords.map(r => [
      r.id,
      r.user_id,
      `"${r.staff_name || ''}"`,
      `"${r.department_name || ''}"`,
      r.attendance_date || '',
      r.check_in_time || '',
      r.check_out_time || '',
      r.working_hours || '',
      `"${r.check_in_geofence_name || ''}"`,
      r.face_similarity_score != null ? Math.round(r.face_similarity_score * 100) : '',
      r.liveness_verified ? 'YES' : 'NO'
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `faflow_attendance_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Real-Time Attendance & Shift Monitor</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Authoritative institutional attendance ledger with on-campus geofencing and biometric verification.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer bg-white px-3 py-2 rounded-xl border border-[#E6E8EC] shadow-xs">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4"
            />
            <span>Auto-refresh (20s)</span>
          </label>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={filteredRecords.length === 0}
          >
            Export CSV
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => loadData(true)}
            loading={refreshing}
            disabled={loading}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E6E8EC] shadow-card">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Active Staff</span>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">{liveData?.total_staff ?? '—'}</p>
          <span className="text-xs text-slate-500 mt-1 block font-medium">Registered personnel</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E6E8EC] shadow-card">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Currently On-Campus</span>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-800 mt-1">{liveData?.checked_in_count ?? '—'}</p>
          <span className="text-xs text-emerald-700 mt-1 block font-medium">Checked in & verified</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E6E8EC] shadow-card">
          <span className="text-[10px] font-bold text-primary-700 uppercase tracking-wider">Shifts Completed</span>
          <p className="text-2xl sm:text-3xl font-extrabold text-primary-800 mt-1">{liveData?.checked_out_count ?? '—'}</p>
          <span className="text-xs text-primary-700 mt-1 block font-medium">Checked out for today</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E6E8EC] shadow-card">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Not Reported Yet</span>
          <p className="text-2xl sm:text-3xl font-extrabold text-amber-800 mt-1">{liveData?.absent_count ?? '—'}</p>
          <span className="text-xs text-amber-700 mt-1 block font-medium">Pending check-in or on leave</span>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-4 bg-white rounded-2xl border border-[#E6E8EC] shadow-card flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'ALL'
                ? 'bg-primary-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Today ({records.length})
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter('CHECKED_IN'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'CHECKED_IN'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Checked In ({liveData?.checked_in_count ?? 0})
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter('CHECKED_OUT'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'CHECKED_OUT'
                ? 'bg-primary-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Completed ({liveData?.checked_out_count ?? 0})
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          {departments.length > 0 && (
            <select
              value={selectedDept}
              onChange={(e) => { setSelectedDept(e.target.value); setCurrentPage(1); }}
              className="text-xs bg-white border border-[var(--color-border-control,#828C99)] rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-primary-600 w-full sm:w-auto min-h-[38px]"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          )}

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Search faculty or staff..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-3 py-2 bg-white border border-[var(--color-border-control,#828C99)] rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-primary-600 min-h-[38px]"
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3 top-2.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-2xl border border-[#E6E8EC] shadow-card overflow-hidden">
        {loading ? (
          <div className="p-4 sm:p-6">
            <SkeletonTable rows={6} cols={6} />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No Attendance Records Match Filter"
              description="No faculty or staff attendance logs match your current search, status, or department filters for today."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 min-w-[700px]">
              <thead className="sticky top-0 z-10 bg-slate-50 text-slate-700 font-bold border-b border-[#E6E8EC] uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Staff Member</th>
                  <th className="px-5 py-3.5">Check-In</th>
                  <th className="px-5 py-3.5">Check-Out</th>
                  <th className="px-5 py-3.5">Duration</th>
                  <th className="px-5 py-3.5">Perimeter</th>
                  <th className="px-5 py-3.5">Liveness & PAD</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8EC] font-medium">
                {paginatedRecords.map((rec) => {
                  const isPresent = rec.check_in_time && !rec.check_out_time
                  const isCompleted = Boolean(rec.check_out_time)

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900">{rec.staff_name || 'Staff Member'}</div>
                        <div className="text-[11px] text-slate-500 font-medium">ID: {rec.user_id} • {rec.department_name || 'General'}</div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-800 font-mono font-semibold">
                        {formatTime(rec.check_in_time)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-800 font-mono font-semibold">
                        {formatTime(rec.check_out_time)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 font-semibold">
                        {typeof rec.working_hours === 'number'
                          ? `${rec.working_hours.toFixed(1)} hrs`
                          : (rec.working_hours || (isPresent ? 'In Progress' : '—'))}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          {rec.check_in_geofence_name || 'Campus Geofence'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-800 font-mono">
                            {Number(rec.face_similarity_score != null ? rec.face_similarity_score * 100 : 0).toFixed(0)}%
                          </span>
                          {rec.liveness_verified && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              PAD Verified
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {isPresent && <StatusBadge status="present" />}
                        {isCompleted && <StatusBadge status="approved" />}
                        {!isPresent && !isCompleted && <StatusBadge status="pending" />}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setRecordToDelete(rec)
                            setDeleteError('')
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors shadow-2xs"
                          title={`Delete record #${rec.id}`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination & Status Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-[#E6E8EC] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-3">
            <span>
              Showing {filteredRecords.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} - {Math.min(currentPage * pageSize, filteredRecords.length)} of {filteredRecords.length} records
            </span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="bg-white border border-[var(--color-border-control,#828C99)] rounded-lg px-2 py-1 text-xs font-semibold text-slate-700"
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>

          <Pagination
            page={currentPage}
            totalPages={Math.max(1, Math.ceil(filteredRecords.length / pageSize))}
            onChange={setCurrentPage}
          />
        </div>
      </div>

      {/* Delete Record Confirmation Modal */}
      <Modal
        open={Boolean(recordToDelete)}
        onClose={() => {
          if (!deleting) {
            setRecordToDelete(null)
            setDeleteError('')
          }
        }}
        title="Delete Attendance Record"
        size="md"
      >
        <div className="space-y-4">
          {deleteError && (
            <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-xl font-semibold">
              {formatErrorMessage(deleteError)}
            </div>
          )}

          <p className="text-sm text-slate-600 font-medium leading-relaxed">
            Are you sure you want to permanently delete this individual attendance entry? This action will remove the shift record from the institutional ledger.
          </p>

          {recordToDelete && (
            <div className="bg-slate-50 rounded-xl p-4 border border-[#E6E8EC] space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500 font-semibold">Staff Name:</span>
                <span className="font-bold text-slate-900">{recordToDelete.staff_name || 'Staff Member'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500 font-semibold">Record ID:</span>
                <span className="font-mono text-slate-700 font-bold">#{recordToDelete.id} (User #{recordToDelete.user_id})</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500 font-semibold">Date:</span>
                <span className="font-semibold text-slate-800">{recordToDelete.attendance_date || 'Today'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500 font-semibold">Check-In Time:</span>
                <span className="font-mono text-slate-800 font-bold">{formatTime(recordToDelete.check_in_time)}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-semibold">Check-Out Time:</span>
                <span className="font-mono text-slate-800 font-bold">{formatTime(recordToDelete.check_out_time)}</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setRecordToDelete(null)
                setDeleteError('')
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={deleting}
              onClick={handleDeleteRecord}
            >
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
