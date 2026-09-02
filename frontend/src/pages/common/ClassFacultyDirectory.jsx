import { useEffect, useState, useMemo } from 'react'
import { classesApi } from '../../api/services'
import { Spinner, EmptyState } from '../../components/ui'

export default function ClassFacultyDirectory() {
  const [classes, setClasses] = useState([])
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    classesApi.directory().then(r => setClasses(r.data)).finally(() => setLoading(false))
  }, [])

  const selectClass = async (cls) => {
    setSelected(cls)
    setDetail(null)
    const { data } = await classesApi.faculty(cls.id)
    setDetail(data)
  }

  const groupedFaculty = useMemo(() => {
    if (!detail?.faculty) return []
    const map = new Map()
    for (const slot of detail.faculty) {
      const key = slot.teacher_id
      if (!map.has(key)) {
        map.set(key, {
          teacher_id: slot.teacher_id,
          teacher_name: slot.teacher_name,
          teacher_department: slot.teacher_department,
          subjects: new Set(),
          schedules: [],
          rooms: new Set(),
        })
      }
      const item = map.get(key)
      if (slot.subject_name) item.subjects.add(slot.subject_name)
      item.schedules.push(`DO${slot.day_order} P${slot.period_number}`)
      if (slot.room) item.rooms.add(slot.room)
    }
    return Array.from(map.values()).map(item => ({
      ...item,
      subject_names: Array.from(item.subjects).join(', ') || '—',
      schedule_text: item.schedules.join(', '),
      total_hours: item.schedules.length,
      room_text: Array.from(item.rooms).join(', ') || '—',
    }))
  }, [detail])

  const visible = classes.filter(c => `${c.name} ${c.section}`.toLowerCase().includes(query.toLowerCase()))

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Class Faculty Directory</h1>
        <p className="text-sm text-gray-500 mt-1">Select a global class to see every teacher handling it.</p>
      </div>

      <input
        className="input max-w-md"
        placeholder="Search class or section…"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="card divide-y max-h-[560px] overflow-y-auto">
          {visible.length ? visible.map(c => (
            <button
              key={c.id}
              onClick={() => selectClass(c)}
              className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${selected?.id === c.id ? 'bg-primary-50' : ''}`}
            >
              <p className="font-semibold text-gray-800">{c.name} – {c.section}</p>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <span className="text-xs text-gray-500">
                  Semester {c.semester} · {c.faculty_count} faculty · {c.subject_count} subjects
                </span>
                {c.default_room_number && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    🏢 {c.default_room_number}
                  </span>
                )}
              </div>
            </button>
          )) : <EmptyState message="No classes found." />}
        </div>

        <div className="card overflow-hidden">
          {!selected ? (
            <EmptyState message="Choose a class to view its faculty." />
          ) : !detail ? (
            <div className="p-10 flex justify-center"><Spinner /></div>
          ) : (
            <>
              <div className="p-5 border-b flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="font-bold text-gray-900">{detail.name} – {detail.section}</h2>
                    {detail.default_room_number && (
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        🏢 Base Room: {detail.default_room_number} {detail.default_room_type ? `(${detail.default_room_type})` : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">Semester {detail.semester}</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-200">
                  {groupedFaculty.length} Staff Member{groupedFaculty.length === 1 ? '' : 's'}
                </span>
              </div>

              {groupedFaculty.length === 0 ? (
                <EmptyState message="No approved timetable entries for this class." />
              ) : (
                <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <table className="w-full text-sm" style={{ minWidth: '550px' }}>
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['Staff Name', 'Department', 'Subject(s)', 'Periods / Week', 'Room(s)'].map(h => (
                          <th className="p-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider" key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {groupedFaculty.map((f) => (
                        <tr key={f.teacher_id} className="hover:bg-gray-50/50">
                          <td className="p-3.5 font-semibold text-gray-900">{f.teacher_name}</td>
                          <td className="p-3.5 text-gray-600 font-medium">{f.teacher_department || '—'}</td>
                          <td className="p-3.5 text-gray-800 font-medium">{f.subject_names}</td>
                          <td className="p-3.5">
                            <span className="font-medium text-gray-800">{f.total_hours} hrs/wk</span>
                            <span className="block text-[11px] text-gray-500 mt-0.5">{f.schedule_text}</span>
                          </td>
                          <td className="p-3.5 text-gray-600">{f.room_text}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
