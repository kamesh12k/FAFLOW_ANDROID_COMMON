import { useEffect, useState, useMemo, useCallback } from 'react'
import { attendanceApi, departmentsApi } from '../../api/services'
import { getApiErrorMessage } from '../../api/client'
import { Spinner, ErrorAlert, EmptyState } from '../../components/ui'

export default function AdminAttendance() {
  const [liveData, setLiveData] = useState(null)
  const [departments, setDepartments] = useState([])
  const [selectedDept, setSelectedDept] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL') // ALL, CHECKED_IN, CHECKED_OUT, NOT_REPORTED
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [lastRefreshed, setLastRefreshed] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

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

  const records = useMemo(() => {
    return liveData?.active_shifts || []
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

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Real-Time Attendance & Shift Monitor</h1>
          <p className="text-sm text-gray-500 mt-1">
            Authoritative institutional attendance ledger. Tracks live faculty and staff presence, on-campus geofence verification, and shift duration.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer bg-white px-3 py-2 rounded-xl border border-gray-200 shadow-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4"
            />
            <span>Auto-refresh (20s)</span>
          </label>

          <button
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition shadow-sm disabled:opacity-60"
          >
            <svg
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Active Staff</span>
          <p className="text-2xl font-bold text-gray-900 mt-1">{liveData?.total_staff ?? '—'}</p>
          <span className="text-xs text-gray-500 mt-1 block">Registered institutional personnel</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Currently On-Campus</span>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{liveData?.checked_in_count ?? '—'}</p>
          <span className="text-xs text-emerald-600 mt-1 block">Checked in & working</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-sky-600 uppercase tracking-wider">Shifts Completed</span>
          <p className="text-2xl font-bold text-sky-700 mt-1">{liveData?.checked_out_count ?? '—'}</p>
          <span className="text-xs text-sky-600 mt-1 block">Checked out for today</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Not Reported Yet</span>
          <p className="text-2xl font-bold text-amber-700 mt-1">{liveData?.absent_count ?? '—'}</p>
          <span className="text-xs text-amber-600 mt-1 block">Pending check-in or on leave</span>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              statusFilter === 'ALL'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Today ({records.length})
          </button>
          <button
            onClick={() => setStatusFilter('CHECKED_IN')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              statusFilter === 'CHECKED_IN'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Checked In ({liveData?.checked_in_count ?? 0})
          </button>
          <button
            onClick={() => setStatusFilter('CHECKED_OUT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              statusFilter === 'CHECKED_OUT'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Completed ({liveData?.checked_out_count ?? 0})
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {departments.length > 0 && (
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 w-full sm:w-auto"
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
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <svg
              className="w-4 h-4 text-gray-400 absolute left-3 top-2.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center items-center">
            <Spinner />
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
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Staff Name</th>
                  <th className="px-5 py-3">Check-In Time</th>
                  <th className="px-5 py-3">Check-Out Time</th>
                  <th className="px-5 py-3">Duration</th>
                  <th className="px-5 py-3">Campus Perimeter</th>
                  <th className="px-5 py-3">Biometric & Liveness</th>
                  <th className="px-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {filteredRecords.map((rec) => {
                  const isPresent = rec.check_in_time && !rec.check_out_time
                  const isCompleted = Boolean(rec.check_out_time)

                  return (
                    <tr key={rec.id} className="hover:bg-gray-50/70 transition">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-gray-900">{rec.staff_name || 'Staff Member'}</div>
                        <div className="text-[11px] text-gray-400">ID: {rec.user_id}</div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-800 font-mono">
                        {rec.check_in_time || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-800 font-mono">
                        {rec.check_out_time || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {rec.working_hours ? `${rec.working_hours.toFixed(1)} hrs` : isPresent ? 'In Progress' : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          {rec.check_in_geofence_name || 'Campus Geofence'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-gray-800">
                            {(rec.face_similarity_score * 100).toFixed(0)}%
                          </span>
                          {rec.liveness_verified && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              PAD Verified
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {isPresent && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            Present
                          </span>
                        )}
                        {isCompleted && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800">
                            Completed
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {lastRefreshed && (
          <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-400 flex items-center justify-between">
            <span>Last synchronized: {lastRefreshed.toLocaleTimeString()}</span>
            <span>Server Authoritative Geofence & Biometric Gate Active</span>
          </div>
        )}
      </div>
    </div>
  )
}
