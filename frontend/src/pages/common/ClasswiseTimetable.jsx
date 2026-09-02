import { useEffect, useState, useMemo } from 'react'
import { classesApi, timetableApi, subjectsApi, teachersApi, roomsApi, departmentsApi } from '../../api/services'
import { Spinner, EmptyState } from '../../components/ui'

const DAY_ORDERS = [1, 2, 3, 4, 5, 6]
const PERIODS = [1, 2, 3, 4, 5]

const PERIOD_TIMES = {
  1: '8:00 – 9:00',
  2: '9:00 – 10:00',
  3: '10:15 – 11:15',
  4: '11:15 – 12:15',
  5: '1:00 – 2:00',
}

const SUBJECT_COLOR_STYLES = [
  { bg: 'bg-blue-50/80 hover:bg-blue-100/70', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-800', text: 'text-blue-900' },
  { bg: 'bg-emerald-50/80 hover:bg-emerald-100/70', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-800', text: 'text-emerald-900' },
  { bg: 'bg-purple-50/80 hover:bg-purple-100/70', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-800', text: 'text-purple-900' },
  { bg: 'bg-amber-50/80 hover:bg-amber-100/70', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-800', text: 'text-amber-900' },
  { bg: 'bg-rose-50/80 hover:bg-rose-100/70', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-800', text: 'text-rose-900' },
  { bg: 'bg-cyan-50/80 hover:bg-cyan-100/70', border: 'border-cyan-200', badge: 'bg-cyan-100 text-cyan-800', text: 'text-cyan-900' },
  { bg: 'bg-indigo-50/80 hover:bg-indigo-100/70', border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-800', text: 'text-indigo-900' },
  { bg: 'bg-teal-50/80 hover:bg-teal-100/70', border: 'border-teal-200', badge: 'bg-teal-100 text-teal-800', text: 'text-teal-900' },
]

const subjectColorMap = {}
let colorIdx = 0
function getSubjectStyle(subjectId) {
  if (!subjectId) return { bg: 'bg-gray-50', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-700', text: 'text-gray-800' }
  if (!subjectColorMap[subjectId]) {
    subjectColorMap[subjectId] = SUBJECT_COLOR_STYLES[colorIdx++ % SUBJECT_COLOR_STYLES.length]
  }
  return subjectColorMap[subjectId]
}

export default function ClasswiseTimetable() {
  const [classes, setClasses] = useState([])
  const [departments, setDepartments] = useState([])
  const [subjects, setSubjects] = useState([])
  const [teachers, setTeachers] = useState([])
  const [rooms, setRooms] = useState([])
  
  const [selectedClassId, setSelectedClassId] = useState('')
  const [slots, setSlots] = useState([])
  const [loadingMaster, setLoadingMaster] = useState(true)
  const [loadingTimetable, setLoadingTimetable] = useState(false)
  const [filterDepartmentId, setFilterDepartmentId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // 1. Fetch master data
  useEffect(() => {
    Promise.all([
      classesApi.list(),
      departmentsApi.list(true),
      subjectsApi.list(false, true),
      teachersApi.list(true),
      roomsApi.list(),
    ]).then(([clsRes, deptRes, subjRes, teachRes, roomRes]) => {
      setClasses(clsRes.data || [])
      setDepartments(deptRes.data || [])
      setSubjects(subjRes.data || [])
      setTeachers(teachRes.data || [])
      setRooms(roomRes.data || [])
      
      if (clsRes.data && clsRes.data.length > 0) {
        setSelectedClassId(String(clsRes.data[0].id))
      }
    }).finally(() => setLoadingMaster(false))
  }, [])

  // 2. Fetch timetable for selected class
  useEffect(() => {
    if (!selectedClassId) {
      setSlots([])
      return
    }
    setLoadingTimetable(true)
    timetableApi.getByClass(Number(selectedClassId))
      .then(res => setSlots(res.data || []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingTimetable(false))
  }, [selectedClassId])

  // Filtered classes list
  const filteredClasses = useMemo(() => {
    return classes.filter(c => {
      const matchDept = !filterDepartmentId || c.department_id === Number(filterDepartmentId)
      const matchQuery = !searchQuery || `${c.name} ${c.section}`.toLowerCase().includes(searchQuery.toLowerCase())
      return matchDept && matchQuery
    })
  }, [classes, filterDepartmentId, searchQuery])

  // Selected Class object
  const selectedClass = useMemo(() => {
    return classes.find(c => c.id === Number(selectedClassId))
  }, [classes, selectedClassId])

  // Map slots into a 2D lookup grid[day_order][period_number]
  const grid = useMemo(() => {
    const matrix = {}
    for (const doNum of DAY_ORDERS) {
      matrix[doNum] = {}
      for (const pNum of PERIODS) {
        matrix[doNum][pNum] = null
      }
    }

    for (const slot of slots) {
      if (slot.day_order >= 1 && slot.day_order <= 6 && slot.period_number >= 1 && slot.period_number <= 5) {
        const subj = subjects.find(s => s.id === slot.subject_id)
        const teach = teachers.find(t => t.id === slot.teacher_id)
        const rm = rooms.find(r => r.id === slot.room_id)
        const dept = departments.find(d => d.id === teach?.department_id)

        const existing = matrix[slot.day_order][slot.period_number]
        if (existing) {
          existing.teacher_names = [...(existing.teacher_names || [existing.teacher_name]), teach?.name || 'Unknown Teacher']
          existing.teacher_name = existing.teacher_names.join(' + ')
          existing.is_multi_staff = true
        } else {
          matrix[slot.day_order][slot.period_number] = {
            ...slot,
            subject_name: subj?.name || 'Unassigned Subject',
            subject_code: subj?.code || '',
            teacher_name: teach?.name || 'Unknown Teacher',
            teacher_names: [teach?.name || 'Unknown Teacher'],
            teacher_department: dept?.name || '',
            room_number: rm?.room_number || '',
            room_type: rm?.room_type || '',
            is_multi_staff: false,
          }
        }
      }
    }
    return matrix
  }, [slots, subjects, teachers, rooms, departments])


  // Subject summary for this class
  const subjectSummary = useMemo(() => {
    const map = new Map()
    for (const slot of slots) {
      const subjKey = slot.subject_id || `nosubj-${slot.id}`
      if (!map.has(subjKey)) {
        const subj = subjects.find(s => s.id === slot.subject_id)
        const teach = teachers.find(t => t.id === slot.teacher_id)
        const rm = rooms.find(r => r.id === slot.room_id)

        map.set(subjKey, {
          subject_id: slot.subject_id,
          subject_name: subj?.name || 'Unassigned Subject',
          subject_code: subj?.code || '—',
          teacher_name: teach?.name || '—',
          room_numbers: new Set(rm?.room_number ? [rm.room_number] : []),
          periods_count: 0,
        })
      }
      const entry = map.get(subjKey)
      entry.periods_count += 1
      const rm = rooms.find(r => r.id === slot.room_id)
      if (rm?.room_number) entry.room_numbers.add(rm.room_number)
    }

    return Array.from(map.values()).map(e => ({
      ...e,
      rooms_text: Array.from(e.room_numbers).join(', ') || '—',
    }))
  }, [slots, subjects, teachers, rooms])

  if (loadingMaster) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Classwise Timetable</h1>
          <p className="text-sm text-gray-500 mt-1">View comprehensive weekly subject timetable for any class.</p>
        </div>

        <button
          onClick={() => window.print()}
          className="btn-secondary self-start sm:self-auto flex items-center gap-2 text-xs print:hidden"
        >
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print Timetable
        </button>
      </div>

      {/* Class Selector Bar */}
      <div className="card p-4 space-y-3 print:hidden">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Select Class</label>
            <select
              className="input font-semibold"
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
            >
              {filteredClasses.length === 0 ? (
                <option value="">No matching classes</option>
              ) : (
                filteredClasses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} – {c.section} (Sem {c.semester})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Filter Department</label>
            <select
              className="input"
              value={filterDepartmentId}
              onChange={e => setFilterDepartmentId(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Search Class</label>
            <input
              className="input"
              placeholder="e.g. I B.Sc CS"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Timetable Card */}
      {!selectedClass ? (
        <div className="card p-10 text-center"><EmptyState message="Please select a class to view its timetable." /></div>
      ) : (
        <div className="card overflow-hidden border border-gray-200">
          {/* Class Header Banner */}
          <div className="p-5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl font-extrabold tracking-tight">{selectedClass.name} – Section {selectedClass.section}</span>
                <span className="bg-primary-600/80 text-white text-xs font-bold px-2.5 py-0.5 rounded-full border border-primary-500">
                  Semester {selectedClass.semester}
                </span>
                {selectedClass.default_room_number && (
                  <span className="bg-emerald-600/80 text-white text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-400">
                    🏢 Base Room: {selectedClass.default_room_number} {selectedClass.default_room_type ? `(${selectedClass.default_room_type})` : ''}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1 font-medium">
                Official Weekly Master Timetable · {slots.length} Scheduled Periods
              </p>
            </div>

            <div className="text-left sm:text-right text-xs text-slate-300 font-semibold space-y-0.5">
              <p>Total Days: 6 Day Orders</p>
              <p>Timing: 8:00 AM – 2:00 PM</p>
            </div>
          </div>

          {loadingTimetable ? (
            <div className="py-20 flex justify-center"><Spinner size="lg" /></div>
          ) : slots.length === 0 ? (
            <div className="p-12 text-center">
              <EmptyState message={`No timetable slots configured for ${selectedClass.name} – ${selectedClass.section} yet.`} />
            </div>
          ) : (
            <>
              {/* Timetable Grid Table */}
              <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                <table className="w-full border-collapse text-xs min-w-[760px]">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700">
                      <th className="p-3 text-center font-bold w-24 border-r border-slate-200 uppercase tracking-wider">Day Order</th>
                      {PERIODS.map(p => (
                        <th key={p} className="p-3 text-center border-r border-slate-200 last:border-r-0">
                          <span className="font-extrabold text-sm block text-slate-900">Period {p}</span>
                          <span className="text-[10px] text-slate-500 font-semibold">{PERIOD_TIMES[p]}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {DAY_ORDERS.map(doNum => (
                      <tr key={doNum} className="hover:bg-slate-50/40">
                        {/* Day Order Header Cell */}
                        <td className="p-3 text-center font-extrabold bg-slate-50 border-r border-slate-200 text-slate-800">
                          <span className="block text-sm">DO {doNum}</span>
                          <span className="text-[10px] font-bold text-slate-400">Day Order {doNum}</span>
                        </td>

                        {/* Period Cells */}
                        {PERIODS.map(pNum => {
                          const cell = grid[doNum][pNum]
                          if (!cell) {
                            return (
                              <td key={pNum} className="p-2 border-r border-slate-200 last:border-r-0 text-center align-middle bg-slate-50/30">
                                <span className="text-[11px] font-semibold text-slate-400 italic">— Free —</span>
                              </td>
                            )
                          }

                          const style = getSubjectStyle(cell.subject_id)
                          return (
                            <td key={pNum} className={`p-2.5 border-r border-slate-200 last:border-r-0 align-top transition-colors ${style.bg}`}>
                              <div className="space-y-1.5">
                                {/* Subject Title & Code */}
                                <div className="flex items-start justify-between gap-1">
                                  <p className={`font-extrabold leading-tight text-xs ${style.text}`}>
                                    {cell.subject_name}
                                  </p>
                                  {cell.subject_code && (
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${style.badge}`}>
                                      {cell.subject_code}
                                    </span>
                                  )}
                                </div>

                                {/* Teacher Name */}
                                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-800">
                                  <svg className="w-3 h-3 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                  <span className="truncate">{cell.teacher_name}</span>
                                  {cell.is_multi_staff && (
                                    <span className="text-[8px] font-black uppercase text-purple-700 bg-purple-100 px-1 py-0.2 rounded shrink-0">
                                      👥 Multi-Staff
                                    </span>
                                  )}
                                </div>


                                {/* Room / Lab */}
                                {cell.room_number && (
                                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-600">
                                    <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4" />
                                    </svg>
                                    <span>{cell.room_type === 'lab' ? '🔬 Lab' : '🚪 Room'} {cell.room_number}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Subject & Faculty Summary Table */}
              <div className="p-5 bg-slate-50 border-t border-slate-200">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Subject & Handling Faculty Summary</h3>
                <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <table className="w-full text-xs text-left" style={{ minWidth: '550px' }}>
                    <thead className="bg-white border border-slate-200 text-slate-500 font-bold uppercase">
                      <tr>
                        <th className="p-2.5">Subject Code</th>
                        <th className="p-2.5">Subject Name</th>
                        <th className="p-2.5">Handling Faculty</th>
                        <th className="p-2.5">Assigned Room(s)</th>
                        <th className="p-2.5 text-right">Periods / Week</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white border border-t-0 border-slate-200">
                      {subjectSummary.map((s, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-primary-700">{s.subject_code}</td>
                          <td className="p-2.5 font-semibold text-slate-900">{s.subject_name}</td>
                          <td className="p-2.5 font-medium text-slate-800">{s.teacher_name}</td>
                          <td className="p-2.5 text-slate-600">{s.rooms_text}</td>
                          <td className="p-2.5 text-right font-bold text-slate-900">{s.periods_count} hrs/wk</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
