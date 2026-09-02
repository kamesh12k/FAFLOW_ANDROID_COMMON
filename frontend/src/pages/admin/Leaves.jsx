import { useEffect, useState, useMemo } from 'react'
import { leavesApi, adminApi, departmentsApi } from '../../api/services'
import { Spinner, StatusBadge, Modal, EmptyState, AssignmentTypeBadge } from '../../components/ui'
import {
  SwapIcon,
  LockIcon,
  UnlockIcon,
  UndoIcon,
  SparklesIcon,
  AlertTriangleIcon,
  SearchIcon,
  XMarkIcon,
  CheckIcon,
  FilterIcon,
} from '../../components/icons'

function ScoreBar({ score }) {
  const color = score >= 75 ? 'bg-emerald-500' : score >= 45 ? 'bg-amber-500' : 'bg-slate-400'
  return (
    <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden shrink-0">
      <div className={`h-full ${color} rounded-full transition-all duration-300`} style={{ width: `${Math.min(score, 100)}%` }} />
    </div>
  )
}

function RecommendationRow({ rec, onAssign, disabled, isSwap = false }) {
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
    <div className="p-3.5 bg-white hover:bg-slate-50/90 border border-slate-200/90 rounded-2xl transition shadow-xs space-y-3">
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
            <div className="flex items-center gap-2 mt-1">
              <ScoreBar score={rec.score} />
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                {rec.score}% match
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => onAssign(teacher.id, true)}
          disabled={disabled}
          className="text-xs font-bold px-4 py-2 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white rounded-xl transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
        >
          {disabled ? '…' : isSwap ? 'Swap' : 'Assign'}
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

