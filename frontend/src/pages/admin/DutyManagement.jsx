import { useState, useEffect, useMemo, useCallback } from 'react'
import { campusDutiesApi, departmentsApi } from '../../api/services'
import { Card, Spinner, ErrorAlert, Modal, Badge } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'

export default function DutyManagement({ readOnly = false }) {
  const { user } = useAuth()
  const isPrincipalOrAdmin = user?.role === 'system_admin' || user?.is_system_admin || user?.role === 'principal'

  const [activeTab, setActiveTab] = useState('today') // today, upcoming, discipline, wing, exam, all
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [duties, setDuties] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [areas, setAreas] = useState([])
  const [breakPeriods, setBreakPeriods] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState(null)

  // 6 Day Orders Autonomous Schedule State
  const [autonomousEnabled, setAutonomousEnabled] = useState(false)
  const [dayOrders, setDayOrders] = useState([])
  const [selectedDayOrderIndex, setSelectedDayOrderIndex] = useState(0) // 0..5 or -1 for all
  const [togglingAutonomous, setTogglingAutonomous] = useState(false)
  const [autonomousResult, setAutonomousResult] = useState(null)

  // Configuration panel state
  const [configOpen, setConfigOpen] = useState(false)
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

  // Candidate Picker Modal
  const [candidateModalDuty, setCandidateModalDuty] = useState(null)
  const [candidateData, setCandidateData] = useState(null)
  const [candidatesLoading, setCandidatesLoading] = useState(false)

  // Override / Replace Modal
  const [actionModal, setActionModal] = useState(null) // { type: 'override'|'replace'|'lock'|'create', duty, assignment }
  const [overrideReason, setOverrideReason] = useState('')
  const [selectedTeacherId, setSelectedTeacherId] = useState('')

  // Create Duty Modal
  const [createForm, setCreateForm] = useState({
    duty_type: 'WING_DUTY',
    title: '',
    duty_date: new Date().toISOString().split('T')[0],
    start_time: '10:00',
    end_time: '11:00',
    area_id: '',
    required_teachers: 1
  })

  // Load next 6 day orders & autonomous setting status
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
      } else if (activeTab === 'today') {
        params.target_date = selectedDate
      }
      const [dutiesRes, metricsRes, areasRes, bpRes] = await Promise.all([
        campusDutiesApi.listDuties(params),
        campusDutiesApi.getMetrics({ target_date: selectedDate }),
        campusDutiesApi.getAreas(),
        campusDutiesApi.getBreakPeriods()
      ])
      setDuties(dutiesRes?.data || [])
      setMetrics(metricsRes?.data || null)
      setAreas(areasRes?.data || [])
      setBreakPeriods(bpRes?.data || [])
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to load duty management data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [activeTab, selectedDate, selectedDayOrderIndex])

  // Filtered duties
  const filteredDuties = useMemo(() => {
    if (selectedDayOrderIndex === -1) {
      if (activeTab === 'discipline') return duties.filter(d => d.duty_type === 'DISCIPLINE_DUTY')
      if (activeTab === 'wing') return duties.filter(d => d.duty_type === 'WING_DUTY')
      if (activeTab === 'exam') return duties.filter(d => d.duty_type === 'EXAM_DUTY')
      return duties
    }
    if (activeTab === 'today') {
      return duties.filter(d => d.duty_date === selectedDate)
    } else if (activeTab === 'upcoming') {
      const todayStr = new Date().toISOString().split('T')[0]
      return duties.filter(d => d.duty_date > todayStr)
    } else if (activeTab === 'discipline') {
      return duties.filter(d => d.duty_type === 'DISCIPLINE_DUTY' && (selectedDate ? d.duty_date === selectedDate : true))
    } else if (activeTab === 'wing') {
      return duties.filter(d => d.duty_type === 'WING_DUTY' && (selectedDate ? d.duty_date === selectedDate : true))
    } else if (activeTab === 'exam') {
      return duties.filter(d => d.duty_type === 'EXAM_DUTY' && (selectedDate ? d.duty_date === selectedDate : true))
    }
    return duties
  }, [duties, activeTab, selectedDate, selectedDayOrderIndex])

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

  // Day Order Selection Handler
  const handleSelectDayOrder = (index) => {
    setSelectedDayOrderIndex(index)
    if (index >= 0 && dayOrders[index]) {
      setSelectedDate(dayOrders[index].date)
      if (activeTab !== 'today') {
        setActiveTab('today')
      }
    }
  }

  // Handlers
  const handleGenerateDiscipline = async () => {
    setActionLoading(true)
    try {
      await campusDutiesApi.generateDiscipline({ target_date: selectedDate })
      await fetchData()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to generate discipline duties')
    } finally {
      setActionLoading(false)
    }
  }

  const handleGenerateWingDuties = async () => {
    setActionLoading(true)
    try {
      const res = await campusDutiesApi.generateWingDuties({ target_date: selectedDate })
      alert(`Wing duties generated from campus floors! Created: ${res?.data?.created_count ?? 0}`)
      await fetchData()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to generate wing duties')
    } finally {
      setActionLoading(false)
    }
  }

  const handleGenerateExamDuties = async () => {
    const session = prompt('Enter Exam Session (FN or AN):', 'FN')
    if (!session) return
    setActionLoading(true)
    try {
      const res = await campusDutiesApi.generateExamDuties({
        target_date: selectedDate,
        session: session.trim().toUpperCase(),
      })
      alert(`Exam duties generated from exam-eligible classrooms! Created: ${res?.data?.created_count ?? 0}`)
      await fetchData()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to generate exam duties')
    } finally {
      setActionLoading(false)
    }
  }

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

  const handleAutoAssignAll = async () => {
    if (!confirm(`Auto-assign all unfilled duties for ${selectedDate}?`)) return
    setActionLoading(true)
    try {
      const res = await campusDutiesApi.autoAssignAll({ target_date: selectedDate })
      alert(`Auto-assignment completed! Assigned: ${res?.data?.total_assigned}, Unfilled: ${res?.data?.total_unfilled}`)
      await fetchData()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Auto-assignment failed')
    } finally {
      setActionLoading(false)
    }
  }

  const openCandidatePicker = async (duty) => {
    setCandidateModalDuty(duty)
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
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Campus Duty Management</h1>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
            Discipline · Wing Supervision · Exam Invigilation · Governance
          </p>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleGenerateDiscipline}
              disabled={actionLoading}
              title="Generate Discipline Duties from Campus Blocks"
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <span>🛡️</span> Discipline Duties
            </button>
            <button
              onClick={handleGenerateWingDuties}
              disabled={actionLoading}
              title="Generate Wing Supervision Duties from Campus Floors"
              className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-200 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <span>🏢</span> Wing Duties
            </button>
            <button
              onClick={handleGenerateExamDuties}
              disabled={actionLoading}
              title="Generate Invigilation Duties from Exam-Eligible Classrooms"
              className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl border border-purple-200 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <span>📝</span> Exam Duties
            </button>
            <button
              onClick={handleAutoAssignAll}
              disabled={actionLoading}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/20 active:scale-95"
            >
              Auto-Assign All
            </button>
            <button
              onClick={() => setActionModal({ type: 'create' })}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95"
            >
              + Create Duty
            </button>
          </div>
        )}
      </div>

      {/* ── Compact Configuration Panel (top, collapsible) ─────────────── */}
      {isPrincipalOrAdmin && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Toggle row */}
          <button
            onClick={() => {
              const next = !configOpen
              setConfigOpen(next)
              if (next && !dutyRules) {
                setRulesLoading(true)
                Promise.all([
                  campusDutiesApi.getRules(),
                  campusDutiesApi.getBreakPeriods({ is_active_only: false })
                ]).then(([rRes, bpRes]) => {
                  const r = rRes?.data || {}
                  setDutyRules(r)
                  setRulesForm(r)
                  setAllBreakPeriods(bpRes?.data || [])
                }).catch(() => {}).finally(() => setRulesLoading(false))
              }
            }}
            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors group"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">⚙️</span>
              <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Duty Configuration</span>
              <span className="text-[10px] font-semibold text-slate-400">(break periods · auto-replace · rules)</span>
            </div>
            <span className={`text-slate-400 text-xs font-bold transition-transform ${configOpen ? 'rotate-180' : ''}`}>▼</span>
          </button>

          {configOpen && (
            <div className="border-t border-slate-100">
              {configMsg && (
                <div className={`mx-4 mt-3 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between ${configMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                  <span>{configMsg.type === 'success' ? '✅' : '❌'} {configMsg.text}</span>
                  <button onClick={() => setConfigMsg(null)} className="ml-2 opacity-60 hover:opacity-100">✕</button>
                </div>
              )}

              {rulesLoading ? (
                <div className="py-6 flex justify-center"><Spinner /></div>
              ) : (
                <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">

                  {/* ── Col 1: Break Periods ── */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">🕐 Break Periods</span>
                      <button
                        onClick={async () => {
                          if (!confirm('Reset all break periods to factory defaults?')) return
                          setConfigSaving(true)
                          try {
                            const res = await campusDutiesApi.resetBreakPeriods()
                            setAllBreakPeriods(res?.data || [])
                            setBreakPeriods((res?.data || []).filter(b => b.is_active))
                            setConfigMsg({ type: 'success', text: 'Reset to defaults.' })
                          } catch (e) { setConfigMsg({ type: 'error', text: 'Reset failed.' }) }
                          finally { setConfigSaving(false) }
                        }}
                        disabled={configSaving}
                        className="text-[10px] font-bold text-amber-600 hover:text-amber-800 px-2 py-0.5 rounded-lg hover:bg-amber-50 border border-amber-200 transition-all"
                      >🔄 Reset</button>
                    </div>
                    <div className="space-y-1">
                      {allBreakPeriods.length === 0 ? (
                        <p className="text-[10px] text-slate-400 py-2">No break periods. Click Reset.</p>
                      ) : allBreakPeriods.map(bp => (
                        <div key={bp.id} className={`flex items-center justify-between gap-1 px-2.5 py-1.5 rounded-xl border text-xs ${bp.is_active ? 'bg-slate-50 border-slate-100' : 'bg-slate-50/50 border-slate-100 opacity-40'}`}>
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-slate-700 truncate block">{bp.name}</span>
                            <span className="text-[10px] text-slate-400">{bp.start_time?.slice(0,5)}–{bp.end_time?.slice(0,5)} · {bp.required_teachers} staff</span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => { setEditingBreakPeriod(bp); setBpForm({ name: bp.name, start_time: bp.start_time?.slice(0,5), end_time: bp.end_time?.slice(0,5), required_teachers: bp.required_teachers, applicable_day_orders: bp.applicable_day_orders, is_active: bp.is_active }) }}
                              className="text-indigo-600 hover:bg-indigo-50 px-1.5 py-0.5 rounded-lg font-bold text-[10px] border border-indigo-100"
                            >✏️</button>
                            <button
                              onClick={async () => {
                                if (!confirm(`Deactivate "${bp.name}"?`)) return
                                setConfigSaving(true)
                                try {
                                  await campusDutiesApi.deleteBreakPeriod(bp.id)
                                  setAllBreakPeriods(prev => prev.map(b => b.id === bp.id ? { ...b, is_active: false } : b))
                                  setBreakPeriods(prev => prev.filter(b => b.id !== bp.id))
                                  setConfigMsg({ type: 'success', text: `"${bp.name}" deactivated.` })
                                } catch (e) { setConfigMsg({ type: 'error', text: 'Delete failed.' }) }
                                finally { setConfigSaving(false) }
                              }}
                              disabled={!bp.is_active || configSaving}
                              className="text-red-400 hover:bg-red-50 px-1.5 py-0.5 rounded-lg font-bold text-[10px] border border-red-100 disabled:opacity-30"
                            >🗑</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Col 2: Auto-Replace ── */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">🤖 Auto-Reassignment</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[['Morning Cutoff', '09:00 AM'], ['Pre-Break', '10 min before'], ['Schedule', 'Every 10 min']].map(([l, v]) => (
                        <div key={l} className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-center">
                          <p className="text-[9px] font-bold text-slate-400 uppercase">{l}</p>
                          <p className="text-xs font-black text-slate-800 mt-0.5 leading-tight">{v}</p>
                        </div>
                      ))}
                    </div>
                    {autoReplaceResult && (
                      <div className="px-2.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-bold">
                        {autoReplaceResult.message}
                        {autoReplaceResult.results?.map((r, i) => (
                          <div key={i} className="text-[10px] text-emerald-700 mt-0.5">↔ {r.replaced_teacher_name} → {r.new_teacher_name}</div>
                        ))}
                        {autoReplaceResult.unfilled_after > 0 && (
                          <div className="text-[10px] text-amber-700 mt-0.5">⚠️ {autoReplaceResult.unfilled_after} unfilled</div>
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
                        } catch (e) { setConfigMsg({ type: 'error', text: 'Sweep failed.' }) }
                        finally { setAutoReplaceLoading(false) }
                      }}
                      className="w-full py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-60"
                    >
                      {autoReplaceLoading ? '⌛ Running...' : '🔄 Run Sweep Now'}
                    </button>
                    <p className="text-[10px] text-slate-400 text-center">for {selectedDate}</p>
                  </div>

                  {/* ── Col 3: Duty Rules ── */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">📋 Duty Rules</span>
                    {dutyRules && (
                      <>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { key: 'default_daily_duty_limit', label: 'Per Day' },
                            { key: 'default_weekly_duty_limit', label: 'Per Week' },
                            { key: 'max_discipline_teachers', label: 'Discipline Staff' },
                            { key: 'max_exam_duties', label: 'Exam Limit' },
                          ].map(({ key, label }) => (
                            <div key={key} className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                              <label className="text-[9px] font-bold text-slate-400 uppercase block">{label}</label>
                              <input
                                type="number" min="1" max="20"
                                value={rulesForm[key] ?? ''}
                                onChange={e => setRulesForm(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                                className="w-full text-sm font-black text-slate-900 bg-transparent border-0 focus:outline-none p-0 mt-0.5"
                              />
                            </div>
                          ))}
                        </div>
                        <div className="space-y-1">
                          {[
                            { key: 'prefer_free_before_break', label: 'Prefer free-before-break' },
                            { key: 'auto_assignment_enabled', label: 'Auto-assignment' },
                            { key: 'auto_replacement_enabled', label: 'Auto-replacement' },
                            { key: 'cross_department_assignment', label: 'Cross-dept assign' },
                          ].map(({ key, label }) => (
                            <div key={key} className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-slate-50">
                              <span className="text-[11px] font-semibold text-slate-600">{label}</span>
                              <button
                                onClick={() => setRulesForm(prev => ({ ...prev, [key]: !prev[key] }))}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${rulesForm[key] ? 'bg-indigo-600' : 'bg-slate-300'}`}
                              >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${rulesForm[key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setRulesForm(dutyRules)} className="flex-1 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-slate-100 rounded-xl border border-slate-200">Discard</button>
                          <button
                            disabled={configSaving}
                            onClick={async () => {
                              setConfigSaving(true)
                              try {
                                const res = await campusDutiesApi.updateRules(rulesForm)
                                const updated = res?.data?.rules || res?.data || rulesForm
                                setDutyRules(updated); setRulesForm(updated)
                                setConfigMsg({ type: 'success', text: 'Rules saved.' })
                              } catch (e) { setConfigMsg({ type: 'error', text: 'Save failed.' }) }
                              finally { setConfigSaving(false) }
                            }}
                            className="flex-1 py-1.5 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm disabled:opacity-60"
                          >Save Rules</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Break Period Edit Modal */}
      {editingBreakPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-900">Edit: {editingBreakPeriod.name}</h4>
              <button onClick={() => setEditingBreakPeriod(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Name</label>
                <input value={bpForm.name || ''} onChange={e => setBpForm({...bpForm, name: e.target.value})}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Start</label>
                  <input type="time" value={bpForm.start_time || ''} onChange={e => setBpForm({...bpForm, start_time: e.target.value})}
                    className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">End</label>
                  <input type="time" value={bpForm.end_time || ''} onChange={e => setBpForm({...bpForm, end_time: e.target.value})}
                    className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Staff Required</label>
                  <input type="number" min="1" max="20" value={bpForm.required_teachers || 1}
                    onChange={e => setBpForm({...bpForm, required_teachers: Number(e.target.value)})}
                    className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Day Orders</label>
                  <input value={bpForm.applicable_day_orders || '1,2,3,4,5,6'}
                    onChange={e => setBpForm({...bpForm, applicable_day_orders: e.target.value})}
                    className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="bp-active" checked={!!bpForm.is_active} onChange={e => setBpForm({...bpForm, is_active: e.target.checked})} className="w-3.5 h-3.5 accent-indigo-600" />
                <label htmlFor="bp-active" className="text-xs font-bold text-slate-600">Active</label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={() => setEditingBreakPeriod(null)} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl">Cancel</button>
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
                  } catch (e) { setConfigMsg({ type: 'error', text: 'Update failed.' }) }
                  finally { setConfigSaving(false) }
                }}
                className="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
              >Save</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-3xl p-5 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <h2 className="text-base font-black tracking-tight text-white">Autonomous 6-Day Order Duty Schedule</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 uppercase tracking-wider">
              {isPrincipalOrAdmin ? 'Principal & Admin Governance' : 'Institutional Automation'}
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            When enabled, FAFLOW automatically generates complete discipline and wing supervision duties across the next 6 Day Orders and auto-assigns available faculty without timetable conflicts.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-bold text-slate-300">
            Status: {autonomousEnabled ? <span className="text-emerald-400">ACTIVE · ON</span> : <span className="text-slate-400">OFF</span>}
          </span>
          <button
            onClick={handleToggleAutonomous}
            disabled={togglingAutonomous || !isPrincipalOrAdmin || readOnly}
            title={!isPrincipalOrAdmin ? 'Only Principal or System Admin can toggle this setting' : 'Toggle 6-Day Order Autonomous Scheduling'}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              autonomousEnabled ? 'bg-indigo-600' : 'bg-slate-700'
            } ${(!isPrincipalOrAdmin || readOnly) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                autonomousEnabled ? 'translate-x-8' : 'translate-x-1'
              } flex items-center justify-center text-[10px]`}
            >
              {togglingAutonomous ? '⌛' : (autonomousEnabled ? '✓' : '✕')}
            </span>
          </button>
        </div>
      </div>

      {/* Autonomous Activation Result Notification */}
      {autonomousResult && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-4 text-emerald-900 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="font-extrabold text-sm text-emerald-950">
                6-Day Duty Schedule Generated ({autonomousResult.schedule_from} → {autonomousResult.schedule_to})
              </p>
              <p className="text-xs text-emerald-700 mt-0.5">
                {autonomousResult.discipline_duties_count} discipline duties + {autonomousResult.wing_duties_count} wing duties created across {autonomousResult.num_day_orders} Day Orders. {autonomousResult.total_assigned} faculty auto-assigned ({autonomousResult.total_unfilled} unfilled).
              </p>
            </div>
          </div>
          <button
            onClick={() => setAutonomousResult(null)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 px-2 py-1 rounded-lg hover:bg-emerald-100"
          >
            ✕ Dismiss
          </button>
        </div>
      )}

      {/* 6 Day Orders Navigation Bar */}
      {dayOrders.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>📅</span> Next 6 Working Day Orders
            </span>
            <span className="text-[11px] font-semibold text-slate-400">
              Select any Day Order to inspect and customize duties
            </span>
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
                  className={`p-3 rounded-2xl border text-left transition-all relative ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/80 shadow-md ring-2 ring-indigo-500/20'
                      : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-black uppercase ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                      DO {doItem.day_order ?? (idx + 1)}
                    </span>
                    {doItem.is_today && (
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-primary-100 text-primary-700">
                        Today
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                    {doItem.formatted_date} · {doItem.day_name.slice(0, 3)}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[10px] font-bold">
                    <span className="text-slate-500">{doItem.total_duties} duties</span>
                    {isFilled ? (
                      <span className="text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-extrabold">✓ Full</span>
                    ) : hasUnfilled ? (
                      <span className="text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-extrabold">⚠️ {doItem.unfilled_duties} open</span>
                    ) : (
                      <span className="text-slate-400">Empty</span>
                    )}
                  </div>
                </button>
              )
            })}

            {/* All 6 Days Option */}
            <button
              onClick={() => handleSelectDayOrder(-1)}
              className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                selectedDayOrderIndex === -1
                  ? 'border-indigo-600 bg-indigo-50/80 shadow-md ring-2 ring-indigo-500/20'
                  : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50 shadow-sm'
              }`}
            >
              <div>
                <span className={`text-xs font-black uppercase ${selectedDayOrderIndex === -1 ? 'text-indigo-900' : 'text-slate-800'}`}>
                  All 6 Day Orders
                </span>
                <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                  Full 6-day window
                </p>
              </div>
              <span className="text-[10px] font-bold text-indigo-600 mt-2">
                Unified Overview →
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Top Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-sm">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Duties</span>
            <span className="text-2xl font-black text-slate-850 mt-1 block">{metrics.total_duties_today}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 shadow-sm">
            <span className="block text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Filled</span>
            <span className="text-2xl font-black text-emerald-850 mt-1 block">{metrics.filled_duties_today}</span>
          </div>
          <div className={`p-3.5 rounded-2xl border shadow-sm ${metrics.unfilled_duties_today > 0 ? 'bg-amber-50/80 border-amber-200 animate-pulse' : 'bg-white border-slate-100'}`}>
            <span className="block text-[10px] font-bold text-amber-700 uppercase tracking-wider">Unfilled</span>
            <span className="text-2xl font-black text-amber-900 mt-1 block">{metrics.unfilled_duties_today}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-sm">
            <span className="block text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Assigned Staff</span>
            <span className="text-2xl font-black text-indigo-900 mt-1 block">{metrics.teachers_assigned_today}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-sm">
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Discipline Cov.</span>
            <span className="text-xl font-black text-slate-800 mt-1 block">{metrics.discipline_coverage_pct}%</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-sm">
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Wing Cov.</span>
            <span className="text-xl font-black text-slate-800 mt-1 block">{metrics.wing_coverage_pct}%</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-sm">
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Locked</span>
            <span className="text-2xl font-black text-slate-700 mt-1 block">{metrics.locked_duties_today}</span>
          </div>
        </div>
      )}

      {/* Tabs & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'today', label: "Today's Schedule" },
            { id: 'upcoming', label: 'Upcoming Duties' },
            { id: 'discipline', label: 'Discipline' },
            { id: 'wing', label: 'Wing Duty' },
            { id: 'exam', label: 'Exam Duty' },
            { id: 'all', label: 'All History' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === t.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500">Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-2.5 py-1 text-xs font-bold bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Error state */}
      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Main List */}
      {loading ? (
        <div className="py-20 flex justify-center"><Spinner /></div>
      ) : filteredDuties.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
          <p className="text-sm font-bold text-slate-600">No campus duties scheduled for this selection</p>
          <p className="text-xs text-slate-400 mt-1">Click "Generate Today's Break Duties" or "+ Create Duty" above to initialize assignments.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDuties.map((d) => {
            const isFull = d.assigned_teachers_count >= d.required_teachers
            return (
              <div
                key={d.id}
                className={`rounded-2xl border bg-white p-5 space-y-4 shadow-sm transition-all hover:shadow-md ${
                  d.is_locked ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200/80'
                }`}
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {d.duty_type.replace('_', ' ')}
                      </span>
                      {d.day_order && (
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                          DO {d.day_order}
                        </span>
                      )}
                    </div>
                    <h3 className="font-extrabold text-sm text-slate-900 mt-1.5 leading-snug">{d.title}</h3>
                    <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                      {d.start_time.substring(0, 5)} – {d.end_time.substring(0, 5)} · {d.duty_date}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isFull ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {d.assigned_teachers_count} / {d.required_teachers} Staff
                    </span>
                    {d.is_locked && (
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                        🔒 Locked
                      </span>
                    )}
                  </div>
                </div>

                {/* Location / Area info */}
                {(d.area_name || d.break_period_name) && (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 space-y-0.5">
                    {d.area_name && (
                      <p className="font-bold flex items-center gap-1">
                        <span>📍</span> {d.area_name} {d.area_code ? `(${d.area_code})` : ''}
                      </p>
                    )}
                    {d.break_period_name && (
                      <p className="text-[11px] text-slate-500 font-medium">Break Schedule: {d.break_period_name}</p>
                    )}
                  </div>
                )}

                {/* Assigned Staff Chips */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned Faculty</span>
                  {d.assignments.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No faculty assigned yet</p>
                  ) : (
                    <div className="space-y-1.5">
                      {d.assignments.map((a) => (
                        <div key={a.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50/80 border border-slate-100 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-600" />
                            <div>
                              <span className="font-extrabold text-slate-800">{a.teacher_name}</span>
                              {a.role && a.role !== 'GENERAL' && (
                                <span className="ml-1.5 text-[9px] font-bold text-indigo-600 uppercase">({a.role})</span>
                              )}
                            </div>
                          </div>

                          {!readOnly && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setActionModal({ type: 'override', duty: d, assignment: a })}
                                title="Reassign/Override"
                                className="px-1.5 py-0.5 text-[10px] font-bold text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 rounded"
                              >
                                Reassign
                              </button>
                              <button
                                onClick={() => setActionModal({ type: 'replace', duty: d, assignment: a })}
                                title="Mark Unavailable & Replace"
                                className="px-1.5 py-0.5 text-[10px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded"
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
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleToggleLock(d)}
                      disabled={actionLoading}
                      className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                        d.is_locked ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {d.is_locked ? '🔓 Unlock' : '🔒 Lock'}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openCandidatePicker(d)}
                        disabled={actionLoading || d.is_locked}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-all disabled:opacity-50"
                      >
                        Pick Staff...
                      </button>

                      <button
                        onClick={() => handleAutoAssign(d.id)}
                        disabled={actionLoading || isFull || d.is_locked}
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
      )}

      {/* Candidate Picker Modal with "Why Selected?" Explainability */}
      {candidateModalDuty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  Eligible Candidate Picker
                </span>
                <h2 className="text-lg font-black text-slate-900 mt-1">{candidateModalDuty.title}</h2>
                <p className="text-xs text-slate-500 font-semibold">
                  Select a faculty member ranked by attendance, conflict checks & preceding free period advantage.
                </p>
              </div>
              <button
                onClick={() => setCandidateModalDuty(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-3 pr-1">
              {candidatesLoading ? (
                <div className="py-12 flex justify-center"><Spinner /></div>
              ) : !candidateData?.candidates?.length ? (
                <p className="text-xs text-slate-400 text-center py-8">No eligible faculty found for this timeslot.</p>
              ) : (
                candidateData.candidates.map((c) => (
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
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900">{c.teacher_name}</span>
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
                              <span key={i} className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                                ✓ {r}
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

      {/* Override / Replace Modal */}
      {actionModal && (actionModal.type === 'override' || actionModal.type === 'replace') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">New Teacher ID</label>
                  <input
                    type="number"
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    placeholder="Enter User ID of replacement faculty"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
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

      {/* Create Duty Modal */}
      {actionModal && actionModal.type === 'create' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
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

      {/* ── Configuration Panel ─────────────────────────────────────────── */}
      {activeTab === 'configuration' && isPrincipalOrAdmin && (
        <div className="space-y-5">
          {configMsg && (
            <div className={`p-3 rounded-2xl text-xs font-bold flex items-center justify-between ${configMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              <span>{configMsg.type === 'success' ? '✅' : '❌'} {configMsg.text}</span>
              <button onClick={() => setConfigMsg(null)} className="ml-3 hover:opacity-70">✕</button>
            </div>
          )}

          {/* ── Block 1: Break Period Configuration ── */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <span className="text-lg">🕐</span> Break Period Configuration
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Configure each campus break / supervision window</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (!confirm('Reset ALL break periods to factory defaults? This will delete custom periods.')) return
                    setConfigSaving(true)
                    try {
                      const res = await campusDutiesApi.resetBreakPeriods()
                      setAllBreakPeriods(res?.data || [])
                      setBreakPeriods((res?.data || []).filter(b => b.is_active))
                      setConfigMsg({ type: 'success', text: 'Break periods reset to factory defaults.' })
                    } catch (e) {
                      setConfigMsg({ type: 'error', text: e?.response?.data?.detail || 'Reset failed.' })
                    } finally { setConfigSaving(false) }
                  }}
                  disabled={configSaving}
                  className="px-3 py-1.5 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl transition-all"
                >
                  🔄 Reset to Defaults
                </button>
              </div>
            </div>

            {rulesLoading ? (
              <div className="py-10 flex justify-center"><Spinner /></div>
            ) : (
              <div className="divide-y divide-slate-50">
                {allBreakPeriods.length === 0 ? (
                  <p className="p-6 text-xs text-slate-400 text-center">No break periods configured. Click Reset to Defaults.</p>
                ) : (
                  allBreakPeriods.map(bp => (
                    <div key={bp.id} className={`px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${!bp.is_active ? 'opacity-40' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${bp.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <div>
                          <p className="text-sm font-black text-slate-800">{bp.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {bp.start_time?.slice(0,5)} – {bp.end_time?.slice(0,5)} · {bp.required_teachers} staff · Day Orders: {bp.applicable_day_orders}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => {
                            setEditingBreakPeriod(bp)
                            setBpForm({
                              name: bp.name,
                              start_time: bp.start_time?.slice(0,5),
                              end_time: bp.end_time?.slice(0,5),
                              required_teachers: bp.required_teachers,
                              applicable_day_orders: bp.applicable_day_orders,
                              is_active: bp.is_active
                            })
                          }}
                          className="px-3 py-1.5 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl transition-all"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`${bp.is_active ? 'Deactivate' : 'Delete'} "${bp.name}"?`)) return
                            setConfigSaving(true)
                            try {
                              await campusDutiesApi.deleteBreakPeriod(bp.id)
                              setAllBreakPeriods(prev => prev.map(b => b.id === bp.id ? { ...b, is_active: false } : b))
                              setBreakPeriods(prev => prev.filter(b => b.id !== bp.id))
                              setConfigMsg({ type: 'success', text: `"${bp.name}" deactivated.` })
                            } catch (e) {
                              setConfigMsg({ type: 'error', text: e?.response?.data?.detail || 'Delete failed.' })
                            } finally { setConfigSaving(false) }
                          }}
                          disabled={!bp.is_active || configSaving}
                          className="px-3 py-1.5 text-xs font-bold bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl transition-all disabled:opacity-40"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Inline Edit Modal for break period */}
            {editingBreakPeriod && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-slate-900">Edit Break Period</h4>
                    <button onClick={() => setEditingBreakPeriod(null)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Name</label>
                      <input value={bpForm.name || ''} onChange={e => setBpForm({...bpForm, name: e.target.value})}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Start Time</label>
                        <input type="time" value={bpForm.start_time || ''} onChange={e => setBpForm({...bpForm, start_time: e.target.value})}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">End Time</label>
                        <input type="time" value={bpForm.end_time || ''} onChange={e => setBpForm({...bpForm, end_time: e.target.value})}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Required Staff</label>
                      <input type="number" min="1" max="20" value={bpForm.required_teachers || 1} onChange={e => setBpForm({...bpForm, required_teachers: Number(e.target.value)})}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Applicable Day Orders (comma-separated)</label>
                      <input value={bpForm.applicable_day_orders || '1,2,3,4,5,6'} onChange={e => setBpForm({...bpForm, applicable_day_orders: e.target.value})}
                        placeholder="e.g. 1,2,3,4,5,6"
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="bp-active" checked={!!bpForm.is_active} onChange={e => setBpForm({...bpForm, is_active: e.target.checked})} className="w-4 h-4 accent-indigo-600" />
                      <label htmlFor="bp-active" className="text-xs font-bold text-slate-600">Active</label>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button onClick={() => setEditingBreakPeriod(null)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
                    <button
                      disabled={configSaving}
                      onClick={async () => {
                        setConfigSaving(true)
                        try {
                          const res = await campusDutiesApi.updateBreakPeriod(editingBreakPeriod.id, bpForm)
                          setAllBreakPeriods(prev => prev.map(b => b.id === editingBreakPeriod.id ? res.data : b))
                          setBreakPeriods(prev => prev.map(b => b.id === editingBreakPeriod.id ? res.data : b).filter(b => b.is_active))
                          setEditingBreakPeriod(null)
                          setConfigMsg({ type: 'success', text: `"${res.data.name}" updated successfully.` })
                        } catch (e) {
                          setConfigMsg({ type: 'error', text: e?.response?.data?.detail || 'Update failed.' })
                        } finally { setConfigSaving(false) }
                      }}
                      className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Block 2: Auto-Reassignment ── */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span className="text-lg">🤖</span> Auto-Reassignment of Absent Staff
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                The system checks attendance at <strong>9:00 AM</strong> and <strong>10 minutes before each break</strong>.
                If an assigned teacher hasn't checked in, they are automatically replaced with the next eligible candidate.
              </p>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Morning Cutoff</p>
                  <p className="text-lg font-black text-slate-800 mt-1">09:00 AM</p>
                  <p className="text-xs text-slate-400 mt-0.5">All duties checked</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pre-Break Cutoff</p>
                  <p className="text-lg font-black text-slate-800 mt-1">10 min before</p>
                  <p className="text-xs text-slate-400 mt-0.5">Each break start time</p>
                </div>
                <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
                  <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Scheduler</p>
                  <p className="text-lg font-black text-indigo-900 mt-1">Every 10 min</p>
                  <p className="text-xs text-indigo-400 mt-0.5">09:00 – 16:00 Mon-Sat</p>
                </div>
              </div>

              {autoReplaceResult && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-2">
                  <p className="text-xs font-black">{autoReplaceResult.message}</p>
                  {autoReplaceResult.results?.length > 0 && (
                    <ul className="text-xs text-emerald-700 space-y-1 pl-2">
                      {autoReplaceResult.results.map((r, i) => (
                        <li key={i}>↔ <strong>{r.replaced_teacher_name}</strong> → <strong>{r.new_teacher_name}</strong> ({r.duty_title})</li>
                      ))}
                    </ul>
                  )}
                  {autoReplaceResult.unfilled_after > 0 && (
                    <p className="text-xs text-amber-700 font-bold">⚠️ {autoReplaceResult.unfilled_after} slot(s) could not be filled (no eligible candidate available).</p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3">
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
                      setConfigMsg({ type: 'error', text: e?.response?.data?.detail || 'Auto-replace sweep failed.' })
                    } finally { setAutoReplaceLoading(false) }
                  }}
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-60"
                >
                  {autoReplaceLoading ? '⌛ Running Sweep...' : '🔄 Run Auto-Replace Sweep Now'}
                </button>
                <span className="text-xs text-slate-400">for {selectedDate}</span>
              </div>
            </div>
          </div>

          {/* ── Block 3: Duty Rules ── */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span className="text-lg">📋</span> Duty Assignment Rules
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Governance rules applied during candidate evaluation and auto-assignment</p>
            </div>
            {rulesLoading ? (
              <div className="py-8 flex justify-center"><Spinner /></div>
            ) : dutyRules ? (
              <div className="px-5 py-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { key: 'default_daily_duty_limit', label: 'Max Duties / Teacher / Day', type: 'number', min: 1, max: 5 },
                    { key: 'default_weekly_duty_limit', label: 'Max Duties / Teacher / Week', type: 'number', min: 1, max: 15 },
                    { key: 'max_discipline_teachers', label: 'Default Discipline Staff per Break', type: 'number', min: 1, max: 20 },
                    { key: 'max_exam_duties', label: 'Max Exam Duties per Teacher', type: 'number', min: 1, max: 20 },
                  ].map(({ key, label, type, min, max }) => (
                    <div key={key} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{label}</label>
                      <input
                        type={type}
                        min={min}
                        max={max}
                        value={rulesForm[key] ?? dutyRules[key]}
                        onChange={e => setRulesForm(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                        className="w-full px-3 py-2 text-sm font-black bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  ))}
                  {[
                    { key: 'prefer_free_before_break', label: 'Prefer free period before break (+50 pts)' },
                    { key: 'auto_assignment_enabled', label: 'Enable automatic assignment engine' },
                    { key: 'auto_replacement_enabled', label: 'Enable auto-replacement (absent staff)' },
                    { key: 'cross_department_assignment', label: 'Allow cross-department assignments' },
                  ].map(({ key, label }) => (
                    <div key={key} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">{label}</label>
                      <button
                        onClick={() => setRulesForm(prev => ({ ...prev, [key]: !prev[key] }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${rulesForm[key] ? 'bg-indigo-600' : 'bg-slate-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${rulesForm[key] ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setRulesForm(dutyRules)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
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
                        setConfigMsg({ type: 'success', text: 'Duty rules updated successfully.' })
                      } catch (e) {
                        setConfigMsg({ type: 'error', text: e?.response?.data?.detail || 'Rules update failed.' })
                      } finally { setConfigSaving(false) }
                    }}
                    className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm"
                  >
                    Save Rules
                  </button>
                </div>
              </div>
            ) : (
              <p className="p-6 text-xs text-slate-400 text-center">Click the Configuration tab to load rules.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
