import { useState, useEffect, useMemo } from 'react'
import { studentAttendanceApi, departmentsApi, intelligenceApi } from '../../api/services'
import { Card, Spinner, Badge, Table, Tabs } from '../../components/ui'
import {
  UsersIcon, CalIcon, ClockIcon, AlertTriangleIcon, SearchIcon,
  CheckCircleIcon, XCircleIcon, DownloadIcon, LockIcon, UnlockIcon,
  FilterIcon, RefreshIcon, ChevronRightIcon, InfoIcon, SparklesIcon
} from '../../components/icons'
import { useAuth } from '../../context/AuthContext'

export default function PrincipalStudentAttendance() {
  const { user } = useAuth()
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [activeTab, setActiveTab] = useState('overview') // 'overview', 'sessions', 'matrix', 'compliance', 'exceptions'
  
  // Data States
  const [overview, setOverview] = useState(null)
  const [sessions, setSessions] = useState([])
  const [departments, setDepartments] = useState([])
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [selectedClassId, setSelectedClassId] = useState('')
  const [classesList, setClassesList] = useState([])
  
  // Matrix State
  const [matrixData, setMatrixData] = useState(null)
  const [loadingMatrix, setLoadingMatrix] = useState(false)

  // Compliance State
  const [complianceList, setComplianceList] = useState([])
  const [loadingCompliance, setLoadingCompliance] = useState(false)

  // Exceptions State
  const [exceptionsList, setExceptionsList] = useState([])
  const [exceptionTypeFilter, setExceptionTypeFilter] = useState('')
  const [loadingExceptions, setLoadingExceptions] = useState(false)

  // Student Profile Modal
  const [profileStudentId, setProfileStudentId] = useState(null)
  const [studentProfile, setStudentProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)

  // Live Academic Intelligence State
  const [liveIntelligence, setLiveIntelligence] = useState(null)
  const [intelligenceEvents, setIntelligenceEvents] = useState([])
  const [loadingIntelligence, setLoadingIntelligence] = useState(false)
  const [lastPollTime, setLastPollTime] = useState(Date.now())
  const [intelSeverityFilter, setIntelSeverityFilter] = useState('')
  const [intelTypeFilter, setIntelTypeFilter] = useState('')
  const [secondsAgo, setSecondsAgo] = useState(0)

  // Admin Override / Lock Modal
  const [lockTargetSession, setLockTargetSession] = useState(null)
  const [lockReason, setLockReason] = useState('')
  const [overrideTarget, setOverrideTarget] = useState(null) // { sessionId, studentId, studentName, currentStatus }
  const [overrideStatus, setOverrideStatus] = useState('present')
  const [overrideReason, setOverrideReason] = useState('')
  const [actionSubmitting, setActionSubmitting] = useState(false)

  // UI state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [exporting, setExporting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // 1. Load Overview & Departments
  const loadOverviewAndDepts = async (targetDate) => {
    try {
      setLoading(true)
      setError('')
      const [ovRes, deptRes] = await Promise.all([
        studentAttendanceApi.getPrincipalOverview(targetDate),
        departmentApi.list().catch(() => ({ data: [] }))
      ])
      setOverview(ovRes.data)
      setDepartments(deptRes.data || [])
    } catch (err) {
      console.error('Failed to load Principal overview', err)
      setError(err.response?.data?.detail || 'Failed to load institutional attendance overview.')
    } finally {
      setLoading(false)
    }
  }

  // 2. Load Sessions List
  const loadSessions = async (targetDate, deptId) => {
    try {
      const params = { target_date: targetDate }
      if (deptId) params.department_id = deptId
      const res = await studentAttendanceApi.getPrincipalSessions(params)
      setSessions(res.data || [])
      
      // Extract unique classes for cascading dropdown
      const uniqueClasses = []
      const seen = new Set()
      for (const s of (res.data || [])) {
        if (!seen.has(s.class_id)) {
          seen.add(s.class_id)
          uniqueClasses.push({ id: s.class_id, name: `${s.class_name} (${s.section})`, department_id: s.department_id })
        }
      }
      setClassesList(uniqueClasses)
    } catch (err) {
      console.error('Failed to load sessions', err)
    }
  }

  // 3. Load Matrix
  const loadMatrix = async (classId, targetDate) => {
    if (!classId) return
    try {
      setLoadingMatrix(true)
      const res = await studentAttendanceApi.getClassPeriodMatrix(classId, targetDate)
      setMatrixData(res.data)
    } catch (err) {
      console.error('Failed to load class matrix', err)
      setError(err.response?.data?.detail || 'Failed to load class attendance matrix.')
    } finally {
      setLoadingMatrix(false)
    }
  }

  // 4. Load Compliance
  const loadCompliance = async (targetDate, deptId) => {
    try {
      setLoadingCompliance(true)
      const params = { target_date: targetDate }
      if (deptId) params.department_id = deptId
      const res = await studentAttendanceApi.getTeacherCompliance(params)
      setComplianceList(res.data || [])
    } catch (err) {
      console.error('Failed to load compliance', err)
    } finally {
      setLoadingCompliance(false)
    }
  }

  // 5. Load Exceptions
  const loadExceptions = async (targetDate, typeFilter, deptId) => {
    try {
      setLoadingExceptions(true)
      const params = { target_date: targetDate }
      if (typeFilter) params.exception_type = typeFilter
      if (deptId) params.department_id = deptId
      const res = await studentAttendanceApi.getPrincipalExceptions(params)
      setExceptionsList(res.data || [])
    } catch (err) {
      console.error('Failed to load exceptions', err)
    } finally {
      setLoadingExceptions(false)
    }
  }

  // 6. Load Student Profile
  const openStudentProfile = async (studentId) => {
    try {
      setProfileStudentId(studentId)
      setLoadingProfile(true)
      const res = await studentAttendanceApi.getStudentProfile(studentId)
      setStudentProfile(res.data)
    } catch (err) {
      console.error('Failed to load student profile', err)
      setError(err.response?.data?.detail || 'Failed to load student profile.')
    } finally {
      setLoadingProfile(false)
    }
  }

  // 7. Load Live Intelligence
  const loadLiveIntelligence = async (targetDate, deptId) => {
    try {
      const params = { date: targetDate }
      if (deptId) params.department_id = deptId
      const [liveRes, evRes] = await Promise.all([
        intelligenceApi.getLive(params),
        intelligenceApi.getEvents(params),
      ])
      setLiveIntelligence(liveRes.data)
      setIntelligenceEvents(evRes.data || [])
      setLastPollTime(Date.now())
    } catch (err) {
      console.warn('Live intelligence poll failed', err)
    }
  }

  const handleAcknowledgeEvent = async (eventId) => {
    try {
      await intelligenceApi.acknowledgeEvent(eventId)
      setIntelligenceEvents(prev => prev.map(e => e.id === eventId ? { ...e, state: 'acknowledged' } : e))
      if (liveIntelligence) {
        setLiveIntelligence(prev => ({
          ...prev,
          needs_attention_count: Math.max(0, (prev?.needs_attention_count || 1) - 1)
        }))
      }
      setSuccessMsg('Operational event acknowledged.')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      setError('Failed to acknowledge event')
    }
  }

  // Effects
  useEffect(() => {
    loadOverviewAndDepts(selectedDate)
    loadSessions(selectedDate, selectedDeptId)
    loadLiveIntelligence(selectedDate, selectedDeptId)

    // Continuous Live Polling every 15 seconds
    const pollInterval = setInterval(() => {
      loadLiveIntelligence(selectedDate, selectedDeptId)
    }, 15000)
    return () => clearInterval(pollInterval)
  }, [selectedDate, selectedDeptId])

  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastPollTime) / 1000))
    }, 1000)
    return () => clearInterval(tick)
  }, [lastPollTime])

  useEffect(() => {
    if (activeTab === 'intelligence') {
      loadLiveIntelligence(selectedDate, selectedDeptId)
    } else if (activeTab === 'sessions') {
      loadSessions(selectedDate, selectedDeptId)
    } else if (activeTab === 'matrix') {
      if (selectedClassId) {
        loadMatrix(selectedClassId, selectedDate)
      } else if (classesList.length > 0) {
        setSelectedClassId(classesList[0].id)
        loadMatrix(classesList[0].id, selectedDate)
      }
    } else if (activeTab === 'compliance') {
      loadCompliance(selectedDate, selectedDeptId)
    } else if (activeTab === 'exceptions') {
      loadExceptions(selectedDate, exceptionTypeFilter, selectedDeptId)
    }
  }, [activeTab, selectedDeptId, selectedClassId, exceptionTypeFilter])


  // Handle Export
  const handleExport = async (reportType) => {
    try {
      setExporting(true)
      const params = { report_type: reportType, target_date: selectedDate }
      if (selectedDeptId) params.department_id = selectedDeptId
      const res = await studentAttendanceApi.exportReport(params)
      
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `FAFLOW_Attendance_${reportType}_${selectedDate}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setSuccessMsg(`Exported ${reportType} CSV successfully.`)
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err) {
      console.error('Export failed', err)
      setError('Failed to generate export report.')
    } finally {
      setExporting(false)
    }
  }

  // Handle Session Lock/Unlock
  const handleToggleLock = async () => {
    if (!lockTargetSession) return
    try {
      setActionSubmitting(true)
      const isLocking = lockTargetSession.status !== 'LOCKED'
      await studentAttendanceApi.adminLockSession(lockTargetSession.session_id, {
        locked: isLocking,
        reason: lockReason || (isLocking ? 'Governance review lock' : 'Governance unlocked')
      })
      setSuccessMsg(`Session ${lockTargetSession.session_id} ${isLocking ? 'locked' : 'unlocked'} successfully.`)
      setLockTargetSession(null)
      setLockReason('')
      // Refresh active view
      loadSessions(selectedDate, selectedDeptId)
      if (selectedClassId) loadMatrix(selectedClassId, selectedDate)
      loadOverviewAndDepts(selectedDate)
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update session lock state.')
    } finally {
      setActionSubmitting(false)
    }
  }

  // Handle Mark Override
  const handleAdminOverride = async () => {
    if (!overrideTarget) return
    try {
      setActionSubmitting(true)
      await studentAttendanceApi.adminOverrideAttendance(overrideTarget.sessionId, overrideTarget.studentId, {
        new_status: overrideStatus,
        reason: overrideReason || 'Principal administrative correction'
      })
      setSuccessMsg(`Attendance override applied for ${overrideTarget.studentName}.`)
      setOverrideTarget(null)
      setOverrideReason('')
      if (selectedClassId) loadMatrix(selectedClassId, selectedDate)
      if (profileStudentId) openStudentProfile(profileStudentId)
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to execute attendance override.')
    } finally {
      setActionSubmitting(false)
    }
  }

  const tabOptions = [
    { id: 'overview', label: 'Campus Overview' },
    { id: 'intelligence', label: `⚡ Live Intelligence (${liveIntelligence?.needs_attention_count ?? 0})` },
    { id: 'sessions', label: 'Period Sessions Grid' },
    { id: 'matrix', label: 'Class Matrix (Roster)' },
    { id: 'compliance', label: 'Faculty Compliance' },
    { id: 'exceptions', label: 'Risk & Exceptions' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* ── Top Header Banner ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-400/30">
            <UsersIcon className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight">Institutional Student Attendance</h1>
              <Badge variant="primary" className="bg-indigo-500/30 text-indigo-200 border-indigo-400/40 text-[10px] uppercase font-bold">
                Principal Controller
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Campus-Wide Hourly Attendance Governance, Faculty Compliance & Exception Intelligence
            </p>
          </div>
        </div>

        {/* Action Controls: Date Picker, Day Order & Export */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
            <CalIcon className="w-4 h-4 text-indigo-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white focus:outline-none font-semibold cursor-pointer"
            />
          </div>

          {overview?.day_order && (
            <span className="px-3 py-1.5 bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 text-xs font-black rounded-xl">
              Day Order {overview.day_order}
            </span>
          )}

          {/* Export Dropdown */}
          <div className="relative group">
            <button
              disabled={exporting}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-xs font-semibold text-slate-200 transition-colors"
            >
              <DownloadIcon className="w-3.5 h-3.5 text-indigo-400" />
              <span>{exporting ? 'Exporting...' : 'Export Reports'}</span>
            </button>
            <div className="hidden group-hover:block absolute right-0 mt-1 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-2 z-50 text-xs">
              <button
                onClick={() => handleExport('daily_summary')}
                className="w-full text-left px-4 py-2 hover:bg-slate-800 text-slate-200 font-medium"
              >
                Daily Institutional Summary
              </button>
              <button
                onClick={() => handleExport('shortage_list')}
                className="w-full text-left px-4 py-2 hover:bg-slate-800 text-rose-300 font-medium"
              >
                Attendance Shortage Report (&lt; 75%)
              </button>
              <button
                onClick={() => handleExport('teacher_compliance')}
                className="w-full text-left px-4 py-2 hover:bg-slate-800 text-amber-300 font-medium"
              >
                Faculty Submission Compliance
              </button>
              <button
                onClick={() => handleExport('sessions')}
                className="w-full text-left px-4 py-2 hover:bg-slate-800 text-indigo-300 font-medium"
              >
                All Scheduled Period Sessions
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── LIVE CAMPUS OPERATIONAL INTELLIGENCE BAR ── */}
      <div className="bg-slate-900 border border-indigo-500/30 shadow-lg rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span className={`h-3 w-3 rounded-full ${secondsAgo > 45 ? 'bg-amber-500' : 'bg-emerald-500 animate-ping'} absolute inline-flex`} />
            <span className={`relative h-2.5 w-2.5 rounded-full ${secondsAgo > 45 ? 'bg-amber-500' : 'bg-emerald-400'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wider text-slate-200 uppercase flex items-center gap-1.5">
                <SparklesIcon className="w-3.5 h-3.5 text-indigo-400" />
                Live Academic Intelligence
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${secondsAgo > 45 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'}`}>
                {secondsAgo > 45 ? 'STALE · RECONNECTING...' : `LIVE · UPDATED ${secondsAgo}s AGO`}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Automated continuous evaluation of attendance, coverage, dropped periods, and faculty compliance.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-3 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs">
            <div>
              <span className="text-slate-400 text-[10px] block font-semibold">SCHEDULED / CONDUCTED</span>
              <span className="font-black text-slate-100">{liveIntelligence?.scheduled_count ?? '-'} / {liveIntelligence?.conducted_count ?? '-'}</span>
            </div>
            <div className="h-6 w-px bg-slate-700" />
            <div>
              <span className="text-slate-400 text-[10px] block font-semibold">CAPTURED</span>
              <span className="font-black text-emerald-400">{liveIntelligence?.captured_percentage ?? '-'}%</span>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('intelligence')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              (liveIntelligence?.needs_attention_count || 0) > 0
                ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/40 shadow-sm shadow-rose-900/40 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            <AlertTriangleIcon className="w-3.5 h-3.5 text-rose-400" />
            <span>Needs Attention: <strong className="text-white font-black">{liveIntelligence?.needs_attention_count ?? 0}</strong></span>
          </button>

          <button
            onClick={() => loadLiveIntelligence(selectedDate, selectedDeptId)}
            className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 hover:text-white transition-colors"
            title="Refresh Live Intelligence Now"
          >
            <RefreshIcon className="w-3.5 h-3.5 text-indigo-400" />
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangleIcon className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 text-xs font-bold">Dismiss</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-500 hover:text-emerald-700 text-xs font-bold">Dismiss</button>
        </div>
      )}

      {/* ── Campus KPI Metrics Banner ── */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scheduled</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{overview.total_scheduled_sessions}</div>
            <div className="text-[11px] text-slate-400 font-medium">Teaching hours</div>
          </div>

          <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm">
            <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Submitted</div>
            <div className="text-2xl font-black text-emerald-700 mt-0.5">{overview.submitted_sessions}</div>
            <div className="text-[11px] text-emerald-600 font-medium">Conducted</div>
          </div>

          <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm">
            <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Pending</div>
            <div className="text-2xl font-black text-amber-700 mt-0.5">{overview.pending_sessions}</div>
            <div className="text-[11px] text-amber-600 font-medium">In progress/awaiting</div>
          </div>

          <div className="p-3.5 bg-orange-50 rounded-2xl border border-orange-200 shadow-sm">
            <div className="text-[10px] font-bold text-orange-800 uppercase tracking-wider">Late Entry</div>
            <div className="text-2xl font-black text-orange-700 mt-0.5">{overview.late_sessions}</div>
            <div className="text-[11px] text-orange-600 font-medium">&gt; 15-min mark</div>
          </div>

          <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200 shadow-sm">
            <div className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Missed</div>
            <div className="text-2xl font-black text-rose-700 mt-0.5">{overview.missed_sessions}</div>
            <div className="text-[11px] text-rose-600 font-medium">Not recorded</div>
          </div>

          <div className="p-3.5 bg-purple-50 rounded-2xl border border-purple-200 shadow-sm">
            <div className="text-[10px] font-bold text-purple-800 uppercase tracking-wider">Emergency</div>
            <div className="text-2xl font-black text-purple-700 mt-0.5">{overview.emergency_sessions}</div>
            <div className="text-[11px] text-purple-600 font-medium">Unplanned sub</div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cancelled</div>
            <div className="text-2xl font-black text-slate-600 mt-0.5">{overview.cancelled_sessions}</div>
            <div className="text-[11px] text-slate-400 font-medium">Excl. from %</div>
          </div>

          <div className="p-3.5 bg-indigo-50 rounded-2xl border border-indigo-200 shadow-sm">
            <div className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">Student %</div>
            <div className={`text-2xl font-black mt-0.5 ${overview.overall_attendance_percentage < 75 ? 'text-rose-600' : 'text-indigo-700'}`}>
              {overview.overall_attendance_percentage}%
            </div>
            <div className="text-[11px] text-indigo-600 font-medium">Campus present</div>
          </div>
        </div>
      )}

      {/* ── Global Filter Bar & Tabs ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <Tabs tabs={tabOptions} activeTab={activeTab} onChange={setActiveTab} />

        <div className="flex items-center gap-3">
          {/* Department Filter */}
          <select
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Departments (Campus-Wide)</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
            ))}
          </select>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB: LIVE CAMPUS ACADEMIC INTELLIGENCE & OPERATIONAL ALERTS */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'intelligence' && (
        <div className="space-y-6">
          <Card
            title="Continuous Academic Intelligence Engine"
            action={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={intelSeverityFilter}
                  onChange={(e) => setIntelSeverityFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
                >
                  <option value="">All Severities</option>
                  <option value="critical">Critical Only</option>
                  <option value="high">High & Critical</option>
                  <option value="medium">Medium</option>
                </select>
                <select
                  value={intelTypeFilter}
                  onChange={(e) => setIntelTypeFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
                >
                  <option value="">All Event Types</option>
                  <option value="group_absenteeism">Group Absenteeism</option>
                  <option value="attendance_drop">Attendance Drop</option>
                  <option value="late_submission">Late Submission</option>
                  <option value="substitution_coverage">Emergency Coverage</option>
                </select>
                <button
                  onClick={() => loadLiveIntelligence(selectedDate, selectedDeptId)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors"
                >
                  <RefreshIcon className="w-3.5 h-3.5" />
                  Refresh
                </button>
              </div>
            }
          >
            <div className="space-y-3 pt-2">
              {intelligenceEvents
                .filter(ev => !intelSeverityFilter || ev.severity === intelSeverityFilter || (intelSeverityFilter === 'high' && ev.severity === 'critical'))
                .filter(ev => !intelTypeFilter || ev.event_type === intelTypeFilter)
                .map((ev) => {
                  const isCrit = ev.severity === 'critical'
                  const isHigh = ev.severity === 'high'
                  const isAck = ev.state === 'acknowledged'
                  return (
                    <div
                      key={ev.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isCrit
                          ? 'bg-rose-50/70 border-rose-200 shadow-sm shadow-rose-100'
                          : isHigh
                          ? 'bg-amber-50/70 border-amber-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-xl mt-0.5 ${
                            isCrit ? 'bg-rose-600 text-white' : isHigh ? 'bg-amber-500 text-white' : 'bg-indigo-600 text-white'
                          }`}>
                            <AlertTriangleIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-black text-slate-900">{ev.title}</span>
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                isCrit
                                  ? 'bg-rose-600 text-white'
                                  : isHigh
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-indigo-600 text-white'
                              }`}>
                                {ev.severity}
                              </span>
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                                {ev.event_type.replace('_', ' ')}
                              </span>
                              {isAck && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  Acknowledged
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 mt-1 font-medium">{ev.detail}</p>
                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-2 font-medium">
                              <span>Department: <strong className="text-slate-700">{ev.department_name}</strong></span>
                              <span>•</span>
                              <span>Class: <strong className="text-slate-700">{ev.class_name || 'N/A'}</strong></span>
                              <span>•</span>
                              <span>Period: <strong className="text-slate-700">{ev.period_number ?? 'N/A'}</strong></span>
                              {ev.teacher_name && (
                                <>
                                  <span>•</span>
                                  <span>Faculty: <strong className="text-slate-700">{ev.teacher_name}</strong></span>
                                </>
                              )}
                              {ev.detected_at && (
                                <>
                                  <span>•</span>
                                  <span>Detected: <strong className="text-slate-600">{new Date(ev.detected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {ev.class_id && (
                            <button
                              onClick={() => {
                                setSelectedClassId(ev.class_id)
                                setActiveTab('matrix')
                              }}
                              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors"
                            >
                              Inspect Matrix
                            </button>
                          )}
                          {!isAck && (
                            <button
                              onClick={() => handleAcknowledgeEvent(ev.id)}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                            >
                              Acknowledge
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

              {intelligenceEvents.length === 0 && (
                <div className="py-12 text-center bg-emerald-50/50 rounded-2xl border border-emerald-200/60 p-6">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                    <CheckCircleIcon className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-black text-emerald-900">All Academic Operations Nominal</h4>
                  <p className="text-xs text-emerald-700 mt-1 max-w-md mx-auto">
                    The intelligence engine has observed all conducted sessions for {selectedDate} and detected no abnormal drops, critical absenteeism, or coverage failures.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 1: OVERVIEW & DEPARTMENT-WISE MONITORING */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <Card title="Departmental Attendance & Compliance Scorecard">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider font-bold">
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">HOD</th>
                    <th className="py-3 px-4 text-center">Classes</th>
                    <th className="py-3 px-4 text-center">Scheduled</th>
                    <th className="py-3 px-4 text-center">Submitted</th>
                    <th className="py-3 px-4 text-center">Pending</th>
                    <th className="py-3 px-4 text-center">Late</th>
                    <th className="py-3 px-4 text-center">Emergency</th>
                    <th className="py-3 px-4 text-center">Student Attendance %</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {overview?.departments?.map((dept) => {
                    const isShort = dept.student_attendance_percentage < 75.0 && dept.submitted_sessions > 0
                    return (
                      <tr key={dept.department_id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span>{dept.department_name}</span>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono">
                              {dept.department_code}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">{dept.hod_name || <span className="text-slate-400 italic">Not Assigned</span>}</td>
                        <td className="py-3.5 px-4 text-center font-semibold text-slate-700">{dept.classes_count}</td>
                        <td className="py-3.5 px-4 text-center font-semibold text-slate-900">{dept.total_scheduled_sessions}</td>
                        <td className="py-3.5 px-4 text-center font-semibold text-emerald-700">{dept.submitted_sessions}</td>
                        <td className="py-3.5 px-4 text-center">
                          {dept.pending_sessions > 0 ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold text-[11px]">
                              {dept.pending_sessions}
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {dept.late_sessions > 0 ? (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full font-bold text-[11px]">
                              {dept.late_sessions}
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {dept.emergency_sessions > 0 ? (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full font-bold text-[11px]">
                              {dept.emergency_sessions}
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full font-black text-xs ${
                            isShort ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {dept.student_attendance_percentage}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedDeptId(dept.department_id)
                              setActiveTab('sessions')
                            }}
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-900 font-bold"
                          >
                            <span>Monitor</span>
                            <ChevronRightIcon className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {(!overview?.departments || overview.departments.length === 0) && (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        No department attendance records available for this date.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 2: PERIOD SESSIONS GRID (DEPARTMENT-WISE MONITORING) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs text-slate-500 font-semibold">
              Showing <span className="text-slate-900 font-black">{sessions.length}</span> scheduled sessions for {selectedDate}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search subject, class or teacher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider font-bold">
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4">Class & Section</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Scheduled Teacher</th>
                  <th className="py-3 px-4">Actual Teacher / Sub</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Headcount</th>
                  <th className="py-3 px-4 text-center">Att. %</th>
                  <th className="py-3 px-4 text-right">Governance Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {sessions
                  .filter((s) => {
                    if (!searchQuery) return true
                    const q = searchQuery.toLowerCase()
                    return (
                      s.class_name?.toLowerCase().includes(q) ||
                      s.subject_name?.toLowerCase().includes(q) ||
                      s.scheduled_teacher_name?.toLowerCase().includes(q) ||
                      s.actual_teacher_name?.toLowerCase().includes(q)
                    )
                  })
                  .map((sess) => {
                    const isSub = sess.is_substitution || (sess.scheduled_teacher_id && sess.actual_teacher_id && sess.scheduled_teacher_id !== sess.actual_teacher_id)
                    const isEmerg = sess.is_emergency || sess.attendance_type === 'EMERGENCY'
                    const isLate = sess.is_late_submission || sess.status === 'SUBMITTED_LATE'

                    return (
                      <tr key={`${sess.class_id}_${sess.period_number}`} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <div>Period {sess.period_number}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{sess.period_time}</div>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          <div>{sess.class_name} ({sess.section})</div>
                          <div className="text-[10px] text-slate-400 font-normal">{sess.department_name}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-800 font-medium">
                          <div>{sess.subject_name || 'Class Subject'}</div>
                          {sess.subject_code && <div className="text-[10px] text-slate-400 font-mono">{sess.subject_code}</div>}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {sess.scheduled_teacher_name || <span className="text-slate-400 italic">Unassigned</span>}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">
                            {sess.actual_teacher_name || sess.scheduled_teacher_name || '-'}
                          </div>
                          {isSub && (
                            <span className="inline-block mt-0.5 px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full">
                              REGISTERED SUBSTITUTION
                            </span>
                          )}
                          {isEmerg && (
                            <span className="inline-block mt-0.5 px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-bold rounded-full">
                              EMERGENCY ATTENDANCE
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {sess.status === 'SUBMITTED' && (
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[11px]">
                              SUBMITTED
                            </span>
                          )}
                          {sess.status === 'SUBMITTED_LATE' && (
                            <span className="px-2.5 py-1 bg-orange-100 text-orange-800 rounded-full font-bold text-[11px]">
                              SUBMITTED LATE
                            </span>
                          )}
                          {sess.status === 'NOT_OPEN' && (
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-bold text-[11px]">
                              NOT OPEN
                            </span>
                          )}
                          {sess.status === 'OPEN' && (
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full font-bold text-[11px]">
                              OPEN
                            </span>
                          )}
                          {sess.status === 'MISSED' && (
                            <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full font-bold text-[11px]">
                              MISSED
                            </span>
                          )}
                          {sess.status === 'LOCKED' && (
                            <span className="px-2.5 py-1 bg-slate-200 text-slate-800 rounded-full font-bold text-[11px] flex items-center justify-center gap-1 mx-auto w-fit">
                              <LockIcon className="w-3 h-3 text-slate-600" /> LOCKED
                            </span>
                          )}
                          {sess.status === 'CANCELLED' && (
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-400 rounded-full font-bold text-[11px]">
                              CANCELLED
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-700">
                          {sess.session_id ? (
                            <div>
                              <span className="font-bold text-emerald-700">{sess.present_count}</span>
                              <span className="text-slate-400"> / {sess.total_students}</span>
                              <div className="text-[10px] text-rose-600 font-semibold">{sess.absent_count} absent</div>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-bold">
                          {sess.session_id ? (
                            <span className={sess.attendance_percentage < 75 ? 'text-rose-600' : 'text-slate-900'}>
                              {sess.attendance_percentage}%
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            onClick={() => {
                              setSelectedClassId(sess.class_id)
                              setActiveTab('matrix')
                            }}
                            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-bold transition-colors"
                          >
                            Roster Matrix
                          </button>
                          {sess.session_id && (
                            <button
                              onClick={() => setLockTargetSession(sess)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold transition-colors"
                              title="Toggle Session Lock"
                            >
                              {sess.status === 'LOCKED' ? 'Unlock' : 'Lock'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No timetable slots or sessions found for this date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 3: CLASS ATTENDANCE MATRIX (ROSTER VIEW) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase">Select Class:</span>
              <select
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value)
                  loadMatrix(e.target.value, selectedDate)
                }}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {classesList.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {matrixData && (
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
                <div>Conducted Hours: <span className="text-slate-900 font-black">{matrixData.scheduled_periods?.filter(p => p.status !== 'not_open' && p.status !== 'cancelled').length || 0}</span></div>
                <div>Roster Count: <span className="text-slate-900 font-black">{matrixData.students.length}</span></div>
                <div className="text-[11px] text-slate-400 font-normal">* Cancelled/non-conducted periods excluded from denominator</div>
              </div>
            )}
          </div>

          {loadingMatrix ? (
            <div className="py-16 text-center">
              <Spinner className="w-8 h-8 mx-auto text-indigo-600" />
              <p className="mt-2 text-xs text-slate-500 font-medium">Computing student period matrix...</p>
            </div>
          ) : !matrixData ? (
            <Card className="p-8 text-center text-slate-500">Please select a class to view student attendance matrix.</Card>
          ) : (
            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold">
                    <th className="py-3 px-4">Roll No</th>
                    <th className="py-3 px-4">Student Name</th>
                    {matrixData.scheduled_periods?.map((slot) => (
                      <th key={slot.period_number} className="py-3 px-2 text-center">
                        <div>Period {slot.period_number}</div>
                        <div className="text-[10px] text-slate-400 font-normal truncate max-w-[90px]">{slot.subject_name || slot.period_time}</div>
                      </th>
                    ))}
                    <th className="py-3 px-2 text-center text-emerald-700">P</th>
                    <th className="py-3 px-2 text-center text-rose-700">A</th>
                    <th className="py-3 px-2 text-center text-amber-700">L</th>
                    <th className="py-3 px-2 text-center text-blue-700">OD</th>
                    <th className="py-3 px-3 text-center">Today %</th>
                    <th className="py-3 px-3 text-center">Cumulative %</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {matrixData.students.map((st) => {
                    const isShort = st.is_shortage || st.cumulative_percentage < 75.0
                    const pCount = Object.values(st.period_marks).filter(m => m === 'PRESENT').length
                    const aCount = Object.values(st.period_marks).filter(m => m === 'ABSENT').length
                    const lCount = Object.values(st.period_marks).filter(m => m === 'LATE').length
                    const odCount = Object.values(st.period_marks).filter(m => m === 'ON_DUTY').length

                    return (
                      <tr key={st.student_id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                          <button
                            onClick={() => openStudentProfile(st.student_id)}
                            className="hover:underline"
                          >
                            {st.roll_number}
                          </button>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">{st.name}</td>
                        {matrixData.scheduled_periods?.map((slot) => {
                          const mark = st.period_marks[String(slot.period_number)]
                          let badgeBg = 'bg-slate-100 text-slate-400'
                          let label = '-'

                          if (mark === 'PRESENT') {
                            badgeBg = 'bg-emerald-100 text-emerald-800'
                            label = 'P'
                          } else if (mark === 'ABSENT') {
                            badgeBg = 'bg-rose-100 text-rose-800'
                            label = 'A'
                          } else if (mark === 'LATE') {
                            badgeBg = 'bg-amber-100 text-amber-800'
                            label = 'L'
                          } else if (mark === 'ON_DUTY') {
                            badgeBg = 'bg-blue-100 text-blue-800'
                            label = 'OD'
                          } else if (mark === 'LEAVE') {
                            badgeBg = 'bg-purple-100 text-purple-800'
                            label = 'LV'
                          } else if (mark === 'MEDICAL') {
                            badgeBg = 'bg-teal-100 text-teal-800'
                            label = 'MED'
                          }

                          return (
                            <td key={slot.period_number} className="py-2.5 px-2 text-center">
                              <span
                                onClick={() => {
                                  if (slot.session_id) {
                                    setOverrideTarget({
                                      sessionId: slot.session_id,
                                      studentId: st.student_id,
                                      studentName: st.name,
                                      currentStatus: mark
                                    })
                                  }
                                }}
                                className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-bold text-xs cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-all ${badgeBg}`}
                                title={`Period ${slot.period_number}: ${mark || 'Not recorded'} (Click to override)`}
                              >
                                {label}
                              </span>
                            </td>
                          )
                        })}
                        <td className="py-2.5 px-2 text-center font-bold text-emerald-700">{pCount}</td>
                        <td className="py-2.5 px-2 text-center font-bold text-rose-700">{aCount}</td>
                        <td className="py-2.5 px-2 text-center font-semibold text-amber-700">{lCount}</td>
                        <td className="py-2.5 px-2 text-center font-semibold text-blue-700">{odCount}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                          {st.day_percentage}%
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-black text-xs ${
                            isShort ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {st.cumulative_percentage}%
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            onClick={() => openStudentProfile(st.student_id)}
                            className="text-xs text-indigo-600 hover:text-indigo-900 font-bold"
                          >
                            Profile
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 4: FACULTY ATTENDANCE COMPLIANCE */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'compliance' && (
        <div className="space-y-4">
          <Card title="Teacher Attendance Submission Compliance">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider font-bold">
                    <th className="py-3 px-4">Faculty Member</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4 text-center">Scheduled Today</th>
                    <th className="py-3 px-4 text-center">Submitted On-Time</th>
                    <th className="py-3 px-4 text-center">Submitted Late</th>
                    <th className="py-3 px-4 text-center">Missed</th>
                    <th className="py-3 px-4 text-center">Emergency Sub</th>
                    <th className="py-3 px-4 text-center">Compliance Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {complianceList.map((tc) => (
                    <tr key={tc.teacher_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{tc.teacher_name}</td>
                      <td className="py-3 px-4 text-slate-600">{tc.department_name}</td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800">{tc.scheduled_sessions_today}</td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-700">{tc.submitted_on_time_count}</td>
                      <td className="py-3 px-4 text-center">
                        {tc.submitted_late_count > 0 ? (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full font-bold text-[11px]">
                            {tc.submitted_late_count}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {tc.missed_count > 0 ? (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full font-bold text-[11px]">
                            {tc.missed_count}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {tc.emergency_count > 0 ? (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full font-bold text-[11px]">
                            {tc.emergency_count}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full font-black text-xs ${
                          tc.compliance_percentage < 80 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {tc.compliance_percentage}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {complianceList.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No faculty compliance data found for this date.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 5: RISK & EXCEPTIONS RADAR */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'exceptions' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-500 uppercase mr-2">Filter Type:</span>
            {[
              { id: '', label: 'All Exceptions' },
              { id: 'LATE_SUBMISSION', label: 'Late Submissions' },
              { id: 'EMERGENCY', label: 'Emergency Sub' },
              { id: 'HIGH_ABSENTEEISM', label: 'High Absenteeism (>25%)' },
              { id: 'STUDENT_SHORTAGE', label: 'Student Shortage (<75%)' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setExceptionTypeFilter(f.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  exceptionTypeFilter === f.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {exceptionsList.map((ex, idx) => (
              <div
                key={idx}
                className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-indigo-300 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl mt-0.5 ${
                    ex.exception_type === 'STUDENT_SHORTAGE' || ex.exception_type === 'HIGH_ABSENTEEISM'
                      ? 'bg-rose-100 text-rose-700'
                      : ex.exception_type === 'LATE_SUBMISSION'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    <AlertTriangleIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{ex.exception_type.replace('_', ' ')}</span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono">
                        {ex.class_name} ({ex.section})
                      </span>
                      {ex.period_number && (
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold">
                          Period {ex.period_number}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 mt-1 font-medium">{ex.details}</div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                      <span>{ex.department_name}</span>
                      {ex.actual_teacher && <span>Teacher: {ex.actual_teacher}</span>}
                      {ex.student_name && <span>Student: {ex.student_name} ({ex.student_roll})</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-auto">
                  {ex.attendance_percentage !== undefined && ex.attendance_percentage !== null && (
                    <span className="px-3 py-1 bg-rose-100 text-rose-800 rounded-full font-black text-xs">
                      {ex.attendance_percentage}%
                    </span>
                  )}
                  {ex.student_id ? (
                    <button
                      onClick={() => openStudentProfile(ex.student_id)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold"
                    >
                      View Student
                    </button>
                  ) : ex.class_id ? (
                    <button
                      onClick={() => {
                        setSelectedClassId(ex.class_id)
                        setActiveTab('matrix')
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold"
                    >
                      Inspect Class
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {exceptionsList.length === 0 && (
              <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
                No exceptions detected under this category for {selectedDate}.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 1: STUDENT ATTENDANCE PROFILE DRAWER */}
      {/* ───────────────────────────────────────────────────────────── */}
      {profileStudentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <UsersIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Student Attendance Dossier</h3>
                  <p className="text-xs text-slate-400">Official Institutional Attendance & Shortage Record</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setProfileStudentId(null)
                  setStudentProfile(null)
                }}
                className="text-slate-400 hover:text-slate-600 p-2"
              >
                ✕
              </button>
            </div>

            {loadingProfile || !studentProfile ? (
              <div className="py-12 text-center">
                <Spinner className="w-8 h-8 mx-auto text-indigo-600" />
                <p className="mt-2 text-xs text-slate-500 font-medium">Loading student history...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Student Bio Card */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-base font-black text-slate-900">{studentProfile.name}</h4>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">Roll: {studentProfile.roll_number}</div>
                    <div className="text-xs text-slate-600 mt-1 font-semibold">
                      {studentProfile.department_name} • {studentProfile.class_name} ({studentProfile.section})
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-400 uppercase">Cumulative Attendance</div>
                    <div className={`text-3xl font-black ${studentProfile.is_shortage ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {studentProfile.overall_percentage}%
                    </div>
                    {studentProfile.is_shortage && (
                      <span className="inline-block mt-0.5 px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-black rounded-full">
                        ATTENDANCE SHORTAGE (&lt; 75%)
                      </span>
                    )}
                  </div>
                </div>

                {/* Counts Breakdown */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-slate-100 rounded-xl">
                    <div className="text-[10px] text-slate-500 font-bold">ELIGIBLE</div>
                    <div className="text-base font-black text-slate-900">{studentProfile.total_eligible_sessions}</div>
                  </div>
                  <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-800">
                    <div className="text-[10px] font-bold">PRESENT</div>
                    <div className="text-base font-black">{studentProfile.attended_sessions}</div>
                  </div>
                  <div className="p-2.5 bg-rose-50 rounded-xl text-rose-800">
                    <div className="text-[10px] font-bold">ABSENT</div>
                    <div className="text-base font-black">{studentProfile.absent_sessions}</div>
                  </div>
                  <div className="p-2.5 bg-amber-50 rounded-xl text-amber-800">
                    <div className="text-[10px] font-bold">LATE</div>
                    <div className="text-base font-black">{studentProfile.late_sessions}</div>
                  </div>
                  <div className="p-2.5 bg-blue-50 rounded-xl text-blue-800">
                    <div className="text-[10px] font-bold">ON DUTY</div>
                    <div className="text-base font-black">{studentProfile.on_duty_sessions}</div>
                  </div>
                  <div className="p-2.5 bg-purple-50 rounded-xl text-purple-800">
                    <div className="text-[10px] font-bold">LEAVE/MED</div>
                    <div className="text-base font-black">{studentProfile.leave_sessions + studentProfile.medical_sessions}</div>
                  </div>
                </div>

                {/* Subject-Wise Breakdown */}
                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subject-Wise Attendance</h5>
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500">
                        <tr>
                          <th className="py-2.5 px-3">Subject</th>
                          <th className="py-2.5 px-3 text-center">Conducted</th>
                          <th className="py-2.5 px-3 text-center">Attended</th>
                          <th className="py-2.5 px-3 text-center">Absent</th>
                          <th className="py-2.5 px-3 text-center">OD</th>
                          <th className="py-2.5 px-3 text-center">%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {studentProfile.subjects.map((sub, sIdx) => (
                          <tr key={sIdx} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 font-semibold text-slate-900">
                              <div>{sub.subject_name}</div>
                              {sub.subject_code && <div className="text-[10px] text-slate-400 font-mono">{sub.subject_code}</div>}
                            </td>
                            <td className="py-2 px-3 text-center">{sub.eligible_sessions}</td>
                            <td className="py-2 px-3 text-center font-bold text-emerald-700">{sub.attended_sessions}</td>
                            <td className="py-2 px-3 text-center font-bold text-rose-700">{sub.absent_sessions}</td>
                            <td className="py-2 px-3 text-center text-blue-700">{sub.od_sessions}</td>
                            <td className="py-2 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded font-black ${
                                sub.percentage < 75 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {sub.percentage}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Session Timeline History */}
                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attendance Session History</h5>
                  <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                    {studentProfile.history.map((h, hIdx) => (
                      <div key={hIdx} className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-900">{h.attendance_date}</span>
                          <span className="text-slate-400 mx-1.5">•</span>
                          <span className="font-semibold text-indigo-700">Period {h.period_number}</span>
                          <span className="text-slate-400 mx-1.5">•</span>
                          <span className="text-slate-700">{h.subject_name}</span>
                          <span className="text-slate-400 text-[10px] ml-2">({h.teacher_name})</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full font-black text-[10px] uppercase ${
                          h.status === 'present' ? 'bg-emerald-100 text-emerald-800' :
                          h.status === 'absent' ? 'bg-rose-100 text-rose-800' :
                          h.status === 'late' ? 'bg-amber-100 text-amber-800' :
                          h.status === 'on_duty' ? 'bg-blue-100 text-blue-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {h.status.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 2: SESSION LOCK/UNLOCK GOVERNANCE DIALOG */}
      {/* ───────────────────────────────────────────────────────────── */}
      {lockTargetSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                <LockIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {lockTargetSession.status === 'LOCKED' ? 'Unlock Session' : 'Lock Session'}
                </h3>
                <p className="text-xs text-slate-400">Session ID #{lockTargetSession.session_id}</p>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl">
              <div><span className="font-bold">Class:</span> {lockTargetSession.class_name} ({lockTargetSession.section})</div>
              <div><span className="font-bold">Period:</span> {lockTargetSession.period_number} • {lockTargetSession.subject_name}</div>
              <div><span className="font-bold">Current Status:</span> {lockTargetSession.status}</div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Audit Reason (Required for Principal Audit Trail)</label>
              <textarea
                rows={3}
                value={lockReason}
                onChange={(e) => setLockReason(e.target.value)}
                placeholder="Reason for administrative lock/unlock..."
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                disabled={actionSubmitting}
                onClick={() => setLockTargetSession(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                disabled={actionSubmitting || !lockReason.trim()}
                onClick={handleToggleLock}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs disabled:opacity-50"
              >
                {actionSubmitting ? 'Updating...' : lockTargetSession.status === 'LOCKED' ? 'Confirm Unlock' : 'Confirm Lock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 3: ADMIN MARK OVERRIDE DIALOG */}
      {/* ───────────────────────────────────────────────────────────── */}
      {overrideTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                <AlertTriangleIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Attendance Status Override</h3>
                <p className="text-xs text-slate-400">Institutional Administrative Correction with Audit Trail</p>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl">
              <div><span className="font-bold">Student:</span> {overrideTarget.studentName}</div>
              <div><span className="font-bold">Current Mark:</span> <span className="font-mono font-bold uppercase">{overrideTarget.currentStatus || 'Unmarked'}</span></div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">New Attendance Status</label>
              <select
                value={overrideStatus}
                onChange={(e) => setOverrideStatus(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-bold"
              >
                <option value="present">PRESENT</option>
                <option value="absent">ABSENT</option>
                <option value="late">LATE</option>
                <option value="on_duty">ON DUTY (OD)</option>
                <option value="leave">LEAVE</option>
                <option value="medical">MEDICAL</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Justification Reason (Logged to Audit Record)</label>
              <textarea
                rows={3}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="E.g. Approved college event representation / Medical certificate submitted"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                disabled={actionSubmitting}
                onClick={() => setOverrideTarget(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                disabled={actionSubmitting || !overrideReason.trim()}
                onClick={handleAdminOverride}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs disabled:opacity-50"
              >
                {actionSubmitting ? 'Saving...' : 'Apply Correction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
