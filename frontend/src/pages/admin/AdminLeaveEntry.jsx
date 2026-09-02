import { useEffect, useState, useCallback, useRef } from 'react'
import { teachersApi, departmentsApi, classesApi, subjectsApi, academicCalendarApi, leavesApi, timetableApi } from '../../api/services'
import { Spinner } from '../../components/ui'

// Constants matching Timetable
const PERIODS = [1, 2, 3, 4, 5]
const PERIOD_TIMES = {
  1: '8:00–9:00',
  2: '9:00–10:00',
  3: '10:15–11:15',
  4: '11:15–12:15',
  5: '1:00–2:00',
}

const LEAVE_TYPES = [
  'Casual Leave (CL)',
  'Sick Leave (SL)',
  'Emergency Leave (EL)',
  'Official Duty (OD)',
  'Casual Leave (Direct)',
  'Emergency Family Situation',
  'Other'
]

const PRESETS = [
  { label: 'Sick (Phone)', reason: 'Sick leave informed by phone', type: 'Sick Leave (SL)' },
  { label: 'Casual (Direct)', reason: 'Casual leave informed directly to HOD', type: 'Casual Leave (CL)' },
  { label: 'Official Duty', reason: 'Official duty outside campus', type: 'Official Duty (OD)' },
  { label: 'Family Emergency', reason: 'Emergency family situation', type: 'Emergency Leave (EL)' },
  { label: 'Emergency', reason: 'Emergency leave', type: 'Emergency Leave (EL)' }
]

function abbrev(name) {
  if (!name) return '?'
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 3)
}

function initials(name) {
  if (!name) return '??'
  const parts = name.trim().split(/\s+/)
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

// ── Toast Component ─────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="le-toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`le-toast le-toast--${t.type || 'success'}`}>
          <span className="le-toast-dot" />
          {t.message}
        </div>
      ))}
    </div>
  )
}

// ── Icons ───────────────────────────────────────────────────────────────────
const IconSearch = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
const IconCheck = () => <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
const IconCalendar = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>

