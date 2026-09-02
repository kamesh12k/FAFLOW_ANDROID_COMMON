import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { leavesApi, academicCalendarApi } from '../../api/services'
import { ErrorAlert, Spinner } from '../../components/ui'
import { CheckCircleIcon } from '../../components/icons'

function ArrowLeftIcon(props) {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  )
}

const PERIOD_TIMES = {
  1: '8:00–9:00',
  2: '9:00–10:00',
  3: '10:15–11:15',
  4: '11:15–12:15',
  5: '1:00–2:00',
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
  const navigate = useNavigate()

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

    setLoading(true)
    try {
      if (form.mode === 'whole_day') {
        await leavesApi.applyBatch({ date: form.date, whole_day: true, reason: form.reason.trim() })
      } else if (form.period_numbers.length === 1) {
        await leavesApi.apply({ date: form.date, period_number: form.period_numbers[0], reason: form.reason.trim() })
      } else {
        await leavesApi.applyBatch({ date: form.date, period_numbers: form.period_numbers, reason: form.reason.trim() })
      }

      setSuccessData({
        date: form.date,
        day_order: calendarInfo?.day_order,
        duration: form.mode === 'whole_day' ? 'Whole Day (All Periods)' : `Periods P${form.period_numbers.join(', P')}`,
        reason: form.reason.trim(),
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
                Your leave request has been recorded successfully and routed for administration.
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
    ? 'Whole Day'
    : form.period_numbers.length > 0
    ? `Periods ${form.period_numbers.join(', ')}`
    : 'None selected'

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

              {/* Date Input with Icon */}
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
                  <span className="text-[11px] text-slate-500 font-normal block mt-0.5">All scheduled periods</span>
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
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => togglePeriod(p)}
                          className={`py-2 px-1 rounded-md border text-center transition flex flex-col items-center justify-center ${
                            selected
                              ? 'bg-primary-600 border-primary-600 text-white font-bold'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 font-semibold'
                          }`}
                        >
                          <span className="text-xs">P{p}</span>
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
                  All applicable teaching periods for the selected working day will be included.
                </p>
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
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold rounded-lg transition shadow-xs flex items-center gap-2"
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