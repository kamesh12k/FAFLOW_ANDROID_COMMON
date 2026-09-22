import { useState, useEffect, useMemo } from 'react'
import { campusDutiesApi, departmentsApi } from '../../api/services'
import { Card, Spinner, ErrorAlert, Modal, Badge } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'

export default function DutyManagement({ readOnly = false }) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('today') // today, upcoming, discipline, wing, exam, history
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [duties, setDuties] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [areas, setAreas] = useState([])
  const [breakPeriods, setBreakPeriods] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState(null)

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

  // Load initial data
  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [dutiesRes, metricsRes, areasRes, bpRes] = await Promise.all([
        campusDutiesApi.listDuties({ target_date: activeTab === 'today' ? selectedDate : undefined }),
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
  }, [activeTab, selectedDate])

  // Filtered duties
  const filteredDuties = useMemo(() => {
    if (activeTab === 'today') {
      return duties.filter(d => d.duty_date === selectedDate)
    } else if (activeTab === 'upcoming') {
      const todayStr = new Date().toISOString().split('T')[0]
      return duties.filter(d => d.duty_date > todayStr)
    } else if (activeTab === 'discipline') {
      return duties.filter(d => d.duty_type === 'DISCIPLINE_DUTY')
    } else if (activeTab === 'wing') {
      return duties.filter(d => d.duty_type === 'WING_DUTY')
    } else if (activeTab === 'exam') {
      return duties.filter(d => d.duty_type === 'EXAM_DUTY')
    }
    return duties
  }, [duties, activeTab, selectedDate])

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
                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {d.duty_type.replace('_', ' ')}
                    </span>
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
    </div>
  )
}
