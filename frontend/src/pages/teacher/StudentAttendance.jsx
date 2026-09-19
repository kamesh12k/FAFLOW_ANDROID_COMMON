import { useState, useEffect, useMemo } from 'react'
import { studentAttendanceApi, classesApi } from '../../api/services'
import { useAuth } from '../../context/AuthContext'
import { Card, Spinner, Badge } from '../../components/ui'
import { CalIcon, UsersIcon, CheckIcon, AlertTriangleIcon, ClockIcon } from '../../components/icons'

export default function StudentAttendance() {
  const { user } = useAuth()
  const [scheduleData, setScheduleData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [allClasses, setAllClasses] = useState([])

  // Active taking attendance state
  const [activeSession, setActiveSession] = useState(null)
  const [activeClassInfo, setActiveClassInfo] = useState(null)
  const [roster, setRoster] = useState([])
  const [rosterLoading, setRosterLoading] = useState(false)

  // Input states for attendance
  const [absentInput, setAbsentInput] = useState('')
  const [specialStatuses, setSpecialStatuses] = useState({}) // student_id -> status ('LATE', 'ON_DUTY', 'LEAVE', 'MEDICAL')
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState('')

  // Emergency modal
  const [showEmergencyModal, setShowEmergencyModal] = useState(false)
  const [emergencySearch, setEmergencySearch] = useState('')

  // Correction state
  const [correctingStudent, setCorrectingStudent] = useState(null) // { student, currentStatus }
  const [correctionReason, setCorrectionReason] = useState('')
  const [correctingLoading, setCorrectingLoading] = useState(false)

  // Fetch schedule
  const loadSchedule = async () => {
    try {
      setLoading(true)
      setError('')
      const [schedRes, clsRes] = await Promise.all([
        studentAttendanceApi.getTodaySchedule(),
        classesApi.list().catch(() => ({ data: [] }))
      ])
      setScheduleData(schedRes.data)
      setAllClasses(clsRes.data || [])
    } catch (err) {
      console.error('Failed to load schedule', err)
      setError(err.response?.data?.detail || 'Failed to load schedule for today')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSchedule()
  }, [])

  // Open attendance taker for a period
  const handleOpenAttendance = async (periodSlot) => {
    try {
      setRosterLoading(true)
      setError('')
      setSubmitSuccess('')
      setAbsentInput('')
      setSpecialStatuses({})

      // 1. Fetch class roster
      const rosterRes = await studentAttendanceApi.getClassRoster(periodSlot.class_id)
      setRoster(rosterRes.data.students || [])
      setActiveClassInfo({
        classId: periodSlot.class_id,
        className: periodSlot.class_name,
        subjectId: periodSlot.subject_id,
        subjectName: periodSlot.subject_name,
        periodNumber: periodSlot.period_number,
        startTime: periodSlot.start_time,
        endTime: periodSlot.end_time,
        slotId: periodSlot.timetable_slot_id,
        isSubstitution: periodSlot.is_substitution,
        substitutionId: periodSlot.substitution_id,
        attendanceType: periodSlot.is_substitution ? 'REGISTERED_SUBSTITUTION' : 'NORMAL'
      })

      // 2. If session already exists, load session details
      if (periodSlot.session_id) {
        const sessRes = await studentAttendanceApi.getSession(periodSlot.session_id)
        setActiveSession(sessRes.data)
        // Pre-fill existing absences if submitted or draft
        const existingAbsents = []
        const specials = {}
        sessRes.data.records?.forEach(r => {
          if (r.status === 'ABSENT') {
            existingAbsents.push(r.roll_suffix || r.student_roll_number.slice(-3))
          } else if (r.status !== 'PRESENT') {
            specials[r.student_id] = r.status
          }
        })
        setAbsentInput(existingAbsents.join(' '))
        setSpecialStatuses(specials)
      } else {
        // Create session draft / or start new session
        const createRes = await studentAttendanceApi.createSession({
          timetable_slot_id: periodSlot.timetable_slot_id,
          class_id: periodSlot.class_id,
          subject_id: periodSlot.subject_id,
          substitution_id: periodSlot.substitution_id || null,
          attendance_type: periodSlot.is_substitution ? 'REGISTERED_SUBSTITUTION' : 'NORMAL'
        })
        setActiveSession(createRes.data)
      }
    } catch (err) {
      console.error('Error starting attendance', err)
      setError(err.response?.data?.detail || 'Failed to initialize attendance session')
    } finally {
      setRosterLoading(false)
    }
  }

  // Handle emergency attendance initiation
  const handleStartEmergency = async (selectedClass) => {
    setShowEmergencyModal(false)
    try {
      setRosterLoading(true)
      setError('')
      setSubmitSuccess('')
      setAbsentInput('')
      setSpecialStatuses({})

      // Current period from schedule
      const currentPeriodNum = scheduleData?.current_period || 1

      // Fetch roster
      const rosterRes = await studentAttendanceApi.getClassRoster(selectedClass.id)
      setRoster(rosterRes.data.students || [])

      // Call emergency endpoint to create/find session
      const emergRes = await studentAttendanceApi.emergencyAttendance({
        class_id: selectedClass.id,
        period_number: currentPeriodNum,
        subject_id: null // auto-derives from class timetable
      })

      setActiveSession(emergRes.data)
      setActiveClassInfo({
        classId: selectedClass.id,
        className: emergRes.data.class_name,
        subjectId: emergRes.data.subject_id,
        subjectName: emergRes.data.subject_name || 'Class Subject',
        periodNumber: currentPeriodNum,
        startTime: emergRes.data.scheduled_start_time || 'Current',
        endTime: emergRes.data.scheduled_end_time || '',
        slotId: emergRes.data.timetable_slot_id,
        isEmergency: true,
        attendanceType: 'EMERGENCY'
      })
    } catch (err) {
      console.error('Error initiating emergency attendance', err)
      setError(err.response?.data?.detail || 'Failed to start emergency attendance')
    } finally {
      setRosterLoading(false)
    }
  }

  // Suffix parsing and real-time resolution
  const parsedSuffixes = useMemo(() => {
    if (!absentInput.trim()) return []
    const rawTokens = absentInput.split(/[\s,]+/).map(t => t.trim()).filter(Boolean)
    // deduplicate preserving order
    return Array.from(new Set(rawTokens))
  }, [absentInput])

  const suffixValidation = useMemo(() => {
    const studentSuffixMap = new Map()
    roster.forEach(s => {
      const suffix = s.roll_suffix || s.roll_number.slice(-3)
      studentSuffixMap.set(suffix, s)
    })

    const validStudents = []
    const invalidTokens = []

    parsedSuffixes.forEach(tok => {
      const padded = tok.padStart(3, '0').slice(-3)
      if (studentSuffixMap.has(padded)) {
        validStudents.push(studentSuffixMap.get(padded))
      } else {
        invalidTokens.push(tok)
      }
    })

    return { validStudents, invalidTokens, studentSuffixMap }
  }, [parsedSuffixes, roster])

  // Count calculations
  const totalCount = roster.length
  const absentCount = suffixValidation.validStudents.length
  const specialCount = Object.keys(specialStatuses).length
  const presentCount = Math.max(0, totalCount - absentCount - specialCount)

  // Submit attendance
  const handleSubmitAttendance = async () => {
    if (!activeSession) return
    if (suffixValidation.invalidTokens.length > 0) {
      setError(`Invalid roll suffix(es) not found in this class: ${suffixValidation.invalidTokens.join(', ')}`)
      return
    }

    try {
      setSubmitting(true)
      setError('')

      const payload = {
        absent_roll_suffixes: parsedSuffixes.map(s => s.padStart(3, '0').slice(-3)),
        student_exceptions: Object.entries(specialStatuses).map(([studentId, status]) => ({
          student_id: parseInt(studentId, 10),
          status
        })),
        client_timestamp: new Date().toISOString()
      }

      const res = await studentAttendanceApi.submitAttendance(activeSession.id, payload)
      setActiveSession(res.data)
      setSubmitSuccess(`Attendance submitted successfully! Status: ${res.data.status}`)
      loadSchedule()
    } catch (err) {
      console.error('Error submitting attendance', err)
      setError(err.response?.data?.detail || 'Failed to submit attendance')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle individual student correction (in-window)
  const handleSaveCorrection = async (newStatus) => {
    if (!activeSession || !correctingStudent) return
    try {
      setCorrectingLoading(true)
      const res = await studentAttendanceApi.correctAttendance(activeSession.id, correctingStudent.id, {
        new_status: newStatus,
        reason: correctionReason || 'Teacher adjustment'
      })
      setActiveSession(res.data)
      setCorrectingStudent(null)
      setCorrectionReason('')
      setSubmitSuccess(`Updated student ${correctingStudent.roll_number} to ${newStatus}`)
    } catch (err) {
      console.error('Correction failed', err)
      setError(err.response?.data?.detail || 'Correction failed')
    } finally {
      setCorrectingLoading(false)
    }
  }

  // Filtered classes for emergency modal
  const filteredEmergencyClasses = useMemo(() => {
    if (!emergencySearch.trim()) return allClasses
    const q = emergencySearch.toLowerCase()
    return allClasses.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.section?.toLowerCase().includes(q) ||
      c.department_name?.toLowerCase().includes(q)
    )
  }, [allClasses, emergencySearch])

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl border border-indigo-800/40">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-400/30">
              <UsersIcon className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Student Attendance</h1>
              <p className="text-sm text-indigo-200/80">Per-Hour Academic Attendance & Compliance</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {scheduleData && (
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 text-xs">
              <CalIcon className="w-4 h-4 text-indigo-300" />
              <span>{scheduleData.date}</span>
              <span className="w-1 h-1 rounded-full bg-indigo-400"></span>
              <span className="font-bold text-indigo-200">
                {scheduleData.is_holiday ? 'Holiday' : `Day Order ${scheduleData.day_order ?? '-'}`}
              </span>
            </div>
          )}

          <button
            onClick={() => setShowEmergencyModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-900/40 transition-all active:scale-95 border border-rose-400/30"
          >
            <span>🚨</span>
            <span>Emergency Attendance</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm flex items-start gap-3">
          <AlertTriangleIcon className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 font-bold">×</button>
        </div>
      )}

      {submitSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-start gap-3">
          <CheckIcon className="w-5 h-5 flex-shrink-0 text-emerald-600 mt-0.5" />
          <div className="flex-1 font-semibold">{submitSuccess}</div>
          <button onClick={() => setSubmitSuccess('')} className="text-emerald-500 hover:text-emerald-700 font-bold">×</button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center">
          <Spinner className="w-8 h-8 mx-auto text-indigo-600" />
          <p className="mt-3 text-sm text-slate-500 font-medium">Loading schedule and attendance context...</p>
        </div>
      ) : scheduleData?.is_holiday ? (
        <Card className="p-8 text-center bg-amber-50/50 border-amber-200">
          <div className="text-4xl mb-2">🎉</div>
          <h2 className="text-lg font-bold text-amber-900">Today is marked as Non-Working / Holiday</h2>
          <p className="text-sm text-amber-700 mt-1">{scheduleData.holiday_reason || 'No scheduled academic sessions for today.'}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Today's Schedule List */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Today's Classes</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                  {scheduleData?.periods?.length || 0}
                </span>
              </h2>
              <button
                onClick={loadSchedule}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                Refresh
              </button>
            </div>

            {(!scheduleData?.periods || scheduleData.periods.length === 0) ? (
              <Card className="p-6 text-center text-slate-500 text-sm">
                No classes scheduled for you today.
              </Card>
            ) : (
              <div className="space-y-3">
                {scheduleData.periods.map((slot) => {
                  const isSelected = activeClassInfo?.slotId === slot.timetable_slot_id
                  const isSubmitted = slot.session_status === 'SUBMITTED' || slot.session_status === 'SUBMITTED_LATE'

                  return (
                    <div
                      key={slot.timetable_slot_id}
                      onClick={() => handleOpenAttendance(slot)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/70 shadow-md ring-2 ring-indigo-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-md">
                              Period {slot.period_number}
                            </span>
                            {slot.is_substitution && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 font-bold text-xs rounded-md">
                                Substitution
                              </span>
                            )}
                            <span className="text-xs text-slate-500 font-medium">
                              {slot.start_time} - {slot.end_time}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 mt-2">
                            {slot.class_name}
                          </h3>
                          <p className="text-xs text-slate-600 mt-0.5 font-medium">
                            {slot.subject_name}
                          </p>
                        </div>

                        <div>
                          {isSubmitted ? (
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                              slot.session_status === 'SUBMITTED_LATE'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              ✓ {slot.session_status === 'SUBMITTED_LATE' ? 'Late' : 'Submitted'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                              Take
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right Column: Attendance Taker / Session Viewer */}
          <div className="lg:col-span-7">
            {!activeClassInfo ? (
              <Card className="p-12 text-center text-slate-500">
                <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
                  <UsersIcon className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-800">Select a Class to Take Attendance</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Click on any of your scheduled periods on the left, or use Emergency Attendance to handle any class.
                </p>
              </Card>
            ) : rosterLoading ? (
              <Card className="p-12 text-center">
                <Spinner className="w-8 h-8 mx-auto text-indigo-600" />
                <p className="mt-3 text-sm text-slate-500">Loading student roster and session records...</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Active Session Card */}
                <Card className="p-6 border-slate-200">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-indigo-600 text-white font-black text-xs rounded-md">
                          Period {activeClassInfo.periodNumber}
                        </span>
                        {activeClassInfo.isEmergency && (
                          <span className="px-2 py-0.5 bg-rose-600 text-white font-black text-xs rounded-md">
                            EMERGENCY
                          </span>
                        )}
                        {activeClassInfo.isSubstitution && (
                          <span className="px-2 py-0.5 bg-purple-600 text-white font-black text-xs rounded-md">
                            SUBSTITUTION
                          </span>
                        )}
                        <span className="text-xs text-slate-500 font-medium">
                          {activeClassInfo.startTime} - {activeClassInfo.endTime}
                        </span>
                      </div>
                      <h2 className="text-xl font-black text-slate-900 mt-2">
                        {activeClassInfo.className}
                      </h2>
                      <p className="text-sm font-semibold text-slate-600">
                        {activeClassInfo.subjectName}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-black text-indigo-600">
                        {totalCount}
                      </div>
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Total Students
                      </div>
                    </div>
                  </div>

                  {/* Submission Status Banner if session exists */}
                  {activeSession && activeSession.status !== 'OPEN' && activeSession.status !== 'NOT_OPEN' && (
                    <div className={`mt-4 p-3.5 rounded-xl border text-xs flex items-center justify-between ${
                      activeSession.status === 'SUBMITTED' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
                      activeSession.status === 'SUBMITTED_LATE' ? 'bg-amber-50 border-amber-200 text-amber-900' :
                      'bg-slate-100 border-slate-200 text-slate-800'
                    }`}>
                      <div className="flex items-center gap-2 font-medium">
                        <ClockIcon className="w-4 h-4" />
                        <span>Status: <strong>{activeSession.status}</strong></span>
                        {activeSession.submitted_at && (
                          <span className="text-slate-500">
                            • Submitted at {new Date(activeSession.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <div>
                        {activeSession.can_edit ? (
                          <span className="text-emerald-700 font-bold bg-emerald-100/60 px-2 py-0.5 rounded">
                            In Correction Window
                          </span>
                        ) : (
                          <span className="text-slate-600 font-bold bg-slate-200 px-2 py-0.5 rounded">
                            Session Locked
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Live Counters */}
                  <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="text-2xl font-black text-emerald-700">{presentCount}</div>
                      <div className="text-xs font-bold text-emerald-800 uppercase">Present</div>
                    </div>
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                      <div className="text-2xl font-black text-rose-700">{absentCount}</div>
                      <div className="text-xs font-bold text-rose-800 uppercase">Absent</div>
                    </div>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className="text-2xl font-black text-amber-700">{specialCount}</div>
                      <div className="text-xs font-bold text-amber-800 uppercase">Exceptions</div>
                    </div>
                  </div>

                  {/* Absent Last-3-Digits Input Field */}
                  <div className="mt-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                        Absent Students (Enter last 3 digits of roll numbers)
                      </label>
                      {(absentInput || Object.keys(specialStatuses).length > 0) && (
                        <button
                          type="button"
                          onClick={() => { setAbsentInput(''); setSpecialStatuses({}); }}
                          className="text-xs text-rose-600 hover:text-rose-800 font-bold hover:underline"
                        >
                          ✕ Clear All Entries
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={absentInput}
                        onChange={(e) => setAbsentInput(e.target.value)}
                        placeholder="e.g. 044 051 073"
                        disabled={activeSession && !activeSession.can_edit && activeSession.status !== 'OPEN' && activeSession.status !== 'NOT_OPEN'}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono tracking-wide focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all pr-10"
                      />
                      {absentInput && (
                        <button
                          type="button"
                          onClick={() => setAbsentInput('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold"
                          title="Clear input"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      Separate numbers by spaces, commas, or newlines. All other students are automatically marked <strong>PRESENT</strong>.
                    </p>
                  </div>

                  {/* Chip Previews */}
                  {parsedSuffixes.length > 0 && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="text-xs font-bold text-slate-600">Resolved Absentees:</div>
                      <div className="flex flex-wrap gap-2">
                        {suffixValidation.validStudents.map((st) => (
                          <span
                            key={st.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-100 text-rose-800 text-xs font-semibold rounded-lg border border-rose-200"
                          >
                            <span className="font-mono font-bold">{st.roll_suffix || st.roll_number.slice(-3)}</span>
                            <span className="text-slate-600">({st.name})</span>
                          </span>
                        ))}
                        {suffixValidation.invalidTokens.map((tok, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-600 text-white text-xs font-bold rounded-lg shadow-sm"
                          >
                            <span>⚠️ {tok} (Not Found)</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Submission Action Button */}
                  <div className="mt-6">
                    <button
                      onClick={handleSubmitAttendance}
                      disabled={submitting || (activeSession && !activeSession.can_edit && activeSession.status !== 'OPEN' && activeSession.status !== 'NOT_OPEN')}
                      className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-black text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all active:scale-98 flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <Spinner className="w-4 h-4 text-white" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <CheckIcon className="w-5 h-5" />
                          <span>SUBMIT ATTENDANCE</span>
                        </>
                      )}
                    </button>
                  </div>
                </Card>

                {/* Class Student Roster & Quick Overrides */}
                <Card className="p-6 border-slate-200">
                  <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center justify-between">
                    <span>Full Class Roster ({roster.length})</span>
                    <span className="text-xs text-slate-500 font-normal">Click a student to toggle special status (OD / Leave / Medical / Late)</span>
                  </h3>

                  <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                    {roster.map((student) => {
                      const suffix = student.roll_suffix || student.roll_number.slice(-3)
                      const isAbsent = parsedSuffixes.includes(suffix) || parsedSuffixes.includes(student.roll_number)
                      const special = specialStatuses[student.id]

                      let statusBadge = { label: 'PRESENT', color: 'bg-emerald-100 text-emerald-800' }
                      if (isAbsent) statusBadge = { label: 'ABSENT', color: 'bg-rose-100 text-rose-800' }
                      else if (special === 'LATE') statusBadge = { label: 'LATE', color: 'bg-amber-100 text-amber-800' }
                      else if (special === 'ON_DUTY') statusBadge = { label: 'ON DUTY', color: 'bg-blue-100 text-blue-800' }
                      else if (special === 'LEAVE') statusBadge = { label: 'LEAVE', color: 'bg-purple-100 text-purple-800' }
                      else if (special === 'MEDICAL') statusBadge = { label: 'MEDICAL', color: 'bg-red-100 text-red-800' }

                      return (
                        <div
                          key={student.id}
                          className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 text-xs border border-transparent hover:border-slate-200 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                              {suffix}
                            </span>
                            <span className="font-medium text-slate-700">{student.name}</span>
                            <span className="text-slate-400 font-mono">({student.roll_number})</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${statusBadge.color}`}>
                              {statusBadge.label}
                            </span>

                            {activeSession?.can_edit && (
                              <button
                                onClick={() => setCorrectingStudent(student)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-[10px]"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Emergency Attendance Modal */}
      {showEmergencyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>🚨 Emergency Attendance</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Select any active class to take attendance for the current period
                </p>
              </div>
              <button
                onClick={() => setShowEmergencyModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div>
              <input
                type="text"
                value={emergencySearch}
                onChange={(e) => setEmergencySearch(e.target.value)}
                placeholder="Search class or department..."
                className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {filteredEmergencyClasses.map((cls) => (
                <div
                  key={cls.id}
                  onClick={() => handleStartEmergency(cls)}
                  className="p-3 border rounded-xl hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer transition-all flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{cls.name}</h4>
                    <p className="text-xs text-slate-500">{cls.department_name || 'Academic Class'}</p>
                  </div>
                  <span className="text-xs text-indigo-600 font-bold">Select →</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowEmergencyModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-Window Correction Modal */}
      {correctingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              Update Student Attendance
            </h3>
            <p className="text-xs text-slate-500">
              Student: <strong>{correctingStudent.name}</strong> ({correctingStudent.roll_number})
            </p>

            <div className="grid grid-cols-2 gap-2">
              {['PRESENT', 'ABSENT', 'LATE', 'ON_DUTY', 'LEAVE', 'MEDICAL'].map((st) => (
                <button
                  key={st}
                  onClick={() => handleSaveCorrection(st)}
                  disabled={correctingLoading}
                  className="p-2 text-xs font-bold rounded-lg border border-slate-200 hover:border-indigo-600 hover:bg-indigo-50 text-slate-800 transition-all"
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setCorrectingStudent(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
