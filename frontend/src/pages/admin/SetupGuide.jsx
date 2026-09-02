import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  departmentsApi,
  adminApi,
  teachersApi,
  subjectsApi,
  classesApi,
  roomsApi,
  academicCalendarApi,
} from '../../api/services'
import { Spinner } from '../../components/ui'

export default function SetupGuide() {
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({
    departments: 0,
    hods: 0,
    teachers: 0,
    subjects: 0,
    classes: 0,
    rooms: 0,
    academicYears: 0,
    semesters: 0,
  })

  useEffect(() => {
    async function loadStatus() {
      setLoading(true)
      try {
        const [
          deptRes,
          hodRes,
          teacherRes,
          subjRes,
          classRes,
          roomRes,
          ayRes,
          semRes,
        ] = await Promise.allSettled([
          departmentsApi.list(true),
          adminApi.listSecondaryAdmins(),
          teachersApi.list(),
          subjectsApi.list(false, true),
          classesApi.list(),
          roomsApi.list(),
          academicCalendarApi.listAcademicYears(),
          academicCalendarApi.listSemesters(),
        ])

        setMetrics({
          departments: deptRes.status === 'fulfilled' ? (deptRes.value.data?.length || 0) : 0,
          hods: hodRes.status === 'fulfilled' ? (hodRes.value.data?.length || 0) : 0,
          teachers: teacherRes.status === 'fulfilled' ? (teacherRes.value.data?.length || 0) : 0,
          subjects: subjRes.status === 'fulfilled' ? (subjRes.value.data?.length || 0) : 0,
          classes: classRes.status === 'fulfilled' ? (classRes.value.data?.length || 0) : 0,
          rooms: roomRes.status === 'fulfilled' ? (roomRes.value.data?.length || 0) : 0,
          academicYears: ayRes.status === 'fulfilled' ? (ayRes.value.data?.length || 0) : 0,
          semesters: semRes.status === 'fulfilled' ? (semRes.value.data?.length || 0) : 0,
        })
      } catch (err) {
        console.error('Failed to load setup metrics:', err)
      } finally {
        setLoading(false)
      }
    }
    loadStatus()
  }, [])

  const steps = [
    {
      id: 'departments',
      step: 1,
      title: 'Academic Departments',
      desc: 'Create academic units (e.g. Computer Science, AI, Mechanical).',
      count: metrics.departments,
      unit: 'departments',
      target: 1,
      link: '/admin/departments',
      actionText: 'Manage Departments',
      isComplete: metrics.departments > 0,
    },
    {
      id: 'hods',
      step: 2,
      title: 'Department Administrators (HODs)',
      desc: 'Assign HOD or secondary admin accounts to each department.',
      count: metrics.hods,
      unit: 'HODs assigned',
      target: 1,
      link: '/admin/settings',
      actionText: 'Assign HODs',
      isComplete: metrics.hods > 0,
    },
    {
      id: 'teachers',
      step: 3,
      title: 'Faculty & Teaching Staff',
      desc: 'Import or register faculty members across departments.',
      count: metrics.teachers,
      unit: 'teachers',
      target: 2,
      link: '/admin/teachers',
      actionText: 'Add / Import Faculty',
      isComplete: metrics.teachers > 0,
    },
    {
      id: 'structure',
      step: 4,
      title: 'Curriculum & Venues (Courses, Classes, Rooms)',
      desc: 'Configure Course Subjects, Class Sections, and Physical/Lab Venues.',
      count: metrics.subjects + metrics.classes + metrics.rooms,
      unit: `items (${metrics.subjects} sub, ${metrics.classes} cls, ${metrics.rooms} rm)`,
      target: 3,
      link: '/admin/subjects',
      actionText: 'Configure Structure',
      isComplete: metrics.subjects > 0 && metrics.classes > 0 && metrics.rooms > 0,
    },
    {
      id: 'calendar',
      step: 5,
      title: 'Academic Calendar & Day Orders',
      desc: 'Configure Academic Years, Semesters, and Working Day Order sequence.',
      count: metrics.academicYears + metrics.semesters,
      unit: `periods (${metrics.academicYears} years, ${metrics.semesters} sems)`,
      target: 1,
      link: '/admin/academic-calendar',
      actionText: 'Setup Calendar',
      isComplete: metrics.academicYears > 0 || metrics.semesters > 0,
    },
    {
      id: 'timetable',
      step: 6,
      title: 'Master Timetable Schedule',
      desc: 'Create or bulk-upload Day Order class period allocations.',
      count: 'Slots',
      unit: 'schedule grid',
      target: 1,
      link: '/admin/timetable',
      actionText: 'Open Timetable Grid',
      isComplete: metrics.classes > 0 && metrics.subjects > 0,
    },
  ]

  const completedSteps = steps.filter(s => s.isComplete).length
  const progressPercent = Math.round((completedSteps / steps.length) * 100)

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">System Setup & Readiness</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Guided end-to-end setup workflow for institution administrators.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 bg-primary-50 text-primary-800 border border-primary-200 px-3.5 py-1.5 rounded-xl font-bold text-xs">
          <span>{completedSteps} of {steps.length} Steps Complete</span>
          <span className="bg-primary-600 text-white px-2 py-0.5 rounded-md text-[11px]">{progressPercent}%</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="card p-5 bg-gradient-to-r from-primary-900 to-indigo-900 text-white rounded-2xl shadow-sm border-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold">Institution Configuration Progress</h2>
            <p className="text-xs text-primary-200 mt-0.5">
              {progressPercent === 100
                ? '🟢 All core modules configured and ready for live campus operations.'
                : 'Follow the sequence below to complete initial campus setup.'}
            </p>
          </div>
          <span className="text-2xl font-black text-white">{progressPercent}%</span>
        </div>
        <div className="w-full bg-primary-950/60 rounded-full h-3 overflow-hidden p-0.5">
          <div
            className="bg-gradient-to-r from-emerald-400 to-teal-300 h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Steps List */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <div className="space-y-3.5">
          {steps.map((item) => (
            <div
              key={item.id}
              className={`card p-5 rounded-2xl border transition hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                item.isComplete ? 'border-gray-200 bg-white' : 'border-amber-200 bg-amber-50/20'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center font-bold text-sm ${
                    item.isComplete
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {item.isComplete ? '✓' : item.step}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 text-base">{item.title}</h3>
                    {item.isComplete ? (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
                        Ready
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                        Pending Action
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                  <p className="text-xs font-semibold text-gray-700 mt-1.5">
                    Current Status: <span className="text-primary-700 font-bold">{item.count}</span> {item.unit}
                  </p>
                </div>
              </div>

              <div className="shrink-0 self-end sm:self-center">
                <Link
                  to={item.link}
                  className={`btn text-xs font-bold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 transition ${
                    item.isComplete
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                      : 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm'
                  }`}
                >
                  {item.actionText} →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
