import { useState, useEffect } from 'react'
import { studentAttendanceApi, intelligenceApi } from '../../api/services'
import { Card, Spinner, Modal } from '../../components/ui'
import {
  UsersIcon, CalIcon, ClockIcon, AlertTriangleIcon, SparklesIcon,
  RefreshIcon, CheckCircleIcon
} from '../../components/icons'

const getTodayString = () => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function HodStudentAttendance() {
  const [overview, setOverview] = useState(null)
  const [selectedDate, setSelectedDate] = useState(getTodayString())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [filterTab, setFilterTab] = useState('ALL') // 'ALL', 'INTELLIGENCE', 'EXCEPTIONS', 'EMERGENCY', 'LATE'

  // Operational Session Absentee Inspection
  const [selectedSessionDetail, setSelectedSessionDetail] = useState(null)
  const [sessionModalOpen, setSessionModalOpen] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Live Intelligence State
  const [liveIntelligence, setLiveIntelligence] = useState(null)
  const [intelligenceEvents, setIntelligenceEvents] = useState([])
  const [lastPollTime, setLastPollTime] = useState(Date.now())
  const [secondsAgo, setSecondsAgo] = useState(0)

  const loadOverview = async (date) => {
    try {
      setLoading(true)
      setError('')
      const res = await studentAttendanceApi.getHodOverview(date)
      setOverview(res.data)
    } catch (err) {
      console.error('Failed to load HOD attendance overview', err)
      setError(err.response?.data?.detail || 'Failed to load attendance records')
    } finally {
      setLoading(false)
    }
  }

  const handleViewSessionAbsentees = async (sessionId) => {
    setLoadingDetail(true)
    setSessionModalOpen(true)
    try {
      const res = await studentAttendanceApi.getSession(sessionId)
      setSelectedSessionDetail(res.data)
    } catch (err) {
      console.error('Failed to load session absentees', err)
      setError('Failed to load session details')
    } finally {
      setLoadingDetail(false)
    }
  }

  const loadLiveIntelligence = async (date) => {
    try {
      const [liveRes, evRes] = await Promise.all([
        intelligenceApi.getLive({ date }),
        intelligenceApi.getEvents({ date }),
      ])
      setLiveIntelligence(liveRes.data)
      setIntelligenceEvents(evRes.data || [])
      setLastPollTime(Date.now())
    } catch (err) {
      console.warn('HOD live intelligence poll failed', err)
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

  useEffect(() => {
    loadOverview(selectedDate)
    loadLiveIntelligence(selectedDate)

    const pollInterval = setInterval(() => {
      loadLiveIntelligence(selectedDate)
    }, 15000)
    return () => clearInterval(pollInterval)
  }, [selectedDate])

  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastPollTime) / 1000))
    }, 1000)
    return () => clearInterval(tick)
  }, [lastPollTime])

  const rawSessions = (overview?.sessions && overview.sessions.length > 0)
    ? overview.sessions
    : (overview?.classes || [])

  const sessionsToDisplay = rawSessions.filter((s) => {
    const statusUpper = (s.status || s.session_status || '').toUpperCase()
    const typeUpper = (s.attendance_type || '').toUpperCase()
    const isEmerg = Boolean(s.is_emergency === true || typeUpper === 'EMERGENCY' || statusUpper === 'EMERGENCY')
    const isLateSub = Boolean(s.is_late_submission === true || statusUpper === 'SUBMITTED_LATE' || statusUpper === 'LATE')

    if (filterTab === 'EXCEPTIONS') {
      return statusUpper === 'MISSED' || isLateSub || isEmerg
    }
    if (filterTab === 'EMERGENCY') return isEmerg
    if (filterTab === 'LATE') return isLateSub
    return true
  })

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <span className="p-2.5 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-400/30">
            <UsersIcon className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Student Attendance Console</h1>
            <p className="text-xs text-slate-400">Departmental Real-Time Period Monitoring & Compliance</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
            <CalIcon className="w-4 h-4 text-indigo-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white focus:outline-none font-medium cursor-pointer"
            />
          </div>
          {overview && (
            <span className="px-3 py-1.5 bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 text-xs font-bold rounded-xl">
              Day Order {overview.day_order ?? '-'}
            </span>
          )}
        </div>
      </div>

      {/* ── LIVE DEPARTMENT INTELLIGENCE MONITOR ── */}
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
                Department Intelligence Monitor
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${secondsAgo > 45 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'}`}>
                {secondsAgo > 45 ? 'STALE · RECONNECTING...' : `LIVE · UPDATED ${secondsAgo}s AGO`}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Continuously evaluating teaching periods, student attendance drops, and emergency substitutions.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-3 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs text-white">
            <div>
              <span className="text-slate-400 text-[10px] block font-semibold">CONDUCTED / SCHEDULED</span>
              <span className="font-black text-slate-100">{liveIntelligence?.conducted_count ?? '-'} / {liveIntelligence?.scheduled_count ?? '-'}</span>
            </div>
            <div className="h-6 w-px bg-slate-700" />
            <div>
              <span className="text-slate-400 text-[10px] block font-semibold">CAPTURED</span>
              <span className="font-black text-emerald-400">{liveIntelligence?.captured_percentage ?? '-'}%</span>
            </div>
          </div>

          <button
            onClick={() => setFilterTab('INTELLIGENCE')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              (liveIntelligence?.needs_attention_count || 0) > 0
                ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/40 shadow-sm shadow-rose-900/40 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            <AlertTriangleIcon className="w-3.5 h-3.5 text-rose-400" />
            <span>Active Alerts: <strong className="text-white font-black">{liveIntelligence?.needs_attention_count ?? 0}</strong></span>
          </button>

          <button
            onClick={() => {
              loadOverview(selectedDate)
              loadLiveIntelligence(selectedDate)
            }}
            className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 hover:text-white transition-colors"
            title="Refresh Department Intelligence"
          >
            <RefreshIcon className="w-3.5 h-3.5 text-indigo-400" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm flex items-center gap-2">
          <AlertTriangleIcon className="w-5 h-5 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center gap-2">
          <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center">
          <Spinner className="w-8 h-8 mx-auto text-indigo-600" />
          <p className="mt-3 text-sm text-slate-500 font-medium">Gathering period attendance analytics...</p>
        </div>
      ) : !overview ? (
        <Card className="p-8 text-center text-slate-500">No attendance data found for this date.</Card>
      ) : (
        <>
          {/* KPI Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Scheduled</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{overview.total_scheduled_sessions ?? overview.total_classes ?? 0}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Total class hours</div>
            </div>

            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm">
              <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Submitted</div>
              <div className="text-2xl font-black text-emerald-700 mt-1">{overview.submitted_count ?? 0}</div>
              <div className="text-[11px] text-emerald-600 mt-0.5">Recorded on time</div>
            </div>

            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm">
              <div className="text-xs font-bold text-amber-800 uppercase tracking-wider">Late Submissions</div>
              <div className="text-2xl font-black text-amber-700 mt-1">{overview.late_submission_count ?? overview.late_count ?? 0}</div>
              <div className="text-[11px] text-amber-600 mt-0.5">&gt; 15 min threshold</div>
            </div>

            <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 shadow-sm">
              <div className="text-xs font-bold text-purple-800 uppercase tracking-wider">Emergency Coverage</div>
              <div className="text-2xl font-black text-purple-700 mt-1">{overview.emergency_count ?? 0}</div>
              <div className="text-[11px] text-purple-600 mt-0.5">Unregistered subs</div>
            </div>

            <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-200 shadow-sm col-span-2 md:col-span-1">
              <div className="text-xs font-bold text-indigo-800 uppercase tracking-wider">Student Attendance</div>
              <div className="text-2xl font-black text-indigo-700 mt-1">{overview.overall_attendance_percentage ?? overview.student_attendance_percentage ?? 0}%</div>
              <div className="text-[11px] text-indigo-600 mt-0.5">Present across dept</div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
            {[
              { id: 'ALL', label: 'All Sessions' },
              { id: 'INTELLIGENCE', label: `⚡ Department Alerts (${intelligenceEvents.length})` },
              { id: 'EXCEPTIONS', label: `Exceptions (${overview.exceptions?.length || 0})` },
              { id: 'LATE', label: `Late (${overview.late_submission_count ?? overview.late_count ?? 0})` },
              { id: 'EMERGENCY', label: `Emergency (${overview.emergency_count ?? 0})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all ${
                  filterTab === tab.id
                    ? 'bg-slate-900 text-white shadow'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB: INTELLIGENCE ALERTS VIEW */}
          {filterTab === 'INTELLIGENCE' ? (
            <div className="space-y-3">
              {intelligenceEvents.map((ev) => {
                const isCrit = ev.severity === 'critical'
                const isHigh = ev.severity === 'high'
                const isAck = ev.state === 'acknowledged'
                return (
                  <div
                    key={ev.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isCrit
                        ? 'bg-rose-50/70 border-rose-200 shadow-sm'
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
                              isCrit ? 'bg-rose-600 text-white' : isHigh ? 'bg-amber-600 text-white' : 'bg-indigo-600 text-white'
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

                      {!isAck && (
                        <button
                          onClick={() => handleAcknowledgeEvent(ev.id)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm self-end sm:self-center"
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              {intelligenceEvents.length === 0 && (
                <div className="py-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
                  No active operational alerts detected for this department.
                </div>
              )}
            </div>
          ) : (
            /* Sessions Table */
            <Card className="p-0 overflow-hidden border-slate-200 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                      <th className="py-3 px-4">Period</th>
                      <th className="py-3 px-4">Class & Section</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Teacher (Scheduled / Actual)</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Present / Total</th>
                      <th className="py-3 px-4">Submission Time</th>
                      <th className="py-3 px-4 text-right">Absent Rolls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {sessionsToDisplay.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          No sessions match the selected filter.
                        </td>
                      </tr>
                    ) : (
                      sessionsToDisplay.map((s) => {
                        const statusUpper = (s.status || s.session_status || '').toUpperCase()
                        const typeUpper = (s.attendance_type || '').toUpperCase()
                        const isLate = s.is_late_submission || statusUpper === 'SUBMITTED_LATE'
                        const isEmergency = s.is_emergency || typeUpper === 'EMERGENCY'
                        const isSubst = typeUpper === 'REGISTERED_SUBSTITUTION'
                        const pct = s.total_students > 0 ? Math.round((s.present_count / s.total_students) * 100) : (s.percentage || 0)
                        const sessionId = s.id || s.session_id
                        const actualTeacher = s.actual_teacher_name || s.actual_teacher || (isEmergency ? 'Emergency Faculty' : 'Unassigned')
                        const schedTeacher = s.scheduled_teacher_name || s.scheduled_teacher

                        return (
                          <tr key={sessionId ? `sess_${sessionId}` : `slot_${s.class_id}_${s.period_number}`} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3.5 px-4 font-black text-slate-900">
                              P{s.period_number}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-slate-800">
                              {s.class_name} {s.section ? `(${s.section})` : ''}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 font-medium">
                              {s.subject_name || (isEmergency ? 'Emergency Session' : 'N/A')}
                            </td>
                            <td className="py-3.5 px-4 text-slate-700">
                              <div className="font-semibold">{actualTeacher}</div>
                              {schedTeacher && schedTeacher !== actualTeacher && (
                                <div className="text-[10px] text-slate-400">
                                  Sched: {schedTeacher}
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                  isEmergency
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : isSubst
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-slate-50 text-slate-700 border-slate-200'
                                }`}
                              >
                                {isEmergency ? 'EMERGENCY' : typeUpper.replace('_', ' ') || 'NORMAL'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                  statusUpper === 'SUBMITTED'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : isLate
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : statusUpper === 'LOCKED'
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                    : statusUpper === 'MISSED'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                {statusUpper.replace('_', ' ') || 'NOT OPEN'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-700">
                              {s.present_count} / {s.total_students}{' '}
                              <span className={`text-[11px] ${pct < 75 ? 'text-rose-600' : 'text-slate-400'}`}>
                                ({pct}%)
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 font-medium">
                              {s.submitted_at ? new Date(s.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              {sessionId ? (
                                <button
                                  onClick={() => handleViewSessionAbsentees(sessionId)}
                                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all shadow-sm ${
                                    s.absent_count > 0
                                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                  }`}
                                >
                                  {s.absent_count > 0 ? `View ${s.absent_count} Absentees` : '100% Present'}
                                </button>
                              ) : (
                                <span className="text-slate-400 text-[11px] italic">Not Conducted</span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* HOD Operational Absentee Roll Inspection Modal */}
      <Modal
        open={sessionModalOpen}
        onClose={() => { setSessionModalOpen(false); setSelectedSessionDetail(null); }}
        title={`Session Attendance: ${selectedSessionDetail?.class_name || ''} (Period ${selectedSessionDetail?.period_number || ''})`}
      >
        {loadingDetail ? (
          <div className="p-8 text-center"><Spinner className="w-6 h-6 mx-auto text-indigo-600" /></div>
        ) : selectedSessionDetail ? (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Total</span>
                <div className="text-base font-black text-slate-900">{selectedSessionDetail.total_students}</div>
              </div>
              <div>
                <span className="text-[10px] text-emerald-600 uppercase font-bold">Present</span>
                <div className="text-base font-black text-emerald-700">{selectedSessionDetail.present_count}</div>
              </div>
              <div>
                <span className="text-[10px] text-rose-600 uppercase font-bold">Absent</span>
                <div className="text-base font-black text-rose-700">{selectedSessionDetail.absent_count}</div>
              </div>
            </div>

            <div>
              <div className="text-xs font-black uppercase text-slate-700 tracking-wider mb-2">
                Authoritative Absent Roll Numbers ({selectedSessionDetail.absent_count})
              </div>
              {selectedSessionDetail.records?.filter(r => r.status === 'absent').length === 0 ? (
                <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold text-center border border-emerald-200">
                  ✓ 100% Attendance — Zero Absentees in this session.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedSessionDetail.records
                    ?.filter(r => r.status === 'absent')
                    .map((r, i) => (
                      <div
                        key={i}
                        className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs font-mono font-black shadow-sm"
                      >
                        {r.student_roll}
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSessionModalOpen(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
