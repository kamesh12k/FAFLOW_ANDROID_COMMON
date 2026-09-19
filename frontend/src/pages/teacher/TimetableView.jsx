import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { timetableApi } from '../../api/services'

const PERIOD_TIMES = { 1:'9:20 – 10:20', 2:'10:20 – 11:15', 3:'11:40 – 12:35', 4:'13:35 – 14:30', 5:'14:55 – 15:50' }
const ALL_PERIODS = [1, 2, 3, 4, 5]

function SkeletonPeriod() {
  return (
    <div className="flex gap-4 py-5 border-b border-slate-100 animate-pulse">
      <div className="w-14 shrink-0 space-y-1.5">
        <div className="h-3 bg-slate-100 rounded w-8" />
        <div className="h-3 bg-slate-100 rounded w-12" />
      </div>
      <div className="w-1 bg-slate-100 rounded-full shrink-0 self-stretch" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-100 rounded w-2/3" />
        <div className="h-3 bg-slate-100 rounded w-1/2" />
      </div>
    </div>
  )
}

export default function TimetableView() {
  const { user } = useAuth()
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedDay, setSelectedDay] = useState(1)

  useEffect(() => {
    if (!user?.id) return
    setLoading(true)
    timetableApi.getByTeacher(user.id)
      .then(res => { setSlots(res?.data || []); setError(null) })
      .catch(() => setError('Unable to load timetable. Check your connection.'))
      .finally(() => setLoading(false))
  }, [user?.id])

  const daySlots = useMemo(() => slots.filter(s => s.day_order === selectedDay), [slots, selectedDay])
  const maxDayOrder = slots.length ? Math.max(...slots.map(s => s.day_order)) : 6
  const dayOrders = Array.from({ length: Math.max(maxDayOrder, 5) }, (_, i) => i + 1)

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">My Timetable</h1>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              {loading ? 'Loading...' : slots.length + ' teaching periods total'}
            </p>
          </div>
          <Link to="/teacher/dashboard" className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors">
            Back
          </Link>
        </div>
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {dayOrders.map(day => {
              const count = slots.filter(s => s.day_order === day).length
              const isSel = day === selectedDay
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={
                    'flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 ' +
                    (isSel ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                  }
                >
                  DO{day}
                  {count > 0 && (
                    <span className={'ml-1.5 text-[10px] font-semibold ' + (isSel ? 'text-indigo-200' : 'text-slate-400')}>
                      {count}p
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-extrabold text-slate-700">Day Order {selectedDay}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
            {daySlots.length === 0 ? 'No periods' : daySlots.length + ' period' + (daySlots.length === 1 ? '' : 's')}
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="px-6 divide-y divide-slate-50">
              {ALL_PERIODS.map(p => <SkeletonPeriod key={p} />)}
            </div>
          ) : error ? (
            <div className="py-16 text-center px-6">
              <p className="text-sm font-bold text-rose-600">{error}</p>
              <button onClick={() => window.location.reload()} className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-700">
                Retry
              </button>
            </div>
          ) : (
            <div className="px-6 divide-y divide-slate-50">
              {ALL_PERIODS.map(period => {
                const slot = daySlots.find(s => s.period_number === period)
                const isBusy = !!slot
                const locationParts = [
                  slot ? (slot.class_name + (slot.class_section ? ' - ' + slot.class_section : '')) : null,
                  slot && slot.room_number ? 'Room ' + slot.room_number : null,
                ].filter(Boolean)

                return (
                  <div key={period} className="flex gap-4 py-5">
                    <div className="w-14 shrink-0">
                      <p className="text-[10px] font-mono font-semibold text-slate-400">P0{period}</p>
                      <p className="text-[11px] font-bold text-slate-500 mt-0.5 leading-tight">{PERIOD_TIMES[period]}</p>
                    </div>
                    <div className={'w-[3px] self-stretch rounded-full shrink-0 ' + (isBusy ? 'bg-indigo-500' : 'bg-slate-100')} />
                    <div className="flex-1 min-w-0">
                      {isBusy ? (
                        <>
                          <p className="text-[15px] font-extrabold text-slate-900 leading-tight">
                            {slot.subject_name || 'Teaching Period'}
                          </p>
                          {locationParts.length > 0 && (
                            <p className="text-[11px] text-slate-500 font-semibold mt-1">
                              {locationParts.join(' · ')}
                            </p>
                          )}
                          {slot.subject_code && (
                            <span className="inline-block mt-2 px-2.5 py-1 text-[10px] font-bold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {slot.subject_code}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-[14px] font-semibold text-slate-400">Free Period</p>
                          <p className="text-[11px] text-slate-300 font-medium mt-0.5">Research, preparation &amp; grading</p>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {!loading && !error && (
          <p className="text-center text-[10px] text-slate-300 font-semibold mt-6">
            Timetable managed by your department. Contact HOD for any changes.
          </p>
        )}
      </div>
    </div>
  )
}
