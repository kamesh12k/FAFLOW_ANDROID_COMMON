import { useEffect, useState, useMemo } from 'react'
import { teacherSubstitutionApi, leavesApi, departmentsApi } from '../../api/services'
import { Spinner, Modal, EmptyState, AssignmentTypeBadge, ErrorAlert } from '../../components/ui'
import { AlertTriangleIcon, SwapIcon, UndoIcon, SettingsIcon, SparklesIcon, FilterIcon, SearchIcon, XMarkIcon } from '../../components/icons'

function ScoreBar({ score }) {
  const color = score >= 75 ? 'bg-green-500' : score >= 45 ? 'bg-yellow-500' : 'bg-gray-400'
  return (
    <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden shrink-0">
      <div className={`h-full ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
    </div>
  )
}

function RecommendationRow({ rec, onAssign, disabled, isOverride }) {
  const teacher = rec.teacher || {}
  const initial = (teacher.name || 'T')[0].toUpperCase()
  const todayLoad = rec.today_workload !== undefined ? rec.today_workload : teacher.today_workload
  const projToday = rec.projected_today_workload !== undefined ? rec.projected_today_workload : (todayLoad !== undefined ? todayLoad + 1 : undefined)
  const weekLoad = rec.week_workload !== undefined ? rec.week_workload : teacher.week_workload
  const projWeek = rec.projected_week_workload !== undefined ? rec.projected_week_workload : (weekLoad !== undefined ? weekLoad + 1 : undefined)
  const contLoad = rec.longest_continuous_periods
  const projCont = rec.projected_longest_continuous_periods
  const todayPeriods = rec.today_periods || teacher.today_periods || []

  return (
    <div className="p-3.5 bg-white hover:bg-slate-50/90 border border-slate-200/90 rounded-2xl transition shadow-xs space-y-3 text-left">
      {/* Top Header: Avatar, Name, Dept, Match %, Assign Button */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-slate-900 truncate">{teacher.name}</h4>
              {teacher.department && (
                <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-semibold shrink-0 border border-slate-200/70">
                  {teacher.department}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <ScoreBar score={rec.score} />
              {rec.tier && (
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                  rec.tier === 'EXCELLENT' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                  rec.tier === 'GOOD' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                  rec.tier === 'FAIR' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                  'bg-slate-100 text-slate-700 border border-slate-300'
                }`}>
                  {rec.tier}
                </span>
              )}
              <span className="text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                Suitability: {Math.max(0, Math.min(100, Math.round(Number(rec.score) || 0)))}/100
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => onAssign(teacher.id)}
          disabled={disabled}
          className="text-xs font-bold px-4 py-2 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white rounded-xl transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
        >
          {disabled ? '…' : isOverride ? 'Reassign' : 'Assign'}
        </button>
      </div>

      {/* Workload Simulation Metrics Grid */}
      <div className="grid grid-cols-3 gap-2 bg-slate-50/90 border border-slate-200/80 rounded-xl p-2.5 text-center">
        <div className="flex flex-col items-center justify-center">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total Today</span>
          <span className="text-xs font-black text-slate-800 mt-0.5">
            {todayLoad === 0 ? 'Free (0 classes)' : `${todayLoad} → ${projToday} classes`}
          </span>
          {todayPeriods.length > 0 ? (
            <span className="text-[9px] text-slate-500 font-medium mt-0.5 truncate max-w-full">
              Periods: P{todayPeriods.sort((a, b) => a - b).join(', P')}
            </span>
          ) : todayLoad > 0 ? (
            <span className="text-[9px] text-slate-400 mt-0.5">{todayLoad} periods total</span>
          ) : (
            <span className="text-[9px] text-emerald-600 font-medium mt-0.5">Free all day</span>
          )}
        </div>

        <div className="flex flex-col items-center justify-center border-x border-slate-200/80 px-1">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Back-to-Back</span>
          <span className={`text-xs font-black mt-0.5 ${projCont >= 4 ? 'text-amber-700 font-extrabold' : 'text-slate-800'}`}>
            {contLoad === undefined ? '-' : `${contLoad} → ${projCont} in a row`}
          </span>
          <span className={`text-[9px] mt-0.5 ${projCont >= 4 ? 'text-amber-700 font-bold' : 'text-slate-400'}`}>
            {projCont >= 4 ? `⚠️ ${projCont} in a row (no break)` : projCont > 1 ? 'Classes in a row' : 'No consecutive'}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Weekly Total</span>
          <span className="text-xs font-black text-slate-800 mt-0.5">
            {weekLoad !== undefined ? `${weekLoad} → ${projWeek} classes` : '-'}
          </span>
          <span className="text-[9px] text-slate-400 mt-0.5">
            {rec.substitutions_week !== undefined ? `${rec.substitutions_week} sub(s) this week` : 'Weekly total'}
          </span>
        </div>
      </div>

      {/* Distinct Context Badges */}
      {rec.reasons?.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {rec.reasons.map((r, i) => {
            const isWarn = r.includes('⚠') || r.includes('Fatigue') || r.includes('break')
            const isSubject = r.includes('subject')
            const isDept = r.includes('department')
            return (
              <span
                key={i}
                className={`text-[10px] px-2 py-0.5 rounded-md font-semibold tracking-tight ${
                  isWarn
                    ? 'bg-amber-50 text-amber-800 border border-amber-200 font-bold'
                    : isSubject
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : isDept
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200/80'
                }`}
              >
                {r}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function TeacherSubstitution() {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [myLeaves, setMyLeaves] = useState([])
  const [activeCoverLeaves, setActiveCoverLeaves] = useState([])
  const [pastCoverLeaves, setPastCoverLeaves] = useState([])
  const [allDepartments, setAllDepartments] = useState([])
  const [activeTab, setActiveTab] = useState('needs-cover')
  const [assignModal, setAssignModal] = useState(null) // { leave, recommendations, others, isOverride }
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)
  const [limitWarning, setLimitWarning] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)
  const [error, setError] = useState('')
  const [filterError, setFilterError] = useState('')
  const [candidateFilters, setCandidateFilters] = useState({
    crossDepartment: false,
    handlesClass: false,
    department: '',
    search: '',
  })

  const loadData = async () => {
    setError('')
    try {
      const [enabledRes, deptsRes] = await Promise.all([
        teacherSubstitutionApi.enabled(),
        departmentsApi.list(true).catch(() => ({ data: [] })),
      ])
      setEnabled(enabledRes.data.teachers_mode_enabled)
      setAllDepartments(deptsRes.data || [])
      
      if (enabledRes.data.teachers_mode_enabled) {
        const [{ data: needsCover }, { data: allMyLeaves }] = await Promise.all([
          teacherSubstitutionApi.myLeaves(),
          leavesApi.myLeaves()
        ])
        
        // Backend is the single source of truth for expiration in Asia/Kolkata
        setMyLeaves(needsCover.filter(l => !l.is_expired))
        
        setActiveCoverLeaves(
          allMyLeaves.filter(l => l.status === 'approved' && l.alter_assignment && !l.is_expired)
        )

        setPastCoverLeaves(
          allMyLeaves.filter(l => l.status === 'approved' && l.is_expired)
        )
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load substitution data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const loadCandidates = async (leave, filters = candidateFilters) => {
    const params = {
      include_cross_department: filters.crossDepartment,
      only_handles_class: filters.handlesClass,
    }
    const [{ data: recommendations }, { data: freeTeachers }] = await Promise.all([
      teacherSubstitutionApi.candidates(leave.id, params),
      teacherSubstitutionApi.freeTeachers(leave.id, params),
    ])
    const recommendedIds = new Set(recommendations.map(r => r.teacher.id))
    const others = freeTeachers.filter(t => !recommendedIds.has(t.id))
    return { recommendations, others }
  }

  const handleOpenAssignModal = async (leave, isOverride = false) => {
    setActionLoading(leave.id + '_load_candidates')
    setError('')
    setFilterError('')
    const initialFilters = { crossDepartment: false, handlesClass: false, department: '', search: '' }
    setCandidateFilters(initialFilters)
    try {
      const { recommendations, others } = await loadCandidates(leave, initialFilters)
      setAssignModal({ leave, recommendations, others, isOverride })
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load candidates.')
    } finally {
      setActionLoading(null)
    }
  }

  const applyCandidateFilters = async (nextFilters) => {
    setCandidateFilters(nextFilters)
    if (!assignModal) return
    setActionLoading('filter_candidates')
    setFilterError('')
    try {
      const { recommendations, others } = await loadCandidates(assignModal.leave, nextFilters)
      setAssignModal(prev => ({ ...prev, recommendations, others }))
    } catch (err) {
      setFilterError(err.response?.data?.detail || 'Could not apply candidate filters.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDepartmentChange = (selectedDept) => {
    applyCandidateFilters({
      ...candidateFilters,
      department: selectedDept,
    })
  }

  const handleCrossDeptToggle = (checked) => {
    applyCandidateFilters({
      ...candidateFilters,
      crossDepartment: checked,
      department: '',
    })
  }

  const candidateMatchesLocalFilters = (candidate) => {
    const teacher = candidate.teacher || candidate
    const department = teacher.department || ''
    const name = teacher.name || ''
    return (
      (!candidateFilters.department || department.toLowerCase() === candidateFilters.department.toLowerCase()) &&
      (!candidateFilters.search || `${name} ${department}`.toLowerCase().includes(candidateFilters.search.toLowerCase()))
    )
  }

  const candidateDepartments = useMemo(() => {
    if (!candidateFilters.crossDepartment) {
      if (!assignModal) return []
      const names = []
      assignModal.recommendations.forEach(r => { if (r.teacher?.department) names.push(r.teacher.department) })
      assignModal.others.forEach(t => { if (t?.department) names.push(t.department) })
      if (assignModal.leave?.teacher?.department) names.push(assignModal.leave.teacher.department)
      return [...new Set(names.filter(Boolean))].sort()
    }
    const names = allDepartments.map(d => d.name)
    if (assignModal) {
      assignModal.recommendations.forEach(r => { if (r.teacher?.department) names.push(r.teacher.department) })
      assignModal.others.forEach(t => { if (t?.department) names.push(t.department) })
    }
    return [...new Set(names.filter(Boolean))].sort()
  }, [allDepartments, assignModal, candidateFilters.crossDepartment])

  const handleAssignSubstitute = async (substituteId, overrideLimit = false) => {
    const leaveId = assignModal?.leave?.id || limitWarning?.leaveId
    if (!leaveId) return
    const isOverride = assignModal ? assignModal.isOverride : limitWarning?.isOverride
    setActionLoading('assign')
    try {
      const params = { include_cross_department: candidateFilters.crossDepartment }
      if (isOverride) {
        await teacherSubstitutionApi.override(leaveId, substituteId, params, overrideLimit)
      } else {
        await teacherSubstitutionApi.assign(leaveId, substituteId, params, overrideLimit)
      }
      setLimitWarning(null)
      setAssignModal(null)
      await loadData()
    } catch (err) {
      if (err.response?.status === 409 && (err.response?.data?.detail?.code === 'LIMIT_ACKNOWLEDGEMENT_REQUIRED' || err.response?.data?.code === 'LIMIT_ACKNOWLEDGEMENT_REQUIRED')) {
        const warningData = err.response?.data?.detail || err.response?.data
        setLimitWarning({
          leaveId,
          substituteId,
          isOverride,
          warningData,
        })
        return
      }
      setError(err.response?.data?.detail?.message || err.response?.data?.detail || 'Failed to assign substitute.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleClearAllAssignments = async () => {
    setActionLoading('clear_all')
    try {
      await teacherSubstitutionApi.clearAllAssignments()
      setConfirmClearOpen(false)
      await loadData()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to clear assignments.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleResetPreferences = async () => {
    setActionLoading('reset_prefs')
    try {
      await teacherSubstitutionApi.resetPreferences()
      setConfirmResetOpen(false)
      await loadData()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reset preferences.')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  if (!enabled) {
    return (
      <div className="max-w-md mx-auto mt-10">
        <div className="card p-6 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">
            <AlertTriangleIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Teachers Mode Disabled</h2>
            <p className="text-sm text-gray-500 mt-1">
              Your institution is currently in Manual or Full Autonomous workflow mode. 
              Self-guided teacher substitutions are disabled.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Manage Substitutes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Assign and override substitutes for your own approved leaves</p>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setConfirmResetOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 rounded-lg transition-colors"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            Reset Preferences
          </button>
          <button
            onClick={() => setConfirmClearOpen(true)}
            disabled={activeCoverLeaves.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <UndoIcon className="w-3.5 h-3.5" />
            Clear All Assignments
          </button>
        </div>
      </div>

      <ErrorAlert message={error} />

      {/* Tabs */}
      <div className="border-b border-gray-100 flex gap-4 overflow-x-auto" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        <button
          onClick={() => setActiveTab('needs-cover')}
          className={`pb-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'needs-cover'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Needs Cover ({myLeaves.length})
        </button>
        <button
          onClick={() => setActiveTab('assigned-cover')}
          className={`pb-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'assigned-cover'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Assigned Cover ({activeCoverLeaves.length})
        </button>
        <button
          onClick={() => setActiveTab('completed-cover')}
          className={`pb-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'completed-cover'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Completed / Past ({pastCoverLeaves.length})
        </button>
      </div>

      <div className="card overflow-hidden">
        {activeTab === 'needs-cover' ? (
          myLeaves.length === 0 ? (
            <EmptyState message="No active approved leaves needing substitutes right now." />
          ) : (
            <>
              {/* Desktop Table View (md and up) */}
              <div className="hidden md:block overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Date', 'Day Order', 'Period', 'Reason', ''].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {myLeaves.map(leave => (
                      <tr key={leave.id} className="hover:bg-gray-50/50">
                        <td className="px-5 py-3 text-gray-800 font-medium">{leave.date}</td>
                        <td className="px-5 py-3 text-gray-500">DO {leave.day_order}</td>
                        <td className="px-5 py-3 text-gray-500">P{leave.period_number}</td>
                        <td className="px-5 py-3 text-gray-600 max-w-xs truncate">
                          <div className="flex items-center gap-1.5">
                            {leave.is_emergency && <AlertTriangleIcon className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                            {leave.reason}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => handleOpenAssignModal(leave, false)}
                            disabled={!!actionLoading}
                            className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg transition-colors ml-auto"
                          >
                            <SwapIcon className="w-3 h-3" />
                            {actionLoading === leave.id + '_load_candidates' ? 'Loading…' : 'Assign Sub'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View (below md — zero horizontal scroll) */}
              <div className="block md:hidden divide-y divide-gray-100">
                {myLeaves.map(leave => (
                  <div key={leave.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-900 text-sm">{leave.date}</span>
                          <span className="text-[10px] text-gray-600 font-semibold bg-gray-100 px-2 py-0.5 rounded-md">
                            DO {leave.day_order} · P{leave.period_number}
                          </span>
                        </div>
                      </div>
                      {leave.is_emergency && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-md">
                          <AlertTriangleIcon className="w-3 h-3 text-rose-500" />
                          Emergency
                        </span>
                      )}
                    </div>

                    {leave.reason && (
                      <div className="p-2.5 bg-gray-50/80 rounded-xl border border-gray-200/70 text-xs text-gray-700">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Reason</span>
                        <p className="font-medium">{leave.reason}</p>
                      </div>
                    )}

                    <div className="pt-1">
                      <button
                        onClick={() => handleOpenAssignModal(leave, false)}
                        disabled={!!actionLoading}
                        className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm min-h-[40px]"
                      >
                        <SwapIcon className="w-3.5 h-3.5" />
                        <span>{actionLoading === leave.id + '_load_candidates' ? 'Loading…' : 'Assign Substitute'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        ) : activeTab === 'assigned-cover' ? (
          activeCoverLeaves.length === 0 ? (
            <EmptyState message="No active substitute covers assigned yet." />
          ) : (
            <>
              {/* Desktop Table View (md and up) */}
              <div className="hidden md:block overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Date', 'Day Order', 'Period', 'Assigned Substitute', 'Type', ''].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {activeCoverLeaves.map(leave => (
                      <tr key={leave.id} className="hover:bg-gray-50/50">
                        <td className="px-5 py-3 text-gray-800 font-medium">{leave.date}</td>
                        <td className="px-5 py-3 text-gray-500">DO {leave.day_order}</td>
                        <td className="px-5 py-3 text-gray-500">P{leave.period_number}</td>
                        <td className="px-5 py-3 text-gray-800 font-medium">{leave.alter_assignment.substitute?.name}</td>
                        <td className="px-5 py-3">
                          <AssignmentTypeBadge type={leave.alter_assignment.assignment_type} small />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => handleOpenAssignModal(leave, true)}
                            disabled={!!actionLoading}
                            className="text-xs text-primary-600 hover:text-primary-800 font-medium ml-auto"
                          >
                            {actionLoading === leave.id + '_load_candidates' ? 'Loading…' : 'Change Cover'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View (below md — zero horizontal scroll) */}
              <div className="block md:hidden divide-y divide-gray-100">
                {activeCoverLeaves.map(leave => (
                  <div key={leave.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-900 text-sm">{leave.date}</span>
                          <span className="text-[10px] text-gray-600 font-semibold bg-gray-100 px-2 py-0.5 rounded-md">
                            DO {leave.day_order} · P{leave.period_number}
                          </span>
                        </div>
                      </div>
                      <AssignmentTypeBadge type={leave.alter_assignment.assignment_type} small />
                    </div>

                    <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider block mb-0.5">Assigned Substitute</span>
                        <span className="font-extrabold text-gray-900 text-sm">{leave.alter_assignment.substitute?.name}</span>
                      </div>
                    </div>

                    <div className="pt-1">
                      <button
                        onClick={() => handleOpenAssignModal(leave, true)}
                        disabled={!!actionLoading}
                        className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 border border-primary-200 bg-primary-50/80 hover:bg-primary-100 active:bg-primary-200 text-primary-700 text-xs font-bold rounded-xl transition-all min-h-[40px]"
                      >
                        <SwapIcon className="w-3.5 h-3.5 text-primary-600" />
                        <span>{actionLoading === leave.id + '_load_candidates' ? 'Loading…' : 'Change Cover'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        ) : (
          pastCoverLeaves.length === 0 ? (
            <EmptyState message="No completed or past substitution records." />
          ) : (
            <>
              {/* Desktop Table View (md and up) */}
              <div className="hidden md:block overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Date', 'Day Order', 'Period', 'Cover / Substitute', 'Status', 'Reason'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pastCoverLeaves.map(leave => {
                      const subName = leave.alter_assignment?.substitute?.name
                      return (
                        <tr key={leave.id} className="hover:bg-gray-50/50">
                          <td className="px-5 py-3 text-gray-800 font-medium whitespace-nowrap">{leave.date}</td>
                          <td className="px-5 py-3 text-gray-500 whitespace-nowrap">DO {leave.day_order}</td>
                          <td className="px-5 py-3 text-gray-500 whitespace-nowrap">P{leave.period_number}</td>
                          <td className="px-5 py-3 text-gray-800 font-medium">
                            {subName ? (
                              <div className="flex items-center gap-2">
                                <span>{subName}</span>
                                <AssignmentTypeBadge type={leave.alter_assignment.assignment_type} small />
                              </div>
                            ) : (
                              <span className="text-gray-400 italic text-xs">No substitute assigned</span>
                            )}
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              Completed
                            </span>
                          </td>
                          <td className="px-5 py-3 text-gray-500 text-xs max-w-xs truncate">
                            {leave.reason || '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View (below md) */}
              <div className="block md:hidden divide-y divide-gray-100">
                {pastCoverLeaves.map(leave => {
                  const subName = leave.alter_assignment?.substitute?.name
                  return (
                    <div key={leave.id} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-900 text-sm">{leave.date}</span>
                          <span className="text-[10px] text-gray-600 font-semibold bg-gray-100 px-2 py-0.5 rounded-md">
                            DO {leave.day_order} · P{leave.period_number}
                          </span>
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                          Completed
                        </span>
                      </div>

                      <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-2">
                        <div>
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                            Substitute Coverage
                          </span>
                          <span className="font-bold text-gray-800 text-sm">
                            {subName || 'No substitute assigned'}
                          </span>
                        </div>
                        {leave.alter_assignment && (
                          <AssignmentTypeBadge type={leave.alter_assignment.assignment_type} small />
                        )}
                      </div>

                      {leave.reason && (
                        <p className="text-xs text-gray-500 italic truncate">
                          Reason: {leave.reason}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )
        )}
      </div>

      {/* Assign/Override Candidates Modal */}
      <Modal
        open={!!assignModal}
        onClose={() => setAssignModal(null)}
        title={assignModal?.isOverride ? "Change Substitute Assignment" : "Assign Substitute Candidate"}
      >
        {assignModal && (() => {
          const matchingRecs = assignModal.recommendations.filter(candidateMatchesLocalFilters)
          const matchingOthers = assignModal.others.filter(candidateMatchesLocalFilters)
          const totalAvailable = matchingRecs.length + matchingOthers.length

          return (
            <div className="space-y-4">
              {/* Slot Details Header */}
              <div className="p-3.5 bg-gradient-to-r from-slate-50 via-gray-50 to-indigo-50/40 border border-slate-200/80 rounded-2xl flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200/80 rounded-lg font-semibold text-slate-800 shadow-sm">
                    📅 {assignModal.leave.date}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200/80 rounded-lg font-semibold text-slate-700 shadow-sm">
                    DO {assignModal.leave.day_order} · Period {assignModal.leave.period_number}
                  </span>
                </div>
                {assignModal.leave.reason && (
                  <p className="text-xs text-slate-600 truncate max-w-full font-medium italic">
                    "{assignModal.leave.reason}"
                  </p>
                )}
              </div>

              <ErrorAlert message={filterError} />

              {/* Candidate Filters Redesign */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
                      <FilterIcon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Candidate Filters</h4>
                      <p className="text-[11px] text-slate-500">
                        {totalAvailable} {totalAvailable === 1 ? 'candidate' : 'candidates'} available
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {actionLoading === 'filter_candidates' && (
                      <span className="inline-flex items-center gap-1 text-xs text-primary-600 font-medium">
                        <Spinner size="sm" /> Refreshing…
                      </span>
                    )}
                    {(candidateFilters.crossDepartment || candidateFilters.handlesClass || candidateFilters.department || candidateFilters.search) && (
                      <button
                        type="button"
                        onClick={() => applyCandidateFilters({ crossDepartment: false, handlesClass: false, department: '', search: '' })}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline transition"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                </div>

                {/* Search and Department row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="relative">
                    <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition"
                      placeholder="Search candidate name…"
                      value={candidateFilters.search}
                      onChange={e => setCandidateFilters({ ...candidateFilters, search: e.target.value })}
                    />
                    {candidateFilters.search && (
                      <button
                        type="button"
                        onClick={() => setCandidateFilters({ ...candidateFilters, search: '' })}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-md"
                      >
                        <XMarkIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div>
                    <select
                      className="w-full px-3 py-2 text-xs bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition font-medium text-slate-700 cursor-pointer"
                      value={candidateFilters.department}
                      onChange={e => handleDepartmentChange(e.target.value)}
                    >
                      <option value="">All Departments</option>
                      {candidateDepartments.map(d => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Interactive Toggle Switch Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleCrossDeptToggle(!candidateFilters.crossDepartment)}
                    disabled={actionLoading === 'filter_candidates'}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      candidateFilters.crossDepartment
                        ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950 shadow-sm ring-1 ring-indigo-500/10'
                        : 'bg-slate-50/60 hover:bg-slate-50 border-slate-200/90 text-slate-700'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-semibold truncate">Other Departments</p>
                      <p className="text-[11px] text-slate-500 truncate">Search across campus</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        candidateFilters.crossDepartment ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {candidateFilters.crossDepartment ? 'ON' : 'OFF'}
                      </span>
                      <span className={`w-8 h-4 flex items-center rounded-full p-0.5 transition-colors ${
                        candidateFilters.crossDepartment ? 'bg-indigo-600' : 'bg-slate-300'
                      }`}>
                        <span className={`bg-white w-3 h-3 rounded-full shadow transform transition-transform ${
                          candidateFilters.crossDepartment ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyCandidateFilters({ ...candidateFilters, handlesClass: !candidateFilters.handlesClass })}
                    disabled={actionLoading === 'filter_candidates'}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      candidateFilters.handlesClass
                        ? 'bg-amber-50/80 border-amber-200 text-amber-950 shadow-sm ring-1 ring-amber-500/10'
                        : 'bg-slate-50/60 hover:bg-slate-50 border-slate-200/90 text-slate-700'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-semibold truncate">Class Faculty Only</p>
                      <p className="text-[11px] text-slate-500 truncate">Teachers of this class</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        candidateFilters.handlesClass ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {candidateFilters.handlesClass ? 'ON' : 'OFF'}
                      </span>
                      <span className={`w-8 h-4 flex items-center rounded-full p-0.5 transition-colors ${
                        candidateFilters.handlesClass ? 'bg-amber-600' : 'bg-slate-300'
                      }`}>
                        <span className={`bg-white w-3 h-3 rounded-full shadow transform transition-transform ${
                          candidateFilters.handlesClass ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Recommended candidates */}
              {matchingRecs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-4 flex items-center gap-1.5">
                    <SparklesIcon className="w-3.5 h-3.5 text-primary-500" /> Recommended Candidates ({matchingRecs.length})
                  </p>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {matchingRecs.map(rec => (
                      <RecommendationRow
                        key={rec.teacher.id}
                        rec={rec}
                        onAssign={handleAssignSubstitute}
                        disabled={actionLoading === 'assign'}
                        isOverride={assignModal.isOverride}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Other available teachers */}
              {matchingOthers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-4">
                    Other available teachers ({matchingOthers.length})
                  </p>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {matchingOthers.map(t => (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-slate-50/80 hover:bg-slate-50 border border-slate-100 rounded-xl gap-3 transition">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-800">{t.name}</p>
                            {t.department && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-slate-200/80 text-slate-700 rounded-md font-semibold shrink-0">
                                {t.department}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-slate-500">
                              {t.today_workload ?? 0} {t.today_workload === 1 ? 'period' : 'periods'} today
                              {t.today_periods && t.today_periods.length > 0 && (
                                <span className="text-slate-400"> (P{t.today_periods.sort((a, b) => a - b).join(', P')})</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAssignSubstitute(t.id)}
                          disabled={actionLoading === 'assign'}
                          className="text-xs px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 shrink-0 font-medium shadow-sm"
                        >
                          {actionLoading === 'assign' ? '…' : assignModal.isOverride ? 'Reassign' : 'Assign'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {matchingRecs.length === 0 && matchingOthers.length === 0 && (
                <div className="py-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-400 font-medium">No available candidates found matching the selected filters.</p>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssignModal(null)}
                  className="btn-secondary text-xs px-4 py-2"
                >
                  Close
                </button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Confirm Clear All Modal */}
      <Modal
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        title="Clear all assignments?"
      >
        <div className="space-y-4 text-sm text-gray-600">
          <p>
            Are you sure you want to remove all substitute coverage assignments from your leaves? 
            This will:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>Delete all covers currently assigned to your approved leaves</li>
            <li>Revert all credit transactions for both you and your substitutes</li>
            <li>Return your leaves to "Needs Cover" status</li>
          </ul>
          <p className="text-xs text-red-500 font-medium">This action cannot be undone.</p>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setConfirmClearOpen(false)}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              onClick={handleClearAllAssignments}
              disabled={actionLoading === 'clear_all'}
              className="btn-danger flex-1"
            >
              {actionLoading === 'clear_all' ? 'Clearing…' : 'Clear All'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirm Reset Preferences Modal */}
      <Modal
        open={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        title="Reset substitution preferences?"
      >
        <div className="space-y-4 text-sm text-gray-600">
          <p>
            Are you sure you want to reset all your substitution preferences? 
            This will immediately:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>Turn off auto-assignments and emergency assignments</li>
            <li>Reset morning and same-department nudges to off</li>
            <li>Set your weekly substitution cap back to 5</li>
          </ul>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setConfirmResetOpen(false)}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              onClick={handleResetPreferences}
              disabled={actionLoading === 'reset_prefs'}
              className="btn-primary flex-1"
            >
              {actionLoading === 'reset_prefs' ? 'Resetting…' : 'Reset'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 7-Day Substitution Limit Warning Modal */}
      {limitWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-amber-200 max-w-lg w-full overflow-hidden text-left">
            {/* Header */}
            <div className="bg-amber-50 px-6 py-4 border-b border-amber-100 flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 text-xl font-bold shadow-xs">
                ⚠️
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Substitution Allocation Limit Reached</h3>
                <p className="text-xs text-slate-600 mt-0.5">Explicit authorization required to proceed with this assignment</p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-sm text-slate-700">
              <p>
                <span className="font-bold text-slate-900">{limitWarning.warningData.teacher_name || 'The selected teacher'}</span> has reached the maximum number of substitution allocations allowed within the current 7-day window.
              </p>

              {/* Allocation Metrics Box */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200/80 rounded-xl p-4">
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Current 7-Day Total</span>
                  <span className="text-xl font-black text-slate-800 mt-0.5">
                    {limitWarning.warningData.current_allocations} / {limitWarning.warningData.max_allocations}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Allocations in past 7 days</span>
                </div>

                <div className="flex flex-col border-l border-slate-200 pl-3">
                  <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">After Assignment</span>
                  <span className="text-xl font-black text-amber-600 mt-0.5">
                    {limitWarning.warningData.projected_allocations} / {limitWarning.warningData.max_allocations}
                  </span>
                  <span className="text-[10px] text-amber-700/80 mt-0.5">Exceeds 7-day window limit</span>
                </div>
              </div>

              <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
                <span className="text-base leading-none">ℹ️</span>
                <p className="leading-relaxed">
                  This assignment will exceed the configured 7-day substitution allocation limit. Please confirm that you understand and want to authorize this assignment.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setLimitWarning(null)}
                disabled={actionLoading === 'assign'}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleAssignSubstitute(limitWarning.substituteId, true)}
                disabled={actionLoading === 'assign'}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-lg shadow-xs transition flex items-center gap-2"
              >
                {actionLoading === 'assign' ? 'Assigning…' : 'I Understand & Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
