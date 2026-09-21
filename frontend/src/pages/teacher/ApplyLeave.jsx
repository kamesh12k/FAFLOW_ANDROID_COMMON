import { useEffect, useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { leavesApi, academicCalendarApi, campusOperationsApi, timetableApi } from '../../api/services'
import { useAuth } from '../../context/AuthContext'
import { ErrorAlert, Spinner } from '../../components/ui'
import { CheckCircleIcon } from '../../components/icons'

function ArrowLeftIcon(props) {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  )
}

function ClockIcon(props) {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="12" r="9" strokeWidth="2" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 7v5l3 2" />
    </svg>
  )
}

function ChevronDownIcon(props) {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function SparklesIcon(props) {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 00-2.456-2.456L14.25 6l1.035-.259a3.375 3.375 0 002.456-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  )
}

function ScoreBar({ score }) {
  const color = score >= 75 ? 'bg-emerald-500' : score >= 45 ? 'bg-amber-500' : 'bg-slate-400'
  return (
    <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden shrink-0">
      <div className={`h-full ${color} rounded-full transition-all duration-300`} style={{ width: `${Math.min(score, 100)}%` }} />
    </div>
  )
}

function RecommendationCard({ rec, isSelected, onSelect, periodNumber }) {
  const teacher = rec.teacher || {}
  const teacherName = teacher.name || rec.name || 'Faculty Member'
  const deptName = teacher.department || rec.department_name || teacher.department_name
  const initial = (teacherName || 'T')[0].toUpperCase()

  const todayLoad = rec.today_workload !== undefined ? rec.today_workload : (teacher.today_workload ?? 0)
  const projToday = rec.projected_today_workload !== undefined ? rec.projected_today_workload : (todayLoad !== undefined ? todayLoad + 1 : undefined)
  const weekLoad = rec.week_workload !== undefined ? rec.week_workload : (teacher.week_workload ?? 0)
  const projWeek = rec.projected_week_workload !== undefined ? rec.projected_week_workload : (weekLoad !== undefined ? weekLoad + 1 : undefined)
  const contLoad = rec.longest_continuous_periods
  const projCont = rec.projected_longest_continuous_periods
  const todayPeriods = rec.today_periods || teacher.today_periods || []
  const score = rec.compatibility_score ?? rec.score ?? 50
  const tier = rec.tier || (score >= 75 ? 'EXCELLENT' : score >= 45 ? 'GOOD' : 'FAIR')

  return (
    <div className={`p-3.5 bg-white hover:bg-slate-50/90 border rounded-2xl transition shadow-xs space-y-3 ${
      isSelected ? 'border-emerald-400 ring-2 ring-emerald-500/20 bg-emerald-50/20' : 'border-slate-200/90'
    }`}>
      {/* Top Header: Avatar, Name, Dept, Match %, Assign Button */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`w-10 h-10 rounded-xl text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs ${
            isSelected ? 'bg-emerald-600' : 'bg-gradient-to-br from-indigo-600 to-indigo-800'
          }`}>
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-slate-900 truncate">{teacherName}</h4>
              {deptName && (
                <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-semibold shrink-0 border border-slate-200/70">
                  {deptName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <ScoreBar score={score} />
              {tier && (
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                  tier === 'EXCELLENT' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                  tier === 'GOOD' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                  tier === 'FAIR' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                  'bg-slate-100 text-slate-700 border border-slate-300'
                }`}>
                  {tier}
                </span>
              )}
              <span className="text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                Suitability: {Math.max(0, Math.min(100, Math.round(Number(score) || 0)))}/100
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onSelect}
          className={`text-xs font-bold px-4 py-2 rounded-xl transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer ${
            isSelected
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white'
          }`}
        >
          {isSelected ? '✓ Nominated' : 'Assign'}
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

      {/* Distinct Context Badges / Reasons */}
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

const PERIOD_TIMES = {
  1: '09:20–10:20',
  2: '10:20–11:15',
  3: '11:40–12:35',
  4: '13:35–14:30',
  5: '14:55–15:50',
}

function pad(n) { return String(n).padStart(2, '0') }
function isoFor(daysFromToday) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromToday)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatReadableDate(isoStr) {
  if (!isoStr) return '—'
  try {
    const [y, m, d] = isoStr.split('-')
    if (!y || !m || !d) return isoStr
    const dt = new Date(Number(y), Number(m) - 1, Number(d))
    return dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return isoStr
  }
}

const REASON_PRESETS = [
  { label: 'Personal', value: 'Personal reason' },
  { label: 'Medical', value: 'Medical leave' },
  { label: 'Conference', value: 'Conference attendance' },
  { label: 'Family', value: 'Family event' },
]

export default function ApplyLeave() {
  const { user } = useAuth()
  const [form, setForm] = useState({
    date: isoFor(1),
    mode: 'whole_day', // 'whole_day' | 'custom'
    period_numbers: [],
    reason: '',
  })
  const [calendarInfo, setCalendarInfo] = useState(null)
  const [checkingDate, setCheckingDate] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successData, setSuccessData] = useState(null)
  const [campusMode, setCampusMode] = useState('assisted')
  const [candidatesMap, setCandidatesMap] = useState({})
  const [selectedSubstitutes, setSelectedSubstitutes] = useState({})
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [teacherSlots, setTeacherSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [expandedPeriod, setExpandedPeriod] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    campusOperationsApi.getMode()
      .then(r => setCampusMode(r.data?.mode || 'assisted'))
      .catch(() => setCampusMode('assisted'))
  }, [])

  // Fetch teacher's timetable slots once
  useEffect(() => {
    if (!user?.id) return
    setLoadingSlots(true)
    timetableApi.getByTeacher(user.id)
      .then(res => setTeacherSlots(res.data || []))
      .catch(err => {
        console.error('Failed to load teacher timetable slots:', err)
        setTeacherSlots([])
      })
      .finally(() => setLoadingSlots(false))
  }, [user?.id])

  useEffect(() => {
    if (!form.date) {
      setCalendarInfo(null)
      return
    }
    setCheckingDate(true)
    academicCalendarApi.resolve(form.date)
      .then(r => setCalendarInfo(r.data))
      .catch(() => setCalendarInfo(null))
      .finally(() => setCheckingDate(false))
  }, [form.date])

  const isBlocked = Boolean(calendarInfo?.blocks_operations)
  const dayOrder = calendarInfo?.day_order

  // Scheduled timetable slots for the selected day order
  const scheduledSlotsForDayOrder = useMemo(() => {
    if (!dayOrder || !teacherSlots.length) return []
    return teacherSlots
      .filter(s => s.day_order === dayOrder)
      .sort((a, b) => a.period_number - b.period_number)
  }, [dayOrder, teacherSlots])

  // Derive active period numbers and affected classes list
  const { activePeriodNumbers, affectedClasses } = useMemo(() => {
    if (form.mode === 'whole_day') {
      if (scheduledSlotsForDayOrder.length > 0) {
        return {
          activePeriodNumbers: scheduledSlotsForDayOrder.map(s => s.period_number),
          affectedClasses: scheduledSlotsForDayOrder.map(s => ({
            period: s.period_number,
            className: s.class_name ? `${s.class_name}${s.class_section ? ' · ' + s.class_section : ''}` : `Class P${s.period_number}`,
            subject: s.subject_name || s.subject_code || 'Scheduled Class',
            subjectCode: s.subject_code,
            time: PERIOD_TIMES[s.period_number] || '—',
            room: s.room_number,
            isScheduled: true,
          }))
        }
      }
      // If calendar is resolved and working day, but teacher has no timetable slots on this day order:
      if (calendarInfo && !isBlocked) {
        if (teacherSlots.length > 0) {
          // Teacher has timetable configured, but 0 classes on this day order
          return { activePeriodNumbers: [], affectedClasses: [] }
        } else {
          // Teacher has no timetable at all in system, fallback to periods 1..5
          const defaultPeriods = [1, 2, 3, 4, 5]
          return {
            activePeriodNumbers: defaultPeriods,
            affectedClasses: defaultPeriods.map(p => ({
              period: p,
              className: `Period P${p}`,
              subject: 'Class Lecture',
              subjectCode: null,
              time: PERIOD_TIMES[p] || '—',
              room: null,
              isScheduled: false,
            }))
          }
        }
      }
      return { activePeriodNumbers: [], affectedClasses: [] }
    } else {
      // Custom mode: user-selected periods
      const periods = form.period_numbers
      return {
        activePeriodNumbers: periods,
        affectedClasses: periods.map(p => {
          const s = scheduledSlotsForDayOrder.find(slot => slot.period_number === p)
          if (s) {
            return {
              period: p,
              className: s.class_name ? `${s.class_name}${s.class_section ? ' · ' + s.class_section : ''}` : `Class P${p}`,
              subject: s.subject_name || s.subject_code || 'Scheduled Class',
              subjectCode: s.subject_code,
              time: PERIOD_TIMES[p] || '—',
              room: s.room_number,
              isScheduled: true,
            }
          }
          return {
            period: p,
            className: `Period P${p}`,
            subject: 'Class Lecture',
            subjectCode: null,
            time: PERIOD_TIMES[p] || '—',
            room: null,
            isScheduled: false,
          }
        })
      }
    }
  }, [form.mode, form.period_numbers, scheduledSlotsForDayOrder, calendarInfo, isBlocked, teacherSlots.length])

  // Fetch slot candidates only for the active periods requiring substitutes
  useEffect(() => {
    if (campusMode !== 'flexible' || !form.date || isBlocked || activePeriodNumbers.length === 0) {
      setCandidatesMap({})
      return
    }

    let isMounted = true
    setLoadingCandidates(true)

    const promises = activePeriodNumbers.map(p =>
      leavesApi.slotCandidates({ date: form.date, period_number: p })
        .then(res => ({ period: p, candidates: res.data || [] }))
        .catch(err => {
          console.error(`Failed to load candidates for period ${p}:`, err)
          return { period: p, candidates: [] }
        })
    )

    Promise.all(promises).then(results => {
      if (!isMounted) return
      const map = {}
      results.forEach(r => {
        map[r.period] = r.candidates
      })
      setCandidatesMap(map)
      setLoadingCandidates(false)
    })

    return () => { isMounted = false }
  }, [campusMode, form.date, isBlocked, activePeriodNumbers.join(',')])

  const togglePeriod = (p) => {
    setForm(f => {
      const exists = f.period_numbers.includes(p)
      const next = exists ? f.period_numbers.filter(x => x !== p) : [...f.period_numbers, p]
      return { ...f, period_numbers: next.sort((a, b) => a - b) }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.date) {
      setError('Please select a leave date.')
      return
    }

    if (isBlocked) {
      setError(`${form.date} is marked as ${calendarInfo?.day_type?.replace('_', ' ') || 'non-working'} — leave cannot be requested for this date.`)
      return
    }

    if (form.mode === 'custom' && form.period_numbers.length === 0) {
      setError('Please select at least one class period.')
      return
    }

    if (!form.reason.trim()) {
      setError('Please provide a reason for your leave request.')
      return
    }

    if (campusMode === 'flexible' && activePeriodNumbers.length > 0) {
      const missingSubstitutes = activePeriodNumbers.filter(p => !selectedSubstitutes[p])
      if (missingSubstitutes.length > 0) {
        setError(`Please select a proposed substitute for Period ${missingSubstitutes.map(p => `P${p}`).join(', ')}. In Flexible Mode, proposing substitutes is mandatory for scheduled classes.`)
        return
      }
    }

    setLoading(true)
    try {
      if (form.mode === 'whole_day') {
        const payload = {
          date: form.date,
          whole_day: true,
          reason: form.reason.trim(),
        }
        if (campusMode === 'flexible' && activePeriodNumbers.length > 0) {
          payload.period_substitutes = selectedSubstitutes
        }
        await leavesApi.applyBatch(payload)
      } else if (form.period_numbers.length === 1) {
        const p = form.period_numbers[0]
        const payload = {
          date: form.date,
          period_number: p,
          reason: form.reason.trim(),
        }
        if (campusMode === 'flexible') {
          payload.proposed_substitute_id = selectedSubstitutes[p]
        }
        await leavesApi.apply(payload)
      } else {
        const payload = {
          date: form.date,
          period_numbers: form.period_numbers,
          reason: form.reason.trim(),
        }
        if (campusMode === 'flexible') {
          payload.period_substitutes = selectedSubstitutes
        }
        await leavesApi.applyBatch(payload)
      }

      setSuccessData({
        date: form.date,
        day_order: calendarInfo?.day_order,
        duration: form.mode === 'whole_day'
          ? (activePeriodNumbers.length > 0 ? `Whole Day (${activePeriodNumbers.length} Scheduled Class${activePeriodNumbers.length > 1 ? 'es' : ''})` : 'Whole Day (No Scheduled Classes)')
          : `Periods P${form.period_numbers.join(', P')}`,
        reason: form.reason.trim(),
        isFlexible: campusMode === 'flexible',
      })

      setTimeout(() => navigate('/teacher/leaves'), 2200)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit leave request. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Success Confirmation State ──
  if (successData) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircleIcon className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <h2 className="text-base font-bold text-slate-900">Leave Request Submitted</h2>
              <p className="text-xs text-slate-500">
                {successData.isFlexible
                  ? 'Your leave request and proposed substitutes have been submitted. They will be officially assigned once your HOD approves.'
                  : 'Your leave request has been recorded successfully and routed for administration.'}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200/80 space-y-2.5 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Date</span>
              <span className="font-bold text-slate-900">{formatReadableDate(successData.date)}</span>
            </div>
            {successData.day_order && (
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Day Order</span>
                <span className="font-bold text-slate-900">Day Order {successData.day_order}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Duration</span>
              <span className="font-bold text-slate-900">{successData.duration}</span>
            </div>
            <div className="flex justify-between items-start py-1">
              <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Reason</span>
              <span className="font-semibold text-slate-800 text-right max-w-xs">{successData.reason}</span>
            </div>
            {successData.isFlexible && (
              <div className="flex justify-between items-center py-1 border-t border-slate-200/60">
                <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Proposed Substitutes</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  Pending HOD Approval
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 text-xs">
            <span className="text-slate-400">Redirecting to leave history…</span>
            <Link
              to="/teacher/leaves"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold transition"
            >
              View Leave History
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const dateShortcuts = [
    { label: 'Today', value: isoFor(0) },
    { label: 'Tomorrow', value: isoFor(1) },
    { label: 'In 2 days', value: isoFor(2) },
    { label: 'Next week', value: isoFor(7) },
  ]

  const formattedPeriodString = form.mode === 'whole_day'
    ? (activePeriodNumbers.length > 0 ? `Whole Day (${activePeriodNumbers.length} Classes)` : 'Whole Day')
    : form.period_numbers.length > 0
    ? `Periods ${form.period_numbers.join(', ')}`
    : 'None selected'

  const assignedCount = activePeriodNumbers.filter(p => selectedSubstitutes[p]).length

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Apply for Leave
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Submit a leave request for a working day or specific teaching periods.
          </p>
        </div>

        <Link
          to="/teacher/leaves"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition shadow-xs self-start sm:self-auto"
        >
          <ArrowLeftIcon className="w-3.5 h-3.5" />
          <span>Back to Leave History</span>
        </Link>
      </div>

      {/* ── Flexible Mode Active Banner ── */}
      {campusMode === 'flexible' && (
        <div className="flex items-start gap-3 p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 border border-indigo-300 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-indigo-900">Flexible Mode is Active</p>
            <p className="text-[11px] text-indigo-700 mt-0.5 leading-snug">
              You must propose an eligible substitute teacher for each affected class. They will be officially assigned once your HOD approves the request.
            </p>
          </div>
        </div>
      )}

      {error && <ErrorAlert message={error} />}

      {/* ── 2-Column Desktop Grid Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── Left Column (Main Working Panel: LEAVE REQUEST) ── */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
          <div className="p-5 sm:p-6 space-y-1">
            <h2 className="text-base font-bold text-slate-900">Leave Request</h2>
            <p className="text-xs text-slate-500">Select the date, duration and reason for your leave.</p>
          </div>

          <form onSubmit={handleSubmit} className="divide-y divide-slate-100">
            {/* 1. Date Selection */}
            <div className="p-5 sm:p-6 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  Date
                </label>
                {checkingDate && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                    <Spinner size="xs" /> Checking calendar…
                  </span>
                )}
              </div>

              {/* Date Input */}
              <div className="relative">
                <input
                  type="date"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:border-primary-600 transition"
                  value={form.date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                />
              </div>

              {/* Quick Date Shortcuts */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-[11px] text-slate-400 font-medium">Quick select:</span>
                {dateShortcuts.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setForm({ ...form, date: s.value })}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition ${
                      form.date === s.value
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Blocked Date Warning Alert */}
              {isBlocked && !checkingDate && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-0.5">
                  <p className="font-bold">Leave cannot be requested for this date</p>
                  <p className="text-rose-700 text-[11px]">
                    The selected date is marked as {calendarInfo?.day_type?.replace('_', ' ') || 'non-working'}. Please choose a scheduled working day.
                  </p>
                </div>
              )}
            </div>

            {/* 2. Leave Duration */}
            <div className="p-5 sm:p-6 space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                Leave Duration
              </label>

              {/* Duration Segmented Control */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, mode: 'whole_day', period_numbers: [] })}
                  className={`p-3.5 rounded-lg border text-left transition ${
                    form.mode === 'whole_day'
                      ? 'border-primary-600 bg-primary-50/50 text-primary-950 font-bold'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 font-medium'
                  }`}
                >
                  <span className="text-xs block">Whole Day</span>
                  <span className="text-[11px] text-slate-500 font-normal block mt-0.5">
                    {scheduledSlotsForDayOrder.length > 0
                      ? `${scheduledSlotsForDayOrder.length} scheduled class${scheduledSlotsForDayOrder.length > 1 ? 'es' : ''}`
                      : 'All scheduled periods'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setForm({ ...form, mode: 'custom' })}
                  className={`p-3.5 rounded-lg border text-left transition ${
                    form.mode === 'custom'
                      ? 'border-primary-600 bg-primary-50/50 text-primary-950 font-bold'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 font-medium'
                  }`}
                >
                  <span className="text-xs block">Specific Periods</span>
                  <span className="text-[11px] text-slate-500 font-normal block mt-0.5">Select individual periods</span>
                </button>
              </div>

              {/* Specific Periods Selector */}
              {form.mode === 'custom' && (
                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2.5 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Select Periods</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, period_numbers: [1, 2, 3] })}
                        className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-slate-200 text-slate-600 rounded hover:bg-slate-100"
                      >
                        Morning (P1–P3)
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, period_numbers: [4, 5] })}
                        className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-slate-200 text-slate-600 rounded hover:bg-slate-100"
                      >
                        Afternoon (P4–P5)
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, period_numbers: [1, 2, 3, 4, 5] })}
                        className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-slate-200 text-slate-600 rounded hover:bg-slate-100"
                      >
                        All (P1–P5)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map(p => {
                      const selected = form.period_numbers.includes(p)
                      const isScheduled = scheduledSlotsForDayOrder.some(s => s.period_number === p)
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => togglePeriod(p)}
                          className={`py-2 px-1 rounded-md border text-center transition flex flex-col items-center justify-center relative ${
                            selected
                              ? 'bg-primary-600 border-primary-600 text-white font-bold'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 font-semibold'
                          }`}
                        >
                          <span className="text-xs flex items-center gap-1">
                            P{p}
                            {isScheduled && (
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${selected ? 'bg-white' : 'bg-emerald-500'}`}
                                title="Teaching class scheduled"
                              />
                            )}
                          </span>
                          <span className={`text-[9px] ${selected ? 'text-primary-100' : 'text-slate-400'}`}>
                            {PERIOD_TIMES[p]}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {form.mode === 'whole_day' && (
                <p className="text-[11px] text-slate-500 pt-0.5">
                  {dayOrder ? (
                    scheduledSlotsForDayOrder.length > 0
                      ? `Day Order ${dayOrder}: You have ${scheduledSlotsForDayOrder.length} scheduled class${scheduledSlotsForDayOrder.length > 1 ? 'es' : ''} on this day.`
                      : `Day Order ${dayOrder}: You have no scheduled classes on this day.`
                  ) : (
                    'All scheduled teaching periods for the selected working day will be included.'
                  )}
                </p>
              )}
            </div>

            {/* ── 2.5 AFFECTED CLASSES & COMPACT SUBSTITUTION ROWS ── */}
            {/* Dense Horizontal Rows (44–56px height per row, Teams / Scheduling software look) */}
            <div className="p-5 sm:p-6 space-y-3 bg-slate-50/40 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-800 block">
                      Affected Classes ({affectedClasses.length})
                    </label>
                    {campusMode === 'flexible' && (
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                        Substitute Required
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {campusMode === 'flexible'
                      ? 'Click any class row to view ranked candidates with full workload simulations, back-to-back checks, and reason signals.'
                      : 'Scheduled teaching slots recorded for your leave.'}
                  </p>
                </div>

                {campusMode === 'flexible' && affectedClasses.length > 0 && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                      assignedCount === affectedClasses.length
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        : 'text-amber-700 bg-amber-50 border-amber-200'
                    }`}>
                      {assignedCount}/{affectedClasses.length} covered
                    </span>
                    {loadingCandidates && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-indigo-600 font-medium">
                        <Spinner size="xs" /> Finding faculty…
                      </span>
                    )}
                  </div>
                )}
              </div>

              {loadingSlots ? (
                <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Spinner size="xs" /> Loading scheduled classes…
                </div>
              ) : affectedClasses.length === 0 ? (
                <div className="p-4 rounded-[12px] bg-white border border-slate-200/80 text-center text-xs text-slate-500">
                  {dayOrder ? (
                    <span>No teaching classes scheduled for you on Day Order {dayOrder}. Whole-day leave will be recorded without requiring substitutions.</span>
                  ) : (
                    <span>Select a date and leave duration above to see affected classes.</span>
                  )}
                </div>
              ) : (
                /* Dense Horizontal List (Container) */
                <div className="space-y-2">
                  {affectedClasses.map(cls => {
                    const p = cls.period
                    const candidates = candidatesMap[p] || []
                    const selectedId = selectedSubstitutes[p]
                    const selectedCand = candidates.find(c => (c.teacher?.id || c.id) === selectedId)
                    const selectedName = selectedCand?.teacher?.name || selectedCand?.name
                    const isExpanded = expandedPeriod === p

                    return (
                      <div
                        key={p}
                        className={`border rounded-[14px] transition-all bg-white overflow-hidden ${
                          isExpanded
                            ? 'border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                            : 'border-slate-200/90 hover:border-slate-300 shadow-[0_1px_2px_rgba(0,0,0,0.02)]'
                        }`}
                      >
                        {/* ── Compact Pill / Dense Horizontal Row (approx 44–56px height on desktop) ── */}
                        {/* Structure: [ PERIOD ] [ CLASS ] [ SUBJECT ] [ TIME ] [ SUBSTITUTE STATUS ] [ > ] */}
                        <div
                          onClick={() => {
                            if (campusMode === 'flexible') {
                              setExpandedPeriod(prev => prev === p ? null : p)
                            }
                          }}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 sm:px-3.5 py-2 sm:py-2.5 min-h-[46px] sm:h-[50px] transition-colors ${
                            campusMode === 'flexible' ? 'cursor-pointer hover:bg-slate-50/70' : ''
                          }`}
                        >
                          {/* Left Section: [ PERIOD ] [ CLASS ] [ SUBJECT ] [ TIME ] */}
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                            {/* [ PERIOD ] */}
                            <span className="w-8 h-6 rounded-[6px] bg-slate-900 text-white font-mono text-[11px] font-bold tracking-tight flex items-center justify-center shrink-0 shadow-2xs">
                              P{p}
                            </span>

                            {/* [ CLASS ] */}
                            <span className="text-xs font-bold text-slate-800 truncate max-w-[120px] sm:max-w-[140px] shrink-0">
                              {cls.className}
                            </span>

                            {/* [ SUBJECT ] */}
                            <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate text-xs text-slate-600">
                              {cls.subjectCode && (
                                <span className="font-semibold text-slate-700 font-mono text-[11px] shrink-0">
                                  {cls.subjectCode}
                                </span>
                              )}
                              <span className="truncate text-slate-500 text-[11px] sm:text-xs">
                                {cls.subject}
                              </span>
                            </div>

                            {/* [ TIME ] */}
                            <span className="text-[11px] font-mono text-slate-400 shrink-0 hidden md:inline-flex items-center gap-1">
                              <ClockIcon className="w-3 h-3 text-slate-300 shrink-0" />
                              {cls.time}
                            </span>
                          </div>

                          {/* Right Section: [ SUBSTITUTE STATUS ] [ > ] */}
                          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                            {/* Mobile Time */}
                            <span className="text-[10px] font-mono text-slate-400 sm:hidden">
                              {cls.time}
                            </span>

                            {campusMode === 'flexible' ? (
                              <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                                {/* [ SUBSTITUTE STATUS ] */}
                                {selectedId ? (
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                    <span className="truncate max-w-[120px] sm:max-w-[150px]">
                                      {selectedName || 'Substitute Nominated'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedSubstitutes(prev => ({ ...prev, [p]: null }))
                                      }}
                                      className="text-emerald-600 hover:text-rose-600 hover:bg-emerald-100 rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold text-xs transition shrink-0 ml-0.5"
                                      title="Clear proposed substitute"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold hover:bg-amber-100 transition">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                                    <span>Select Sub</span>
                                  </span>
                                )}

                                {/* [ > ] */}
                                <span className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 transition">
                                  <ChevronDownIcon
                                    className={`w-3.5 h-3.5 transform transition-transform duration-200 ${
                                      isExpanded ? 'rotate-180 text-indigo-600' : ''
                                    }`}
                                  />
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                Auto-coverage
                              </span>
                            )}
                          </div>
                        </div>

                        {/* ── Rich Intelligent Recommendation Drawer (Exact module requested from Leaves.jsx) ── */}
                        {isExpanded && campusMode === 'flexible' && (
                          <div className="border-t border-slate-100 bg-slate-50/70 p-3 sm:p-4 space-y-3">
                            {/* Header: Recommended Candidates (N) + Ranked by score & workload */}
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                                <SparklesIcon className="w-3.5 h-3.5 text-primary-500" />
                                Recommended Candidates ({candidates.length})
                              </p>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-400 font-medium">Ranked by score &amp; workload</span>
                                {selectedId && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedSubstitutes(prev => ({ ...prev, [p]: null }))}
                                    className="text-rose-600 font-semibold hover:underline text-[10px] ml-1"
                                  >
                                    Clear Selection
                                  </button>
                                )}
                              </div>
                            </div>

                            {loadingCandidates ? (
                              <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                                <Spinner size="xs" /> Finding eligible faculty &amp; simulating workloads…
                              </div>
                            ) : candidates.length === 0 ? (
                              <div className="py-3 px-3.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-800">
                                No free faculty found for Period P{p}. Your HOD will assign coverage upon leave approval.
                              </div>
                            ) : (
                              /* List of Full Intelligent Recommendation Cards */
                              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                                {candidates.map(c => {
                                  const candId = c.teacher?.id || c.id
                                  const isPicked = selectedId === candId
                                  return (
                                    <RecommendationCard
                                      key={candId}
                                      rec={c}
                                      isSelected={isPicked}
                                      onSelect={() => {
                                        setSelectedSubstitutes(prev => ({ ...prev, [p]: candId }))
                                        setExpandedPeriod(null) // One-click selection closes tray
                                      }}
                                      periodNumber={p}
                                    />
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 3. Reason Section */}
            <div className="p-5 sm:p-6 space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                Reason
              </label>

              {/* Reason Preset Chips */}
              <div className="flex items-center gap-2 flex-wrap">
                {REASON_PRESETS.map(preset => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setForm({ ...form, reason: preset.value })}
                    className={`px-3 py-1 rounded-md text-xs font-semibold border transition ${
                      form.reason === preset.value
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Additional Details Textarea */}
              <div className="space-y-1">
                <label className="text-[11px] text-slate-500 font-medium block">
                  Additional details
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Enter additional information..."
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary-600 resize-none transition"
                />
              </div>
            </div>

            {/* Inline Review & Submit Footer */}
            <div className="p-5 sm:p-6 bg-slate-50/60 space-y-4">
              <div className="flex items-center justify-between gap-3 text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Request Summary</span>
                  <span className="font-semibold text-slate-800">
                    {formatReadableDate(form.date)} {calendarInfo?.day_order ? `· Day Order ${calendarInfo.day_order}` : ''}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-primary-700 block">{formattedPeriodString}</span>
                  <span className="text-[11px] text-slate-500 truncate max-w-[160px] block">{form.reason || 'No reason set'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Link
                  to="/teacher/leaves"
                  className="px-4 py-2 border border-slate-300 hover:bg-white text-slate-700 text-xs font-semibold rounded-lg transition"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  disabled={loading || isBlocked}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white text-xs sm:text-sm font-bold rounded-lg transition shadow-xs flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Spinner size="xs" />
                      <span>Submitting…</span>
                    </>
                  ) : (
                    <span>Submit Leave Request</span>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* ── Right Column (Contextual Panel: DATE INFORMATION) ── */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Date Information
              </h2>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Selected Date</span>
                <span className="font-bold text-slate-900 block mt-0.5">{formatReadableDate(form.date)}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Day Order</span>
                <span className="font-bold text-slate-900 block mt-0.5">
                  {calendarInfo?.day_order ? `Day Order ${calendarInfo.day_order}` : '—'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Calendar Status</span>
                <span className="font-bold text-slate-900 block mt-0.5">
                  {calendarInfo ? (
                    calendarInfo.day_type === 'working' ? 'Working Day' : calendarInfo.day_type.replace('_', ' ')
                  ) : (
                    '—'
                  )}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Scheduled Teaching Classes</span>
                <span className="font-bold text-slate-900 block mt-0.5">
                  {scheduledSlotsForDayOrder.length} class{scheduledSlotsForDayOrder.length === 1 ? '' : 'es'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Leave Eligibility</span>
                <div className="mt-0.5">
                  {calendarInfo ? (
                    !isBlocked ? (
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        ✓ Available
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        ✕ Unavailable
                      </span>
                    )
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-2">
              <h3 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Request Summary
              </h3>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/70 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span className="font-bold text-slate-800">{form.date || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Duration:</span>
                  <span className="font-bold text-slate-800">{formattedPeriodString}</span>
                </div>
                {campusMode === 'flexible' && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Substitutes:</span>
                    <span className={`font-bold ${assignedCount === activePeriodNumbers.length ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {assignedCount}/{activePeriodNumbers.length} selected
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Reason:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[120px]">{form.reason || '—'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}