import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { campusDutiesApi, campusStructureApi, departmentsApi } from '../../api/services'
import { Card, Spinner, ErrorAlert, Modal, Badge } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'

export default function DutyManagement({ readOnly = false }) {
  const { user } = useAuth()
  const isPrincipalOrAdmin = user?.role === 'system_admin' || user?.is_system_admin || user?.role === 'principal'

  // Primary scheduling state
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [duties, setDuties] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [areas, setAreas] = useState([])
  const [breakPeriods, setBreakPeriods] = useState([])
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState(null)

  // 6 Day Orders Autonomous Schedule State
  const [autonomousEnabled, setAutonomousEnabled] = useState(false)
  const [dayOrders, setDayOrders] = useState([])
  const [selectedDayOrderIndex, setSelectedDayOrderIndex] = useState(0) // 0..5 or -1 for all
  const [togglingAutonomous, setTogglingAutonomous] = useState(false)
  const [autonomousResult, setAutonomousResult] = useState(null)

  // Quick Filters & Instant Search
  const [quickFilter, setQuickFilter] = useState('all') // all, unfilled, filled, discipline, wing, exam, locked
  const [searchQuery, setSearchQuery] = useState('')
  const [generateMenuOpen, setGenerateMenuOpen] = useState(false)
  const generateMenuRef = useRef(null)

  // Configuration Drawer State
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false)
  const [configActiveTab, setConfigActiveTab] = useState('rules') // rules, breaks, sweep
  const [dutyRules, setDutyRules] = useState(null)
  const [rulesLoading, setRulesLoading] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [configMsg, setConfigMsg] = useState(null)
  const [editingBreakPeriod, setEditingBreakPeriod] = useState(null)
  const [bpForm, setBpForm] = useState({})
  const [rulesForm, setRulesForm] = useState({})
  const [autoReplaceResult, setAutoReplaceResult] = useState(null)
  const [autoReplaceLoading, setAutoReplaceLoading] = useState(false)
  const [allBreakPeriods, setAllBreakPeriods] = useState([])

  // Discipline Duty Generation Modal (Block & Staff specified by Principal)
  const [disciplineModalOpen, setDisciplineModalOpen] = useState(false)
  const [disciplineForm, setDisciplineForm] = useState({
    block_id: '',
    required_teachers: 2,
    auto_assign: true,
    target_date: ''
  })

  // Candidate Picker Modal (Explainability & Scoring)
  const [candidateModalDuty, setCandidateModalDuty] = useState(null)
  const [candidateData, setCandidateData] = useState(null)
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [candidateFilter, setCandidateFilter] = useState('all')

  // Override / Replace Modal
  const [actionModal, setActionModal] = useState(null) // { type: 'override'|'replace'|'create', duty, assignment }
  const [overrideReason, setOverrideReason] = useState('')
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [overrideCandidates, setOverrideCandidates] = useState([])

  // Create Custom Duty Modal
  const [createForm, setCreateForm] = useState({
    duty_type: 'WING_DUTY',
    title: '',
    duty_date: new Date().toISOString().split('T')[0],
    start_time: '10:00',
    end_time: '11:00',
    area_id: '',
    required_teachers: 1
  })

  // Close generate menu on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (generateMenuRef.current && !generateMenuRef.current.contains(e.target)) {
        setGenerateMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load next 6 day orders & autonomous status
  const fetchDayOrders = useCallback(async () => {
    try {
      const res = await campusDutiesApi.getNext6DayOrders()
      const data = res?.data
      if (data) {
        setAutonomousEnabled(Boolean(data.autonomous_enabled))
        setDayOrders(data.day_orders || [])
      }
    } catch (err) {
      console.error('Failed to load next 6 day orders:', err)
    }
  }, [])

  useEffect(() => {
    fetchDayOrders()
  }, [fetchDayOrders])

  // Load duties & metrics
  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (selectedDayOrderIndex === -1 && dayOrders.length > 0) {
        params.date_from = dayOrders[0].date
        params.date_to = dayOrders[dayOrders.length - 1].date
      } else {
        params.target_date = selectedDate
      }

      const [dutiesRes, metricsRes, areasRes, bpRes, blocksRes] = await Promise.all([
        campusDutiesApi.listDuties(params),
        campusDutiesApi.getMetrics({ target_date: selectedDate }),
        campusDutiesApi.getAreas(),
        campusDutiesApi.getBreakPeriods(),
        campusStructureApi.listBlocks(true).catch(() => ({ data: [] }))
      ])

      setDuties(dutiesRes?.data || [])
      setMetrics(metricsRes?.data || null)
      setAreas(areasRes?.data || [])
      setBreakPeriods(bpRes?.data || [])
      setBlocks(blocksRes?.data || [])
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to load duty management data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedDate, selectedDayOrderIndex])

  // Filtered duties with instant search & quick-filter pills
  const filteredDuties = useMemo(() => {
    let result = duties

    // If a single day is selected (not all 6 days), scope to that date
    if (selectedDayOrderIndex !== -1) {
      result = result.filter(d => d.duty_date === selectedDate)
    }

    // Apply Quick KPI Filter
    if (quickFilter === 'unfilled') {
      result = result.filter(d => (d.assigned_teachers_count || 0) < (d.required_teachers || 1) && d.status !== 'CANCELLED')
    } else if (quickFilter === 'filled') {
      result = result.filter(d => (d.assigned_teachers_count || 0) >= (d.required_teachers || 1))
    } else if (quickFilter === 'discipline') {
      result = result.filter(d => d.duty_type === 'DISCIPLINE_DUTY')
    } else if (quickFilter === 'wing') {
      result = result.filter(d => d.duty_type === 'WING_DUTY')
    } else if (quickFilter === 'exam') {
      result = result.filter(d => d.duty_type === 'EXAM_DUTY')
    } else if (quickFilter === 'locked') {
      result = result.filter(d => Boolean(d.is_locked))
    }

    // Apply Live Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(d =>
        (d.title || '').toLowerCase().includes(q) ||
        (d.block_name || '').toLowerCase().includes(q) ||
        (d.area_name || '').toLowerCase().includes(q) ||
        (d.location_hierarchy || '').toLowerCase().includes(q) ||
        (d.assignments || []).some(a => (a.teacher_name || '').toLowerCase().includes(q))
      )
    }

    return result
  }, [duties, selectedDate, selectedDayOrderIndex, quickFilter, searchQuery])

  // Group duties by day: single cohesive card per date
  const dutiesByDay = useMemo(() => {
    const map = {}
    filteredDuties.forEach((d) => {
      const key = d.duty_date
      if (!map[key]) {
        map[key] = {
          date: d.duty_date,
          day_order: d.day_order,
          duties: []
        }
      }
      map[key].duties.push(d)
      if (!map[key].day_order && d.day_order) {
        map[key].day_order = d.day_order
      }
    })

    // Sort duties within each day chronologically
    Object.values(map).forEach((group) => {
      group.duties.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
    })

    // Sort days chronologically
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredDuties])

  // Autonomous 6-Day Order Toggle Handler
  const handleToggleAutonomous = async () => {
    if (!isPrincipalOrAdmin) {
      alert('Only the Principal and System Administrator have the authority to toggle the Autonomous Duty Schedule.')
      return
    }
    const targetState = !autonomousEnabled
    if (targetState) {
      const proceed = window.confirm(
        'Turn ON Autonomous 6-Day Order Duty Scheduling?\n\n' +
        'FAFLOW will automatically generate discipline and wing duties for the next 6 Day Orders and auto-assign staff without timetable conflicts.'
      )
      if (!proceed) return
    }
    setTogglingAutonomous(true)
    setError(null)
    try {
      const res = await campusDutiesApi.toggleAutonomousSchedule({
        enabled: targetState,
        start_date: selectedDate,
        num_day_orders: 6,
        activate_discipline: true,
        activate_wing: true,
      })
      setAutonomousEnabled(targetState)
      if (res?.data?.activation) {
        setAutonomousResult(res.data.activation)
      } else {
        setAutonomousResult(null)
      }
      await Promise.all([fetchData(), fetchDayOrders()])
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to toggle autonomous duty schedule.')
    } finally {
      setTogglingAutonomous(false)
    }
  }

  // Day Order Selection Handler (1 Click)
  const handleSelectDayOrder = (index) => {
    setSelectedDayOrderIndex(index)
    if (index >= 0 && dayOrders[index]) {
      setSelectedDate(dayOrders[index].date)
    }
  }

  // Open Configuration Drawer and load rules
  const handleOpenConfigDrawer = async (tab = 'rules') => {
    setConfigActiveTab(tab)
    setConfigDrawerOpen(true)
    if (!dutyRules) {
      setRulesLoading(true)
      try {
        const [rRes, bpRes] = await Promise.all([
          campusDutiesApi.getRules(),
          campusDutiesApi.getBreakPeriods({ is_active_only: false })
        ])
        const r = rRes?.data || {}
        setDutyRules(r)
        setRulesForm(r)
        setAllBreakPeriods(bpRes?.data || [])
      } catch (err) {
        console.error('Failed to load rules:', err)
      } finally {
        setRulesLoading(false)
      }
    }
  }

  // Generate Discipline Duties
  const handleOpenDisciplineModal = () => {
    setGenerateMenuOpen(false)
    setDisciplineForm({
      block_id: blocks.length > 0 ? blocks[0].id : '',
      required_teachers: dutyRules?.max_discipline_teachers || 2,
      auto_assign: true,
      target_date: selectedDate
    })
    setDisciplineModalOpen(true)
  }

  const handleGenerateDiscipline = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    setActionLoading(true)
    try {
      const payload = {
        target_date: disciplineForm.target_date || selectedDate,
        block_id: disciplineForm.block_id ? Number(disciplineForm.block_id) : null,
        required_teachers: Number(disciplineForm.required_teachers) || 2,
        auto_assign: Boolean(disciplineForm.auto_assign)
      }
      const res = await campusDutiesApi.generateDiscipline(payload)
      const count = res?.data?.length || 0
      setDisciplineModalOpen(false)
      await fetchData()
      alert(`Discipline duties configured & generated (${count} duties)! Eligible faculty from departments located in that block have been gathered and assigned with balanced workload.`)
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to generate block discipline duties')
    } finally {
      setActionLoading(false)
    }
  }

  // Generate Wing Duties
  const handleGenerateWingDuties = async () => {
    setGenerateMenuOpen(false)
    setActionLoading(true)
    try {
      const res = await campusDutiesApi.generateWingDuties({ target_date: selectedDate })
      const count = Array.isArray(res?.data) ? res.data.length : (res?.data?.created_count ?? 0)
      alert(`Wing duties generated from campus floors! Created: ${count}`)
      await fetchData()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to generate wing duties')
    } finally {
      setActionLoading(false)
    }
  }

  // Generate Exam Duties
  const handleGenerateExamDuties = async () => {
    setGenerateMenuOpen(false)
    const session = prompt('Enter Exam Session (FN or AN):', 'FN')
    if (!session) return
    setActionLoading(true)
    try {
      const res = await campusDutiesApi.generateExamDuties({
        target_date: selectedDate,
        session: session.trim().toUpperCase(),
      })
      const count = Array.isArray(res?.data) ? res.data.length : (res?.data?.created_count ?? 0)
      alert(`Exam duties generated from exam-eligible classrooms! Created: ${count}`)
      await fetchData()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to generate exam duties')
    } finally {
      setActionLoading(false)
    }
  }

  // Auto-Assign
  const handleAutoAssign = async (dutyId) => {
    setActionLoading(true)
    try {
      await campusDutiesApi.autoAssign(dutyId)
      await fetchData()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Auto assignment failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAutoAssignAll = async (targetDate = selectedDate) => {
    if (!confirm(`Auto-assign all unfilled duties for ${targetDate}?`)) return
    setActionLoading(true)
    try {
      const res = await campusDutiesApi.autoAssignAll({ target_date: targetDate })
      alert(`Auto-assignment completed! Assigned: ${res?.data?.total_assigned ?? 0}, Unfilled: ${res?.data?.total_unfilled ?? 0}`)
      await fetchData()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Auto-assignment failed')
    } finally {
      setActionLoading(false)
    }
  }

  // Candidate Picker Modal
  const openCandidatePicker = async (duty) => {
    setCandidateModalDuty(duty)
    setCandidateFilter('all')
    setCandidatesLoading(true)
    try {
      const res = await campusDutiesApi.getCandidates(duty.id)
      setCandidateData(res?.data || null)
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to evaluate candidates')
      setCandidateModalDuty(null)
    } finally {
      setCandidatesLoading(false)
    }
  }

  const handleManualAssign = async (teacherId) => {
    if (!candidateModalDuty) return
    setActionLoading(true)
    try {
      await campusDutiesApi.manualAssign(candidateModalDuty.id, { teacher_id: teacherId, role: 'GENERAL' })
      setCandidateModalDuty(null)
      await fetchData()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Manual assignment failed')
    } finally {
      setActionLoading(false)
    }
  }

  // Lock / Unlock Duty
  const handleToggleLock = async (duty) => {
    const reason = duty.is_locked ? null : prompt('Enter lock reason (optional):', 'Administrative review lock')
    if (!duty.is_locked && reason === null) return
    setActionLoading(true)
    try {
      await campusDutiesApi.setLock(duty.id, { lock: !duty.is_locked, reason })
      await fetchData()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Lock state toggle failed')
    } finally {
      setActionLoading(false)
    }
  }

  // Reset Duty
  const handleResetDuty = async (duty) => {
    if (!window.confirm(`Reset all assigned faculty for "${duty.title}"?\nThis will clear current assignments and unlock the duty.`)) return
    setActionLoading(true)
    try {
      await campusDutiesApi.resetDuty(duty.id)
      await fetchData()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Reset duty failed')
    } finally {
      setActionLoading(false)
    }
  }

  // Toggle Active
  const handleToggleDutyActive = async (duty) => {
    const isDeactivated = duty.status === 'CANCELLED'
    const confirmMsg = isDeactivated
      ? `Reactivate duty "${duty.title}"?`
      : `Deactivate duty "${duty.title}"? This duty will be marked inactive.`
    if (!window.confirm(confirmMsg)) return
    setActionLoading(true)
    try {
      await campusDutiesApi.toggleDutyActive(duty.id)
      await fetchData()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to toggle duty status')
    } finally {
      setActionLoading(false)
    }
  }

  // Delete Duty
  const handleDeleteDuty = async (duty) => {
    if (!window.confirm(`Are you sure you want to permanently DELETE "${duty.title}"?\nThis action cannot be undone.`)) return
    setActionLoading(true)
    try {
      await campusDutiesApi.deleteDuty(duty.id)
      await fetchData()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to delete duty')
    } finally {
      setActionLoading(false)
    }
  }

  // Bulk Delete
  const handleBulkDelete = async (targetDate = selectedDate, targetDuties = filteredDuties) => {
    const count = targetDuties.length
    if (count === 0) {
      alert('No duties found to delete.')
      return
    }
    const msg = `⚠️ PERMANENT BULK DELETION\n\nAre you sure you want to delete ALL ${count} duties on ${targetDate}?\n\nThis will remove all duty records and clear faculty assignments. This action cannot be undone.`
    if (!window.confirm(msg)) return

    const confirmation = prompt(`Type "DELETE" to confirm deleting all ${count} duties on ${targetDate}:`)
    if (confirmation !== 'DELETE') {
      alert('Bulk deletion cancelled.')
      return
    }

    setActionLoading(true)
    try {
      const dutyIds = targetDuties.map(d => d.id)
      const res = await campusDutiesApi.bulkDelete({
        target_date: targetDate,
        duty_ids: dutyIds
      })
      await fetchData()
      alert(res?.data?.message || `Successfully deleted ${count} duties.`)
    } catch (err) {
      alert(err?.response?.data?.detail || 'Bulk deletion failed')
    } finally {
      setActionLoading(false)
    }
  }

  // Bulk Reset
  const handleBulkReset = async (targetDate = selectedDate, targetDuties = filteredDuties) => {
    const count = targetDuties.length
    if (count === 0) {
      alert('No duties found to reset.')
      return
    }
    if (!window.confirm(`Reset faculty assignments for ALL ${count} duties on ${targetDate}?\n\nAll assigned staff will be cleared (0/N) and duties will be unlocked.`)) return

    setActionLoading(true)
    try {
      const dutyIds = targetDuties.map(d => d.id)
      const res = await campusDutiesApi.bulkReset({
        target_date: targetDate,
        duty_ids: dutyIds
      })
      await fetchData()
      alert(res?.data?.message || `Successfully reset assignments for ${count} duties.`)
    } catch (err) {
      alert(err?.response?.data?.detail || 'Bulk reset failed')
    } finally {
      setActionLoading(false)
    }
  }

  // Reassign / Override
  const handleOpenOverrideModal = async (duty, assignment) => {
    setSelectedTeacherId('')
    setOverrideReason('')
    setOverrideCandidates([])
    setActionModal({ type: 'override', duty, assignment })
    try {
      const res = await campusDutiesApi.getCandidates(duty.id)
      setOverrideCandidates(res?.data?.candidates || [])
    } catch {
      setOverrideCandidates([])
    }
  }

  const handleExecuteOverride = async () => {
    if (!actionModal?.assignment || !selectedTeacherId) return
    setActionLoading(true)
    try {
      await campusDutiesApi.overrideAssignment(actionModal.assignment.id, {
        new_teacher_id: Number(selectedTeacherId),
        reason: overrideReason || 'HOD administrative reassignment'
      })
      setActionModal(null)
      await fetchData()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Override failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleExecuteReplace = async () => {
    if (!actionModal?.assignment) return
    setActionLoading(true)
    try {
      await campusDutiesApi.replaceTeacher(actionModal.assignment.id, {
        reason: overrideReason || 'Staff reported emergency unavailability'
      })
      setActionModal(null)
      await fetchData()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Replacement failed')
    } finally {
      setActionLoading(false)
    }
  }

  // Create Duty
  const handleCreateDutySubmit = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    try {
      await campusDutiesApi.createDuty({
        ...createForm,
        area_id: createForm.area_id ? Number(createForm.area_id) : undefined,
        required_teachers: Number(createForm.required_teachers)
      })
      setActionModal(null)
      setCreateForm({
        duty_type: 'WING_DUTY',
        title: '',
        duty_date: selectedDate,
        start_time: '10:00',
        end_time: '11:00',
        area_id: '',
        required_teachers: 1
      })
      await fetchData()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to create campus duty')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      {/* ── UNIFIED EXECUTIVE HEADER & ACTION HUB ── */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Campus Duty Management</h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                autonomousEnabled
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                <span className={`w-2 h-2 rounded-full ${autonomousEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                {autonomousEnabled ? 'Autonomous Schedule ON' : 'Manual Mode'}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              Discipline (Block-based) · Wing Supervision · Exam Invigilation · Automated Conflict Resolution
            </p>
          </div>

          {/* Action Toolbar */}
          {!readOnly && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Primary 1-Click Action: Auto-Fill Day */}
              <button
                onClick={() => handleAutoAssignAll(selectedDate)}
                disabled={actionLoading}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-indigo-600/25 flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                title="Auto-assign all unfilled duties for this day with conflict-free matching"
              >
                <span>⚡</span> Auto-Fill Day
              </button>

              {/* + Generate Duties Dropdown */}
              <div className="relative" ref={generateMenuRef}>
                <button
                  type="button"
                  onClick={() => setGenerateMenuOpen(!generateMenuOpen)}
                  disabled={actionLoading}
                  className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                >
                  <span>+ Generate Duties</span>
                  <span className="text-[10px]">▼</span>
                </button>

                {generateMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 py-2 divide-y divide-slate-100 animate-in fade-in duration-100">
                    <div className="py-1">
                      <button
                        onClick={handleOpenDisciplineModal}
                        className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-800 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 transition-colors"
                      >
                        <span className="text-base">🛡️</span>
                        <div>
                          <p className="leading-none">Discipline Duty (by Block)</p>
                          <p className="text-[10px] text-slate-400 font-normal mt-0.5">Assigned to block-located faculty</p>
                        </div>
                      </button>
                      <button
                        onClick={handleGenerateWingDuties}
                        className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-800 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2.5 transition-colors"
                      >
                        <span className="text-base">🏢</span>
                        <div>
                          <p className="leading-none">Wing Duties</p>
                          <p className="text-[10px] text-slate-400 font-normal mt-0.5">Generate from campus floors</p>
                        </div>
                      </button>
                      <button
                        onClick={handleGenerateExamDuties}
                        className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-800 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-2.5 transition-colors"
                      >
                        <span className="text-base">📝</span>
                        <div>
                          <p className="leading-none">Exam Duties</p>
                          <p className="text-[10px] text-slate-400 font-normal mt-0.5">From exam-eligible halls</p>
                        </div>
                      </button>
                    </div>
                    <div className="pt-1">
                      <button
                        onClick={() => {
                          setGenerateMenuOpen(false)
                          setActionModal({ type: 'create' })
                        }}
                        className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                      >
                        <span className="text-base">➕</span>
                        <div>
                          <p className="leading-none">Create Custom Duty</p>
                          <p className="text-[10px] text-slate-400 font-normal mt-0.5">Manual duty period</p>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Autonomous Toggle Switch */}
              {isPrincipalOrAdmin && (
                <button
                  onClick={handleToggleAutonomous}
                  disabled={togglingAutonomous}
                  title="Toggle Autonomous 6-Day Order Duty Scheduling"
                  className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 active:scale-95 ${
                    autonomousEnabled
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>{autonomousEnabled ? '⚡' : '⚪'}</span>
                  <span>{togglingAutonomous ? 'Updating...' : autonomousEnabled ? 'Autonomous (ON)' : 'Autonomous (OFF)'}</span>
                </button>
              )}

              {/* Rules & Settings Drawer Trigger */}
              {isPrincipalOrAdmin && (
                <button
                  onClick={() => handleOpenConfigDrawer('rules')}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 active:scale-95"
                  title="Configure break periods, auto-replace sweeps, and governance limits"
                >
                  <span>⚙️</span> Rules & Settings
                </button>
              )}
            </div>
          )}
        </div>

        {/* Autonomous Activation Notification */}
        {autonomousResult && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-emerald-900 text-xs shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🎉</span>
              <div>
                <p className="font-extrabold text-emerald-950">
                  6-Day Duty Schedule Active ({autonomousResult.schedule_from} → {autonomousResult.schedule_to})
                </p>
                <p className="text-emerald-700 mt-0.5">
                  {autonomousResult.discipline_duties_count} discipline duties + {autonomousResult.wing_duties_count} wing duties created across {autonomousResult.num_day_orders} Day Orders. {autonomousResult.total_assigned} faculty auto-assigned ({autonomousResult.total_unfilled} open).
                </p>
              </div>
            </div>
            <button
              onClick={() => setAutonomousResult(null)}
              className="font-bold text-emerald-700 hover:text-emerald-900 px-2 py-1 rounded-lg hover:bg-emerald-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── 6 DAY ORDERS HORIZON BAR ── */}
        {dayOrders.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <span>📅</span> 6 Day Orders Schedule Horizon
              </span>
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-bold text-slate-400">Date:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value)
                    setSelectedDayOrderIndex(0)
                  }}
                  className="px-2 py-0.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {dayOrders.map((doItem, idx) => {
                const isSelected = selectedDayOrderIndex === idx
                const hasUnfilled = doItem.unfilled_duties > 0
                const isFilled = doItem.total_duties > 0 && doItem.unfilled_duties === 0

                return (
                  <button
                    key={doItem.date}
                    onClick={() => handleSelectDayOrder(idx)}
                    className={`p-2.5 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/90 shadow-md ring-2 ring-indigo-500/20'
                        : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-black uppercase ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                        DO {doItem.day_order ?? (idx + 1)}
                      </span>
                      {doItem.is_today && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700">
                          Today
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                      {doItem.formatted_date} · {doItem.day_name.slice(0, 3)}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] font-bold">
                      <span className="text-slate-500">{doItem.total_duties} duties</span>
                      {isFilled ? (
                        <span className="text-emerald-700 bg-emerald-100 px-1 py-0.2 rounded text-[9px] font-extrabold">✓ Full</span>
                      ) : hasUnfilled ? (
                        <span className="text-amber-700 bg-amber-100 px-1 py-0.2 rounded text-[9px] font-extrabold">⚠️ {doItem.unfilled_duties} open</span>
                      ) : (
                        <span className="text-slate-400 text-[9px]">Empty</span>
                      )}
                    </div>
                  </button>
                )
              })}

              {/* All 6 Days Option */}
              <button
                onClick={() => handleSelectDayOrder(-1)}
                className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  selectedDayOrderIndex === -1
                    ? 'border-indigo-600 bg-indigo-50/90 shadow-md ring-2 ring-indigo-500/20'
                    : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50 shadow-sm'
                }`}
              >
                <div>
                  <span className={`text-xs font-black uppercase ${selectedDayOrderIndex === -1 ? 'text-indigo-900' : 'text-slate-800'}`}>
                    All 6 Days
                  </span>
                  <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                    Unified Window
                  </p>
                </div>
                <span className="text-[10px] font-bold text-indigo-600 mt-1">
                  View All →
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── INTERACTIVE KPI QUICK-FILTER STRIP (1-CLICK FILTERING) ── */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {/* All Duties */}
          <button
            onClick={() => setQuickFilter('all')}
            className={`p-3 rounded-2xl border text-left transition-all ${
              quickFilter === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
                : 'bg-white text-slate-800 border-slate-200/80 hover:bg-slate-50 shadow-sm'
            }`}
          >
            <span className={`block text-[10px] font-bold uppercase tracking-wider ${quickFilter === 'all' ? 'text-slate-300' : 'text-slate-400'}`}>
              All Duties
            </span>
            <span className="text-xl font-black mt-0.5 block">{metrics.total_duties_today}</span>
          </button>

          {/* Needs Staff (Unfilled) */}
          <button
            onClick={() => setQuickFilter('unfilled')}
            className={`p-3 rounded-2xl border text-left transition-all ${
              quickFilter === 'unfilled'
                ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-500/20'
                : metrics.unfilled_duties_today > 0
                ? 'bg-amber-50/80 border-amber-300 text-amber-900 hover:bg-amber-100 shadow-sm'
                : 'bg-white text-slate-800 border-slate-200/80 hover:bg-slate-50 shadow-sm'
            }`}
          >
            <span className={`block text-[10px] font-bold uppercase tracking-wider ${quickFilter === 'unfilled' ? 'text-amber-100' : 'text-amber-700'}`}>
              ⚠️ Needs Staff
            </span>
            <span className="text-xl font-black mt-0.5 block">{metrics.unfilled_duties_today}</span>
          </button>

          {/* Filled */}
          <button
            onClick={() => setQuickFilter('filled')}
            className={`p-3 rounded-2xl border text-left transition-all ${
              quickFilter === 'filled'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-600/20'
                : 'bg-emerald-50/70 border-emerald-200 text-emerald-900 hover:bg-emerald-100 shadow-sm'
            }`}
          >
            <span className={`block text-[10px] font-bold uppercase tracking-wider ${quickFilter === 'filled' ? 'text-emerald-100' : 'text-emerald-700'}`}>
              ✓ Fully Staffed
            </span>
            <span className="text-xl font-black mt-0.5 block">{metrics.filled_duties_today}</span>
          </button>

          {/* Discipline */}
          <button
            onClick={() => setQuickFilter('discipline')}
            className={`p-3 rounded-2xl border text-left transition-all ${
              quickFilter === 'discipline'
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-600/20'
                : 'bg-white text-slate-800 border-slate-200/80 hover:bg-slate-50 shadow-sm'
            }`}
          >
            <span className={`block text-[10px] font-bold uppercase tracking-wider ${quickFilter === 'discipline' ? 'text-indigo-200' : 'text-slate-400'}`}>
              🛡️ Discipline ({metrics.discipline_coverage_pct}%)
            </span>
            <span className="text-xl font-black mt-0.5 block">
              {duties.filter(d => d.duty_type === 'DISCIPLINE_DUTY').length}
            </span>
          </button>

          {/* Wing Duty */}
          <button
            onClick={() => setQuickFilter('wing')}
            className={`p-3 rounded-2xl border text-left transition-all ${
              quickFilter === 'wing'
                ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-600/20'
                : 'bg-white text-slate-800 border-slate-200/80 hover:bg-slate-50 shadow-sm'
            }`}
          >
            <span className={`block text-[10px] font-bold uppercase tracking-wider ${quickFilter === 'wing' ? 'text-blue-200' : 'text-slate-400'}`}>
              🏢 Wing ({metrics.wing_coverage_pct}%)
            </span>
            <span className="text-xl font-black mt-0.5 block">
              {duties.filter(d => d.duty_type === 'WING_DUTY').length}
            </span>
          </button>

          {/* Exam Duty */}
          <button
            onClick={() => setQuickFilter('exam')}
            className={`p-3 rounded-2xl border text-left transition-all ${
              quickFilter === 'exam'
                ? 'bg-purple-600 text-white border-purple-700 shadow-md ring-2 ring-purple-600/20'
                : 'bg-white text-slate-800 border-slate-200/80 hover:bg-slate-50 shadow-sm'
            }`}
          >
            <span className={`block text-[10px] font-bold uppercase tracking-wider ${quickFilter === 'exam' ? 'text-purple-200' : 'text-slate-400'}`}>
              📝 Exam
            </span>
            <span className="text-xl font-black mt-0.5 block">
              {duties.filter(d => d.duty_type === 'EXAM_DUTY').length}
            </span>
          </button>

          {/* Locked */}
          <button
            onClick={() => setQuickFilter('locked')}
            className={`p-3 rounded-2xl border text-left transition-all ${
              quickFilter === 'locked'
                ? 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-600/20'
                : 'bg-white text-slate-800 border-slate-200/80 hover:bg-slate-50 shadow-sm'
            }`}
          >
            <span className={`block text-[10px] font-bold uppercase tracking-wider ${quickFilter === 'locked' ? 'text-amber-100' : 'text-slate-400'}`}>
              🔒 Locked
            </span>
            <span className="text-xl font-black mt-0.5 block">{metrics.locked_duties_today}</span>
          </button>
        </div>
      )}

      {/* ── LIVE SEARCH & FAST ACTIONS BAR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm">
            🔍
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search duties by block, corridor, staff name, or title..."
            className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter status & bulk controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {quickFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200">
              Filter: {quickFilter.toUpperCase()}
              <button onClick={() => setQuickFilter('all')} className="ml-1 hover:text-indigo-900">✕</button>
            </span>
          )}

          {!readOnly && filteredDuties.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleBulkReset(selectedDate, filteredDuties)}
                disabled={actionLoading}
                title={`Reset faculty assignments for all ${filteredDuties.length} visible duties`}
                className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-1 shadow-sm disabled:opacity-50"
              >
                <span>🔄</span> Reset ({filteredDuties.length})
              </button>
              <button
                onClick={() => handleBulkDelete(selectedDate, filteredDuties)}
                disabled={actionLoading}
                title={`Permanently delete all ${filteredDuties.length} visible duties`}
                className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-all flex items-center gap-1 shadow-sm disabled:opacity-50"
              >
                <span>🗑️</span> Delete ({filteredDuties.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* ── MAIN DUTY CARDS LIST ── */}
      {loading ? (
        <div className="py-20 flex justify-center"><Spinner /></div>
      ) : filteredDuties.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-100 p-8 shadow-sm space-y-3">
          <div className="text-4xl">🛡️</div>
          <p className="text-sm font-bold text-slate-700">No duties found for this selection</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {searchQuery
              ? `No duties match "${searchQuery}". Try clearing the search or changing the filter.`
              : `Click "+ Generate Duties" above to initialize Discipline or Wing duties for this Day Order.`}
          </p>
          {!readOnly && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={handleOpenDisciplineModal}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                🛡️ Generate Discipline Duties
              </button>
              <button
                onClick={handleGenerateWingDuties}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                🏢 Generate Wing Duties
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {dutiesByDay.map((dayGroup) => {
            const totalRequired = dayGroup.duties.reduce((sum, d) => sum + (d.required_teachers || 0), 0)
            const totalAssigned = dayGroup.duties.reduce((sum, d) => sum + (d.assigned_teachers_count || 0), 0)
            const isDayFull = totalAssigned >= totalRequired && totalRequired > 0

            let dateLabel = dayGroup.date
            try {
              const [y, m, day] = dayGroup.date.split('-')
              const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(day))
              dateLabel = dt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })
            } catch (_) {}

            return (
              <div
                key={dayGroup.date}
                className="rounded-3xl border border-slate-200/90 bg-white shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                {/* Day Header Strip */}
                <div className="px-6 py-4 bg-gradient-to-r from-slate-50 via-indigo-50/20 to-white border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-indigo-600/20">
                      📅
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-black text-slate-900 leading-tight">
                          {dateLabel}
                        </h2>
                        {dayGroup.day_order && (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
                            Day Order {dayGroup.day_order}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {dayGroup.duties.length} {dayGroup.duties.length === 1 ? 'Period' : 'Periods'}
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                        Campus Supervision & Faculty Allocation for {dayGroup.date}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-3 py-1 rounded-xl text-xs font-bold ${
                      isDayFull ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {totalAssigned} / {totalRequired} Staff Assigned
                    </span>

                    {!readOnly && (
                      <div className="flex items-center gap-1.5 ml-2">
                        <button
                          onClick={() => handleAutoAssignAll(dayGroup.date)}
                          disabled={actionLoading || isDayFull}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-all disabled:opacity-50 flex items-center gap-1"
                        >
                          ⚡ Auto-Fill
                        </button>
                        <button
                          onClick={() => handleBulkReset(dayGroup.date, dayGroup.duties)}
                          disabled={actionLoading}
                          title={`Reset all duty assignments for ${dayGroup.date}`}
                          className="px-2 py-1 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition-all flex items-center gap-1"
                        >
                          🔄 Reset
                        </button>
                        <button
                          onClick={() => handleBulkDelete(dayGroup.date, dayGroup.duties)}
                          disabled={actionLoading}
                          title={`Permanently delete all duties on ${dayGroup.date}`}
                          className="px-2 py-1 text-xs font-bold rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-all flex items-center gap-1"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Day Duties Cards Grid */}
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/40">
                  {dayGroup.duties.map((d) => {
                    const isFull = (d.assigned_teachers_count || 0) >= (d.required_teachers || 1)
                    const isDeactivated = d.status === 'CANCELLED'

                    return (
                      <div
                        key={d.id}
                        className={`rounded-2xl border bg-white p-5 space-y-4 shadow-sm transition-all hover:shadow-md ${
                          isDeactivated
                            ? 'border-dashed border-rose-300 bg-rose-50/20 opacity-80'
                            : d.is_locked
                            ? 'border-amber-200 bg-amber-50/20'
                            : isFull
                            ? 'border-emerald-100'
                            : 'border-slate-200/80'
                        }`}
                      >
                        {/* Period Title & Type */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                                {d.duty_type.replace('_', ' ')}
                              </span>
                              {d.block_name && (
                                <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 truncate max-w-[140px]" title={`Campus Block: ${d.block_name}`}>
                                  🏢 {d.block_name}
                                </span>
                              )}
                              {isDeactivated && (
                                <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                                  DEACTIVATED
                                </span>
                              )}
                            </div>
                            <h3 className={`font-extrabold text-sm mt-1.5 leading-snug truncate ${isDeactivated ? 'line-through text-slate-400' : 'text-slate-900'}`} title={d.title}>
                              {d.title}
                            </h3>
                            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                              {d.start_time?.substring(0, 5)} – {d.end_time?.substring(0, 5)}
                            </p>
                          </div>

                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isDeactivated
                                ? 'bg-slate-100 text-slate-500'
                                : isFull
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {d.assigned_teachers_count || 0} / {d.required_teachers || 1} Staff
                            </span>
                            {d.is_locked && (
                              <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                                🔒 Locked
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Location / Area info */}
                        {(d.area_name || d.break_period_name || d.block_name || d.location_hierarchy) && (
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 space-y-0.5">
                            {d.block_name && (
                              <p className="font-bold flex items-center gap-1 text-purple-900">
                                <span>🏢</span> Block: {d.block_name}
                              </p>
                            )}
                            {d.location_hierarchy ? (
                              <p className="font-semibold text-slate-600 flex items-center gap-1 truncate" title={d.location_hierarchy}>
                                <span>📍</span> {d.location_hierarchy}
                              </p>
                            ) : d.area_name ? (
                              <p className="font-bold flex items-center gap-1">
                                <span>📍</span> {d.area_name} {d.area_code ? `(${d.area_code})` : ''}
                              </p>
                            ) : null}
                            {d.break_period_name && (
                              <p className="text-[11px] text-slate-500 font-medium">Break Period: {d.break_period_name}</p>
                            )}
                          </div>
                        )}

                        {/* Assigned Staff Chips */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned Faculty</span>
                          {(!d.assignments || d.assignments.length === 0) ? (
                            <p className="text-xs text-slate-400 italic py-1">No faculty assigned yet</p>
                          ) : (
                            <div className="space-y-1.5">
                              {d.assignments.map((a) => (
                                <div key={a.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50/80 border border-slate-100 text-xs">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                                    <div className="truncate">
                                      <span className="font-extrabold text-slate-800">{a.teacher_name}</span>
                                      {a.role && a.role !== 'GENERAL' && (
                                        <span className="ml-1.5 text-[9px] font-bold text-indigo-600 uppercase">({a.role})</span>
                                      )}
                                    </div>
                                  </div>

                                  {!readOnly && (
                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                      <button
                                        onClick={() => handleOpenOverrideModal(d, a)}
                                        title="Reassign to another teacher"
                                        disabled={isDeactivated}
                                        className="px-1.5 py-0.5 text-[10px] font-bold text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 rounded disabled:opacity-40"
                                      >
                                        Reassign
                                      </button>
                                      <button
                                        onClick={() => setActionModal({ type: 'replace', duty: d, assignment: a })}
                                        title="Report staff unavailable & replace"
                                        disabled={isDeactivated}
                                        className="px-1.5 py-0.5 text-[10px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded disabled:opacity-40"
                                      >
                                        Replace
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Actions Footer */}
                        {!readOnly && (
                          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1 flex-wrap">
                              <button
                                onClick={() => handleToggleLock(d)}
                                disabled={actionLoading}
                                title={d.is_locked ? 'Unlock duty to allow edits' : 'Lock duty to prevent auto-changes'}
                                className={`text-[11px] font-bold px-2 py-1.5 rounded-lg border transition-all ${
                                  d.is_locked ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {d.is_locked ? '🔓 Unlock' : '🔒 Lock'}
                              </button>

                              <button
                                onClick={() => handleResetDuty(d)}
                                disabled={actionLoading || d.is_locked}
                                title="Clear assigned faculty (0/N)"
                                className="text-[11px] font-bold px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all disabled:opacity-50"
                              >
                                🔄 Reset
                              </button>

                              <button
                                onClick={() => handleToggleDutyActive(d)}
                                disabled={actionLoading}
                                title={isDeactivated ? 'Reactivate this duty' : 'Deactivate this duty'}
                                className={`text-[11px] font-bold px-2 py-1.5 rounded-lg border transition-all ${
                                  isDeactivated
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                }`}
                              >
                                {isDeactivated ? '✅' : '🚫'}
                              </button>

                              <button
                                onClick={() => handleDeleteDuty(d)}
                                disabled={actionLoading}
                                title="Delete this duty"
                                className="text-[11px] font-bold px-2 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all disabled:opacity-50"
                              >
                                🗑️
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => openCandidatePicker(d)}
                                disabled={actionLoading || d.is_locked || isDeactivated}
                                className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-all disabled:opacity-50"
                              >
                                Pick Staff...
                              </button>

                              <button
                                onClick={() => handleAutoAssign(d.id)}
                                disabled={actionLoading || isFull || d.is_locked || isDeactivated}
                                className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-all disabled:opacity-50"
                              >
                                ⚡ Auto-Fill
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── CANDIDATE PICKER MODAL (Scoring & Explainability) ── */}
      {candidateModalDuty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-100">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  Eligible Candidate Picker
                </span>
                <h2 className="text-lg font-black text-slate-900 mt-1">{candidateModalDuty.title}</h2>
                <p className="text-xs text-slate-500 font-semibold">
                  Select a faculty member ranked by attendance, conflict checks & preceding free period advantage.
                </p>
                <div className="mt-2 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200/70 rounded-xl px-2.5 py-1.5 flex items-center gap-1.5">
                  <span className="text-xs">💡</span>
                  <span>Faculty pending check-in can be assigned now. If absent at duty cutoff (9:00 AM / 10m before), system auto-swaps to next present staff.</span>
                </div>
              </div>
              <button
                onClick={() => setCandidateModalDuty(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Filter Tabs */}
            {candidateData?.candidates?.length > 0 && (
              <div className="flex items-center gap-1.5 pb-1">
                {[
                  { id: 'all', label: `All Candidates (${candidateData.candidates.length})` },
                  { id: 'checked_in', label: `✓ Checked In (${candidateData.candidates.filter(c => c.present_today && c.is_eligible).length})` },
                  { id: 'pending', label: `⏳ Pending Check-in (${candidateData.candidates.filter(c => !c.present_today && c.is_eligible).length})` },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setCandidateFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      candidateFilter === tab.id
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            <div className="overflow-y-auto flex-1 space-y-3 pr-1">
              {candidatesLoading ? (
                <div className="py-12 flex justify-center"><Spinner /></div>
              ) : !candidateData?.candidates?.length ? (
                <p className="text-xs text-slate-400 text-center py-8">No eligible faculty found for this timeslot.</p>
              ) : (
                candidateData.candidates
                  .filter((c) => {
                    if (candidateFilter === 'checked_in') return c.present_today && c.is_eligible
                    if (candidateFilter === 'pending') return !c.present_today && c.is_eligible
                    return true
                  })
                  .map((c) => (
                    <div
                      key={c.teacher_id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        c.is_eligible
                          ? 'bg-white border-slate-200 hover:border-indigo-400 shadow-sm'
                          : 'bg-slate-50/60 border-slate-100 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-sm text-slate-900">{c.teacher_name}</span>
                            {c.present_today ? (
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-emerald-100 text-emerald-800">
                                ✓ Checked In
                              </span>
                            ) : c.is_eligible ? (
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-amber-100 text-amber-800" title="Pending check-in. Auto-swapped if absent at cutoff.">
                                ⏳ Pending Check-in
                              </span>
                            ) : null}
                            {c.free_before_break && (
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-emerald-100 text-emerald-800">
                                ⚡ Free Pre-Break Slot
                              </span>
                            )}
                            <span className="text-[10px] font-bold text-slate-400">{c.department_name}</span>
                          </div>

                          {/* Explainable Reasons */}
                          {c.is_eligible ? (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {c.reasons.map((r, i) => (
                                <span
                                  key={i}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                    r.includes('Pending check-in')
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200/50'
                                      : r.includes('Checked in')
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {r.includes('Pending check-in') ? '⏳' : '✓'} {r}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs font-bold text-rose-600 mt-1">
                              ✕ Excluded: {c.exclusion_reason}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span className={`text-xs font-black ${c.is_eligible ? 'text-indigo-600' : 'text-slate-400'}`}>
                            Score: {c.score}
                          </span>
                          {c.is_eligible && (
                            <button
                              onClick={() => handleManualAssign(c.teacher_id)}
                              disabled={actionLoading}
                              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all active:scale-95"
                            >
                              Assign
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── DISCIPLINE DUTY GENERATION MODAL (Block & Staff specified by Principal) ── */}
      {disciplineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
            <div className="px-6 py-5 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-xl shadow-inner">
                  🛡️
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">Generate Block Discipline Duties</h3>
                  <p className="text-xs text-indigo-200 mt-0.5">Campus Block Faculty Gathering & Automated Balancing</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDisciplineModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold transition-all"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateDiscipline} className="p-6 space-y-4">
              <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-start gap-2.5">
                <span className="text-lg">💡</span>
                <p className="text-xs text-indigo-900 font-medium leading-relaxed">
                  A discipline duty belongs to a physical <strong>Campus Block</strong>. FaFlow automatically discovers all faculty belonging to departments located in that block, filters them through existing eligibility rules (attendance, leaves, timetable collisions), balances workload, and assigns the required number of staff.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Target Date
                </label>
                <input
                  type="date"
                  value={disciplineForm.target_date || selectedDate}
                  onChange={e => setDisciplineForm(prev => ({ ...prev, target_date: e.target.value }))}
                  required
                  className="w-full px-3.5 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-600 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Campus Block
                </label>
                <select
                  value={disciplineForm.block_id}
                  onChange={e => setDisciplineForm(prev => ({ ...prev, block_id: e.target.value }))}
                  className="w-full px-3.5 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-600 focus:outline-none transition-all"
                >
                  <option value="">🏢 All Active Campus Blocks (Campus-wide)</option>
                  {blocks.map(b => (
                    <option key={b.id} value={b.id}>
                      🏢 {b.name} ({b.code}) {b.department ? `· Dept: ${b.department.name}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Select a specific block, or generate duties across all campus blocks simultaneously.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Required Staff Count (Specified by Principal)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={disciplineForm.required_teachers}
                    onChange={e => setDisciplineForm(prev => ({ ...prev, required_teachers: Math.max(1, Math.min(10, Number(e.target.value))) }))}
                    required
                    className="w-28 px-3.5 py-2.5 text-sm font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-600 focus:outline-none transition-all text-center"
                  />
                  <div className="text-xs text-slate-500">
                    <p className="font-bold text-slate-700">Staff members per break period</p>
                    <p className="text-[10px] text-slate-400">FaFlow will assign exactly this number of eligible faculty.</p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="auto_assign_toggle"
                  checked={disciplineForm.auto_assign}
                  onChange={e => setDisciplineForm(prev => ({ ...prev, auto_assign: e.target.checked }))}
                  className="w-4 h-4 mt-0.5 accent-indigo-600 rounded cursor-pointer"
                />
                <label htmlFor="auto_assign_toggle" className="cursor-pointer">
                  <p className="text-xs font-bold text-slate-800">
                    Automatically gather & assign eligible faculty
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Gathers faculty from departments located in that block, filters for leaves & timetable conflicts, balances workload, and assigns immediately.
                  </p>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDisciplineModalOpen(false)}
                  disabled={actionLoading}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  {actionLoading ? '⏳ Generating...' : disciplineForm.auto_assign ? '🛡️ Generate & Assign Staff' : '🛡️ Generate Duties'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── OVERRIDE / REPLACE MODAL ── */}
      {actionModal && (actionModal.type === 'override' || actionModal.type === 'replace') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-100">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            <h3 className="font-extrabold text-base text-slate-900">
              {actionModal.type === 'override' ? 'Administrative Duty Override' : 'Report Unavailable & Replace'}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Current Assigned: <span className="font-bold text-slate-800">{actionModal.assignment?.teacher_name}</span>
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Reason</label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Medical emergency, urgent institutional meeting..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {actionModal.type === 'override' && (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Replace With (Faculty Only)</label>
                  {overrideCandidates.length > 0 ? (
                    <select
                      value={selectedTeacherId}
                      onChange={(e) => setSelectedTeacherId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">— Select a faculty member —</option>
                      {overrideCandidates
                        .filter(c => c.teacher_id !== actionModal.assignment?.teacher_id)
                        .map(c => (
                          <option key={c.teacher_id} value={c.teacher_id}>
                            {c.teacher_name}{c.department_name ? ` (${c.department_name})` : ''}{!c.is_eligible ? ' ⚠ Ineligible' : ''}
                          </option>
                        ))
                      }
                    </select>
                  ) : (
                    <p className="text-[11px] text-slate-400 py-2">Loading faculty list…</p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">⚠ Ineligible faculty are shown for administrative override only — check leave/attendance before confirming.</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setActionModal(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={actionModal.type === 'override' ? handleExecuteOverride : handleExecuteReplace}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20"
              >
                Confirm {actionModal.type === 'override' ? 'Reassign' : 'Replace'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE CUSTOM DUTY MODAL ── */}
      {actionModal && actionModal.type === 'create' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-100">
          <form onSubmit={handleCreateDutySubmit} className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            <h3 className="font-extrabold text-base text-slate-900">Create Campus Duty</h3>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Duty Type</label>
                <select
                  value={createForm.duty_type}
                  onChange={(e) => setCreateForm({ ...createForm, duty_type: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  <option value="WING_DUTY">Wing Duty (Corridor / Block)</option>
                  <option value="DISCIPLINE_DUTY">Discipline Duty</option>
                  <option value="EXAM_DUTY">Exam Invigilation Duty</option>
                  <option value="SPECIAL_DUTY">Special Campus Duty</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Science Block Corridor 2nd Floor"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={createForm.duty_date}
                    onChange={(e) => setCreateForm({ ...createForm, duty_date: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Required Faculty</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={createForm.required_teachers}
                    onChange={(e) => setCreateForm({ ...createForm, required_teachers: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={createForm.start_time}
                    onChange={(e) => setCreateForm({ ...createForm, start_time: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={createForm.end_time}
                    onChange={(e) => setCreateForm({ ...createForm, end_time: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Campus Area / Location</label>
                <select
                  value={createForm.area_id}
                  onChange={(e) => setCreateForm({ ...createForm, area_id: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  <option value="">No specific area assigned</option>
                  {areas.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
              >
                Create Duty
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── SLIDE-OVER CONFIGURATION DRAWER (Break Periods, Auto-Replace, Rules) ── */}
      {configDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-xl bg-white shadow-2xl border-l border-slate-200 flex flex-col">
              {/* Drawer Header */}
              <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black flex items-center gap-2">
                    <span>⚙️</span> Duty Governance & Configuration
                  </h3>
                  <p className="text-xs text-indigo-200 mt-0.5">Rules, break schedules & auto-reassignment settings</p>
                </div>
                <button
                  onClick={() => setConfigDrawerOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold transition-all"
                >
                  ✕
                </button>
              </div>

              {/* Drawer Tabs */}
              <div className="flex border-b border-slate-200 px-6 bg-slate-50">
                {[
                  { id: 'rules', label: '📋 Assignment Rules' },
                  { id: 'breaks', label: '🕐 Break Periods' },
                  { id: 'sweep', label: '🤖 Auto-Reassignment' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setConfigActiveTab(tab.id)}
                    className={`py-3 px-3 text-xs font-bold border-b-2 transition-all ${
                      configActiveTab === tab.id
                        ? 'border-indigo-600 text-indigo-700 bg-white'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {configMsg && (
                  <div className={`p-3 rounded-2xl text-xs font-bold flex items-center justify-between ${
                    configMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    <span>{configMsg.type === 'success' ? '✅' : '❌'} {configMsg.text}</span>
                    <button onClick={() => setConfigMsg(null)} className="ml-2 hover:opacity-70">✕</button>
                  </div>
                )}

                {rulesLoading ? (
                  <div className="py-12 flex justify-center"><Spinner /></div>
                ) : configActiveTab === 'rules' ? (
                  /* ── Tab 1: Rules ── */
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500">
                      Configure institutional workload limits and scoring heuristics applied when assigning faculty.
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: 'default_daily_duty_limit', label: 'Max Duties / Staff / Day', min: 1, max: 5 },
                        { key: 'default_weekly_duty_limit', label: 'Max Duties / Staff / Week', min: 1, max: 15 },
                        { key: 'max_discipline_teachers', label: 'Default Discipline Staff', min: 1, max: 10 },
                        { key: 'max_exam_duties', label: 'Max Exam Duties / Staff', min: 1, max: 20 },
                      ].map(({ key, label, min, max }) => (
                        <div key={key} className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{label}</label>
                          <input
                            type="number"
                            min={min}
                            max={max}
                            value={rulesForm[key] ?? ''}
                            onChange={e => setRulesForm(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                            className="w-full text-base font-black text-slate-900 bg-transparent border-0 focus:outline-none p-0 mt-1"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      {[
                        { key: 'prefer_free_before_break', label: 'Prefer faculty with free pre-break slot (+50 pts)' },
                        { key: 'auto_assignment_enabled', label: 'Enable automated assignment engine' },
                        { key: 'auto_replacement_enabled', label: 'Enable auto-replacement for absent staff' },
                        { key: 'cross_department_assignment', label: 'Allow cross-department duty assignments' },
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-xs font-bold text-slate-700">{label}</span>
                          <button
                            type="button"
                            onClick={() => setRulesForm(prev => ({ ...prev, [key]: !prev[key] }))}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${rulesForm[key] ? 'bg-indigo-600' : 'bg-slate-300'}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${rulesForm[key] ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="pt-3 flex items-center gap-2">
                      <button
                        onClick={() => setRulesForm(dutyRules)}
                        className="flex-1 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200"
                      >
                        Discard
                      </button>
                      <button
                        disabled={configSaving}
                        onClick={async () => {
                          setConfigSaving(true)
                          try {
                            const res = await campusDutiesApi.updateRules(rulesForm)
                            const updated = res?.data?.rules || res?.data || rulesForm
                            setDutyRules(updated)
                            setRulesForm(updated)
                            setConfigMsg({ type: 'success', text: 'Duty rules saved successfully.' })
                          } catch (e) {
                            setConfigMsg({ type: 'error', text: 'Rules save failed.' })
                          } finally {
                            setConfigSaving(false)
                          }
                        }}
                        className="flex-1 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm disabled:opacity-60"
                      >
                        Save Governance Rules
                      </button>
                    </div>
                  </div>
                ) : configActiveTab === 'breaks' ? (
                  /* ── Tab 2: Break Periods ── */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500">Supervision intervals across the college day.</p>
                      <button
                        onClick={async () => {
                          if (!confirm('Reset all break periods to factory defaults?')) return
                          setConfigSaving(true)
                          try {
                            const res = await campusDutiesApi.resetBreakPeriods()
                            setAllBreakPeriods(res?.data || [])
                            setBreakPeriods((res?.data || []).filter(b => b.is_active))
                            setConfigMsg({ type: 'success', text: 'Break periods reset to defaults.' })
                          } catch (e) { setConfigMsg({ type: 'error', text: 'Reset failed.' }) }
                          finally { setConfigSaving(false) }
                        }}
                        disabled={configSaving}
                        className="text-xs font-bold text-amber-600 hover:bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 transition-all"
                      >
                        🔄 Reset Defaults
                      </button>
                    </div>

                    <div className="space-y-2">
                      {allBreakPeriods.map(bp => (
                        <div key={bp.id} className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${bp.is_active ? 'bg-slate-50 border-slate-200' : 'bg-slate-50/50 border-slate-100 opacity-50'}`}>
                          <div>
                            <p className="text-xs font-extrabold text-slate-800">{bp.name}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {bp.start_time?.slice(0, 5)} – {bp.end_time?.slice(0, 5)} · {bp.required_teachers} staff · DO: {bp.applicable_day_orders}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => {
                                setEditingBreakPeriod(bp)
                                setBpForm({
                                  name: bp.name,
                                  start_time: bp.start_time?.slice(0, 5),
                                  end_time: bp.end_time?.slice(0, 5),
                                  required_teachers: bp.required_teachers,
                                  applicable_day_orders: bp.applicable_day_orders,
                                  is_active: bp.is_active
                                })
                              }}
                              className="px-2.5 py-1 text-xs font-bold text-indigo-600 bg-white border border-indigo-100 hover:bg-indigo-50 rounded-lg"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm(`Deactivate "${bp.name}"?`)) return
                                setConfigSaving(true)
                                try {
                                  await campusDutiesApi.deleteBreakPeriod(bp.id)
                                  setAllBreakPeriods(prev => prev.map(b => b.id === bp.id ? { ...b, is_active: false } : b))
                                  setBreakPeriods(prev => prev.filter(b => b.id !== bp.id))
                                  setConfigMsg({ type: 'success', text: `"${bp.name}" deactivated.` })
                                } catch (e) { setConfigMsg({ type: 'error', text: 'Deactivation failed.' }) }
                                finally { setConfigSaving(false) }
                              }}
                              disabled={!bp.is_active || configSaving}
                              className="p-1 text-xs text-rose-500 hover:bg-rose-50 rounded-lg disabled:opacity-30"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* ── Tab 3: Auto-Reassignment Sweep ── */
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      FaFlow monitors check-ins and absences. At <strong>09:00 AM</strong> and <strong>10 minutes before each break</strong>, absent faculty are automatically replaced with available staff.
                    </p>

                    <div className="grid grid-cols-3 gap-2">
                      {[
                        ['Morning Cutoff', '09:00 AM', 'All duties'],
                        ['Pre-Break', '10 min prior', 'Per break slot'],
                        ['Scheduler', 'Every 10 min', 'Auto-sweep engine'],
                      ].map(([l, v, sub]) => (
                        <div key={l} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{l}</p>
                          <p className="text-sm font-black text-slate-800 mt-0.5">{v}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5">{sub}</p>
                        </div>
                      ))}
                    </div>

                    {autoReplaceResult && (
                      <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 space-y-2">
                        <p className="font-black">{autoReplaceResult.message}</p>
                        {autoReplaceResult.results?.length > 0 && (
                          <div className="space-y-1">
                            {autoReplaceResult.results.map((r, i) => (
                              <p key={i} className="text-emerald-700">
                                ↔ <strong>{r.replaced_teacher_name}</strong> → <strong>{r.new_teacher_name}</strong> ({r.duty_title})
                              </p>
                            ))}
                          </div>
                        )}
                        {autoReplaceResult.unfilled_after > 0 && (
                          <p className="text-amber-700 font-bold">⚠️ {autoReplaceResult.unfilled_after} slot(s) unfilled (no eligible candidate available).</p>
                        )}
                      </div>
                    )}

                    <button
                      disabled={autoReplaceLoading}
                      onClick={async () => {
                        setAutoReplaceLoading(true)
                        setAutoReplaceResult(null)
                        try {
                          const res = await campusDutiesApi.triggerAutoReplace(selectedDate)
                          setAutoReplaceResult(res?.data)
                          await fetchData()
                        } catch (e) {
                          setConfigMsg({ type: 'error', text: 'Sweep execution failed.' })
                        } finally {
                          setAutoReplaceLoading(false)
                        }
                      }}
                      className="w-full py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60"
                    >
                      {autoReplaceLoading ? '⌛ Running Sweep...' : '🔄 Run Auto-Replace Sweep Now'}
                    </button>
                    <p className="text-[11px] text-slate-400 text-center">Executing sweep for {selectedDate}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BREAK PERIOD EDIT MODAL ── */}
      {editingBreakPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-900">Edit: {editingBreakPeriod.name}</h4>
              <button onClick={() => setEditingBreakPeriod(null)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>
            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Name</label>
                <input
                  value={bpForm.name || ''}
                  onChange={e => setBpForm({...bpForm, name: e.target.value})}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Start</label>
                  <input
                    type="time"
                    value={bpForm.start_time || ''}
                    onChange={e => setBpForm({...bpForm, start_time: e.target.value})}
                    className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">End</label>
                  <input
                    type="time"
                    value={bpForm.end_time || ''}
                    onChange={e => setBpForm({...bpForm, end_time: e.target.value})}
                    className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Staff Required</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={bpForm.required_teachers || 1}
                    onChange={e => setBpForm({...bpForm, required_teachers: Number(e.target.value)})}
                    className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Day Orders</label>
                  <input
                    value={bpForm.applicable_day_orders || '1,2,3,4,5,6'}
                    onChange={e => setBpForm({...bpForm, applicable_day_orders: e.target.value})}
                    className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="bp-active"
                  checked={!!bpForm.is_active}
                  onChange={e => setBpForm({...bpForm, is_active: e.target.checked})}
                  className="w-4 h-4 accent-indigo-600 rounded"
                />
                <label htmlFor="bp-active" className="text-xs font-bold text-slate-700">Active Break Period</label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={() => setEditingBreakPeriod(null)} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl">
                Cancel
              </button>
              <button
                disabled={configSaving}
                onClick={async () => {
                  setConfigSaving(true)
                  try {
                    const res = await campusDutiesApi.updateBreakPeriod(editingBreakPeriod.id, bpForm)
                    setAllBreakPeriods(prev => prev.map(b => b.id === editingBreakPeriod.id ? res.data : b))
                    setBreakPeriods(prev => prev.map(b => b.id === editingBreakPeriod.id ? res.data : b).filter(b => b.is_active))
                    setEditingBreakPeriod(null)
                    setConfigMsg({ type: 'success', text: `"${res.data.name}" updated.` })
                  } catch (e) {
                    setConfigMsg({ type: 'error', text: 'Update failed.' })
                  } finally {
                    setConfigSaving(false)
                  }
                }}
                className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
