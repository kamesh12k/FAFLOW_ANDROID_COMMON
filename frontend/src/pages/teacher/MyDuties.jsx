import { useState, useEffect } from 'react'
import { campusDutiesApi } from '../../api/services'
import { Card, Spinner, ErrorAlert } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'

export default function MyDuties() {
  const { user } = useAuth()
  const [duties, setDuties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedFilter, setSelectedFilter] = useState('all') // all, today, upcoming

  const todayStr = new Date().toISOString().split('T')[0]

  const fetchMyDuties = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await campusDutiesApi.getMyDuties()
      setDuties(res?.data || [])
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load assigned campus duties')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMyDuties()
  }, [])

  const filteredDuties = duties.filter(d => {
    if (selectedFilter === 'today') return d.duty_date === todayStr
    if (selectedFilter === 'upcoming') return d.duty_date > todayStr
    return true
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">My Campus Duties</h1>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
            Personal Discipline, Wing & Examination Assignments
          </p>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5">
          {[
            { id: 'all', label: 'All Duties' },
            { id: 'today', label: "Today's Duties" },
            { id: 'upcoming', label: 'Upcoming' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setSelectedFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedFilter === f.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <div className="py-20 flex justify-center"><Spinner /></div>
      ) : filteredDuties.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xl mx-auto mb-3">
            🛡️
          </div>
          <h3 className="text-sm font-bold text-slate-700">No duties assigned</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            You currently have no scheduled discipline, wing, or examination duties for this period.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDuties.map(d => {
            const isToday = d.duty_date === todayStr
            const myAssignment = d.assignments?.find(a => a.teacher_id === user.id)

            return (
              <div
                key={d.id}
                className={`rounded-3xl border bg-white p-5 space-y-4 shadow-sm transition-all hover:shadow-md ${
                  isToday ? 'border-indigo-200 bg-indigo-50/10' : 'border-slate-200/80'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {d.duty_type.replace('_', ' ')}
                    </span>
                    <h3 className="font-extrabold text-base text-slate-900 mt-1">{d.title}</h3>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">
                      {d.start_time.substring(0, 5)} – {d.end_time.substring(0, 5)}
                    </p>
                  </div>

                  <span className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold ${
                    isToday ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {isToday ? 'TODAY' : d.duty_date}
                  </span>
                </div>

                {/* Location / Instructions */}
                {(d.area_name || d.break_period_name) && (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-700 space-y-1">
                    {d.area_name && (
                      <p className="font-bold flex items-center gap-1.5 text-slate-850">
                        <span>📍</span> {d.area_name} {d.area_code ? `(${d.area_code})` : ''}
                      </p>
                    )}
                    {d.break_period_name && (
                      <p className="text-[11px] text-slate-500 font-medium">Break Period: {d.break_period_name}</p>
                    )}
                  </div>
                )}

                {/* Assignment details & Reason */}
                {myAssignment && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold uppercase text-[10px]">Your Role:</span>
                      <span className="font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md text-[10px] capitalize">
                        {myAssignment.role.toLowerCase()}
                      </span>
                    </div>

                    {myAssignment.selection_reason?.length > 0 && (
                      <div className="pt-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Why you were selected:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {myAssignment.selection_reason.map((r, i) => (
                            <span key={i} className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              ✓ {r}
                            </span>
                          ))}
                        </div>
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
  )
}
