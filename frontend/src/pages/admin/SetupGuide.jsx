import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { setupGuideApi } from '../../api/services'
import { Spinner } from '../../components/ui'

export default function SetupGuide() {
  const [activeTab, setActiveTab] = useState('roadmap') // 'roadmap' | 'dependency_map' | 'data_flow' | 'module_readiness' | 'knowledge_hub'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedNode, setSelectedNode] = useState(null)
  const [activeFlowIndex, setActiveFlowIndex] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadReadiness()
  }, [])

  const loadReadiness = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await setupGuideApi.getReadiness()
      setData(res.data)
      if (res.data?.data_flow?.nodes?.length > 0) {
        setSelectedNode(res.data.data_flow.nodes[0])
      }
    } catch (err) {
      console.error('Failed to load setup readiness:', err)
      setError(err.response?.data?.detail || 'Failed to calculate system setup readiness.')
    } finally {
      setLoading(false)
    }
  }

  // Pre-defined detailed FAQs and topics for Knowledge Hub
  const knowledgeTopics = [
    {
      id: 'order',
      title: 'What should I configure first in FAFLOW?',
      category: 'Setup Order',
      summary: 'Start with Foundation entities (Departments, Academic Year), followed by Structure (Rooms, Teachers, Classes), Curriculum (Subjects), and finally Scheduling (Day Orders, Timetable).',
      content: 'FAFLOW strictly relies on relational integrity. A Teacher or Class cannot exist without a Department. A Student cannot exist without a Class. A Timetable Slot cannot be scheduled without an assigned Class, Teacher, Subject, and Day Order. Follow the numbered sequence in the Setup Roadmap tab.',
      keywords: ['order', 'sequence', 'first', 'start', 'prerequisites']
    },
    {
      id: 'classes',
      title: 'How do I create and structure Classes & Sections?',
      category: 'Classes & Students',
      summary: 'Navigate to Classes, specify Class Name (e.g. "III B.Tech CSE"), Section ("A"), Department, and Semester (1-8).',
      content: 'A class represents an academic cohort. Once created, you can bulk-import students or add them individually. Every class has an assigned semester which dictates which subjects are taught to that section.',
      keywords: ['class', 'section', 'create class', 'semester', 'students']
    },
    {
      id: 'day_order',
      title: 'How does the 6-Day Order cycle work in FAFLOW?',
      category: 'Academic Calendar',
      summary: 'FAFLOW uses a rotational 6-Day Order system (Day 1 through Day 6) instead of standard Monday-Friday weekdays.',
      content: 'When an academic year is configured, calendar dates are assigned Day Orders (1-6). If a holiday or exam occurs, the day order sequence pauses and resumes on the next working day. Timetable slots are configured against Day Orders 1-6, ensuring schedules rotate predictably regardless of calendar holidays.',
      keywords: ['day order', 'cycle', 'rotation', 'calendar', 'holiday', 'schedule']
    },
    {
      id: 'timetable',
      title: 'Why is my Timetable configuration blocked?',
      category: 'Timetable',
      summary: 'Timetable creation requires at least one Class, one Subject, and one Faculty Member.',
      content: 'A timetable slot is defined by the tuple: (Class + Subject + Teacher + Day Order + Period Number). If any of these prerequisite records do not exist in the database, the timetable matrix cannot be constructed. Configure your departments, faculty, subjects, and classes first.',
      keywords: ['timetable', 'blocked', 'slot', 'period', 'schedule', 'conflict']
    },
    {
      id: 'substitution',
      title: 'How does automated teacher substitution work?',
      category: 'Leave & Substitution',
      summary: 'When a teacher is on approved leave, FAFLOW matches their scheduled timetable slots with available free faculty.',
      content: '1. Teacher submits leave request -> 2. HOD or Admin approves -> 3. System checks the teacher timetable slots for that date based on the Day Order -> 4. For each period, the engine checks other faculty schedules in the department and identifies teachers with no scheduled class -> 5. Alter assignment is created and substitute is notified via web & mobile push.',
      keywords: ['substitution', 'alter', 'leave', 'coverage', 'conflict-free', 'auto-assign']
    },
    {
      id: 'attendance',
      title: 'How does Student Attendance flow from Timetable to Analytics?',
      category: 'Attendance',
      summary: 'Teachers open their mobile app or web portal to view today\'s timetable periods and mark attendance with one tap.',
      content: 'The attendance screen pre-populates enrolled students for that class. Marking attendance creates an official AttendanceSession with audit trails. Instant statistics update student absence percentages and trigger parent/admin alerts if minimum thresholds are breached.',
      keywords: ['attendance', 'student attendance', 'analytics', 'marking', 'absent']
    },
    {
      id: 'geofence',
      title: 'How does Mobile Staff Geofence Check-In work?',
      category: 'Operations',
      summary: 'Faculty punch in/out using GPS campus geofence validation on their mobile devices.',
      content: 'Administrators define campus GPS center coordinates and radius in meters under Geofences. When staff open the mobile check-in screen, on-device GPS verifies they are physically inside the institutional geofence perimeter before recording their duty punch.',
      keywords: ['geofence', 'staff attendance', 'gps', 'check-in', 'mobile', 'location']
    },
    {
      id: 'credits',
      title: 'How are Faculty Credits and Workload calculated?',
      category: 'Credits',
      summary: 'Teaching hours and substitution duty generate credits tracked against monthly department policies.',
      content: 'Every period taught awards standard curriculum credits. When a faculty member covers for an absent colleague via an alter assignment, additional substitution credits are awarded automatically upon attendance completion.',
      keywords: ['credits', 'workload', 'hours', 'faculty credits', 'compensation']
    }
  ]

  // Filtered knowledge topics based on search
  const filteredTopics = useMemo(() => {
    if (!searchQuery.trim()) return knowledgeTopics
    const q = searchQuery.toLowerCase().trim()
    return knowledgeTopics.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.summary.toLowerCase().includes(q) ||
      t.content.toLowerCase().includes(q) ||
      t.keywords.some(k => k.includes(q))
    )
  }, [searchQuery])

  // Data flow scenarios
  const flowScenarios = [
    {
      id: 'flow_attendance',
      name: 'Class Timetable → Student Attendance → Analytics',
      description: 'End-to-end operational flow from master timetable configuration to daily classroom attendance marking and reporting.',
      steps: [
        { node: 'Class & Subject Master', role: 'Admin', desc: 'Defines Class (e.g. III CSE-A), Subject (Compiler Design), and assigned Faculty.' },
        { node: 'Academic Calendar', role: 'Admin', desc: 'Calendar date maps to rotational Day Order (e.g. Sept 19 = Day Order 3).' },
        { node: 'Master Timetable Grid', role: 'System', desc: 'Slot resolved for Day Order 3, Period 2: Prof. Sharma in Room 304.' },
        { node: 'Student Attendance Session', role: 'Teacher', desc: 'Teacher launches Attendance on mobile, pre-populated with enrolled students.' },
        { node: 'Institutional Analytics', role: 'HOD / Admin', desc: 'Records stored with audit logs; student attendance percentages update instantly.' },
      ]
    },
    {
      id: 'flow_leave_sub',
      name: 'Faculty Leave → Auto-Substitution → Schedule Dispatch',
      description: 'How approved teacher leaves automatically trigger conflict-free substitution assignments without disrupting classes.',
      steps: [
        { node: 'Leave Request', role: 'Teacher', desc: 'Faculty submits Casual/Medical leave for a specific date range.' },
        { node: 'Approval & Validation', role: 'HOD / Admin', desc: 'HOD verifies leave quota and approves the leave request.' },
        { node: 'Timetable Slot Resolution', role: 'System', desc: 'System queries all periods the absent teacher was scheduled to teach on those dates.' },
        { node: 'Conflict-Free Search', role: 'System', desc: 'Engine analyzes department timetable grid to find free teachers with zero period clashes.' },
        { node: 'Alter Assignment & Alert', role: 'Substitute', desc: 'Substitute is assigned, schedule is updated, and real-time push notification is dispatched.' },
      ]
    },
    {
      id: 'flow_geofence',
      name: 'Campus Geofence → Mobile Verification → Staff Duty Log',
      description: 'Physical campus validation during staff check-in preventing remote or proxy attendance.',
      steps: [
        { node: 'Geofence Perimeter', role: 'Admin', desc: 'Admin sets campus GPS coordinates (Latitude, Longitude, Radius).' },
        { node: 'Calendar Working Day', role: 'System', desc: 'System verifies today is an active working day (not a holiday or non-working day).' },
        { node: 'Mobile Punch-In', role: 'Faculty', desc: 'Staff taps Check-In on mobile; hardware GPS verifies presence inside geofence boundary.' },
        { node: 'Duty Log & Daily Status', role: 'System', desc: 'Check-in timestamp recorded with biometric/device integrity verification.' },
      ]
    }
  ]

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold text-lg">
              🧭
            </span>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              Admin Setup Guide & System Architecture
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Official configuration roadmap, verified dependency graph, and runtime data flow explorer for FAFLOW.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('faflow:start-tour'))}
            className="btn bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl inline-flex items-center gap-1.5 shadow-xs transition"
          >
            <span>▶ Replay Admin Tour</span>
          </button>
          {data && (
            <div className="inline-flex items-center gap-2 bg-primary-50 dark:bg-primary-950/60 border border-primary-200 dark:border-primary-800 px-3.5 py-2 rounded-xl font-bold text-xs text-primary-900 dark:text-primary-200">
              <span>{data.completed_steps} / {data.total_steps} Setup Steps Complete</span>
              <span className="bg-primary-600 text-white px-2 py-0.5 rounded-md text-[11px] font-black">{data.progress_percent}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-gray-200 dark:border-slate-800 pb-1">
        {[
          { id: 'roadmap', label: '1. Setup Roadmap & Checklist', icon: '🗺️' },
          { id: 'dependency_map', label: '2. Visual Dependency Map', icon: '📊' },
          { id: 'data_flow', label: '3. Runtime Data Flows', icon: '⚡' },
          { id: 'module_readiness', label: '4. Module Readiness Matrix', icon: '🛡️' },
          { id: 'knowledge_hub', label: '5. Searchable Guide & FAQs', icon: '🔍' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition inline-flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-primary-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-16 flex flex-col items-center justify-center gap-3">
          <Spinner size="lg" />
          <p className="text-xs text-gray-500 font-medium animate-pulse">Calculating institutional readiness from database...</p>
        </div>
      ) : error ? (
        <div className="card p-8 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="font-bold">Error loading setup guide</h3>
            <p className="text-xs text-rose-600">{error}</p>
          </div>
          <button onClick={loadReadiness} className="btn bg-rose-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 1: SETUP ROADMAP & CHECKLIST                              */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeTab === 'roadmap' && (
            <div className="space-y-6">
              {/* Overall Progress Banner */}
              <div className="card p-6 bg-gradient-to-r from-slate-900 via-primary-950 to-indigo-950 text-white rounded-3xl shadow-md border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950">
                        {data.progress_percent === 100 ? 'System Fully Operational' : 'Setup In Progress'}
                      </span>
                      <span className="text-xs text-slate-300 font-medium">
                        • {data.completed_steps} of {data.total_steps} prerequisites ready
                      </span>
                    </div>
                    <h2 className="text-xl font-black tracking-tight text-white">
                      Institutional Setup Progress ({data.progress_percent}%)
                    </h2>
                    <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                      {data.progress_percent === 100
                        ? '🟢 All core entities, timetable matrices, calendar schedules, and staff credentials are fully configured and ready for live campus usage.'
                        : 'Follow the strict configuration order below. Each step unlocks dependent academic, timetable, and attendance capabilities.'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-4xl font-black text-white">{data.progress_percent}%</span>
                  </div>
                </div>

                {/* Progress bar track */}
                <div className="w-full bg-slate-950/80 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 h-full rounded-full transition-all duration-700 shadow-sm"
                    style={{ width: `${Math.max(data.progress_percent, 5)}%` }}
                  />
                </div>

                {/* Next Recommended Action Banner */}
                {data.next_recommended_step && (
                  <div className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold text-sm shrink-0">
                        ⚡
                      </span>
                      <div>
                        <span className="font-bold text-amber-300">Next Recommended Action: </span>
                        <span className="text-slate-200">
                          Step {data.next_recommended_step.step_number} — {data.next_recommended_step.title}
                        </span>
                      </div>
                    </div>
                    <Link
                      to={data.next_recommended_step.config_url}
                      className="px-4 py-1.5 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl text-xs transition shadow-xs shrink-0 inline-flex items-center gap-1"
                    >
                      <span>{data.next_recommended_step.action_text}</span>
                      <span>→</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* Sequential Steps List */}
              <div className="space-y-4">
                {data.steps.map((step) => {
                  const isBlocked = step.is_blocked
                  const isComplete = step.is_complete

                  return (
                    <div
                      key={step.id}
                      className={`card p-5 sm:p-6 rounded-2xl border transition-all duration-200 hover:shadow-md space-y-4 ${
                        isComplete
                          ? 'border-emerald-200 dark:border-emerald-900/60 bg-white dark:bg-slate-900'
                          : isBlocked
                          ? 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 opacity-80'
                          : 'border-amber-300 dark:border-amber-800/80 bg-amber-50/20 dark:bg-amber-950/20'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        {/* Step Icon & Title */}
                        <div className="flex items-start gap-3.5">
                          <div
                            className={`w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center font-black text-sm border shadow-xs ${
                              isComplete
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                                : isBlocked
                                ? 'bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                : 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                            }`}
                          >
                            {isComplete ? '✓' : step.step_number.toString().padStart(2, '0')}
                          </div>

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                {step.title}
                              </h3>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                  isComplete
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : isBlocked
                                    ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                }`}
                              >
                                {isComplete ? 'Configured' : isBlocked ? 'Blocked by Prerequisite' : 'Pending Action'}
                              </span>
                              <span className="text-[11px] font-semibold text-gray-400 capitalize">
                                • {step.category}
                              </span>
                            </div>

                            <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed max-w-3xl">
                              <strong className="text-gray-900 dark:text-white font-semibold">Why is this required? </strong>
                              {step.why_required}
                            </p>
                          </div>
                        </div>

                        {/* Action Button */}
                        <div className="shrink-0 self-start sm:self-center">
                          <Link
                            to={step.config_url}
                            className={`btn text-xs font-bold px-4 py-2.5 rounded-xl transition inline-flex items-center gap-1.5 shadow-xs ${
                              isComplete
                                ? 'bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-gray-200 border border-gray-200 dark:border-slate-700'
                                : isBlocked
                                ? 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-400'
                                : 'bg-primary-600 hover:bg-primary-700 text-white'
                            }`}
                          >
                            <span>{step.actionText}</span>
                            <span>→</span>
                          </Link>
                        </div>
                      </div>

                      {/* Status and Details Grid */}
                      <div className="pt-3 border-t border-gray-100 dark:border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        {/* Status Count */}
                        <div className="p-3 bg-gray-50/80 dark:bg-slate-800/40 rounded-xl border border-gray-100 dark:border-slate-800">
                          <span className="font-bold text-gray-500 dark:text-slate-400 uppercase text-[10px] tracking-wider block mb-1">
                            Live Database Status
                          </span>
                          <p className="font-bold text-gray-900 dark:text-white text-sm">
                            {step.current_count > 0 ? (
                              <span className="text-emerald-600 dark:text-emerald-400">✓ {step.unit_label}</span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400">0 records found</span>
                            )}
                          </p>
                        </div>

                        {/* What Depends on It */}
                        <div className="p-3 bg-gray-50/80 dark:bg-slate-800/40 rounded-xl border border-gray-100 dark:border-slate-800">
                          <span className="font-bold text-gray-500 dark:text-slate-400 uppercase text-[10px] tracking-wider block mb-1">
                            What Depends On It
                          </span>
                          <p className="text-gray-700 dark:text-slate-300 font-medium leading-tight truncate" title={step.what_depends_on_it.join(', ')}>
                            {step.what_depends_on_it.join(' • ')}
                          </p>
                        </div>

                        {/* Required Fields Checklist */}
                        <div className="p-3 bg-gray-50/80 dark:bg-slate-800/40 rounded-xl border border-gray-100 dark:border-slate-800">
                          <span className="font-bold text-gray-500 dark:text-slate-400 uppercase text-[10px] tracking-wider block mb-1">
                            Required Information
                          </span>
                          <p className="text-gray-700 dark:text-slate-300 font-medium leading-tight truncate" title={step.required_fields.join(', ')}>
                            {step.required_fields.join(' • ')}
                          </p>
                        </div>
                      </div>

                      {/* Blocker alert if blocked */}
                      {isBlocked && step.block_reason && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold shrink-0">⚠️ Blocked:</span>
                            <span>{step.block_reason}</span>
                          </div>
                          {step.prerequisites.length > 0 && !step.prerequisites[0].is_satisfied && (
                            <Link
                              to={data.steps.find(s => s.id === step.prerequisites[0].id)?.config_url || '/admin/setup'}
                              className="font-bold text-rose-700 dark:text-rose-300 underline shrink-0 hover:text-rose-900"
                            >
                              Fix Prerequisite →
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 2: VISUAL DEPENDENCY MAP                                  */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeTab === 'dependency_map' && (
            <div className="space-y-6">
              <div className="card p-5 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 space-y-2">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Evidence-Driven Architecture & Dependency Map
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Click on any node in the graph below to inspect its purpose, database relations, and current live status.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Visual Graph Panel */}
                <div className="lg:col-span-2 card p-6 bg-slate-950 rounded-3xl border border-slate-800 text-white min-h-[480px] flex flex-col justify-between overflow-x-auto">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-800 text-xs">
                    <span className="font-bold text-slate-400 uppercase tracking-wider">Dependency Hierarchy (Top to Bottom)</span>
                    <span className="text-[11px] text-emerald-400 font-semibold">● 11 Verified Entity Nodes</span>
                  </div>

                  {/* Flowchart Layout */}
                  <div className="py-6 space-y-8 flex flex-col items-center min-w-[500px]">
                    {/* Layer 1: Foundation */}
                    <div className="flex items-center justify-center gap-8">
                      {data.data_flow.nodes.filter(n => n.category === 'Foundation').map(node => (
                        <button
                          key={node.id}
                          onClick={() => setSelectedNode(node)}
                          className={`px-4 py-3 rounded-2xl border text-xs font-bold transition-all shadow-md flex items-center gap-2.5 ${
                            selectedNode?.id === node.id
                              ? 'bg-primary-600 text-white border-primary-400 ring-4 ring-primary-500/30'
                              : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          <span className="text-base">🏛️</span>
                          <div className="text-left">
                            <div>{node.label}</div>
                            <div className="text-[10px] text-slate-400 font-normal">{node.current_count} configured</div>
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="text-slate-600 font-black text-sm">↓ ↓ ↓</div>

                    {/* Layer 2: Structure & People & Curriculum */}
                    <div className="flex flex-wrap items-center justify-center gap-4">
                      {data.data_flow.nodes.filter(n => ['Structure', 'People', 'Curriculum'].includes(n.category) && n.id !== 'students').map(node => (
                        <button
                          key={node.id}
                          onClick={() => setSelectedNode(node)}
                          className={`px-3.5 py-2.5 rounded-2xl border text-xs font-bold transition-all shadow-md flex items-center gap-2 ${
                            selectedNode?.id === node.id
                              ? 'bg-primary-600 text-white border-primary-400 ring-4 ring-primary-500/30'
                              : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          <span className="text-sm">
                            {node.category === 'People' ? '👨‍🏫' : node.category === 'Curriculum' ? '📚' : '🏢'}
                          </span>
                          <div className="text-left">
                            <div>{node.label}</div>
                            <div className="text-[10px] text-slate-400 font-normal">{node.current_count} records</div>
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="text-slate-600 font-black text-sm">↓ ↓ ↓</div>

                    {/* Layer 3: Scheduling */}
                    <div className="flex items-center justify-center gap-6">
                      {data.data_flow.nodes.filter(n => n.category === 'Scheduling' || n.id === 'students').map(node => (
                        <button
                          key={node.id}
                          onClick={() => setSelectedNode(node)}
                          className={`px-4 py-3 rounded-2xl border text-xs font-bold transition-all shadow-md flex items-center gap-2.5 ${
                            selectedNode?.id === node.id
                              ? 'bg-indigo-600 text-white border-indigo-400 ring-4 ring-indigo-500/30'
                              : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          <span className="text-base">{node.id === 'students' ? '🎓' : '🗓️'}</span>
                          <div className="text-left">
                            <div>{node.label}</div>
                            <div className="text-[10px] text-slate-400 font-normal">{node.current_count} records</div>
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="text-slate-600 font-black text-sm">↓ ↓ ↓</div>

                    {/* Layer 4: Daily Operations */}
                    <div className="flex items-center justify-center gap-6">
                      {data.data_flow.nodes.filter(n => n.category === 'Operations').map(node => (
                        <button
                          key={node.id}
                          onClick={() => setSelectedNode(node)}
                          className={`px-4 py-3 rounded-2xl border text-xs font-bold transition-all shadow-md flex items-center gap-2.5 ${
                            selectedNode?.id === node.id
                              ? 'bg-emerald-600 text-white border-emerald-400 ring-4 ring-emerald-500/30'
                              : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          <span className="text-base">⚡</span>
                          <div className="text-left">
                            <div>{node.label}</div>
                            <div className="text-[10px] text-emerald-400 font-normal">Active Workflow</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 pt-3 border-t border-slate-900 text-center">
                    All connections verified from database foreign keys and operational constraints.
                  </div>
                </div>

                {/* Selected Node Details Card */}
                <div className="card p-6 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 space-y-4 flex flex-col justify-between">
                  {selectedNode ? (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-primary-100 dark:bg-primary-950 text-primary-800 dark:text-primary-300">
                          {selectedNode.category} Layer
                        </span>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-2">
                          {selectedNode.label}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          {selectedNode.purpose}
                        </p>
                      </div>

                      <div className="p-3.5 bg-gray-50 dark:bg-slate-800/60 rounded-2xl space-y-1">
                        <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 block uppercase">
                          Live Record Count
                        </span>
                        <span className="text-lg font-black text-gray-900 dark:text-white">
                          {selectedNode.current_count}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <span className="text-xs font-bold text-gray-900 dark:text-white block">
                          Consumed By (Dependents):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedNode.used_by.map((item, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 font-semibold text-xs"
                            >
                              • {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-400 text-xs">
                      Select a node in the graph to view details.
                    </div>
                  )}

                  {selectedNode && (
                    <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
                      <Link
                        to={selectedNode.config_url}
                        className="btn bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold py-2.5 rounded-xl w-full flex items-center justify-center gap-1.5 shadow-xs transition"
                      >
                        <span>Manage {selectedNode.label}</span>
                        <span>→</span>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 3: RUNTIME DATA FLOW EXPLORER                             */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeTab === 'data_flow' && (
            <div className="space-y-6">
              {/* Flow Selector */}
              <div className="flex flex-wrap gap-2">
                {flowScenarios.map((flow, index) => (
                  <button
                    key={flow.id}
                    onClick={() => setActiveFlowIndex(index)}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs transition inline-flex items-center gap-2 ${
                      activeFlowIndex === index
                        ? 'bg-primary-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-800 hover:bg-gray-50'
                    }`}
                  >
                    <span>⚡</span>
                    <span>{flow.name.split('→')[0]} Workflow</span>
                  </button>
                ))}
              </div>

              {/* Selected Flow Overview */}
              <div className="card p-6 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 space-y-6">
                <div className="space-y-1">
                  <h2 className="text-lg font-black text-gray-900 dark:text-white">
                    {flowScenarios[activeFlowIndex].name}
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                    {flowScenarios[activeFlowIndex].description}
                  </p>
                </div>

                {/* Step through pipeline */}
                <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-primary-200 dark:before:bg-primary-900">
                  {flowScenarios[activeFlowIndex].steps.map((s, idx) => (
                    <div key={idx} className="relative flex items-start gap-4">
                      {/* Step Marker */}
                      <div className="absolute -left-6 sm:-left-8 top-0.5 w-6 h-6 rounded-full bg-primary-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                        {idx + 1}
                      </div>

                      <div className="p-4 bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 rounded-2xl flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                            {s.node}
                          </h4>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-200">
                            {s.role}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-slate-300">
                          {s.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 4: MODULE READINESS MATRIX                                */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeTab === 'module_readiness' && (
            <div className="space-y-6">
              <div className="card p-5 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 space-y-1">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Functional Module Readiness
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Each major FAFLOW capability evaluates its prerequisites to ensure administrators don't encounter unexpected errors during daily operations.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.module_readiness.map((mod) => {
                  const isReady = mod.status === 'READY'
                  const isPartial = mod.status === 'PARTIALLY_READY'

                  return (
                    <div
                      key={mod.id}
                      className={`card p-5 rounded-2xl border transition hover:shadow-md space-y-4 flex flex-col justify-between ${
                        isReady
                          ? 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-900/50'
                          : isPartial
                          ? 'bg-amber-50/20 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                          : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-base font-bold text-gray-900 dark:text-white">
                            {mod.name}
                          </h3>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                              isReady
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : isPartial
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {mod.status_label}
                          </span>
                        </div>

                        <p className="text-xs text-gray-600 dark:text-slate-400">
                          {mod.description}
                        </p>

                        {/* Prerequisites checklist chips */}
                        <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-slate-800">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                            Prerequisites Health:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {mod.requirements.map((req, idx) => (
                              <span
                                key={idx}
                                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1 ${
                                  req.is_satisfied
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                }`}
                              >
                                <span>{req.is_satisfied ? '✓' : '✕'}</span>
                                <span>{req.title}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">
                          {isReady ? 'Ready for faculty usage' : `${mod.missing_prerequisites.length} prerequisite(s) pending`}
                        </span>
                        <Link
                          to={mod.route_url}
                          className={`btn text-xs font-bold px-3 py-1.5 rounded-xl inline-flex items-center gap-1 transition ${
                            isReady
                              ? 'bg-primary-600 text-white hover:bg-primary-700'
                              : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200'
                          }`}
                        >
                          <span>{mod.action_text}</span>
                          <span>→</span>
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 5: SEARCHABLE GUIDE & FAQS                                */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeTab === 'knowledge_hub' && (
            <div className="space-y-6">
              {/* Search Bar */}
              <div className="card p-5 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 space-y-3">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 text-sm">
                    🔍
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search topics (e.g. 'How do I create a class?', 'Day Order', 'Timetable blocked', 'Substitution')..."
                    className="input pl-10 pr-4 py-2.5 w-full text-xs rounded-xl bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-gray-400 hover:text-gray-600 font-bold"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Popular Tags */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-gray-400 font-semibold text-[11px]">Popular:</span>
                  {['Setup Order', 'Classes & Students', 'Day Order', 'Timetable', 'Substitution', 'Geofence'].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setSearchQuery(tag)}
                      className="px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 font-medium text-[11px] transition"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Topics List */}
              <div className="space-y-4">
                {filteredTopics.length > 0 ? (
                  filteredTopics.map((topic) => (
                    <div
                      key={topic.id}
                      className="card p-6 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 space-y-2 hover:shadow-md transition"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border border-primary-100 dark:border-primary-900">
                          {topic.category}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-gray-900 dark:text-white">
                        {topic.title}
                      </h3>

                      <p className="text-xs font-semibold text-primary-700 dark:text-primary-400">
                        {topic.summary}
                      </p>

                      <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed pt-1">
                        {topic.content}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="card p-12 text-center text-gray-500 text-xs">
                    No documentation found matching "{searchQuery}". Try searching for "Classes", "Day Order", or "Timetable".
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