export default function AdminLeaveEntry() {
  // Master Data
  const [teachers, setTeachers] = useState([])
  const [departments, setDepartments] = useState([])
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [allLeaves, setAllLeaves] = useState([])
  const [masterReady, setMasterReady] = useState(false)

  // Filters & State
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [teacherSearch, setTeacherSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all', 'active', 'on_leave'

  // Leave Form Details
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [dayOrderInfo, setDayOrderInfo] = useState(null)
  const [loadingCalendar, setLoadingCalendar] = useState(false)

  // Teacher Schedule
  const [teacherSlots, setTeacherSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Selected periods for leave
  const [selectedPeriods, setSelectedPeriods] = useState(new Set())
  const [leaveType, setLeaveType] = useState('Emergency Leave (EL)')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')

  // UI state
  const [saving, setSaving] = useState(false)
  const [toasts, setToasts] = useState([])

  const toastId = useRef(0)
  const toast = useCallback((message, type = 'success') => {
    const id = ++toastId.current
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }, [])

  // Load Master Data & Leaves
  useEffect(() => {
    Promise.all([
      teachersApi.list(),
      departmentsApi.list(),
      classesApi.list(),
      subjectsApi.list(),
      leavesApi.all()
    ])
      .then(([t, d, c, s, l]) => {
        setTeachers(t.data)
        setDepartments(d.data)
        setClasses(c.data)
        setSubjects(s.data)
        setAllLeaves(l.data)
        setMasterReady(true)
      })
      .catch(() => toast('Failed to load system settings and teacher list', 'error'))
  }, [toast])

  // Reload leaves list periodically or on success
  const refreshLeavesList = useCallback(() => {
    leavesApi.all()
      .then(res => setAllLeaves(res.data))
      .catch(() => {})
  }, [])

  // Fetch Teacher Timetable Slots
  useEffect(() => {
    if (!selectedTeacherId) {
      setTeacherSlots([])
      return
    }
    setLoadingSlots(true)
    timetableApi.getByTeacher(selectedTeacherId)
      .then(res => {
        setTeacherSlots(res.data)
        setSelectedPeriods(new Set())
      })
      .catch(() => toast('Failed to load teacher timetable schedule', 'error'))
      .finally(() => setLoadingSlots(false))
  }, [selectedTeacherId, toast])

  // Resolve Date to Day Order
  useEffect(() => {
    if (!selectedDate) {
      setDayOrderInfo(null)
      return
    }
    setLoadingCalendar(true)
    academicCalendarApi.resolve(selectedDate)
      .then(res => {
        setDayOrderInfo(res.data)
        setSelectedPeriods(new Set()) // Clear periods selection since Day Order might have changed
      })
      .catch(() => {
        toast('Failed to resolve academic calendar details for this date', 'error')
        setDayOrderInfo(null)
      })
      .finally(() => setLoadingCalendar(false))
  }, [selectedDate, toast])

  // Derived: Is current date a working day?
  // API returns { blocks_operations, day_type, day_order } — NOT is_working_day
  const isWorkingDay = dayOrderInfo && !dayOrderInfo.blocks_operations && dayOrderInfo.day_order > 0
  const currentDayOrder = dayOrderInfo?.day_order

  // Derived: Timetable slots for the selected day order
  const scheduledSlotsForDayOrder = teacherSlots.filter(s => s.day_order === currentDayOrder)
  const scheduledPeriodsSet = new Set(scheduledSlotsForDayOrder.map(s => s.period_number))

  // Determine teachers leave status on selected date
  const getTeacherLeaveStatusOnDate = useCallback((teacherId) => {
    const leavesOnDate = allLeaves.filter(
      l => l.teacher_id === teacherId && l.date === selectedDate && l.status !== 'cancelled'
    )
    if (leavesOnDate.length > 0) {
      const wholeDay = leavesOnDate.length >= 5 || leavesOnDate.some(l => l.batch_id && leavesOnDate.length >= 3)
      return {
        onLeave: true,
        label: wholeDay ? 'On Leave (Full)' : `On Leave (${leavesOnDate.length} Period${leavesOnDate.length > 1 ? 's' : ''})`,
        periods: leavesOnDate.map(l => l.period_number)
      }
    }
    return { onLeave: false }
  }, [allLeaves, selectedDate])

  // Apply Quick Selection
  const applySelectionMode = (mode) => {
    if (!isWorkingDay) return
    const newSet = new Set()
    
    if (mode === 'full') {
      // Select all scheduled periods
      scheduledSlotsForDayOrder.forEach(s => newSet.add(s.period_number))
    } else if (mode === 'morning') {
      // Select periods 1, 2, 3 if scheduled
      scheduledSlotsForDayOrder
        .filter(s => s.period_number <= 3)
        .forEach(s => newSet.add(s.period_number))
    } else if (mode === 'afternoon') {
      // Select periods 4, 5 if scheduled
      scheduledSlotsForDayOrder
        .filter(s => s.period_number >= 4)
        .forEach(s => newSet.add(s.period_number))
    }
    
    setSelectedPeriods(newSet)
  }

  const togglePeriodSelection = (periodNum) => {
    if (!scheduledPeriodsSet.has(periodNum)) return // Only allow selecting periods that are scheduled
    const newSet = new Set(selectedPeriods)
    if (newSet.has(periodNum)) {
      newSet.delete(periodNum)
    } else {
      newSet.add(periodNum)
    }
    setSelectedPeriods(newSet)
  }

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedTeacherId) return toast('Please select a teacher first', 'error')
    if (selectedPeriods.size === 0) return toast('Please select at least one period for leave', 'error')
    if (!reason.trim()) return toast('Please enter a reason for the leave', 'error')
    if (!isWorkingDay) return toast('Cannot apply leave on holidays or non-working days', 'error')

    setSaving(true)
    try {
      // If selectedPeriods equals all scheduled periods, we can mark whole_day = True
      const isWholeDay = selectedPeriods.size === scheduledSlotsForDayOrder.length && scheduledSlotsForDayOrder.length > 0
      
      const payload = {
        teacher_id: Number(selectedTeacherId),
        date: selectedDate,
        whole_day: isWholeDay,
        period_numbers: isWholeDay ? null : Array.from(selectedPeriods),
        reason: `${leaveType} - ${reason}`,
        notes: notes.trim() || null
      }

      await leavesApi.adminCreate(payload)
      toast('Approved leave recorded and substitutions generated successfully!')
      
      // Reset form states
      setSelectedPeriods(new Set())
      setReason('')
      setNotes('')
      
      // Refresh lists
      refreshLeavesList()
      // Reload slots to show updated status
      timetableApi.getByTeacher(selectedTeacherId)
        .then(res => setTeacherSlots(res.data))
    } catch (err) {
      toast(err.response?.data?.detail || 'Failed to submit leave entry', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Filtered teachers list
  const filteredTeachers = teachers.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(teacherSearch.toLowerCase())
    const matchesDept = !deptFilter || t.department === deptFilter
    
    // Status filter
    const status = getTeacherLeaveStatusOnDate(t.id)
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'on_leave' && status.onLeave) ||
      (statusFilter === 'active' && !status.onLeave)

    return matchesSearch && matchesDept && matchesStatus && t.is_active
  })

  const selectedTeacher = teachers.find(t => t.id === Number(selectedTeacherId))

  return (
    <div className="le-root">
      <style>{CSS}</style>
      <Toast toasts={toasts} />

      {/* ── Header ── */}
      <header className="le-header">
        <div className="le-brand">
          <svg className="le-brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          <div>
            <h1 className="le-title">Admin Leave Entry</h1>
            <p className="le-subtitle">
              Emergency or direct leave recording with immediate approval and auto-substitutions.
            </p>
          </div>
        </div>

        {saving && (
          <div className="le-saving">
            <span className="le-saving-dot" /> Submitting request…
          </div>
        )}
      </header>

      {/* ── Main Body ── */}
      <div className="le-body">

        {/* ── LEFT PANEL: Teachers ── */}
        <aside className="le-left">
          <div className="le-input-icon-wrap" style={{ width: '100%' }}>
            <IconSearch />
            <input
              className="le-input le-input--icon le-input--sm"
              placeholder="Search teacher…"
              value={teacherSearch}
              onChange={e => setTeacherSearch(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div className="le-filter-row">
            <select
              className="le-select le-select--sm"
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              style={{ flex: 1, minWidth: '0' }}
            >
              <option value="">All Depts</option>
              {departments.map(d => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>

            <select
              className="le-select le-select--sm"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ flex: 1, minWidth: '0' }}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
            </select>
          </div>

          <div className="le-panel-label" style={{ marginTop: 8 }}>
            Teachers
            <span className="le-badge">{filteredTeachers.length}</span>
          </div>

          <div className="le-teacher-list">
            {filteredTeachers.map(t => {
              const isActive = selectedTeacherId === String(t.id)
              const leaveStatus = getTeacherLeaveStatusOnDate(t.id)
              
              return (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelectedTeacherId(String(t.id))
                    setSelectedPeriods(new Set())
                  }}
                  className={`le-teacher-item ${isActive ? 'le-teacher-item--active' : ''}`}
                >
                  <div className="teacher-avatar">
                    {initials(t.name)}
                  </div>
                  <div className="le-teacher-info">
                    <div className="teacher-name">{t.name}</div>
                    <div className="teacher-dept">{t.department || 'No Department'}</div>
                  </div>
                  {leaveStatus.onLeave ? (
                    <span className="le-status-tag le-status-tag--leave" title={leaveStatus.label}>
                      Leave
                    </span>
                  ) : (
                    <span className="le-status-tag le-status-tag--active">
                      Active
                    </span>
                  )}
                </div>
              )
            })}

            {filteredTeachers.length === 0 && (
              <div className="le-empty-list">No teachers found</div>
            )}
          </div>
        </aside>

        {/* ── CENTER PANEL: Schedule Grid ── */}
        <main className="le-center">
          {!selectedTeacherId ? (
            <div className="le-empty-state">
              <svg className="le-empty-icon" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6M23 11h-6" />
              </svg>
              <h3 className="le-empty-title">No Teacher Selected</h3>
              <p className="le-empty-sub">
                Select a teacher from the left panel to review their scheduled timetable and apply leaves.
              </p>
            </div>
          ) : (
            <div className="le-grid-wrapper">
              <div className="le-grid-header">
                <div>
                  <h2 className="le-section-title">Today's Schedule & Leave Selection</h2>
                  <p className="le-section-subtitle">
                    Showing slots for {selectedTeacher?.name} · {selectedDate} ({dayOrderInfo ? `Day Order ${dayOrderInfo.day_order}` : 'Resolving...'})
                  </p>
                </div>
                
                {isWorkingDay && scheduledSlotsForDayOrder.length > 0 && (
                  <div className="le-quick-selectors">
                    <button
                      type="button"
                      className="le-btn le-btn--xs"
                      onClick={() => applySelectionMode('full')}
                    >
                      Full Day
                    </button>
                    <button
                      type="button"
                      className="le-btn le-btn--xs"
                      onClick={() => applySelectionMode('morning')}
                    >
                      Morning (P1-P3)
                    </button>
                    <button
                      type="button"
                      className="le-btn le-btn--xs"
                      onClick={() => applySelectionMode('afternoon')}
                    >
                      Afternoon (P4-P5)
                    </button>
                    <button
                      type="button"
                      className="le-btn le-btn--xs le-btn--danger-text"
                      onClick={() => setSelectedPeriods(new Set())}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {loadingSlots || loadingCalendar ? (
                <div className="le-loading-state">
                  <Spinner size="md" />
                  <p>Loading teacher schedule...</p>
                </div>
              ) : !isWorkingDay ? (
                <div className="le-alert le-alert--holiday">
                  <div className="le-alert-icon">⚠️</div>
                  <div>
                    <h4 className="le-alert-title">Non-Working Day</h4>
                    <p className="le-alert-desc">
                      The academic calendar marks {selectedDate} as {dayOrderInfo?.day_type?.replace('_', ' ') || 'a non-working day'} (No Day Order assigned). Leaves cannot be recorded.
                    </p>
                  </div>
                </div>
              ) : scheduledSlotsForDayOrder.length === 0 ? (
                <div className="le-alert le-alert--empty">
                  <div className="le-alert-icon">ℹ️</div>
                  <div>
                    <h4 className="le-alert-title">No Timetable Slots</h4>
                    <p className="le-alert-desc">
                      This teacher has no scheduled classes on Day Order {currentDayOrder}. Leave cannot be entered because there are no slots requiring substitutes.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="le-periods-grid">
                  {PERIODS.map(periodNum => {
                    const slot = scheduledSlotsForDayOrder.find(s => s.period_number === periodNum)
                    const isScheduled = !!slot
                    const isSelected = selectedPeriods.has(periodNum)
                    
                    // Check if already on leave for this specific period
                    const alreadyOnLeave = getTeacherLeaveStatusOnDate(Number(selectedTeacherId)).periods?.includes(periodNum)

                    const targetClass = slot ? classes.find(c => c.id === slot.class_id) : null
                    const className = targetClass ? `${targetClass.name}-${targetClass.section}` : `Class #${slot?.class_id}`
                    const targetSubject = slot ? subjects.find(s => s.id === slot.subject_id) : null
                    const subjectName = targetSubject ? targetSubject.name : 'General Duty'

                    return (
                      <div
                        key={periodNum}
                        onClick={() => !alreadyOnLeave && isScheduled && togglePeriodSelection(periodNum)}
                        className={`le-period-cell ${!isScheduled ? 'le-period-cell--free' : ''} ${isSelected ? 'le-period-cell--selected' : ''} ${alreadyOnLeave ? 'le-period-cell--already-leave' : ''}`}
                      >
                        <div className="pc-header">
                          <span className="pc-num">Period {periodNum}</span>
                          <span className="pc-time">{PERIOD_TIMES[periodNum]}</span>
                        </div>

                        {isScheduled ? (
                          <div className="pc-body">
                            <div className="pc-class">{className}</div>
                            <div className="pc-subject" title={subjectName}>{subjectName}</div>
                            {slot.room_id && (
                              <div className="pc-room">Room {slot.room_id}</div>
                            )}
                            
                            {alreadyOnLeave ? (
                              <div className="pc-status pc-status--leave">Already Recorded</div>
                            ) : isSelected ? (
                              <div className="pc-status pc-status--selected">
                                <IconCheck /> Selected
                              </div>
                            ) : (
                              <div className="pc-status pc-status--click">Click to select</div>
                            )}
                          </div>
                        ) : (
                          <div className="pc-body pc-body--free">
                            <span className="pc-free-tag">Free Period</span>
                            <span className="pc-free-desc">No class scheduled</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </main>

        {/* ── RIGHT PANEL: Form submission ── */}
        <aside className="le-right">
          <div className="le-panel-label">Leave Details</div>

          {selectedTeacher ? (
            <div className="le-form-card">
              <div className="le-teacher-summary">
                <div className="teacher-avatar">
                  {initials(selectedTeacher.name)}
                </div>
                <div>
                  <div className="teacher-name">{selectedTeacher.name}</div>
                  <div className="teacher-dept">{selectedTeacher.department || 'No Department'}</div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="le-form">
                <div>
                  <label className="le-form-label">Leave Date</label>
                  <div className="le-input-icon-wrap">
                    <IconCalendar />
                    <input
                      type="date"
                      className="le-input le-input--icon w-full"
                      value={selectedDate}
                      onChange={e => setSelectedDate(e.target.value)}
                    />
                  </div>
                  {dayOrderInfo && (
                    <div className="le-day-order-indicator">
                      {isWorkingDay ? (
                        <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '10px', marginTop: '2px', display: 'block' }}>
                          ✓ Working Day — Day Order {dayOrderInfo.day_order}
                        </span>
                      ) : (
                        <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '10px', marginTop: '2px', display: 'block' }}>
                          ✗ {dayOrderInfo.day_type?.replace('_', ' ') || 'Non-working'} — No classes scheduled
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="le-form-label">Leave Type</label>
                  <select
                    className="le-select w-full"
                    value={leaveType}
                    onChange={e => setLeaveType(e.target.value)}
                  >
                    {LEAVE_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="le-form-label">Reason for Adjustment</label>
                  
                  {/* Quick Presets */}
                  <div className="le-presets-grid">
                    {PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="le-preset-badge"
                        onClick={() => {
                          setReason(p.reason)
                          setLeaveType(p.type)
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <textarea
                    className="le-textarea w-full"
                    placeholder="e.g. Sick leave informed by phone / emergency family situation"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows="3"
                    required
                  />
                </div>

                <div>
                  <label className="le-form-label">Internal notes (Optional)</label>
                  <textarea
                    className="le-textarea w-full"
                    placeholder="Administrators internal comments..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows="2"
                  />
                </div>

                {isWorkingDay && selectedPeriods.size > 0 && (
                  <div className="le-selection-summary">
                    <span className="le-form-label" style={{ marginBottom: 4 }}>Selection Summary</span>
                    <div className="le-summary-box">
                      <strong>Periods:</strong> {Array.from(selectedPeriods).sort().join(', ')} <br />
                      <strong>Total:</strong> {selectedPeriods.size} hour(s) of class coverage needed
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving || !isWorkingDay || selectedPeriods.size === 0 || !reason.trim()}
                  className="le-submit-btn w-full"
                >
                  {saving ? 'Processing...' : 'Record Approved Leave'}
                </button>
              </form>
            </div>
          ) : (
            <div className="le-detail-placeholder">
              <svg className="dp-icon" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
              </svg>
              Select a teacher to record leaves and generate coverages
            </div>
          )}
        </aside>

      </div>
    </div>
  )
}

// ── CSS Styles ──────────────────────────────────────────────────────────────
const CSS = `
/* ─── Animations ─────────────────────────────────────────────────────────── */
@keyframes leSlide   { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
@keyframes lePulse   { 0%,100% { opacity:1 } 50% { opacity:.4 } }

/* ─── Root ───────────────────────────────────────────────────────────────── */
.le-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
  background: #F7F8FC;
  color: #1E2532;
  font-size: 13px;
  line-height: 1.4;
}

/* ─── Header ─────────────────────────────────────────────────────────────── */
.le-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  background: #fff;
  border-bottom: 1px solid #E8EBEF;
  flex-shrink: 0;
}

.le-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.le-brand-icon {
  width: 24px;
  height: 24px;
  color: #4F46E5;
  flex-shrink: 0;
}

.le-title {
  font-size: 16px;
  font-weight: 700;
  color: #1E2532;
  margin: 0;
  letter-spacing: -0.3px;
}

.le-subtitle {
  font-size: 11px;
  color: #94A3B8;
  margin: 2px 0 0;
  line-height: 1.1;
}

/* ─── Body ───────────────────────────────────────────────────────────────── */
.le-body {
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 14px 16px;
}

/* ─── Left panel ─────────────────────────────────────────────────────────── */
.le-left {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  padding-right: 2px;
}

.le-panel-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 700;
  color: #94A3B8;
  text-transform: uppercase;
  letter-spacing: .08em;
  padding: 2px 0;
}

.le-badge {
  background: #F1F5F9;
  color: #64748B;
  border-radius: 99px;
  padding: 1px 6px;
  font-size: 9px;
  font-weight: 700;
}

.le-filter-row {
  display: flex;
  gap: 6px;
}

.le-teacher-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
}

/* Teacher Item */
.le-teacher-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1.5px solid #E8EBEF;
  background: #fff;
  cursor: pointer;
  transition: all .12s;
  user-select: none;
  box-shadow: 0 1px 2px rgba(30,37,50,.04);
}

.le-teacher-item:hover {
  border-color: #C7D2FE;
  box-shadow: 0 3px 8px rgba(30,37,50,.08);
}

.le-teacher-item--active {
  background: #EEF2FF;
  border-color: #6366F1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.teacher-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #818CF8 0%, #6366F1 100%);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.le-teacher-info {
  flex: 1;
  min-width: 0;
}

.teacher-name {
  font-size: 12px;
  font-weight: 700;
  color: #1E2532;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.teacher-dept {
  font-size: 10px;
  color: #64748B;
  margin-top: 1px;
}

.le-status-tag {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 99px;
  text-transform: uppercase;
}

.le-status-tag--active { background: #ECFDF5; color: #059669; }
.le-status-tag--leave  { background: #FFF7ED; color: #EA580C; }

/* ─── Center panel ───────────────────────────────────────────────────────── */
.le-center {
  flex: 1;
  min-width: 0;
  overflow: auto;
  background: #fff;
  border: 1px solid #E8EBEF;
  border-radius: 12px;
  padding: 16px;
}

.le-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  text-align: center;
  color: #94A3B8;
}

.le-empty-icon { width: 56px; height: 56px; margin-bottom: 4px; }
.le-empty-title { font-size: 15px; font-weight: 600; color: #475569; margin: 0; }
.le-empty-sub   { font-size: 12px; margin: 0; max-width: 280px; line-height: 1.6; }

.le-grid-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 16px;
}

.le-grid-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  border-bottom: 1px solid #F1F5F9;
  padding-bottom: 12px;
  flex-wrap: wrap;
  gap: 10px;
}

.le-section-title {
  font-size: 14px;
  font-weight: 700;
  color: #1E2532;
  margin: 0;
}

.le-section-subtitle {
  font-size: 11px;
  color: #64748B;
  margin: 2px 0 0;
}

.le-quick-selectors {
  display: flex;
  gap: 6px;
}

.le-periods-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
  flex: 1;
}

.le-period-cell {
  background: #FAFAFA;
  border: 2px solid #E4E7EC;
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: all .14s ease;
  user-select: none;
  min-height: 150px;
}

.le-period-cell:hover:not(.le-period-cell--free):not(.le-period-cell--already-leave) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,.04);
  border-color: #CBD5E1;
}

.le-period-cell--selected {
  border-color: #6366F1;
  background: #EEF2FF;
}

.le-period-cell--free {
  cursor: not-allowed;
  opacity: 0.65;
  background: #F1F5F9;
  border-color: #E2E8F0;
}

.le-period-cell--already-leave {
  cursor: not-allowed;
  opacity: 0.8;
  background: #FEF2F2;
  border-color: #FCA5A5;
}

.pc-header {
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid rgba(0,0,0,.05);
  padding-bottom: 6px;
  margin-bottom: 8px;
}

.pc-num { font-size: 11px; font-weight: 700; color: #475569; }
.pc-time { font-size: 9px; color: #94A3B8; font-family: monospace; margin-top: 1px; }

.pc-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.pc-class {
  font-size: 13px;
  font-weight: 800;
  color: #1E2532;
}

.pc-subject {
  font-size: 11px;
  color: #475569;
  font-weight: 500;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  height: 32px;
  line-height: 1.3;
}

.pc-room {
  font-size: 9px;
  color: #94A3B8;
}

.pc-status {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  margin-top: auto;
  padding-top: 8px;
}

.pc-status--click { color: #94A3B8; }
.pc-status--selected { color: #4F46E5; display: inline-flex; align-items: center; gap: 4px; }
.pc-status--leave { color: #DC2626; }

.pc-body--free {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  flex: 1;
  color: #94A3B8;
  gap: 4px;
}

.pc-free-tag { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748B; }
.pc-free-desc { font-size: 9px; }

.le-loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 8px;
  color: #94A3B8;
}

.le-alert {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 10px;
  align-items: flex-start;
}

.le-alert--holiday { background: #FFFBEB; border: 1px solid #FDE68A; }
.le-alert--empty   { background: #F8FAFC; border: 1px solid #E2E8F0; }

.le-alert-icon { font-size: 16px; line-height: 1; }
.le-alert-title { font-size: 13px; font-weight: 700; color: #1E2532; margin: 0; }
.le-alert-desc  { font-size: 11px; color: #64748B; margin: 4px 0 0; line-height: 1.5; }

/* ─── Right panel ────────────────────────────────────────────────────────── */
.le-right {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}

.le-form-card {
  background: #fff;
  border: 1px solid #E8EBEF;
  border-radius: 12px;
  padding: 14px;
  box-shadow: 0 1px 2px rgba(30,37,50,.04);
}

.le-teacher-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid #F1F5F9;
  padding-bottom: 12px;
  margin-bottom: 14px;
}

.le-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.le-form-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  color: #94A3B8;
  text-transform: uppercase;
  letter-spacing: .06em;
  margin-bottom: 5px;
}

.le-input,
.le-select,
.le-textarea {
  padding: 8px 10px;
  border: 1px solid #E4E7EC;
  border-radius: 8px;
  font-size: 12px;
  color: #334155;
  background: #fff;
  outline: none;
  font-family: inherit;
  transition: border-color .15s;
}

.le-input:focus,
.le-select:focus,
.le-textarea:focus {
  border-color: #818CF8;
}

.w-full { width: 100%; box-sizing: border-box; }

.le-input-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.le-input-icon-wrap svg {
  position: absolute;
  left: 10px;
  color: #94A3B8;
  pointer-events: none;
}

.le-input--icon { padding-left: 28px; }
.le-input--sm { padding: 5px 8px; font-size: 11px; border-radius: 7px; }
.le-select--sm { padding: 5px 8px; font-size: 11px; border-radius: 7px; }

.le-day-order-indicator {
  font-size: 10px;
  margin-top: 4px;
}

.le-selection-summary {
  margin-top: 4px;
}

.le-summary-box {
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 11px;
  color: #475569;
  line-height: 1.5;
}

.le-submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 10px 0;
  border-radius: 8px;
  border: 1px solid #4F46E5;
  background: #4F46E5;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background .12s;
  font-family: inherit;
}

.le-submit-btn:hover:not(:disabled) { background: #4338CA; }
.le-submit-btn:disabled { opacity: .5; cursor: not-allowed; border-color: #E2E8F0; background: #E2E8F0; color: #94A3B8; }

.le-detail-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  background: #FAFAFA;
  border: 1.5px dashed #E4E7EC;
  border-radius: 12px;
  color: #CBD5E1;
  font-size: 11px;
  text-align: center;
  gap: 10px;
  line-height: 1.5;
}

.dp-icon { width: 36px; height: 36px; }

.le-btn {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border: 1px solid #E4E7EC;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 600;
  background: #fff;
  color: #475569;
  cursor: pointer;
  transition: all .1s;
}

.le-btn:hover { background: #F8FAFC; border-color: #CBD5E1; }
.le-btn--xs { padding: 3px 6px; font-size: 9px; }
.le-btn--danger-text { color: #DC2626; border-color: #FECACA; background: #FEF2F2; }
.le-btn--danger-text:hover { background: #FEE2E2; }

/* ─── Saving Indicator ───────────────────────────────────────────────────── */
.le-saving {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #94A3B8;
  padding: 5px 9px;
  background: #F8FAFC;
  border-radius: 7px;
  border: 1px solid #E4E7EC;
}

.le-saving-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #94A3B8;
  animation: lePulse 1s ease-in-out infinite;
}

/* ─── Toast ──────────────────────────────────────────────────────────────── */
.le-toast-wrap {
  position: fixed;
  bottom: 80px; /* above mobile bottom nav */
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 7px;
  pointer-events: none;
}
@media (min-width: 1024px) {
  .le-toast-wrap {
    bottom: 22px;
    right: 22px;
  }
}

.le-toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  box-shadow: 0 4px 18px rgba(0,0,0,.13);
  animation: leSlide .2s ease;
  max-width: 300px;
  border-width: 1px;
  border-style: solid;
}

.le-toast-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.le-toast--success { background:#ECFDF5; color:#065F46; border-color:#A7F3D0; }
.le-toast--success .le-toast-dot { background:#10B981; }
.le-toast--error   { background:#FEF2F2; color:#991B1B; border-color:#FECACA; }
.le-toast--error   .le-toast-dot { background:#EF4444; }
.le-toast--warn    { background:#FFFBEB; color:#92400E; border-color:#FDE68A; }
.le-toast--warn    .le-toast-dot { background:#F59E0B; }

/* ─── Scrollbars ─────────────────────────────────────────────────────────── */
.le-left::-webkit-scrollbar,
.le-right::-webkit-scrollbar,
.le-center::-webkit-scrollbar { width: 5px; height: 5px; }
.le-left::-webkit-scrollbar-track,
.le-right::-webkit-scrollbar-track,
.le-center::-webkit-scrollbar-track { background: transparent; }
.le-left::-webkit-scrollbar-thumb,
.le-right::-webkit-scrollbar-thumb,
.le-center::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 99px; }

/* ─── Mobile Optimizations ───────────────────────────────────────────────── */
@media (max-width: 1024px) {
  .le-body {
    flex-direction: column;
    overflow: visible;
    height: auto;
    gap: 12px;
    padding: 10px;
  }
  
  .le-left {
    width: 100%;
    max-height: 220px;
    border-bottom: 1px solid #E4E7EC;
    padding-bottom: 8px;
  }
  
  .le-teacher-list {
    flex-direction: row;
    overflow-x: auto;
    gap: 6px;
    flex: none;
    padding-bottom: 4px;
  }
  
  .le-teacher-item {
    flex: 0 0 160px;
  }
  
  .le-center {
    width: 100%;
    min-height: 300px;
  }
  
  .le-right {
    width: 100%;
  }
}

.le-presets-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 8px;
}

.le-preset-badge {
  font-size: 10px;
  padding: 4px 8px;
  border-radius: 6px;
  background: #F1F5F9;
  color: #475569;
  border: 1px solid #E2E8F0;
  cursor: pointer;
  transition: all 0.15s ease;
  font-weight: 600;
  font-family: inherit;
}

.le-preset-badge:hover {
  background: #EEF2FF;
  color: #4F46E5;
  border-color: #C7D2FE;
}
`
