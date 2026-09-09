import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { substitutionsApi, leavesApi, classesApi, departmentsApi } from '../../api/services'
import { Spinner, Modal, EmptyState, AssignmentTypeBadge, ErrorAlert } from '../../components/ui'
import {
  SwapIcon, UndoIcon, LockIcon, SearchIcon, SparklesIcon, AlertTriangleIcon, FilterIcon
} from '../../components/icons'

// ---------- small inline icons (kept local so print CSS's `button { display: none }`
// rule can't accidentally hide anything that needs to stay visible on paper) ----------
const IconBase = ({ children, className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {children}
  </svg>
)
const ChevronLeftIcon = (p) => <IconBase {...p}><path d="m15 18-6-6 6-6" /></IconBase>
const ChevronRightIcon = (p) => <IconBase {...p}><path d="m9 18 6-6-6-6" /></IconBase>
const ChevronUpIcon = (p) => <IconBase {...p}><path d="m18 15-6-6-6 6" /></IconBase>
const ChevronDownIcon = (p) => <IconBase {...p}><path d="m6 9 6 6 6-6" /></IconBase>
const ChevronsUpDownIcon = (p) => <IconBase {...p}><path d="m7 15 5 5 5-5M7 9l5-5 5 5" /></IconBase>
const RefreshIcon = (p) => <IconBase {...p}><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></IconBase>
const InfoIcon = (p) => <IconBase {...p}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></IconBase>

function RecommendationRow({ rec, onAssign, disabled }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-800 truncate">{rec.teacher.name}</p>
          {rec.teacher.department && (
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded font-semibold shrink-0">
              {rec.teacher.department}
            </span>
          )}
          {rec.tier && (
            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
              rec.tier === 'EXCELLENT' ? 'bg-emerald-100 text-emerald-800' :
              rec.tier === 'GOOD' ? 'bg-blue-100 text-blue-800' :
              rec.tier === 'FAIR' ? 'bg-amber-100 text-amber-800' :
              'bg-slate-100 text-slate-700'
            }`}>
              {rec.tier}
            </span>
          )}
          <span className="text-xs font-semibold text-slate-700 shrink-0">
            Suitability: {Math.max(0, Math.min(100, Math.round(Number(rec.score) || 0)))}/100
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden shrink-0">
            <div className={`h-full ${rec.score >= 75 ? 'bg-green-500' : rec.score >= 45 ? 'bg-yellow-500' : 'bg-gray-400'}`} style={{ width: `${Math.min(rec.score, 100)}%` }} />
          </div>
          <p className="text-xs text-gray-400 truncate">{rec.reasons.join(' · ') || 'No strong signals'}</p>
        </div>
      </div>
      <button
        onClick={() => onAssign(rec.teacher.id)}
        disabled={disabled}
        className="text-xs px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 shrink-0 font-medium"
      >
        Assign
      </button>
    </div>
  )
}

// Sortable header that renders as a <span role="button">, not a real <button> —
// the print stylesheet hides every <button>, and a real button here would print blank headers.
function SortableTh({ label, sortKey, sortConfig, onSort, className = '' }) {
  const active = sortConfig.key === sortKey
  return (
    <th className={`px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider ${className}`}>
      <span
        role="button"
        tabIndex={0}
        onClick={() => onSort(sortKey)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort(sortKey) } }}
        className={`inline-flex items-center gap-1 cursor-pointer select-none hover:text-gray-700 ${active ? 'text-gray-700' : ''}`}
      >
        {label}
        {active
          ? (sortConfig.direction === 'asc' ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />)
          : <ChevronsUpDownIcon className="w-3 h-3 opacity-40" />}
      </span>
    </th>
  )
}

const SORT_ACCESSORS = {
  period: s => s.period_number,
  class: s => s.class_name || '',
  original: s => s.original_teacher?.name || '',
  substitute: s => (s.substitute_teacher ? s.substitute_teacher.name : '\uFFFF'), // unassigned sorts last
  source: s => s.assignment_type || '',
}

export default function TodaySubstitutions() {
  const { user, isAdmin } = useAuth()
  const todayStr = new Date().toISOString().split('T')[0]

  // State
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [subData, setSubData] = useState({ date: '', day_order: '', day_type: '', summary: {}, substitutions: [] })
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [classes, setClasses] = useState([])
  const [departments, setDepartments] = useState([])
  const [error, setError] = useState('')
  const [banner, setBanner] = useState(null) // { type: 'success' | 'error', message }

  // Filters
  const [searchTeacher, setSearchTeacher] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [selectedSource, setSelectedSource] = useState('')
  const [showMyOnly, setShowMyOnly] = useState(false)
  const [statusTab, setStatusTab] = useState('all')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [sortConfig, setSortConfig] = useState({ key: 'period', direction: 'asc' })
  const searchInputRef = useRef(null)

  // Admin Modals & Candidate Filters
  const [assignModal, setAssignModal] = useState(null)
  const [overrideModal, setOverrideModal] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)
  const [modalTeacherSearch, setModalTeacherSearch] = useState('')
  const [modalDeptFilter, setModalDeptFilter] = useState('')
  const [includeCrossDept, setIncludeCrossDept] = useState(false)
  const [onlyHandlesClass, setOnlyHandlesClass] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)


  // Auto-assign-all
  const [autoAssignConfirmOpen, setAutoAssignConfirmOpen] = useState(false)
  const [autoAssigning, setAutoAssigning] = useState(null) // { done, total }

  const showBanner = (type, message) => setBanner({ type, message })
  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(null), 4500)
    return () => clearTimeout(t)
  }, [banner])

  // Fetch substitutions. `silent` keeps the current table on screen and only
  // spins a small refresh indicator, instead of blanking the page.
  const loadDashboard = async (dateStr, { silent = false } = {}) => {
    if (!silent) setError('')
    if (silent) setRefreshing(true)
    try {
      const res = await substitutionsApi.getToday(dateStr)
      setSubData(res.data)
      setLastUpdated(new Date())
      if (res.data.date) {
        setSelectedDate(res.data.date)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch substitutions.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Load initial settings, classes, and departments
  const loadMasterData = async () => {
    try {
      const [cRes, dRes] = await Promise.all([classesApi.list(), departmentsApi.list(true)])
      setClasses(cRes.data)
      setDepartments(dRes.data)
    } catch (err) {
      console.error('Failed to load master data:', err)
    }
  }

  useEffect(() => {
    loadMasterData()
    loadDashboard(selectedDate)
  }, [])

  // Candidate loading helper supporting cross-department & affected class faculty filters
  const fetchCandidates = async (leaveId, crossDept = false, handlesClass = false) => {
    setModalLoading(true)
    try {
      const [{ data: recommendations }, { data: freeTeachers }] = await Promise.all([
        leavesApi.recommendations(leaveId, 50, { include_cross_department: crossDept, only_handles_class: handlesClass }),
        leavesApi.freeTeachers(leaveId, { include_cross_department: crossDept, only_handles_class: handlesClass }),
      ])
      const recommendedIds = new Set(recommendations.map(r => r.teacher.id))
      const others = freeTeachers.filter(t => !recommendedIds.has(t.id))
      return { recommendations, others }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load candidates.')
      return { recommendations: [], others: [] }
    } finally {
      setModalLoading(false)
    }
  }

  const handleToggleCrossDept = async (newVal) => {
    setIncludeCrossDept(newVal)
    if (!newVal) {
      setModalDeptFilter('')
    }
    const activeLeaveId = assignModal?.leaveId || overrideModal?.leaveId
    if (!activeLeaveId) return
    const { recommendations, others } = await fetchCandidates(activeLeaveId, newVal, onlyHandlesClass)
    if (assignModal) {
      setAssignModal(prev => prev ? { ...prev, recommendations, others } : null)
    }
    if (overrideModal) {
      setOverrideModal(prev => prev ? { ...prev, recommendations, others } : null)
    }
  }

  const activeModalObj = assignModal || overrideModal
  const modalCandidateDepartments = useMemo(() => {
    if (!includeCrossDept) {
      if (!activeModalObj) return []
      const names = []
      if (activeModalObj.recommendations) {
        activeModalObj.recommendations.forEach(r => { if (r.teacher?.department) names.push(r.teacher.department) })
      }
      if (activeModalObj.others) {
        activeModalObj.others.forEach(t => { if (t?.department) names.push(t.department) })
      }
      if (activeModalObj.leave?.teacher?.department) {
        names.push(activeModalObj.leave.teacher.department)
      }
      return [...new Set(names.filter(Boolean))].sort()
    }
    const names = departments.map(d => d.name)
    if (activeModalObj) {
      if (activeModalObj.recommendations) {
        activeModalObj.recommendations.forEach(r => { if (r.teacher?.department) names.push(r.teacher.department) })
      }
      if (activeModalObj.others) {
        activeModalObj.others.forEach(t => { if (t?.department) names.push(t.department) })
      }
    }
    return [...new Set(names.filter(Boolean))].sort()
  }, [departments, activeModalObj, includeCrossDept])

  const handleToggleOnlyHandlesClass = async (newVal) => {
    setOnlyHandlesClass(newVal)
    const activeLeaveId = assignModal?.leaveId || overrideModal?.leaveId
    if (!activeLeaveId) return
    const { recommendations, others } = await fetchCandidates(activeLeaveId, includeCrossDept, newVal)
    if (assignModal) {
      setAssignModal(prev => prev ? { ...prev, recommendations, others } : null)
    }
    if (overrideModal) {
      setOverrideModal(prev => prev ? { ...prev, recommendations, others } : null)
    }
  }


  // "/" jumps to the teacher search box, same convention as the rest of the app
  useEffect(() => {
    function handler(e) {
      const tag = document.activeElement?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Auto-refresh only makes sense while looking at today's live board
  useEffect(() => {
    if (!autoRefresh || selectedDate !== todayStr) return
    const id = setInterval(() => loadDashboard(selectedDate, { silent: true }), 60000)
    return () => clearInterval(id)
  }, [autoRefresh, selectedDate])

  const handleDateChange = (e) => {
    setLoading(true)
    const newDate = e.target.value
    setSelectedDate(newDate)
    loadDashboard(newDate)
  }

  const shiftDate = (deltaDays) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + deltaDays)
    const newDate = d.toISOString().split('T')[0]
    setLoading(true)
    setSelectedDate(newDate)
    loadDashboard(newDate)
  }

  const goToToday = () => {
    setLoading(true)
    setSelectedDate(todayStr)
    loadDashboard(todayStr)
  }

  const handleRefresh = () => loadDashboard(selectedDate, { silent: true })

  // Admin Substitution Action Handlers
  const handleAssignRecommended = async (teacherId) => {
    setActionLoading('assign')
    try {
      const name = assignModal.recommendations.find(r => r.teacher.id === teacherId)?.teacher.name
      await leavesApi.assignRecommended(assignModal.leaveId, teacherId, { include_cross_department: includeCrossDept })
      setAssignModal(null)
      loadDashboard(selectedDate)
      showBanner('success', `${name || 'Substitute'} assigned for Period ${assignModal.leave.period_number}.`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to assign recommended substitute.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleAssignManual = async (teacherId) => {
    setActionLoading('assign')
    try {
      const name = assignModal.others.find(t => t.id === teacherId)?.name
      await leavesApi.assignSubstitute(assignModal.leaveId, teacherId, { include_cross_department: includeCrossDept })
      setAssignModal(null)
      loadDashboard(selectedDate)
      showBanner('success', `${name || 'Substitute'} assigned for Period ${assignModal.leave.period_number}.`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to assign substitute.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleOverride = async (teacherId) => {
    setActionLoading('override')
    try {
      const name = overrideModal.recommendations.find(r => r.teacher.id === teacherId)?.teacher.name
        || overrideModal.others.find(t => t.id === teacherId)?.name
      await leavesApi.overrideSubstitute(overrideModal.leaveId, teacherId, { include_cross_department: includeCrossDept })
      setOverrideModal(null)
      loadDashboard(selectedDate)
      showBanner('success', `Cover changed to ${name || 'new substitute'} for Period ${overrideModal.leave.period_number}.`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to change substitute.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleUndo = async (leaveId) => {
    setActionLoading(leaveId + '_undo')
    try {
      await leavesApi.undoAssignment(leaveId)
      loadDashboard(selectedDate)
      showBanner('success', 'Substitute removed. Period is unassigned again.')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to remove substitute.')
    } finally {
      setActionLoading(null)
    }
  }

  const openAssignModal = async (sub) => {
    setActionLoading(sub.leave_id + '_open_assign')
    setModalTeacherSearch('')
    setModalDeptFilter('')
    setIncludeCrossDept(false)
    setOnlyHandlesClass(false)
    try {
      const leaveObj = {
        id: sub.leave_id,
        date: selectedDate,
        day_order: subData.day_order?.replace('DO', '') || '1',
        period_number: sub.period_number,
        teacher: sub.original_teacher,
        class_name: sub.class_name,
        subject_name: sub.subject_name,
        reason: sub.reason,
      }
      const { recommendations, others } = await fetchCandidates(sub.leave_id, false, false)
      setAssignModal({ leaveId: sub.leave_id, leave: leaveObj, recommendations, others })
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load candidates.')
    } finally {
      setActionLoading(null)
    }
  }

  const openOverrideModal = async (sub) => {
    setActionLoading(sub.leave_id + '_open_override')
    setModalTeacherSearch('')
    setModalDeptFilter('')
    setIncludeCrossDept(false)
    setOnlyHandlesClass(false)
    try {
      const leaveObj = {
        id: sub.leave_id,
        date: selectedDate,
        day_order: subData.day_order?.replace('DO', '') || '1',
        period_number: sub.period_number,
        class_name: sub.class_name,
        subject_name: sub.subject_name,
        alter_assignment: {
          substitute: sub.substitute_teacher,
          substitute_teacher_id: sub.substitute_teacher?.id
        }
      }
      const { recommendations, others } = await fetchCandidates(sub.leave_id, false, false)
      setOverrideModal({ leaveId: sub.leave_id, leave: leaveObj, recommendations, others })
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load override candidates.')
    } finally {
      setActionLoading(null)
    }
  }




  // Filtered List
  const statusCounts = useMemo(() => {
    const all = subData.substitutions || []
    return {
      all: all.length,
      needs_coverage: all.filter(s => !s.substitute_teacher).length,
      assigned: all.filter(s => s.substitute_teacher && !s.is_expired).length,
      completed: all.filter(s => s.is_expired).length,
    }
  }, [subData.substitutions])

  const filteredSubstitutions = useMemo(() => {
    if (!subData.substitutions) return []
    return subData.substitutions.filter(sub => {
      // 0. Status Tab Filter
      if (statusTab === 'needs_coverage' && sub.substitute_teacher) return false
      if (statusTab === 'assigned' && (!sub.substitute_teacher || sub.is_expired)) return false
      if (statusTab === 'completed' && !sub.is_expired) return false

      // 1. Search Teacher
      if (searchTeacher.trim()) {
        const query = searchTeacher.toLowerCase()
        const matchOrig = sub.original_teacher.name.toLowerCase().includes(query)
        const matchSub = sub.substitute_teacher ? sub.substitute_teacher.name.toLowerCase().includes(query) : false
        if (!matchOrig && !matchSub) return false
      }

      // 2. Class Section
      if (selectedClass && sub.class_name !== selectedClass) return false

      // 3. Period
      if (selectedPeriod && String(sub.period_number) !== selectedPeriod) return false

      // 4. Source
      if (selectedSource) {
        if (selectedSource === 'Unassigned') {
          if (sub.substitute_teacher !== null) return false
        } else {
          // Map to match internal enum label strings or display labels
          const sourceMap = {
            auto_assigned: 'Autonomous',
            faculty_recommended: 'Assisted',
            admin_assigned: 'Manual',
            teacher_assigned: 'Teacher Assigned',
            overridden: 'Manual',
            auto_swapped: 'Autonomous',
            emergency: 'Emergency'
          }
          const actualSource = sourceMap[sub.assignment_type] || 'Unassigned'
          if (actualSource !== selectedSource) return false
        }
      }

      // 5. My Coverage (For Teachers)
      if (!isAdmin && showMyOnly && user) {
        const isMine = sub.original_teacher.id === user.id || (sub.substitute_teacher && sub.substitute_teacher.id === user.id)
        if (!isMine) return false
      }

      return true
    })
  }, [subData.substitutions, statusTab, searchTeacher, selectedClass, selectedPeriod, selectedSource, showMyOnly, isAdmin, user])

  const sortedFilteredSubstitutions = useMemo(() => {
    const arr = [...filteredSubstitutions]
    const accessor = SORT_ACCESSORS[sortConfig.key]
    const dir = sortConfig.direction === 'asc' ? 1 : -1
    if (!accessor) return arr
    arr.sort((a, b) => {
      const av = accessor(a), bv = accessor(b)
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      const as = String(av).toLowerCase(), bs = String(bv).toLowerCase()
      if (as < bs) return -1 * dir
      if (as > bs) return 1 * dir
      return 0
    })
    return arr
  }, [filteredSubstitutions, sortConfig])

  const handleSort = (key) => {
    setSortConfig(prev => prev.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' })
  }

  const periodOptions = useMemo(() => {
    const set = new Set((subData.substitutions || []).map(s => s.period_number))
    return Array.from(set).sort((a, b) => a - b)
  }, [subData.substitutions])

  const filtersActive = Boolean(searchTeacher.trim() || selectedClass || selectedPeriod || selectedSource || showMyOnly || statusTab !== 'all')
  const extraFiltersActiveCount = (searchTeacher.trim() ? 1 : 0) + (selectedClass ? 1 : 0) + (selectedPeriod ? 1 : 0) + (selectedSource ? 1 : 0) + (showMyOnly ? 1 : 0)
  const resetFilters = () => {
    setSearchTeacher('')
    setSelectedClass('')
    setSelectedPeriod('')
    setSelectedSource('')
    setShowMyOnly(false)
    setStatusTab('all')
  }

  const unassignedInView = useMemo(
    () => sortedFilteredSubstitutions.filter(s => !s.substitute_teacher).length,
    [sortedFilteredSubstitutions]
  )

  // Finds, for each unassigned period in view, the best-scoring eligible teacher and
  // assigns them — one period at a time, so an earlier assignment in the batch is
  // reflected before the next period's candidates are fetched (avoids double-booking
  // the same teacher into two periods on the same day).
  const runAutoAssignAll = async () => {
    const targets = sortedFilteredSubstitutions.filter(s => !s.substitute_teacher)
    setAutoAssignConfirmOpen(false)
    if (targets.length === 0) return
    setAutoAssigning({ done: 0, total: targets.length })
    let succeeded = 0
    let skipped = 0
    for (const sub of targets) {
      try {
        const { data: recs } = await leavesApi.recommendations(sub.leave_id)
        const best = (recs || []).reduce((top, r) => (!top || r.score > top.score ? r : top), null)
        if (best) {
          await leavesApi.assignRecommended(sub.leave_id, best.teacher.id)
          succeeded++
        } else {
          skipped++
        }
      } catch (err) {
        skipped++
      }
      setAutoAssigning(prev => (prev ? { ...prev, done: prev.done + 1 } : null))
    }
    setAutoAssigning(null)
    await loadDashboard(selectedDate, { silent: true })
    showBanner(
      skipped ? 'error' : 'success',
      `${succeeded} period(s) auto-assigned${skipped ? `, ${skipped} skipped — no eligible teacher found.` : '.'}`
    )
  }

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Period', 'Class Section', 'Original Teacher', 'Substitute Teacher', 'Source', 'Reason']
    const rows = sortedFilteredSubstitutions.map(sub => [
      `Period ${sub.period_number}`,
      sub.class_name,
      sub.original_teacher.name,
      sub.substitute_teacher ? sub.substitute_teacher.name : 'Unassigned',
      sub.substitute_teacher ? (sub.assignment_type === 'auto_assigned' ? 'Autonomous' : sub.assignment_type === 'faculty_recommended' ? 'Assisted' : sub.assignment_type === 'teacher_assigned' ? 'Teacher Assigned' : 'Manual') : 'Unassigned',
      sub.reason
    ])

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `substitutions_report_${selectedDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Print Page
  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  const { summary } = subData

  return (
    <div className="space-y-6">
      {/* Custom print styling */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          aside, nav, header, button, .filter-bar, .no-print {
            display: none !important;
          }
          .print-header {
            display: block !important;
            margin-bottom: 20px;
          }
          .card {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            border: 1px solid #CBD5E1 !important;
            padding: 8px !important;
            color: black !important;
            font-size: 11px !important;
          }
          .print-only-badge {
            font-size: 9px !important;
            border: 1px solid #64748B !important;
            border-radius: 4px !important;
            padding: 2px 4px !important;
          }
        }
      `}</style>

      {/* Print only header */}
      <div className="hidden print-header">
        <h1 className="text-xl font-bold text-black">Coverage & Substitutions Report</h1>
        <p className="text-xs text-gray-600 mt-1">
          Date: <span className="font-semibold">{selectedDate}</span> &nbsp;·&nbsp; Day Order: <span className="font-semibold">{subData.day_order || 'N/A'}</span>
        </p>
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{isAdmin ? "Today's Substitutions" : "Today's Coverage"}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Operational dashboard of all coverage arrangements for {selectedDate}
          </p>
        </div>

        {/* Date Navigation & Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button onClick={() => shiftDate(-1)} title="Previous day" className="p-2 border border-gray-200 rounded-lg text-gray-500 bg-white hover:bg-gray-50 transition-colors">
            <ChevronLeftIcon className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-semibold text-gray-700">
            <span>{selectedDate}</span>
            <span className="text-gray-300">|</span>
            <span className="text-primary-600">{subData.day_order || 'No Day Order'}</span>
          </div>
          <button onClick={() => shiftDate(1)} title="Next day" className="p-2 border border-gray-200 rounded-lg text-gray-500 bg-white hover:bg-gray-50 transition-colors">
            <ChevronRightIcon className="w-3.5 h-3.5" />
          </button>
          {selectedDate !== todayStr && (
            <button onClick={goToToday} className="px-2.5 py-2 text-xs font-semibold text-primary-600 hover:underline">Today</button>
          )}
          <button onClick={handleRefresh} disabled={refreshing} title="Refresh" className="p-2 border border-gray-200 rounded-lg text-gray-500 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50">
            <RefreshIcon className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-2 border border-gray-200 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 rounded-lg transition-colors"
            >
              Print / Save PDF
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 rounded-lg transition-colors"
            >
              Export Excel (CSV)
            </button>
          </div>
        </div>
      </div>

      {selectedDate === todayStr && (
        <div className="flex items-center gap-2 text-[11px] text-gray-400 no-print -mt-3">
          <input
            type="checkbox"
            id="auto-refresh-check"
            checked={autoRefresh}
            onChange={e => setAutoRefresh(e.target.checked)}
            className="w-3 h-3 rounded text-primary-600 focus:ring-primary-500 border-gray-300"
          />
          <label htmlFor="auto-refresh-check" className="cursor-pointer">Auto-refresh every minute</label>
          {lastUpdated && <span>· Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
        </div>
      )}

      {banner && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium flex items-center justify-between border no-print ${banner.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
          }`}>
          <span>{banner.message}</span>
          <button onClick={() => setBanner(null)} className="opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      <ErrorAlert message={error} />

      {/* Summary Cards */}
      {/* Desktop / Tablet Grid (sm and up) */}
      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-5 gap-4 no-print">
        <div className="card p-5 space-y-1 bg-white">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Teachers on Leave</p>
          <p className="text-2xl font-bold text-gray-800">{summary.teachers_on_leave !== undefined ? summary.teachers_on_leave : '-'}</p>
          <p className="text-[10px] text-gray-400">Unique teachers absent today</p>
        </div>

        <div className="card p-5 space-y-1 bg-white">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Leave Periods Today</p>
          <p className="text-2xl font-bold text-gray-800">{summary.leave_periods !== undefined ? summary.leave_periods : summary.total_leaves}</p>
          <p className="text-[10px] text-gray-400">Affected class periods</p>
        </div>

        <div className="card p-5 space-y-1 bg-white">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Covered Periods</p>
          <p className="text-2xl font-bold text-green-600">{summary.covered_periods !== undefined ? summary.covered_periods : summary.total_substitutions}</p>
          <p className="text-[10px] text-gray-400">Assignments completed</p>
        </div>

        <div className="card p-5 space-y-1 bg-white">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Pending Coverage</p>
          <p className={`text-2xl font-bold ${(summary.pending_coverage !== undefined ? summary.pending_coverage : summary.unassigned_periods) > 0 ? 'text-amber-500' : 'text-gray-800'}`}>
            {summary.pending_coverage !== undefined ? summary.pending_coverage : summary.unassigned_periods}
          </p>
          <p className="text-[10px] text-gray-400">Class periods awaiting sub</p>
        </div>

        <div className="card p-5 space-y-1 bg-white">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Coverage Rate</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-primary-600">{summary.coverage_rate !== undefined ? summary.coverage_rate : summary.coverage_percentage}%</p>
          </div>
          <div className="w-full bg-gray-100 h-1 rounded-full mt-2 overflow-hidden">
            <div className="bg-primary-600 h-full transition-all duration-300" style={{ width: `${summary.coverage_rate !== undefined ? summary.coverage_rate : summary.coverage_percentage}%` }} />
          </div>
        </div>
      </div>

      {/* Mobile Compact Summary Widget (below sm) */}
      <div className="block sm:hidden card p-3 bg-white no-print space-y-2.5">
        <div className="grid grid-cols-2 gap-2 text-center divide-x divide-slate-100">
          <div className="p-0.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Teachers on Leave</span>
            <span className="text-lg font-extrabold text-gray-800 mt-0.5 block">
              {summary.teachers_on_leave !== undefined ? summary.teachers_on_leave : '-'}
            </span>
          </div>
          <div className="p-0.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Leave Periods</span>
            <span className="text-lg font-extrabold text-gray-800 mt-0.5 block">
              {summary.leave_periods !== undefined ? summary.leave_periods : summary.total_leaves}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100 text-center">
          <div className="bg-emerald-50/80 border border-emerald-150 rounded-lg py-1.5 px-1">
            <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-wider block">Covered</span>
            <span className="text-sm font-extrabold text-emerald-700">
              {summary.covered_periods !== undefined ? summary.covered_periods : summary.total_substitutions}
            </span>
          </div>
          <div className={`rounded-lg py-1.5 px-1 border ${
            (summary.pending_coverage !== undefined ? summary.pending_coverage : summary.unassigned_periods) > 0
              ? 'bg-amber-50/80 border-amber-200 text-amber-900'
              : 'bg-slate-50 border-slate-100 text-slate-700'
          }`}>
            <span className="text-[9px] font-bold uppercase tracking-wider block opacity-80">Pending</span>
            <span className="text-sm font-extrabold">
              {summary.pending_coverage !== undefined ? summary.pending_coverage : summary.unassigned_periods}
            </span>
          </div>
          <div className="bg-primary-50/80 border border-primary-150 rounded-lg py-1.5 px-1">
            <span className="text-[9px] font-bold text-primary-800 uppercase tracking-wider block">Coverage</span>
            <span className="text-sm font-extrabold text-primary-700">
              {summary.coverage_rate !== undefined ? summary.coverage_rate : summary.coverage_percentage}%
            </span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card p-3 sm:p-4 space-y-3 bg-white no-print filter-bar">
        {/* Desktop Filter Layout (md and up) */}
        <div className="hidden md:grid md:grid-cols-5 gap-3">
          {/* Date Picker */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Date</label>
            <input
              type="date"
              className="tt-input w-full py-1.5 text-xs"
              value={selectedDate}
              onChange={handleDateChange}
            />
          </div>

          {/* Teacher Search */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Teacher</label>
            <div className="relative flex items-center">
              <SearchIcon className="absolute left-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                className="tt-input w-full py-1.5 pl-8 text-xs"
                placeholder="Search name…  (press /)"
                value={searchTeacher}
                onChange={e => setSearchTeacher(e.target.value)}
              />
            </div>
          </div>

          {/* Class Section Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Class Section</label>
            <select
              className="tt-select w-full py-1.5 text-xs"
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
            >
              <option value="">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={`${c.name} - ${c.section}`}>{c.name} - {c.section}</option>
              ))}
            </select>
          </div>

          {/* Period Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Period</label>
            <select
              className="tt-select w-full py-1.5 text-xs"
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value)}
            >
              <option value="">All Periods</option>
              {periodOptions.map(p => (
                <option key={p} value={String(p)}>Period {p}</option>
              ))}
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Source</label>
            <select
              className="tt-select w-full py-1.5 text-xs"
              value={selectedSource}
              onChange={e => setSelectedSource(e.target.value)}
            >
              <option value="">All Sources</option>
              <option value="Autonomous">Autonomous</option>
              <option value="Assisted">Assisted</option>
              <option value="Manual">Manual</option>
              <option value="Teacher Assigned">Teacher Assigned</option>
              <option value="Unassigned">Unassigned</option>
            </select>
          </div>
        </div>

        {/* Desktop Footer (md and up) */}
        <div className="hidden md:flex items-center justify-between pt-1">
          {!isAdmin ? (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="my-coverage-check-desktop"
                checked={showMyOnly}
                onChange={e => setShowMyOnly(e.target.checked)}
                className="rounded text-primary-600 focus:ring-primary-500 w-3.5 h-3.5 border-gray-300"
              />
              <label htmlFor="my-coverage-check-desktop" className="text-xs font-medium text-gray-600 cursor-pointer">
                Show only my coverage duties / leaves
              </label>
            </div>
          ) : <span />}

          {filtersActive && (
            <button onClick={resetFilters} className="text-xs font-semibold text-primary-600 hover:underline">Reset filters</button>
          )}
        </div>

        {/* Mobile Compact Filter Bar (below md) */}
        <div className="block md:hidden space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Date</label>
              <input
                type="date"
                className="tt-input w-full py-1.5 px-2.5 text-xs font-semibold"
                value={selectedDate}
                onChange={handleDateChange}
              />
            </div>

            <div className="shrink-0 flex items-end">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                  mobileFiltersOpen || extraFiltersActiveCount > 0
                    ? 'bg-primary-50 border-primary-300 text-primary-700 shadow-xs'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <FilterIcon className="w-3.5 h-3.5" />
                <span>Filters</span>
                {extraFiltersActiveCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-primary-600 text-white text-[10px] flex items-center justify-center font-bold">
                    {extraFiltersActiveCount}
                  </span>
                )}
                {mobileFiltersOpen ? <ChevronUpIcon className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDownIcon className="w-3.5 h-3.5 text-gray-500" />}
              </button>
            </div>
          </div>

          {/* Quick Active Filter Chips when collapsed on mobile */}
          {!mobileFiltersOpen && extraFiltersActiveCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {searchTeacher && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-50 text-primary-700 border border-primary-200">
                  Teacher: {searchTeacher}
                  <button onClick={() => setSearchTeacher('')} className="hover:text-primary-900">✕</button>
                </span>
              )}
              {selectedClass && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-50 text-primary-700 border border-primary-200">
                  {selectedClass}
                  <button onClick={() => setSelectedClass('')} className="hover:text-primary-900">✕</button>
                </span>
              )}
              {selectedPeriod && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-50 text-primary-700 border border-primary-200">
                  P{selectedPeriod}
                  <button onClick={() => setSelectedPeriod('')} className="hover:text-primary-900">✕</button>
                </span>
              )}
              {selectedSource && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-50 text-primary-700 border border-primary-200">
                  {selectedSource}
                  <button onClick={() => setSelectedSource('')} className="hover:text-primary-900">✕</button>
                </span>
              )}
              {showMyOnly && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-50 text-primary-700 border border-primary-200">
                  My Duties Only
                  <button onClick={() => setShowMyOnly(false)} className="hover:text-primary-900">✕</button>
                </span>
              )}
              <button
                onClick={resetFilters}
                className="text-[10px] font-bold text-primary-600 hover:underline ml-1"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Expandable Mobile Filters Section */}
          {mobileFiltersOpen && (
            <div className="pt-2.5 border-t border-gray-100 space-y-2.5">
              {/* Teacher Search */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Teacher</label>
                <div className="relative flex items-center">
                  <SearchIcon className="absolute left-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input
                    className="tt-input w-full py-1.5 pl-8 text-xs"
                    placeholder="Search name…"
                    value={searchTeacher}
                    onChange={e => setSearchTeacher(e.target.value)}
                  />
                  {searchTeacher && (
                    <button onClick={() => setSearchTeacher('')} className="absolute right-2.5 text-xs text-gray-400 hover:text-gray-600">✕</button>
                  )}
                </div>
              </div>

              {/* Class & Period in 2 columns */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Class Section</label>
                  <select
                    className="tt-select w-full py-1.5 text-xs"
                    value={selectedClass}
                    onChange={e => setSelectedClass(e.target.value)}
                  >
                    <option value="">All Classes</option>
                    {classes.map(c => (
                      <option key={c.id} value={`${c.name} - ${c.section}`}>{c.name} - {c.section}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Period</label>
                  <select
                    className="tt-select w-full py-1.5 text-xs"
                    value={selectedPeriod}
                    onChange={e => setSelectedPeriod(e.target.value)}
                  >
                    <option value="">All Periods</option>
                    {periodOptions.map(p => (
                      <option key={p} value={String(p)}>Period {p}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Source Filter */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Source</label>
                <select
                  className="tt-select w-full py-1.5 text-xs"
                  value={selectedSource}
                  onChange={e => setSelectedSource(e.target.value)}
                >
                  <option value="">All Sources</option>
                  <option value="Autonomous">Autonomous</option>
                  <option value="Assisted">Assisted</option>
                  <option value="Manual">Manual</option>
                  <option value="Teacher Assigned">Teacher Assigned</option>
                  <option value="Unassigned">Unassigned</option>
                </select>
              </div>

              {/* My Coverage Switcher (Teachers only) */}
              {!isAdmin && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="my-coverage-check-mobile"
                    checked={showMyOnly}
                    onChange={e => setShowMyOnly(e.target.checked)}
                    className="rounded text-primary-600 focus:ring-primary-500 w-4 h-4 border-gray-300"
                  />
                  <label htmlFor="my-coverage-check-mobile" className="text-xs font-semibold text-gray-700 cursor-pointer">
                    Show only my coverage duties / leaves
                  </label>
                </div>
              )}

              {/* Mobile Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={resetFilters}
                  disabled={!filtersActive}
                  className="text-xs font-semibold text-gray-500 hover:text-gray-800 disabled:opacity-40"
                >
                  Reset filters
                </button>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 shadow-xs"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs: All, Needs Cover, Assigned Cover, Completed / Past */}
      <div className="border-b border-gray-200 flex gap-4 overflow-x-auto no-print" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        <button
          onClick={() => setStatusTab('all')}
          className={`pb-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            statusTab === 'all'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          All ({statusCounts.all})
        </button>
        <button
          onClick={() => setStatusTab('needs_coverage')}
          className={`pb-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            statusTab === 'needs_coverage'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Needs Cover ({statusCounts.needs_coverage})
        </button>
        <button
          onClick={() => setStatusTab('assigned')}
          className={`pb-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            statusTab === 'assigned'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Assigned Cover ({statusCounts.assigned})
        </button>
        <button
          onClick={() => setStatusTab('completed')}
          className={`pb-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            statusTab === 'completed'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Completed / Past ({statusCounts.completed})
        </button>
      </div>

      {/* Result count + bulk auto-assign */}
      <div className="flex flex-wrap items-center justify-between gap-2 no-print">
        <p className="text-xs text-gray-500">
          Showing <span className="font-semibold text-gray-700">{sortedFilteredSubstitutions.length}</span> of {subData.substitutions?.length || 0} periods
          {unassignedInView > 0 && <span className="text-amber-500 font-medium"> · {unassignedInView} need coverage</span>}
        </p>
        {isAdmin && unassignedInView > 0 && !autoAssigning && (
          <button
            onClick={() => setAutoAssignConfirmOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            <SparklesIcon className="w-3.5 h-3.5" /> Auto-assign all ({unassignedInView})
          </button>
        )}
      </div>

      {autoAssigning && (
        <div className="card p-3 no-print">
          <div className="flex items-center justify-between text-xs font-medium text-gray-600 mb-1.5">
            <span>Auto-assigning substitutes… {autoAssigning.done}/{autoAssigning.total}</span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${(autoAssigning.done / autoAssigning.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Table Card */}
      <div className="card overflow-hidden bg-white">
        {sortedFilteredSubstitutions.length === 0 ? (
          filtersActive ? (
            <div className="py-12 text-center text-sm text-gray-400">
              No substitutions match your filters.{' '}
              <button onClick={resetFilters} className="text-primary-600 font-semibold hover:underline">Reset filters</button>
            </div>
          ) : (
            <EmptyState message="No substitution records found for the selected date." />
          )
        ) : (
          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full text-sm" style={{ minWidth: '700px' }}>
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <SortableTh label="Period" sortKey="period" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableTh label="Class Section" sortKey="class" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableTh label="Original Teacher" sortKey="original" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableTh label="Substitute Teacher" sortKey="substitute" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableTh label="Source / Status" sortKey="source" sortConfig={sortConfig} onSort={handleSort} />
                  <th className="px-5 py-3 no-print" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedFilteredSubstitutions.map(sub => {
                  const isUnassigned = !sub.substitute_teacher
                  const isLocked = sub.assignment_type === 'admin_assigned' || sub.assignment_type === 'overridden'
                  const isExpired = sub.is_expired

                  return (
                    <tr key={sub.leave_id} className={`hover:bg-gray-50/50 ${isUnassigned ? 'bg-amber-50/50' : ''}`}>
                      <td className="px-5 py-3 text-gray-800 font-medium font-mono">P{sub.period_number}</td>
                      <td className="px-5 py-3 text-gray-800 font-semibold">{sub.class_name}</td>
                      <td className="px-5 py-3 text-gray-600">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{sub.original_teacher.name}</p>
                          <p className="text-[10px] text-gray-400">{sub.original_teacher.department || 'No department'}</p>
                          {sub.reason && (
                            <span
                              className="no-print inline-flex items-center gap-0.5 text-[10px] text-gray-300 hover:text-gray-500 cursor-help mt-0.5"
                              title={sub.reason}
                            >
                              <InfoIcon className="w-3 h-3" /> Reason
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {isUnassigned ? (
                          <div className="flex items-center gap-1.5 text-amber-500 font-medium text-xs">
                            <AlertTriangleIcon className="w-3.5 h-3.5 shrink-0" />
                            Needs Coverage
                          </div>
                        ) : (
                          <p className="text-sm font-medium text-gray-800">{sub.substitute_teacher.name}</p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {/* Interactive badges for screen, print-only fallback classes for paper */}
                        <span className="no-print inline-flex items-center gap-1.5">
                          {isExpired ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              Completed
                            </span>
                          ) : isUnassigned ? (
                            <span className="inline-flex items-center rounded-full font-medium bg-gray-100 text-gray-400 px-1.5 py-0.5 text-[10px]">Unassigned</span>
                          ) : (
                            <>
                              <AssignmentTypeBadge type={sub.assignment_type} small />
                              {isLocked && <LockIcon className="w-3 h-3 text-gray-300" title="Manually assigned" />}
                            </>
                          )}
                        </span>
                        <span className="hidden print-only-badge">
                          {isExpired ? 'Completed' : isUnassigned ? 'Unassigned' : sub.assignment_type?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right no-print">
                        {isAdmin && (
                          <div className="flex items-center justify-end gap-2">
                            {isExpired ? (
                              <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-slate-400 bg-slate-50 border border-slate-200 rounded-lg">
                                Concluded
                              </span>
                            ) : isUnassigned ? (
                              <button
                                onClick={() => openAssignModal(sub)}
                                disabled={actionLoading !== null}
                                className="px-2 py-1 text-[10px] bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded transition-colors"
                              >
                                {actionLoading === sub.leave_id + '_open_assign' ? '…' : 'Assign'}
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => openOverrideModal(sub)}
                                  disabled={actionLoading !== null}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] border border-gray-200 hover:border-primary-300 text-gray-600 rounded transition-colors font-medium"
                                >
                                  <SwapIcon className="w-3 h-3" />
                                  {actionLoading === sub.leave_id + '_open_override' ? '…' : 'Change'}
                                </button>
                                <button
                                  onClick={() => handleUndo(sub.leave_id)}
                                  disabled={actionLoading === sub.leave_id + '_undo'}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] border border-red-200 hover:bg-red-50 text-red-600 rounded transition-colors font-medium"
                                >
                                  <UndoIcon className="w-3 h-3" />
                                  {actionLoading === sub.leave_id + '_undo' ? '…' : 'Remove'}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Modal (Admin only) */}
      <Modal open={!!assignModal} onClose={() => setAssignModal(null)} title="Assign Substitute">
        {assignModal && (() => {
          const matchesModalFilter = (t) => {
            if (modalTeacherSearch.trim()) {
              const q = modalTeacherSearch.toLowerCase()
              const matchName = (t.name || '').toLowerCase().includes(q)
              const matchDept = (t.department || '').toLowerCase().includes(q)
              if (!matchName && !matchDept) return false
            }
            if (modalDeptFilter && (t.department || '') !== modalDeptFilter) return false
            return true
          }

          const filteredRecs = assignModal.recommendations.filter(r => matchesModalFilter(r.teacher))
          const filteredOthers = assignModal.others.filter(t => matchesModalFilter(t))

          return (
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-3.5 text-sm space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-gray-800">Original: {assignModal.leave.teacher?.name}</p>
                  {assignModal.leave.class_name && (
                    <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-md font-bold text-xs shrink-0 border border-indigo-200">
                      Class: {assignModal.leave.class_name}
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-xs flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span>Day Order {assignModal.leave.day_order}</span>
                  <span>·</span>
                  <span>Period {assignModal.leave.period_number}</span>
                  {assignModal.leave.subject_name && (
                    <>
                      <span>·</span>
                      <span className="font-medium text-gray-700">Subject: {assignModal.leave.subject_name}</span>
                    </>
                  )}
                  {assignModal.leave.reason && (
                    <>
                      <span>·</span>
                      <span className="italic">Reason: "{assignModal.leave.reason}"</span>
                    </>
                  )}
                </p>
              </div>


              {/* Filter controls & Cross-Department / Class-Faculty toggle switches */}
              <div className="p-3 bg-gray-50/80 border border-gray-200/80 rounded-xl space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Search candidate name…"
                      value={modalTeacherSearch}
                      onChange={e => setModalTeacherSearch(e.target.value)}
                    />
                    <SearchIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5 pointer-events-none" />
                  </div>
                  <select
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    value={modalDeptFilter}
                    onChange={e => setModalDeptFilter(e.target.value)}
                  >
                    <option value="">All Candidate Depts</option>
                    {modalCandidateDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-gray-200/60">
                  <button
                    type="button"
                    onClick={() => handleToggleCrossDept(!includeCrossDept)}
                    disabled={modalLoading}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      includeCrossDept
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span className={`w-6 h-3.5 flex items-center rounded-full p-0.5 transition-colors shrink-0 ${includeCrossDept ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                        <span className={`bg-white w-2.5 h-2.5 rounded-full shadow transform transition-transform ${includeCrossDept ? 'translate-x-2.5' : 'translate-x-0'}`} />
                      </span>
                      <span className="truncate">Other Depts</span>
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${includeCrossDept ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'}`}>
                      {includeCrossDept ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleOnlyHandlesClass(!onlyHandlesClass)}
                    disabled={modalLoading}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      onlyHandlesClass
                        ? 'bg-amber-50 border-amber-200 text-amber-800 shadow-sm'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span className={`w-6 h-3.5 flex items-center rounded-full p-0.5 transition-colors shrink-0 ${onlyHandlesClass ? 'bg-amber-600' : 'bg-gray-300'}`}>
                        <span className={`bg-white w-2.5 h-2.5 rounded-full shadow transform transition-transform ${onlyHandlesClass ? 'translate-x-2.5' : 'translate-x-0'}`} />
                      </span>
                      <span className="truncate">Class Faculty Only</span>
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${onlyHandlesClass ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-600'}`}>
                      {onlyHandlesClass ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </div>
              </div>


              {filteredRecs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                    <SparklesIcon className="w-3.5 h-3.5 text-indigo-600" /> Recommended Candidates ({filteredRecs.length})
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {filteredRecs.map(rec => (
                      <RecommendationRow
                        key={rec.teacher.id}
                        rec={rec}
                        onAssign={handleAssignRecommended}
                        disabled={actionLoading !== null}
                      />
                    ))}
                  </div>
                </div>
              )}

              {filteredOthers.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Other Available Teachers ({filteredOthers.length})</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {filteredOthers.map(t => (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-800 truncate">{t.name}</p>
                            {t.department && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded font-semibold shrink-0">
                                {t.department}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 truncate mt-0.5">
                            {t.today_workload === 0 ? 'Free all day today' : t.today_workload === 1 ? '1 period today' : `${t.today_workload} periods today`}
                            {t.today_workload > 0 ? ` (Periods: ${t.today_periods.join(', ')})` : ''}
                            {' · '}
                            {t.week_workload === 1 ? '1 period this week' : `${t.week_workload} periods this week`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleAssignManual(t.id)}
                          disabled={actionLoading !== null}
                          className="text-xs px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:border-primary-300 transition-colors disabled:opacity-50 shrink-0 ml-2"
                        >
                          Assign
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredRecs.length === 0 && filteredOthers.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6">
                  {modalLoading ? 'Loading candidates…' : 'No matching teachers found for this period.'}
                </p>
              )}
            </div>
          )
        })()}
      </Modal>

      {/* Override Modal (Admin only) */}
      <Modal open={!!overrideModal} onClose={() => setOverrideModal(null)} title="Change Substitute Cover">
        {overrideModal && (() => {
          const matchesModalFilter = (t) => {
            if (modalTeacherSearch.trim()) {
              const q = modalTeacherSearch.toLowerCase()
              const matchName = (t.name || '').toLowerCase().includes(q)
              const matchDept = (t.department || '').toLowerCase().includes(q)
              if (!matchName && !matchDept) return false
            }
            if (modalDeptFilter && (t.department || '') !== modalDeptFilter) return false
            return true
          }

          const filteredRecs = overrideModal.recommendations
            .filter(r => r.teacher.id !== overrideModal.leave.alter_assignment?.substitute_teacher_id)
            .filter(r => matchesModalFilter(r.teacher))

          const filteredOthers = overrideModal.others
            .filter(t => t.id !== overrideModal.leave.alter_assignment?.substitute_teacher_id)
            .filter(t => matchesModalFilter(t))

          return (
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-3.5 text-sm space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-gray-800">Currently Covered By: {overrideModal.leave.alter_assignment?.substitute?.name}</p>
                  {overrideModal.leave.class_name && (
                    <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-md font-bold text-xs shrink-0 border border-indigo-200">
                      Class: {overrideModal.leave.class_name}
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-xs flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span>Day Order {overrideModal.leave.day_order}</span>
                  <span>·</span>
                  <span>Period {overrideModal.leave.period_number}</span>
                  {overrideModal.leave.subject_name && (
                    <>
                      <span>·</span>
                      <span className="font-medium text-gray-700">Subject: {overrideModal.leave.subject_name}</span>
                    </>
                  )}
                </p>
              </div>


              {/* Filter controls & Cross-Department / Class-Faculty toggle switches */}
              <div className="p-3 bg-gray-50/80 border border-gray-200/80 rounded-xl space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Search candidate name…"
                      value={modalTeacherSearch}
                      onChange={e => setModalTeacherSearch(e.target.value)}
                    />
                    <SearchIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5 pointer-events-none" />
                  </div>
                  <select
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    value={modalDeptFilter}
                    onChange={e => setModalDeptFilter(e.target.value)}
                  >
                    <option value="">All Candidate Depts</option>
                    {modalCandidateDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-gray-200/60">
                  <button
                    type="button"
                    onClick={() => handleToggleCrossDept(!includeCrossDept)}
                    disabled={modalLoading}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      includeCrossDept
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span className={`w-6 h-3.5 flex items-center rounded-full p-0.5 transition-colors shrink-0 ${includeCrossDept ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                        <span className={`bg-white w-2.5 h-2.5 rounded-full shadow transform transition-transform ${includeCrossDept ? 'translate-x-2.5' : 'translate-x-0'}`} />
                      </span>
                      <span className="truncate">Other Depts</span>
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${includeCrossDept ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'}`}>
                      {includeCrossDept ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleOnlyHandlesClass(!onlyHandlesClass)}
                    disabled={modalLoading}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      onlyHandlesClass
                        ? 'bg-amber-50 border-amber-200 text-amber-800 shadow-sm'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span className={`w-6 h-3.5 flex items-center rounded-full p-0.5 transition-colors shrink-0 ${onlyHandlesClass ? 'bg-amber-600' : 'bg-gray-300'}`}>
                        <span className={`bg-white w-2.5 h-2.5 rounded-full shadow transform transition-transform ${onlyHandlesClass ? 'translate-x-2.5' : 'translate-x-0'}`} />
                      </span>
                      <span className="truncate">Class Faculty Only</span>
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${onlyHandlesClass ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-600'}`}>
                      {onlyHandlesClass ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </div>
              </div>


              {filteredRecs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                    <SparklesIcon className="w-3.5 h-3.5 text-indigo-600" /> Recommended Candidates ({filteredRecs.length})
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {filteredRecs.map(rec => (
                      <RecommendationRow
                        key={rec.teacher.id}
                        rec={rec}
                        onAssign={handleOverride}
                        disabled={actionLoading !== null}
                      />
                    ))}
                  </div>
                </div>
              )}

              {filteredOthers.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Other Available Teachers ({filteredOthers.length})</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {filteredOthers.map(t => (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-800 truncate">{t.name}</p>
                            {t.department && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded font-semibold shrink-0">
                                {t.department}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 truncate mt-0.5">
                            {t.today_workload === 0 ? 'Free all day today' : t.today_workload === 1 ? '1 period today' : `${t.today_workload} periods today`}
                            {t.today_workload > 0 ? ` (Periods: ${t.today_periods.join(', ')})` : ''}
                            {' · '}
                            {t.week_workload === 1 ? '1 period this week' : `${t.week_workload} periods this week`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleOverride(t.id)}
                          disabled={actionLoading !== null}
                          className="text-xs px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:border-primary-300 transition-colors disabled:opacity-50 shrink-0 ml-2"
                        >
                          Assign
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredRecs.length === 0 && filteredOthers.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6">
                  {modalLoading ? 'Loading candidates…' : 'No other eligible teachers found for this period.'}
                </p>
              )}
            </div>
          )
        })()}
      </Modal>


      {/* Auto-assign-all Confirmation Modal (Admin only) */}
      <Modal open={autoAssignConfirmOpen} onClose={() => setAutoAssignConfirmOpen(false)} title="Auto-assign Substitutes">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This finds the best available substitute for each of the <strong className="text-gray-800">{unassignedInView}</strong> unassigned
            period(s) currently shown, and assigns them one at a time so nobody gets double-booked. Periods with no eligible teacher are skipped.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAutoAssignConfirmOpen(false)}
              className="flex-1 px-3 py-2 border border-gray-200 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runAutoAssignAll}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <SparklesIcon className="w-3.5 h-3.5" /> Auto-assign {unassignedInView}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}