export default function AdminLeaves() {
  const [leaves, setLeaves] = useState([])
  const [allDepartments, setAllDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(new Set()) // Stores consolidated group keys
  const [subModal, setSubModal] = useState(null) // { group, activeReq, recommendations, others }
  const [cancelModal, setCancelModal] = useState(null) // { group, impact }
  const [cancelReason, setCancelReason] = useState('')
  const [limitWarning, setLimitWarning] = useState(null) // { payload, warningData }
  const [actionLoading, setActionLoading] = useState(null)
  const [candidateFilters, setCandidateFilters] = useState({ crossDepartment: false, handlesClass: false, department: '', search: '' })
  
  // High-frequency queue filters
  const [filterTab, setFilterTab] = useState('all') // 'all' | 'pending' | 'needs_sub' | 'approved' | 'rejected'
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [toast, setToast] = useState(null) // { type: 'success'|'error', message, undo }

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(timer)
  }, [toast])

  const loadCandidates = async (request, filters = candidateFilters) => {
    const params = { include_cross_department: filters.crossDepartment, only_handles_class: filters.handlesClass }
    const [{ data: recommendations }, { data: freeTeachers }] = await Promise.all([
      leavesApi.recommendations(request.id, 100, params),
      leavesApi.freeTeachers(request.id, { include_cross_department: filters.crossDepartment, only_handles_class: filters.handlesClass }),
    ])
    const recommendedIds = new Set(recommendations.map(r => r.teacher.id))
    return { recommendations, others: freeTeachers.filter(t => !recommendedIds.has(t.id)) }
  }

  const groupLeaves = (leavesList) => {
    const map = {}
    leavesList.forEach(l => {
      const createdDate = l.created_at ? l.created_at.split('T')[0] : ''
      const key = `${l.teacher_id}_${l.date}_${l.status}_${l.reason || ''}_${createdDate}`
      if (!map[key]) {
        map[key] = {
          key,
          teacher_id: l.teacher_id,
          teacher: l.teacher,
          date: l.date,
          day_order: l.day_order,
          is_emergency: false,
          status: l.status,
          requests: []
        }
      }
      if (!map[key].requests.some(r => r.id === l.id)) {
        map[key].requests.push(l)
      }
      if (l.is_emergency) {
        map[key].is_emergency = true
      }
    })

    const list = Object.values(map).map(g => {
      g.requests.sort((a, b) => a.period_number - b.period_number)
      return g
    })

    list.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      if (a.status === 'pending' && b.status !== 'pending') return -1
      if (b.status === 'pending' && a.status !== 'pending') return 1
      return (a.teacher?.name || '').localeCompare(b.teacher?.name || '')
    })

    return list
  }

  const allGroupedLeaves = useMemo(() => groupLeaves(leaves), [leaves])

  const counts = useMemo(() => {
    return {
      all: allGroupedLeaves.length,
      pending: allGroupedLeaves.filter(g => g.status === 'pending').length,
      needs_sub: allGroupedLeaves.filter(g => g.status === 'approved' && g.requests.some(r => !r.alter_assignment)).length,
      approved: allGroupedLeaves.filter(g => g.status === 'approved').length,
      rejected: allGroupedLeaves.filter(g => g.status === 'rejected' || g.status === 'cancelled').length,
    }
  }, [allGroupedLeaves])

  const groupedLeavesList = useMemo(() => {
    let list = allGroupedLeaves

    if (filterTab === 'pending') {
      list = list.filter(g => g.status === 'pending')
    } else if (filterTab === 'needs_sub') {
      list = list.filter(g => g.status === 'approved' && g.requests.some(r => !r.alter_assignment))
    } else if (filterTab === 'approved') {
      list = list.filter(g => g.status === 'approved')
    } else if (filterTab === 'rejected') {
      list = list.filter(g => g.status === 'rejected' || g.status === 'cancelled')
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(g =>
        (g.teacher?.name || '').toLowerCase().includes(q) ||
        (g.teacher?.department || '').toLowerCase().includes(q) ||
        (g.requests[0]?.reason || '').toLowerCase().includes(q)
      )
    }

    if (dateFilter) {
      list = list.filter(g => g.date === dateFilter)
    }

    return list
  }, [allGroupedLeaves, filterTab, searchQuery, dateFilter])

  const load = () => {
    setLoading(true)
    departmentsApi.list(true).then(r => setAllDepartments(r.data || [])).catch(() => {})
    return leavesApi.all()
      .then(r => {
        setLeaves(r.data)
        return r.data
      })
      .catch(err => {
        setToast({ type: 'error', message: 'Failed to load leave requests.' })
        return []
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleClearHistory = async () => {
    if (!window.confirm("Are you sure you want to permanently delete all leave requests and substitution assignments? This action cannot be undone.")) {
      return
    }
    setActionLoading('clear_history')
    try {
      await adminApi.clearLeavesHistory()
      load()
      setToast({ type: 'success', message: 'Leave history cleared successfully.' })
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.detail || 'Failed to clear leaves history.' })
    } finally {
      setActionLoading(null)
    }
  }

  const pendingGroupKeys = useMemo(() => {
    return groupedLeavesList.filter(g => g.status === 'pending').map(g => g.key)
  }, [groupedLeavesList])

  const toggleSelect = (key) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelected(prev => prev.size === pendingGroupKeys.length ? new Set() : new Set(pendingGroupKeys))
  }

  const handleApproveGroup = async (group) => {
    setActionLoading(group.key + '_approve')
    const prevLeaves = leaves
    // Optimistic UI update
    const pendingReqs = group.requests.filter(r => r.status === 'pending')
    const pendingIds = new Set(pendingReqs.map(r => r.id))
    setLeaves(prev => prev.map(l => pendingIds.has(l.id) ? { ...l, status: 'approved' } : l))

    try {
      const results = await Promise.all(pendingReqs.map(r => leavesApi.approve(r.id).then(res => res.data.leave)))
      const updatedList = await load()
      
      setToast({
        type: 'success',
        message: `Approved leave for ${group.teacher?.name || 'teacher'} (${group.date})`,
        undo: async () => {
          await Promise.all(pendingReqs.map(r => leavesApi.reject(r.id)))
          load()
        }
      })

      const unassigned = results.find(r => !r.alter_assignment)
      if (unassigned) {
        const freshGroup = groupLeaves(updatedList).find(g => g.key === group.key)
        if (freshGroup) {
          openSubModal(freshGroup, freshGroup.requests.find(r => r.id === unassigned.id))
        }
      }
    } catch (err) {
      setLeaves(prevLeaves)
      setToast({ type: 'error', message: err.response?.data?.detail || 'Failed to approve leave.' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleRejectGroup = async (group) => {
    setActionLoading(group.key + '_reject')
    const prevLeaves = leaves
    const pendingReqs = group.requests.filter(r => r.status === 'pending')
    const pendingIds = new Set(pendingReqs.map(r => r.id))
    // Optimistic UI update
    setLeaves(prev => prev.map(l => pendingIds.has(l.id) ? { ...l, status: 'rejected' } : l))

    try {
      await Promise.all(pendingReqs.map(r => leavesApi.reject(r.id)))
      load()
      setToast({
        type: 'success',
        message: `Rejected leave for ${group.teacher?.name || 'teacher'} (${group.date})`,
        undo: async () => {
          await Promise.all(pendingReqs.map(r => leavesApi.approve(r.id)))
          load()
        }
      })
    } catch (err) {
      setLeaves(prevLeaves)
      setToast({ type: 'error', message: err.response?.data?.detail || 'Failed to reject leave.' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleBulkApprove = async () => {
    setActionLoading('bulk')
    try {
      const ids = []
      selected.forEach(key => {
        const g = groupedLeavesList.find(x => x.key === key)
        if (g) {
          g.requests.forEach(r => {
            if (r.status === 'pending') ids.push(r.id)
          })
        }
      })
      if (ids.length === 0) return
      await leavesApi.bulkApprove(ids)
      setSelected(new Set())
      load()
    } catch (err) {
      alert('Failed to bulk approve.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleBulkReject = async () => {
    setActionLoading('bulk')
    try {
      const ids = []
      selected.forEach(key => {
        const g = groupedLeavesList.find(x => x.key === key)
        if (g) {
          g.requests.forEach(r => {
            if (r.status === 'pending') ids.push(r.id)
          })
        }
      })
      if (ids.length === 0) return
      await leavesApi.bulkReject(ids)
      setSelected(new Set())
      load()
    } catch (err) {
      alert('Failed to bulk reject.')
    } finally {
      setActionLoading(null)
    }
  }

  const openSubModal = async (group, req = null) => {
    const active = req || group.requests.find(r => r.status === 'approved') || group.requests[0]
    setActionLoading('load_sub_modal')
    try {
      const { recommendations, others } = await loadCandidates(active)
      
      setSubModal({
        group,
        activeReq: active,
        recommendations,
        others
      })
    } catch (err) {
      alert('Failed to load substitute candidates.')
    } finally {
      setActionLoading(null)
    }
  }

  const switchSubModalPeriod = async (req) => {
    setActionLoading('switch_sub_period')
    try {
      const { recommendations, others } = await loadCandidates(req)
      
      setSubModal(prev => ({
        ...prev,
        activeReq: req,
        recommendations,
        others
      }))
    } catch (err) {
      alert('Failed to switch period slot.')
    } finally {
      setActionLoading(null)
    }
  }

  const applyCandidateFilters = async (nextFilters) => {
    setCandidateFilters(nextFilters)
    if (!subModal) return
    setActionLoading('filter_candidates')
    try {
      const { recommendations, others } = await loadCandidates(subModal.activeReq, nextFilters)
      setSubModal(prev => ({ ...prev, recommendations, others }))
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not apply candidate filters.')
    } finally { setActionLoading(null) }
  }

  const handleAssignSubstitute = async (teacherId, isRecommended, overrideLimit = false) => {
    if (!subModal) return
    setActionLoading('assign')
    try {
      if (isRecommended) {
        await leavesApi.assignRecommended(subModal.activeReq.id, teacherId, { include_cross_department: candidateFilters.crossDepartment }, overrideLimit)
      } else {
        await leavesApi.assignSubstitute(subModal.activeReq.id, teacherId, { include_cross_department: candidateFilters.crossDepartment }, overrideLimit)
      }
      setLimitWarning(null)
      const updatedList = await leavesApi.all().then(r => r.data)
      setLeaves(updatedList)
      
      const freshGroup = groupLeaves(updatedList).find(g => g.key === subModal.group.key)
      if (freshGroup) {
        const freshReq = freshGroup.requests.find(r => r.id === subModal.activeReq.id)
        if (freshReq) {
          const { recommendations, others } = await loadCandidates(freshReq)
          setSubModal({
            group: freshGroup,
            activeReq: freshReq,
            recommendations,
            others
          })
        }
      }
    } catch (err) {
      if (err.response?.status === 409 && (err.response?.data?.detail?.code === 'LIMIT_ACKNOWLEDGEMENT_REQUIRED' || err.response?.data?.code === 'LIMIT_ACKNOWLEDGEMENT_REQUIRED')) {
        const warningData = err.response?.data?.detail || err.response?.data
        setLimitWarning({
          payload: { teacherId, isRecommended, isOverride: false },
          warningData,
        })
        return
      }
      alert(err.response?.data?.detail?.message || err.response?.data?.detail || 'Failed to assign substitute.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleOverride = async (teacherId, overrideLimit = false) => {
    if (!subModal) return
    setActionLoading('override')
    try {
      await leavesApi.overrideSubstitute(subModal.activeReq.id, teacherId, { include_cross_department: candidateFilters.crossDepartment }, overrideLimit)
      setLimitWarning(null)
      const updatedList = await leavesApi.all().then(r => r.data)
      setLeaves(updatedList)
      
      const freshGroup = groupLeaves(updatedList).find(g => g.key === subModal.group.key)
      if (freshGroup) {
        const freshReq = freshGroup.requests.find(r => r.id === subModal.activeReq.id)
        if (freshReq) {
          const [{ data: recommendations }, { data: freeTeachers }] = await Promise.all([
            leavesApi.recommendations(freshReq.id),
            leavesApi.freeTeachers(freshReq.id),
          ])
          const recommendedIds = new Set(recommendations.map(r => r.teacher.id))
          const others = freeTeachers.filter(t => !recommendedIds.has(t.id))
          setSubModal({
            group: freshGroup,
            activeReq: freshReq,
            recommendations,
            others
          })
        }
      }
    } catch (err) {
      if (err.response?.status === 409 && (err.response?.data?.detail?.code === 'LIMIT_ACKNOWLEDGEMENT_REQUIRED' || err.response?.data?.code === 'LIMIT_ACKNOWLEDGEMENT_REQUIRED')) {
        const warningData = err.response?.data?.detail || err.response?.data
        setLimitWarning({
          payload: { teacherId, isRecommended: false, isOverride: true },
          warningData,
        })
        return
      }
      alert(err.response?.data?.detail?.message || err.response?.data?.detail || 'Failed to swap substitute.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleUndo = async (reqId) => {
    if (!subModal) return
    setActionLoading(reqId + '_undo')
    try {
      await leavesApi.undoAssignment(reqId)
      const updatedList = await leavesApi.all().then(r => r.data)
      setLeaves(updatedList)
      
      const freshGroup = groupLeaves(updatedList).find(g => g.key === subModal.group.key)
      if (freshGroup) {
        const freshReq = freshGroup.requests.find(r => r.id === reqId)
        if (freshReq) {
          const [{ data: recommendations }, { data: freeTeachers }] = await Promise.all([
            leavesApi.recommendations(freshReq.id),
            leavesApi.freeTeachers(freshReq.id),
          ])
          const recommendedIds = new Set(recommendations.map(r => r.teacher.id))
          const others = freeTeachers.filter(t => !recommendedIds.has(t.id))
          setSubModal({
            group: freshGroup,
            activeReq: freshReq,
            recommendations,
            others
          })
        }
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to undo assignment.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleLock = async (req) => {
    if (!subModal) return
    const locked = !req.alter_assignment.is_locked
    setActionLoading(req.id + '_lock')
    try {
      await leavesApi.setLock(req.id, locked)
      const updatedList = await leavesApi.all().then(r => r.data)
      setLeaves(updatedList)
      
      const freshGroup = groupLeaves(updatedList).find(g => g.key === subModal.group.key)
      if (freshGroup) {
        const freshReq = freshGroup.requests.find(r => r.id === req.id)
        if (freshReq) {
          setSubModal(prev => ({
            ...prev,
            group: freshGroup,
            activeReq: freshReq
          }))
        }
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to toggle lock.')
    } finally {
      setActionLoading(null)
    }
  }

  const openCancelModal = async (group) => {
    const active = group.requests.find(r => r.status !== 'cancelled' && r.status !== 'rejected')
    if (!active) return
    setActionLoading(group.key + '_cancel_open')
    try {
      const { data: impact } = await leavesApi.cancelImpact(active.id)
      setCancelModal({ group, impact })
      setCancelReason('')
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to fetch cancel impact.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleAdminCancel = async () => {
    if (!cancelModal || !cancelReason.trim()) return
    setActionLoading('admin_cancel')
    try {
      const activeReqs = cancelModal.group.requests.filter(r => r.status !== 'cancelled' && r.status !== 'rejected')
      await Promise.all(activeReqs.map(r => leavesApi.adminCancel(r.id, cancelReason.trim())))
      setCancelModal(null)
      setCancelReason('')
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to cancel leaves.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCrossDeptToggle = (crossDept) => {
    applyCandidateFilters({
      ...candidateFilters,
      crossDepartment: crossDept,
      department: !crossDept ? '' : candidateFilters.department,
    })
  }

  const handleDepartmentChange = (dept) => {
    setCandidateFilters(prev => ({
      ...prev,
      department: dept,
      crossDepartment: dept ? true : prev.crossDepartment,
    }))
  }

  const candidateMatchesLocalFilters = (candidate) => {
    const teacher = candidate.teacher || candidate
    const department = teacher.department || ''
    const name = teacher.name || ''
    return (!candidateFilters.department || department === candidateFilters.department) &&
      (!candidateFilters.search || `${name} ${department}`.toLowerCase().includes(candidateFilters.search.toLowerCase()))
  }

  const candidateDepartments = useMemo(() => {
    if (!candidateFilters.crossDepartment) {
      if (!subModal) return []
      const names = []
      subModal.recommendations.forEach(r => { if (r.teacher?.department) names.push(r.teacher.department) })
      subModal.others.forEach(t => { if (t?.department) names.push(t.department) })
      if (subModal.group?.teacher?.department) names.push(subModal.group.teacher.department)
      return [...new Set(names.filter(Boolean))].sort()
    }
    const names = allDepartments.map(d => d.name)
    if (subModal) {
      subModal.recommendations.forEach(r => { if (r.teacher?.department) names.push(r.teacher.department) })
      subModal.others.forEach(t => { if (t?.department) names.push(t.department) })
    }
    return [...new Set(names.filter(Boolean))].sort()
  }, [allDepartments, subModal, candidateFilters.crossDepartment])

  return (
    <div className="space-y-4">
      {/* Toast Alert with Undo Action */}
      {toast && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold shadow-md transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span>{toast.message}</span>
          <div className="flex items-center gap-2">
            {toast.undo && (
              <button
                onClick={() => {
                  toast.undo()
                  setToast(null)
                }}
                className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold shadow-xs cursor-pointer"
              >
                Undo
              </button>
            )}
            <button onClick={() => setToast(null)} className="text-gray-400 hover:text-gray-600 font-bold ml-1">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Header with Title & Clear History */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Leave Requests Queue</h1>
          <p className="text-xs text-gray-500 mt-0.5">Approve or reject faculty leave requests and allocate classroom substitutes.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.size === 0 && (
            <button
              onClick={handleClearHistory}
              disabled={actionLoading === 'clear_history'}
              className="inline-flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 text-xs font-semibold border border-red-200 transition"
            >
              {actionLoading === 'clear_history' ? 'Clearing…' : 'Clear Leaves History'}
            </button>
          )}
          {selected.size > 0 && (
            <div className="flex gap-2">
              <button onClick={handleBulkApprove} disabled={actionLoading === 'bulk'} className="text-xs px-3.5 py-1.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 shadow-xs cursor-pointer">
                ✓ Approve ({selected.size})
              </button>
              <button onClick={handleBulkReject} disabled={actionLoading === 'bulk'} className="text-xs px-3.5 py-1.5 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 disabled:opacity-50 shadow-xs cursor-pointer">
                ✕ Reject ({selected.size})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Fast Tab Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'all', label: 'All Requests', count: counts.all },
          { id: 'pending', label: 'Pending Review', count: counts.pending, badgeColor: 'bg-amber-100 text-amber-800' },
          { id: 'needs_sub', label: 'Needs Substitute', count: counts.needs_sub, badgeColor: 'bg-rose-100 text-rose-800' },
          { id: 'approved', label: 'Approved', count: counts.approved, badgeColor: 'bg-emerald-100 text-emerald-800' },
          { id: 'rejected', label: 'Rejected', count: counts.rejected, badgeColor: 'bg-gray-100 text-gray-700' },
        ].map(tab => {
          const active = filterTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition inline-flex items-center gap-2 shrink-0 cursor-pointer ${
                active
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-md font-bold ${
                  active ? 'bg-primary-800 text-white' : tab.badgeColor || 'bg-gray-100 text-gray-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Search & Date Filter Bar */}
      <div className="card p-2.5 bg-white border border-gray-200 rounded-xl flex flex-col sm:flex-row items-center gap-2">
        <div className="relative flex-1 w-full">
          <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Filter by faculty name, department, or reason…"
            className="input !py-1.5 pl-9 text-xs w-full"
          />
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="input !py-1.5 text-xs w-full sm:w-44 shrink-0"
        />
        {(searchQuery || dateFilter || filterTab !== 'all') && (
          <button
            onClick={() => {
              setSearchQuery('')
              setDateFilter('')
              setFilterTab('all')
            }}
            className="btn-secondary !py-1.5 !px-3 text-xs shrink-0"
          >
            Reset
          </button>
        )}
      </div>

      <div className="card overflow-hidden bg-white border border-slate-200 shadow-xs rounded-xl">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : groupedLeavesList.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <p className="text-sm text-slate-500 font-medium">No leave requests match the current queue filters.</p>
            <button
              onClick={() => { setFilterTab('all'); setSearchQuery(''); setDateFilter(''); }}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 select-none">
                <tr>
                  <th className="px-3 py-3 w-8 text-center">
                    {pendingGroupKeys.length > 0 && (
                      <input type="checkbox" checked={selected.size === pendingGroupKeys.length} onChange={toggleSelectAll} />
                    )}
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Teacher</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Schedule</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Periods</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Substitute</th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupedLeavesList.map(group => {
                  const firstReq = group.requests[0]
                  const approved = group.requests.filter(r => r.status === 'approved')
                  const covered = approved.filter(r => r.alter_assignment)
                  const subsNames = [...new Set(covered.map(r => r.alter_assignment.substitute?.name))].filter(Boolean)
                  const hasUnassigned = approved.some(r => !r.alter_assignment)
                  const uniquePeriods = [...new Set(group.requests.map(r => r.period_number))].sort((a, b) => a - b)

                  return (
                    <tr key={group.key} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3 py-3 text-center">
                        {group.status === 'pending' && (
                          <input type="checkbox" checked={selected.has(group.key)} onChange={() => toggleSelect(group.key)} />
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 truncate max-w-[180px] text-xs sm:text-sm">
                        {group.teacher?.name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-bold text-slate-900 block text-xs">{group.date}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">DO {group.day_order}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-semibold whitespace-nowrap text-xs">
                        {uniquePeriods.map(p => `P${p}`).join(', ')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={group.status} />
                      </td>
                      <td className="px-4 py-3">
                        {approved.length > 0 ? (
                          covered.length === approved.length ? (
                            <div className="space-y-0.5 max-w-[180px]">
                              <p className="text-xs font-semibold text-slate-800 truncate" title={subsNames.join(', ')}>
                                {subsNames.join(', ')}
                              </p>
                              <div className="flex items-center gap-1">
                                <AssignmentTypeBadge type={covered[0]?.alter_assignment?.assignment_type} small />
                                {covered.some(r => r.alter_assignment?.is_locked) && <LockIcon className="w-3.5 h-3.5 text-slate-400" />}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-amber-600 font-semibold whitespace-nowrap">
                              Needs sub ({covered.length}/{approved.length})
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {group.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApproveGroup(group)}
                                disabled={!!actionLoading}
                                className="text-xs px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition disabled:opacity-50 cursor-pointer shadow-xs"
                              >
                                {actionLoading === group.key + '_approve' ? '…' : 'Approve'}
                              </button>
                              <button
                                onClick={() => handleRejectGroup(group)}
                                disabled={!!actionLoading}
                                className="text-xs px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg transition disabled:opacity-50 cursor-pointer shadow-xs"
                              >
                                {actionLoading === group.key + '_reject' ? '…' : 'Reject'}
                              </button>
                            </>
                          )}
                          {group.status === 'approved' && hasUnassigned && (
                            <button
                              onClick={() => openSubModal(group)}
                              className="text-xs px-2.5 py-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition cursor-pointer shadow-xs"
                            >
                              Assign Sub
                            </button>
                          )}
                          {group.status === 'approved' && !hasUnassigned && approved.length > 0 && (
                            <button
                              onClick={() => openSubModal(group)}
                              title="Swap substitute"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-primary-600 hover:border-primary-300 hover:bg-slate-50 transition cursor-pointer"
                            >
                              <SwapIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {group.status !== 'cancelled' && group.status !== 'rejected' && (
                            <button
                              onClick={() => openCancelModal(group)}
                              disabled={!!actionLoading}
                              title="Cancel leaves"
                              className="text-xs px-2.5 py-1 border border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition disabled:opacity-30 font-semibold cursor-pointer"
                            >
                              {actionLoading === group.key + '_cancel_open' ? '...' : 'Cancel'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* substitution modal with period selector */}
      <Modal
        open={!!subModal}
        onClose={() => setSubModal(null)}
        title={
          <div className="flex items-center gap-2 flex-wrap">
            <span>Manage Substitutions</span>
            {subModal?.activeReq && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-200">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-600 animate-pulse" />
                Hour / Period P{subModal.activeReq.period_number}
              </span>
            )}
          </div>
        }
        size="lg"
      >
        {subModal && (
          <div className="space-y-4">
            {/* Header Absent Faculty Card */}
            <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-indigo-800 text-white font-black text-sm flex items-center justify-center shadow-xs shrink-0">
                  {(subModal.group.teacher?.name || 'T')[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-900 text-sm">{subModal.group.teacher?.name}</p>
                    {subModal.group.teacher?.department && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 bg-indigo-50 text-indigo-700 border border-indigo-200/60 rounded">
                        {subModal.group.teacher.department}
                      </span>
                    )}
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-primary-100 text-primary-800 rounded-md border border-primary-200">
                      Active: Hour P{subModal.activeReq.period_number}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 font-medium flex-wrap">
                    <span>{subModal.group.date}</span>
                    <span className="text-slate-300">•</span>
                    <span>Day Order {subModal.group.day_order}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-700 font-semibold">
                      {subModal.group.requests.length} leave period(s)
                    </span>
                  </div>
                </div>
              </div>

              {subModal.group.is_emergency && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 shrink-0 self-start sm:self-auto">
                  <AlertTriangleIcon className="w-3.5 h-3.5 text-rose-600" />
                  Emergency Leave
                </span>
              )}
            </div>

            {/* Select Slot to substitute */}
            {subModal.group.requests.filter(r => r.status === 'approved').length > 1 && (
              <div className="space-y-1.5 bg-white border border-slate-200/80 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Select Period Slot to Configure:</p>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {subModal.group.requests.filter(r => r.alter_assignment).length}/{subModal.group.requests.filter(r => r.status === 'approved').length} assigned
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {subModal.group.requests.filter(r => r.status === 'approved').map(r => {
                    const isAssigned = !!r.alter_assignment
                    const isSelected = subModal.activeReq.id === r.id
                    return (
                      <button
                        key={r.id}
                        onClick={() => switchSubModalPeriod(r)}
                        disabled={actionLoading === 'switch_sub_period'}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-semibold flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-primary-600 text-white border-primary-700 shadow-xs ring-2 ring-primary-500/20'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span>Period P{r.period_number}</span>
                        {isAssigned ? (
                          <span className={`text-[10px] font-bold px-1 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                            ✓
                          </span>
                        ) : (
                          <span className={`text-[10px] font-bold px-1 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
                            Needs sub
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Current Assignment Status Banner */}
            {subModal.activeReq.alter_assignment ? (
              <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-3.5 text-xs space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-900">Period P{subModal.activeReq.period_number} Substitute:</span>
                    <span className="font-extrabold text-slate-900 text-sm">{subModal.activeReq.alter_assignment.substitute?.name}</span>
                    {subModal.activeReq.alter_assignment.substitute?.department && (
                      <span className="text-[10px] px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded font-semibold">
                        {subModal.activeReq.alter_assignment.substitute.department}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <AssignmentTypeBadge type={subModal.activeReq.alter_assignment.assignment_type} small />
                    {subModal.activeReq.alter_assignment.is_locked && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded">
                        <LockIcon className="w-3 h-3 text-slate-500" /> Locked
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-1 border-t border-indigo-200/60">
                  <button
                    onClick={() => handleToggleLock(subModal.activeReq)}
                    disabled={actionLoading === subModal.activeReq.id + '_lock'}
                    className="text-[11px] font-bold text-slate-700 hover:text-primary-700 transition flex items-center gap-1 cursor-pointer"
                  >
                    {subModal.activeReq.alter_assignment.is_locked ? <><UnlockIcon className="w-3 h-3" /> Unlock</> : <><LockIcon className="w-3 h-3" /> Lock (protect)</>}
                  </button>
                  <span className="text-indigo-200">•</span>
                  <button
                    onClick={() => handleUndo(subModal.activeReq.id)}
                    disabled={subModal.activeReq.alter_assignment.is_locked || actionLoading === subModal.activeReq.id + '_undo'}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 transition disabled:opacity-30 cursor-pointer"
                  >
                    Undo Assignment
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 flex items-center gap-2">
                <AlertTriangleIcon className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-semibold">Period P{subModal.activeReq.period_number} requires a substitute candidate. Select a candidate below.</span>
              </div>
            )}

            {/* Smart Candidate Filters Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FilterIcon className="w-3.5 h-3.5 text-slate-500" />
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Candidate Filters</p>
                </div>
                <div className="flex items-center gap-2">
                  {actionLoading === 'filter_candidates' && <span className="text-xs text-primary-600 font-semibold">Updating…</span>}
                  {(candidateFilters.crossDepartment || candidateFilters.handlesClass || candidateFilters.department || candidateFilters.search) && (
                    <button
                      type="button"
                      onClick={() => applyCandidateFilters({ crossDepartment: false, handlesClass: false, department: '', search: '' })}
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline transition cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {/* Search & Department row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="relative">
                  <input
                    type="text"
                    className="w-full pl-8 pr-8 py-2 text-xs bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition font-medium placeholder:text-slate-400"
                    placeholder="Search candidate name or dept…"
                    value={candidateFilters.search}
                    onChange={e => setCandidateFilters({ ...candidateFilters, search: e.target.value })}
                  />
                  <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                  {candidateFilters.search && (
                    <button
                      type="button"
                      onClick={() => setCandidateFilters({ ...candidateFilters, search: '' })}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-md cursor-pointer"
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
                      ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950 shadow-xs ring-1 ring-indigo-500/10'
                      : 'bg-slate-50/60 hover:bg-slate-50 border-slate-200/90 text-slate-700'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold truncate">Other Departments</p>
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
                      ? 'bg-amber-50/80 border-amber-200 text-amber-950 shadow-xs ring-1 ring-amber-500/10'
                      : 'bg-slate-50/60 hover:bg-slate-50 border-slate-200/90 text-slate-700'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold truncate">Class Faculty Only</p>
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

            {/* Recommended Candidates */}
            {subModal.recommendations.filter(candidateMatchesLocalFilters).length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <SparklesIcon className="w-3.5 h-3.5 text-primary-500" />
                    Recommended Candidates ({subModal.recommendations.filter(candidateMatchesLocalFilters).length})
                  </p>
                  <span className="text-[10px] text-slate-400 font-medium">Ranked by score & workload</span>
                </div>
                <div className="space-y-2">
                  {subModal.recommendations.filter(candidateMatchesLocalFilters).map(rec => (
                    <RecommendationRow
                      key={rec.teacher.id}
                      rec={rec}
                      onAssign={handleAssignSubstitute}
                      disabled={actionLoading === 'assign' || (subModal.activeReq.alter_assignment && subModal.activeReq.alter_assignment.is_locked)}
                      isSwap={!!subModal.activeReq.alter_assignment}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Other Available Teachers */}
            {subModal.others.filter(candidateMatchesLocalFilters).length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Other Available Teachers ({subModal.others.filter(candidateMatchesLocalFilters).length})
                </p>
                <div className="space-y-2">
                  {subModal.others.filter(candidateMatchesLocalFilters).map(t => {
                    const initial = (t.name || 'T')[0].toUpperCase()
                    return (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-white hover:bg-slate-50 border border-slate-200/70 rounded-xl gap-3 transition">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {initial}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-bold text-slate-900 truncate">{t.name}</p>
                              {t.department && (
                                <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-semibold border border-slate-200/60">
                                  {t.department}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                              {t.today_workload === 0 ? 'Free all day today' : `${t.today_workload} period(s) today`}
                              {t.today_periods && t.today_periods.length > 0 && (
                                <span className="text-slate-400"> (P{t.today_periods.sort((a, b) => a - b).join(', P')})</span>
                              )}
                              {t.week_workload !== undefined && ` · ${t.week_workload} period(s) this week`}
                            </p>
                          </div>
                        </div>

                        {subModal.activeReq.alter_assignment ? (
                          subModal.activeReq.alter_assignment.substitute_teacher_id !== t.id && (
                            <button
                              onClick={() => handleOverride(t.id)}
                              disabled={actionLoading === 'override' || subModal.activeReq.alter_assignment.is_locked}
                              className="text-xs font-semibold px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:border-primary-400 hover:text-primary-700 transition-colors disabled:opacity-40 shrink-0 cursor-pointer"
                            >
                              Swap
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => handleAssignSubstitute(t.id, false)}
                            disabled={actionLoading === 'assign'}
                            className="text-xs font-semibold px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:border-primary-400 hover:text-primary-700 transition-colors disabled:opacity-40 shrink-0 cursor-pointer"
                          >
                            Assign
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {subModal.recommendations.filter(candidateMatchesLocalFilters).length === 0 && subModal.others.filter(candidateMatchesLocalFilters).length === 0 && (
              <div className="text-center py-8 text-slate-400 space-y-1.5">
                <p className="text-xs font-bold text-slate-700">No eligible teachers found</p>
                <p className="text-[11px] text-slate-500">Try adjusting candidate filters or including other departments.</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Admin Cancel Leave Group */}
      <Modal open={!!cancelModal} onClose={() => { setCancelModal(null); setCancelReason('') }} title="Cancel Leave Requests">
        {cancelModal && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm">
              <p className="font-semibold text-red-800">
                Cancel all leave requests for {cancelModal.impact.teacher_name}
              </p>
              <p className="text-red-600 text-xs mt-0.5">
                {cancelModal.impact.leave_date} &middot; Day Order {cancelModal.impact.day_order} &middot; Periods P{cancelModal.group.requests.map(r => r.period_number).sort().join(', P')}
              </p>
            </div>

            {cancelModal.impact.has_substitute && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800">
                <p className="font-semibold">Warning: Substitution assignments exist for these slots</p>
                <p className="text-amber-600 mt-1">All substitution assignments for the day will be removed and credit transactions will be reversed.</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Reason for cancellation *</label>
              <textarea
                className="tt-input w-full text-sm"
                rows={3}
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Enter reason for cancelling these leaves..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => { setCancelModal(null); setCancelReason('') }}
                className="text-xs px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Keep Leaves
              </button>
              <button
                onClick={handleAdminCancel}
                disabled={!cancelReason.trim() || actionLoading === 'admin_cancel'}
                className="text-xs px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 font-semibold"
              >
                {actionLoading === 'admin_cancel' ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 7-Day Substitution Limit Warning Modal */}
      {limitWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-amber-200 max-w-lg w-full overflow-hidden">
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
                disabled={actionLoading === 'assign' || actionLoading === 'override'}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (limitWarning.payload.isOverride) {
                    handleOverride(limitWarning.payload.teacherId, true)
                  } else {
                    handleAssignSubstitute(limitWarning.payload.teacherId, limitWarning.payload.isRecommended, true)
                  }
                }}
                disabled={actionLoading === 'assign' || actionLoading === 'override'}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-lg shadow-xs transition flex items-center gap-2"
              >
                {actionLoading === 'assign' || actionLoading === 'override' ? 'Assigning…' : 'I Understand & Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
