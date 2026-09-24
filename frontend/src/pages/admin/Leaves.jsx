import { useEffect, useState, useMemo } from 'react'
import { leavesApi, adminApi, departmentsApi, leaveBalancesApi } from '../../api/services'
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

  // Staff Leave Balances Tab State
  const [activeView, setActiveView] = useState('queue') // 'queue' | 'balances'
  const [balancesData, setBalancesData] = useState([])
  const [loadingBalances, setLoadingBalances] = useState(false)
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [academicYear, setAcademicYear] = useState('2026-2027')
  const [balanceSearch, setBalanceSearch] = useState('')
  const [activePolicies, setActivePolicies] = useState([])
  const [adjustModal, setAdjustModal] = useState(null) // { teacher, policy_id, days, reason, loading, error }
  const [teacherLedgerModal, setTeacherLedgerModal] = useState(null) // { teacher, transactions, loading }
  const [exceptionModal, setExceptionModal] = useState(null) // { group, reason, acknowledged, error, loading }

  const openExceptionModal = (group) => {
    setExceptionModal({
      group,
      reason: '',
      acknowledged: false,
      error: null,
      loading: false,
    })
  }

  const handleApproveWithException = async () => {
    if (!exceptionModal || !exceptionModal.group) return
    if (!exceptionModal.acknowledged) {
      setExceptionModal(prev => ({ ...prev, error: 'You must acknowledge the policy exception before approving.' }))
      return
    }
    if (!exceptionModal.reason || exceptionModal.reason.trim().length < 3) {
      setExceptionModal(prev => ({ ...prev, error: 'A valid reason for the exception is required (minimum 3 characters).' }))
      return
    }

    setExceptionModal(prev => ({ ...prev, loading: true, error: null }))
    const group = exceptionModal.group
    const pendingReqs = group.requests.filter(r => r.status === 'pending')

    try {
      const results = []
      for (const req of pendingReqs) {
        const res = await leavesApi.approveWithException(req.id, {
          hod_acknowledged: true,
          exception_reason: exceptionModal.reason.trim(),
        })
        results.push(res.data?.leave || res.data)
      }
      setExceptionModal(null)
      const updatedList = await load()
      setToast({
        type: 'success',
        message: `Approved leave with policy exception for ${group.teacher?.name || 'teacher'} (${group.date})`,
      })

      const unassigned = results.find(r => !r.alter_assignment)
      if (unassigned) {
        const freshGroup = groupLeaves(updatedList).find(g => g.key === group.key)
        if (freshGroup) {
          openSubModal(freshGroup, freshGroup.requests.find(r => r.id === unassigned.id))
        }
      }
    } catch (err) {
      setExceptionModal(prev => ({
        ...prev,
        loading: false,
        error: err.response?.data?.detail || 'Failed to approve with exception.',
      }))
    }
  }

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(timer)
  }, [toast])

  const loadBalances = (deptId = selectedDeptId, ay = academicYear) => {
    setLoadingBalances(true)
    leaveBalancesApi.getDepartmentOverview(deptId ? Number(deptId) : undefined, ay)
      .then(r => setBalancesData(r.data || []))
      .catch(err => setToast({ type: 'error', message: err.response?.data?.detail || 'Failed to load staff leave balances.' }))
      .finally(() => setLoadingBalances(false))
  }

  useEffect(() => {
    leaveBalancesApi.getActivePolicies()
      .then(r => setActivePolicies(r.data || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (activeView === 'balances') {
      loadBalances(selectedDeptId, academicYear)
    }
  }, [activeView, selectedDeptId, academicYear])

  const handleAdjustSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!adjustModal || !adjustModal.teacher) return
    if (!adjustModal.policy_id) {
      setAdjustModal(prev => ({ ...prev, error: 'Please select a leave policy.' }))
      return
    }
    const daysNum = parseFloat(adjustModal.days)
    if (isNaN(daysNum) || daysNum === 0) {
      setAdjustModal(prev => ({ ...prev, error: 'Please enter a valid non-zero adjustment (+/- days).' }))
      return
    }
    if (!adjustModal.reason || !adjustModal.reason.trim()) {
      setAdjustModal(prev => ({ ...prev, error: 'Reason is required for administrative audit trail.' }))
      return
    }
    setAdjustModal(prev => ({ ...prev, loading: true, error: null }))
    try {
      await leaveBalancesApi.adjustBalance({
        teacher_id: adjustModal.teacher.teacher_id,
        policy_id: Number(adjustModal.policy_id),
        days: daysNum,
        reason: adjustModal.reason.trim(),
        academic_year: academicYear,
      })
      setToast({ type: 'success', message: `Adjusted balance for ${adjustModal.teacher.teacher_name}.` })
      setAdjustModal(null)
      loadBalances(selectedDeptId, academicYear)
    } catch (err) {
      setAdjustModal(prev => ({ ...prev, loading: false, error: err.response?.data?.detail || 'Failed to adjust balance.' }))
    }
  }

  const openTeacherLedger = (teacher) => {
    setTeacherLedgerModal({ teacher, transactions: [], loading: true })
    leaveBalancesApi.getTeacherLedger(teacher.teacher_id)
      .then(r => setTeacherLedgerModal(prev => prev ? { ...prev, transactions: r.data || [], loading: false } : null))
      .catch(() => {
        setToast({ type: 'error', message: 'Failed to load teacher leave ledger.' })
        setTeacherLedgerModal(null)
      })
  }

  const filteredBalances = useMemo(() => {
    let list = balancesData || []
    if (balanceSearch.trim()) {
      const q = balanceSearch.toLowerCase()
      list = list.filter(t =>
        t.teacher_name?.toLowerCase().includes(q) ||
        t.department_name?.toLowerCase().includes(q) ||
        t.email?.toLowerCase().includes(q)
      )
    }
    return list
  }, [balancesData, balanceSearch])

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
          requests: [],
          policy_violation: false,
          policy_evaluation_snapshot: null,
          exception_reason: null,
          policy_enforcement_mode: null,
        }
      }
      if (!map[key].requests.some(r => r.id === l.id)) {
        map[key].requests.push(l)
      }
      if (l.is_emergency) {
        map[key].is_emergency = true
      }
      if (l.policy_violation) {
        map[key].policy_violation = true
      }
      if (l.policy_evaluation_snapshot) {
        map[key].policy_evaluation_snapshot = l.policy_evaluation_snapshot
      }
      if (l.exception_reason) {
        map[key].exception_reason = l.exception_reason
      }
      if (l.policy_enforcement_mode) {
        map[key].policy_enforcement_mode = l.policy_enforcement_mode
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
      needs_sub: allGroupedLeaves.filter(g => (g.status === 'approved' || g.status === 'approved_with_exception') && g.requests.some(r => !r.alter_assignment)).length,
      policy_warning: allGroupedLeaves.filter(g => g.requests.some(r => r.policy_violation)).length,
      exception_approved: allGroupedLeaves.filter(g => g.status === 'approved_with_exception').length,
      approved: allGroupedLeaves.filter(g => g.status === 'approved' || g.status === 'approved_with_exception').length,
      rejected: allGroupedLeaves.filter(g => g.status === 'rejected' || g.status === 'cancelled').length,
    }
  }, [allGroupedLeaves])

  const groupedLeavesList = useMemo(() => {
    let list = allGroupedLeaves

    if (filterTab === 'pending') {
      list = list.filter(g => g.status === 'pending')
    } else if (filterTab === 'needs_sub') {
      list = list.filter(g => (g.status === 'approved' || g.status === 'approved_with_exception') && g.requests.some(r => !r.alter_assignment))
    } else if (filterTab === 'policy_warning') {
      list = list.filter(g => g.requests.some(r => r.policy_violation))
    } else if (filterTab === 'exception_approved') {
      list = list.filter(g => g.status === 'approved_with_exception')
    } else if (filterTab === 'approved') {
      list = list.filter(g => g.status === 'approved' || g.status === 'approved_with_exception')
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
    if (actionLoading) return
    setActionLoading(group.key + '_approve')
    const prevLeaves = leaves
    // Optimistic UI update
    const pendingReqs = group.requests.filter(r => r.status === 'pending')
    const pendingIds = new Set(pendingReqs.map(r => r.id))
    setLeaves(prev => prev.map(l => pendingIds.has(l.id) ? { ...l, status: 'approved' } : l))

    try {
      let results
      if (pendingReqs.length > 1) {
        const res = await leavesApi.bulkApprove(pendingReqs.map(r => r.id))
        results = Array.isArray(res.data) ? res.data : (res.data?.leaves || [])
      } else if (pendingReqs.length === 1) {
        const res = await leavesApi.approve(pendingReqs[0].id)
        results = [res.data?.leave || res.data]
      } else {
        results = []
      }
      const updatedList = await load()
      
      setToast({
        type: 'success',
        message: `Approved leave for ${group.teacher?.name || 'teacher'} (${group.date})`,
        undo: async () => {
          if (pendingReqs.length > 1) {
            await leavesApi.bulkReject(pendingReqs.map(r => r.id))
          } else {
            await Promise.all(pendingReqs.map(r => leavesApi.reject(r.id)))
          }
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
      await load().catch(() => setLeaves(prevLeaves))
      setToast({ type: 'error', message: err.response?.data?.detail || 'Failed to approve leave.' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleRejectGroup = async (group) => {
    if (actionLoading) return
    setActionLoading(group.key + '_reject')
    const prevLeaves = leaves
    const pendingReqs = group.requests.filter(r => r.status === 'pending')
    const pendingIds = new Set(pendingReqs.map(r => r.id))
    // Optimistic UI update
    setLeaves(prev => prev.map(l => pendingIds.has(l.id) ? { ...l, status: 'rejected' } : l))

    try {
      if (pendingReqs.length > 1) {
        await leavesApi.bulkReject(pendingReqs.map(r => r.id))
      } else if (pendingReqs.length === 1) {
        await leavesApi.reject(pendingReqs[0].id)
      }
      await load()
      setToast({
        type: 'success',
        message: `Rejected leave for ${group.teacher?.name || 'teacher'} (${group.date})`,
        undo: async () => {
          if (pendingReqs.length > 1) {
            await leavesApi.bulkApprove(pendingReqs.map(r => r.id))
          } else {
            await Promise.all(pendingReqs.map(r => leavesApi.approve(r.id)))
          }
          load()
        }
      })
    } catch (err) {
      await load().catch(() => setLeaves(prevLeaves))
      setToast({ type: 'error', message: err.response?.data?.detail || 'Failed to reject leave.' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleBulkApprove = async () => {
    if (actionLoading) return
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
      await load()
    } catch (err) {
      await load()
      setToast({ type: 'error', message: err.response?.data?.detail || 'Failed to bulk approve.' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleBulkReject = async () => {
    if (actionLoading) return
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
      await load()
    } catch (err) {
      await load()
      setToast({ type: 'error', message: err.response?.data?.detail || 'Failed to bulk reject.' })
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

      {/* Top Level Nav Switcher: Queue vs Staff Balances */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveView('queue')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeView === 'queue'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Leave Requests Queue
          </button>
          <button
            type="button"
            onClick={() => setActiveView('balances')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeView === 'balances'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Staff Leave Balances</span>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded border border-indigo-200">
              Policies
            </span>
          </button>
        </div>
      </div>

      {activeView === 'balances' ? (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">Staff Leave Balances</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Monitor institutional leave entitlements, track consumption, and issue audited balance adjustments.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadBalances(selectedDeptId, academicYear)}
                disabled={loadingBalances}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>{loadingBalances ? 'Refreshing…' : '↻ Refresh'}</span>
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="card p-3 bg-white border border-gray-200 rounded-xl flex flex-col sm:flex-row items-center gap-2.5 shadow-xs">
            <div className="relative flex-1 w-full">
              <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={balanceSearch}
                onChange={e => setBalanceSearch(e.target.value)}
                placeholder="Search staff by name, department, or email…"
                className="input !py-1.5 pl-9 text-xs w-full"
              />
            </div>

            {/* Department Filter */}
            <select
              value={selectedDeptId}
              onChange={e => setSelectedDeptId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary-600 w-full sm:w-auto"
            >
              <option value="">All My Assigned Departments</option>
              {allDepartments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            {/* Academic Year Filter */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <span className="text-[10px] font-bold uppercase text-slate-400">AY:</span>
              <input
                type="text"
                value={academicYear}
                onChange={e => setAcademicYear(e.target.value)}
                placeholder="2026-2027"
                className="input !py-1.5 text-xs w-28 font-mono font-bold"
              />
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Staff Monitored</span>
              <span className="text-xl font-black text-slate-900 mt-0.5 block">{filteredBalances.length}</span>
              <span className="text-[10px] text-slate-400">Faculty members</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Entitlement</span>
              <span className="text-xl font-black text-slate-900 mt-0.5 block">
                {filteredBalances.reduce((sum, t) => sum + (t.total_entitled || 0), 0)}d
              </span>
              <span className="text-[10px] text-slate-400">Allocated for AY {academicYear}</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Consumed Leave</span>
              <span className="text-xl font-black text-rose-700 mt-0.5 block">
                {filteredBalances.reduce((sum, t) => sum + (t.total_consumed || 0), 0)}d
              </span>
              <span className="text-[10px] text-slate-400">Actually taken to date</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Remaining</span>
              <span className="text-xl font-black text-emerald-700 mt-0.5 block">
                {filteredBalances.reduce((sum, t) => sum + (t.total_remaining || 0), 0)}d
              </span>
              <span className="text-[10px] text-slate-400">Available across staff</span>
            </div>
          </div>

          {/* Balances Matrix Table */}
          <div className="card overflow-hidden bg-white border border-gray-200 rounded-xl shadow-xs">
            {loadingBalances ? (
              <div className="flex justify-center py-16"><Spinner /></div>
            ) : filteredBalances.length === 0 ? (
              <div className="py-12">
                <EmptyState message="No staff leave balances found for the selected criteria." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50/90 text-slate-600 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider select-none">
                    <tr>
                      <th className="py-3 px-4">Faculty Member</th>
                      <th className="py-3 px-2 text-center" title="Applied Leave (12/yr)">AL</th>
                      <th className="py-3 px-2 text-center" title="Informed Leave (2/sem)">IL</th>
                      <th className="py-3 px-2 text-center" title="Medical Leave (5/yr)">ML</th>
                      <th className="py-3 px-2 text-center" title="Wedding Leave (5/event)">WL</th>
                      <th className="py-3 px-2 text-center" title="Vacation Leave (10/yr)">VL</th>
                      <th className="py-3 px-2 text-center" title="Official On Duty (10/yr)">OOD</th>
                      <th className="py-3 px-3 text-right">Leave Remaining</th>
                      <th className="py-3 px-3 text-center bg-indigo-50/50" title="Substitution Workload Credits">
                        Workload Credits
                      </th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredBalances.map(t => {
                      const getBal = (code) => t.balances?.find(b => b.policy_code === code)
                      const al = getBal('AL')
                      const il = getBal('IL')
                      const ml = getBal('ML')
                      const wl = getBal('WL')
                      const vl = getBal('VL')
                      const ood = getBal('OOD')

                      return (
                        <tr key={t.teacher_id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-bold text-slate-900 block">{t.teacher_name}</span>
                            <span className="text-[10px] text-slate-400">
                              {t.department_name || 'Department Staff'} &middot; {t.email || ''}
                            </span>
                          </td>

                          {/* AL */}
                          <td className="py-3 px-2 text-center whitespace-nowrap">
                            <span className={`font-mono font-bold ${al && al.remaining === 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                              {al ? al.remaining : '—'}
                            </span>
                            <span className="text-[9px] text-slate-400">/{al ? al.entitlement : '12'}</span>
                          </td>

                          {/* IL */}
                          <td className="py-3 px-2 text-center whitespace-nowrap">
                            <span className={`font-mono font-bold ${il && il.remaining === 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                              {il ? il.remaining : '—'}
                            </span>
                            <span className="text-[9px] text-slate-400">/{il ? il.entitlement : '2'}</span>
                          </td>

                          {/* ML */}
                          <td className="py-3 px-2 text-center whitespace-nowrap">
                            <span className={`font-mono font-bold ${ml && ml.remaining === 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                              {ml ? ml.remaining : '—'}
                            </span>
                            <span className="text-[9px] text-slate-400">/{ml ? ml.entitlement : '5'}</span>
                          </td>

                          {/* WL */}
                          <td className="py-3 px-2 text-center whitespace-nowrap">
                            <span className={`font-mono font-bold ${wl && wl.remaining === 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                              {wl ? wl.remaining : '—'}
                            </span>
                            <span className="text-[9px] text-slate-400">/{wl ? wl.entitlement : '5'}</span>
                          </td>

                          {/* VL */}
                          <td className="py-3 px-2 text-center whitespace-nowrap">
                            <span className={`font-mono font-bold ${vl && vl.remaining === 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                              {vl ? vl.remaining : '—'}
                            </span>
                            <span className="text-[9px] text-slate-400">/{vl ? vl.entitlement : '10'}</span>
                          </td>

                          {/* OOD */}
                          <td className="py-3 px-2 text-center whitespace-nowrap">
                            <span className={`font-mono font-bold ${ood && ood.remaining === 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                              {ood ? ood.remaining : '—'}
                            </span>
                            <span className="text-[9px] text-slate-400">/{ood ? ood.entitlement : '10'}</span>
                          </td>

                          {/* Total Balance */}
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <span className="font-mono font-bold text-slate-900 text-sm">{t.total_remaining}d</span>
                            <span className="text-[10px] text-slate-400 block font-semibold">of {t.total_entitled}d</span>
                          </td>

                          {/* Workload Substitution Credits */}
                          <td className="py-3 px-3 text-center bg-indigo-50/30 whitespace-nowrap">
                            <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                              t.substitution_credits > 0 ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' :
                              t.substitution_credits < 0 ? 'text-rose-700 bg-rose-50 border border-rose-200' :
                              'text-slate-600 bg-slate-100'
                            }`}>
                              {t.substitution_credits > 0 ? `+${t.substitution_credits}` : t.substitution_credits} pts
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openTeacherLedger(t)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                              >
                                Ledger
                              </button>
                              <button
                                type="button"
                                onClick={() => setAdjustModal({
                                  teacher: t,
                                  policy_id: activePolicies[0]?.id || 1,
                                  days: '',
                                  reason: '',
                                  loading: false,
                                  error: null
                                })}
                                className="px-2.5 py-1 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 rounded-lg text-xs font-bold transition cursor-pointer"
                              >
                                Adjust
                              </button>
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
        </div>
      ) : (
        <>
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
          { id: 'policy_warning', label: 'Policy Warnings', count: counts.policy_warning, badgeColor: 'bg-amber-100 text-amber-800' },
          { id: 'exception_approved', label: 'Exceptions Approved', count: counts.exception_approved, badgeColor: 'bg-purple-100 text-purple-800' },
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
                  const approved = group.requests.filter(r => r.status === 'approved' || r.status === 'approved_with_exception')
                  const covered = approved.filter(r => r.alter_assignment)
                  const subsNames = [...new Set(covered.map(r => r.alter_assignment.substitute?.name))].filter(Boolean)
                  const proposedSubs = [...new Set(group.requests.map(r => r.proposed_substitute?.name).filter(Boolean))]
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
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{group.teacher?.name}</span>
                          {group.policy_violation && (
                            <span
                              title={
                                group.policy_evaluation_snapshot?.violations?.map(v => v.message).join('; ') ||
                                'Policy warning acknowledged by faculty under Advisory Mode'
                              }
                              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300"
                            >
                              ⚠️ Policy Warning
                            </span>
                          )}
                        </div>
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
                        {group.status === 'approved_with_exception' && (
                          <div className="mt-1">
                            <span className="inline-block text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                              Approved with Exception
                            </span>
                            {group.exception_reason && (
                              <p className="text-[10px] text-slate-500 max-w-[160px] truncate mt-0.5 font-medium" title={group.exception_reason}>
                                Reason: {group.exception_reason}
                              </p>
                            )}
                          </div>
                        )}
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
                        ) : group.status === 'pending' && proposedSubs.length > 0 ? (
                          <div className="space-y-0.5 max-w-[180px]">
                            <p className="text-xs font-semibold text-indigo-700 truncate" title={proposedSubs.join(', ')}>
                              {proposedSubs.join(', ')}
                            </p>
                            <span className="inline-block text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-1.5 py-0.5 rounded">
                              Proposed by Teacher
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {group.status === 'pending' && (
                            <>
                              {group.policy_violation ? (
                                <button
                                  onClick={() => openExceptionModal(group)}
                                  disabled={!!actionLoading}
                                  className="text-xs px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition disabled:opacity-50 cursor-pointer shadow-xs flex items-center gap-1"
                                >
                                  <span>⚠️</span>
                                  <span>{actionLoading === group.key + '_approve' ? '…' : 'Approve with Exception'}</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleApproveGroup(group)}
                                  disabled={!!actionLoading}
                                  className="text-xs px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition disabled:opacity-50 cursor-pointer shadow-xs"
                                >
                                  {actionLoading === group.key + '_approve' ? '…' : 'Approve'}
                                </button>
                              )}
                              <button
                                onClick={() => handleRejectGroup(group)}
                                disabled={!!actionLoading}
                                className="text-xs px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg transition disabled:opacity-50 cursor-pointer shadow-xs"
                              >
                                {actionLoading === group.key + '_reject' ? '…' : 'Reject'}
                              </button>
                            </>
                          )}
                          {(group.status === 'approved' || group.status === 'approved_with_exception') && hasUnassigned && (
                            <button
                              onClick={() => openSubModal(group)}
                              className="text-xs px-2.5 py-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition cursor-pointer shadow-xs"
                            >
                              Assign Sub
                            </button>
                          )}
                          {(group.status === 'approved' || group.status === 'approved_with_exception') && !hasUnassigned && approved.length > 0 && (
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
    </>
  )}

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
              <div className="space-y-2">
                {subModal.activeReq.proposed_substitute && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs space-y-2">
                    <div className="flex items-center gap-2">
                      <SparklesIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="font-bold text-indigo-900">Teacher Proposed a Substitute</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 pl-6">
                      <div>
                        <p className="font-extrabold text-slate-900">{subModal.activeReq.proposed_substitute.name}</p>
                        {subModal.activeReq.proposed_substitute.department_name && (
                          <p className="text-[11px] text-indigo-600">{subModal.activeReq.proposed_substitute.department_name}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-100 border border-indigo-300 px-1.5 py-0.5 rounded shrink-0">Proposed</span>
                    </div>
                    <p className="text-[11px] text-slate-500 pl-6">
                      The teacher proposed this faculty member. Search their name in the candidates list below to assign them — or choose a different substitute.
                    </p>
                  </div>
                )}
                <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 flex items-center gap-2">
                  <AlertTriangleIcon className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-semibold">Period P{subModal.activeReq.period_number} requires a substitute candidate. Select a candidate below.</span>
                </div>
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

      {/* ── Admin Balance Adjustment Modal ── */}
      <Modal
        open={!!adjustModal}
        onClose={() => setAdjustModal(null)}
        title={adjustModal ? `Adjust Leave Balance: ${adjustModal.teacher?.teacher_name}` : 'Adjust Balance'}
      >
        {adjustModal && (
          <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs sm:text-sm text-slate-700">
            {adjustModal.error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                {adjustModal.error}
              </div>
            )}

            <div className="space-y-1">
              <label className="font-bold text-slate-700 text-xs">Leave Policy</label>
              <select
                value={adjustModal.policy_id}
                onChange={e => setAdjustModal(prev => ({ ...prev, policy_id: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary-600"
              >
                {activePolicies.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code}) — {p.entitlement_days}d/{p.entitlement_period === 'SEMESTER' ? 'sem' : 'yr'}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 text-xs">Days Adjustment (+ to add, - to deduct)</label>
              <input
                type="number"
                step="0.5"
                placeholder="e.g. 1.0 or -1.0"
                value={adjustModal.days}
                onChange={e => setAdjustModal(prev => ({ ...prev, days: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary-600"
                required
              />
              <span className="text-[10px] text-slate-400 block">Positive adds leave entitlement; negative deducts entitlement.</span>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 text-xs">Administrative Reason (Required for Audit Trail)</label>
              <textarea
                rows={2}
                placeholder="Reason for balance modification (e.g. Compensatory credit granted by Principal)…"
                value={adjustModal.reason}
                onChange={e => setAdjustModal(prev => ({ ...prev, reason: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary-600"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAdjustModal(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={adjustModal.loading}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                {adjustModal.loading ? 'Saving Adjustment…' : 'Confirm Balance Adjustment'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Teacher Leave Ledger Modal ── */}
      <Modal
        open={!!teacherLedgerModal}
        onClose={() => setTeacherLedgerModal(null)}
        title={teacherLedgerModal ? `Leave Ledger: ${teacherLedgerModal.teacher?.teacher_name}` : 'Leave Ledger'}
        size="lg"
      >
        {teacherLedgerModal && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Complete administrative ledger of leave allocations, consumptions, and reversals.
            </p>

            {teacherLedgerModal.loading ? (
              <div className="py-12 text-center">
                <Spinner size="md" />
                <p className="text-xs text-slate-400 mt-2">Loading transactions…</p>
              </div>
            ) : teacherLedgerModal.transactions?.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                No leave transactions recorded for this teacher yet.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Policy</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3 text-right">Change</th>
                      <th className="py-2.5 px-3 text-right">Balance</th>
                      <th className="py-2.5 px-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {teacherLedgerModal.transactions?.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50/60">
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                          {tx.created_at ? tx.created_at.split('T')[0] : '—'}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">
                          <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {tx.policy_code || 'AL'}
                          </span>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            tx.transaction_type === 'CONSUMED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : tx.transaction_type === 'REVERSAL'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : tx.transaction_type === 'OPENING_BALANCE'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {tx.transaction_type}
                          </span>
                        </td>
                        <td className={`py-2 px-3 text-right font-mono font-bold whitespace-nowrap ${
                          tx.days > 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {tx.days > 0 ? `+${tx.days}` : tx.days}d
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-slate-700 whitespace-nowrap">
                          {tx.balance_after}d
                        </td>
                        <td className="py-2 px-3 text-slate-600 max-w-xs truncate" title={tx.reason}>
                          {tx.reason || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setTeacherLedgerModal(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Policy Exception Approval Modal */}
      <Modal
        open={!!exceptionModal}
        onClose={() => setExceptionModal(null)}
        title="Approve Leave with Policy Exception"
        size="md"
      >
        {exceptionModal && (
          <div className="space-y-4">
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider">
                <AlertTriangleIcon className="w-4 h-4 text-amber-600" />
                <span>Policy Violation Warning Notice</span>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed">
                This leave application for <strong>{exceptionModal.group.teacher?.name}</strong> on <strong>{exceptionModal.group.date}</strong> violates configured institutional leave policies.
              </p>
              {exceptionModal.group.policy_evaluation_snapshot?.violations?.length > 0 && (
                <ul className="list-disc list-inside text-xs text-amber-800 font-medium space-y-1 pt-1 bg-white/70 p-2.5 rounded-lg border border-amber-200/60">
                  {exceptionModal.group.policy_evaluation_snapshot.violations.map((v, i) => (
                    <li key={i}>{v.message}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                HOD Exception Justification <span className="text-rose-600">*</span>
              </label>
              <textarea
                value={exceptionModal.reason}
                onChange={e => setExceptionModal(prev => ({ ...prev, reason: e.target.value, error: null }))}
                placeholder="Enter justification for overriding policy (e.g. Emergency family circumstance, special waiver granted by department)..."
                rows={3}
                className="w-full text-xs font-medium p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 bg-white"
              />
              <p className="text-[10px] text-slate-400">
                This reason will be recorded in the audit trail alongside your approval credentials.
              </p>
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={exceptionModal.acknowledged}
                onChange={e => setExceptionModal(prev => ({ ...prev, acknowledged: e.target.checked, error: null }))}
                className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-xs font-semibold text-slate-700 leading-snug">
                I acknowledge that this leave request violates institutional policy and approve it as an authorized departmental exception.
              </span>
            </label>

            {exceptionModal.error && (
              <p className="text-xs text-rose-600 font-bold">{exceptionModal.error}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setExceptionModal(null)}
                disabled={exceptionModal.loading}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveWithException}
                disabled={exceptionModal.loading || !exceptionModal.acknowledged || !exceptionModal.reason.trim()}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-40 rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {exceptionModal.loading ? 'Approving…' : 'Approve with Exception'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
