import { useState, useEffect, useRef } from 'react'
import { policyApi } from '../../api/services'
import { Spinner } from '../ui'

const ROLE_STEPS = {
  teacher: [
    {
      title: "Welcome to FAFLOW!",
      description: "Let's take a quick 2-minute tour of your institutional workspace so you know where everything is.",
      targetSelector: null, // Center modal
    },
    {
      title: "Quick Search & Command Palette",
      description: "Press Ctrl+K (or tap Search in the top bar) to instantly look up any room, class timetable, or colleague.",
      targetSelector: 'button[aria-label="Search"]',
    },
    {
      title: "Real-Time Institutional Alerts",
      description: "Get immediate notifications when timetable changes occur, leaves are approved, or substitution duties are assigned.",
      targetSelector: '[data-tour="notification-bell"], button[aria-label="Notifications"]',
    },
    {
      title: "Today's Timetable & Schedule",
      description: "Your daily classes, room assignments, and period slots are automatically resolved based on the current academic day order.",
      targetSelector: 'a[href*="/timetable"], a[href*="/teacher/dashboard"]',
    },
    {
      title: "Fast Student Attendance",
      description: "Mark attendance in seconds using quick rolls, fast absent entry, or single-tap status toggles.",
      targetSelector: 'a[href*="/attendance"], a[href*="/teacher/student-attendance"]',
    },
    {
      title: "Interactive Practice: Taking Attendance",
      description: "Try it yourself! Tap any student card below to practice toggling attendance status. (This is a safe simulator that will not affect real records).",
      targetSelector: null,
      isInteractiveSandbox: true,
    },
    {
      title: "Leave Management & Substitution",
      description: "Apply for leaves with automated period-clash detection and transparent substitution tracking.",
      targetSelector: 'a[href*="/leaves"], a[href*="/teacher/leave"]',
    },
    {
      title: "Faculty Credits & Recognition",
      description: "Earn institutional credit points for proxy periods and substitution assistance. Track your balance and rewards anytime.",
      targetSelector: 'a[href*="/credits"], a[href*="/teacher/credits"]',
    },
  ],
  admin: [
    {
      title: "Welcome to HOD Command Center",
      description: "Manage your department's faculty, timetables, student attendance, and daily substitution workflows from one unified dashboard.",
      targetSelector: null,
    },
    {
      title: "Department Overview & Faculty Roster",
      description: "Monitor faculty availability, today's working day order, and overall department schedule execution in real time.",
      targetSelector: 'a[href*="/admin/dashboard"]',
    },
    {
      title: "Leave Approvals & Conflict Detection",
      description: "Review pending faculty leave requests, check impact on daily class periods, and approve or reject with a single click.",
      targetSelector: 'a[href*="/admin/leaves"]',
    },
    {
      title: "Campus Operations & Substitutions",
      description: "Manage unattended periods with assisted/automated substitute faculty suggestions based on real-time availability and credit balance.",
      targetSelector: 'a[href*="/admin/today-substitutions"], a[href*="/admin/substitutions"]',
    },
    {
      title: "Department Timetable & Classes",
      description: "Configure class sections, allocate subjects to faculty, and ensure complete weekly curriculum coverage.",
      targetSelector: 'a[href*="/admin/timetable"], a[href*="/admin/classes"]',
    },
  ],
  principal: [
    {
      title: "Institutional Governance & Executive View",
      description: "High-level administrative oversight across all academic departments, faculty presence, and campus operations.",
      targetSelector: null,
    },
    {
      title: "Institution-Wide Attendance & Coverage",
      description: "Track real-time student and faculty attendance across all department wings with period-by-period granularity.",
      targetSelector: 'a[href*="/principal/dashboard"]',
    },
    {
      title: "Campus Operations & Governance Modes",
      description: "Supervise institutional policies, holiday declarations, day-order overrides, and cross-department substitution rules.",
      targetSelector: 'a[href*="/principal/substitutions"], a[href*="/principal/departments"]',
    },
  ],
  system_admin: [
    {
      title: "System Administration & Infrastructure",
      description: "Full control over user provisioning, multi-tenant departments, audit logs, and automated data retention.",
      targetSelector: null,
    },
    {
      title: "Department Workspace Switching",
      description: "Switch between department scopes or manage institution-wide resources from the global top navigation.",
      targetSelector: 'select[title*="Switch department"]',
    },
    {
      title: "Audit Trails & Automated Backups",
      description: "Review cryptographically logged administrative actions and schedule automated, verifiable database backups.",
      targetSelector: 'a[href*="/admin/audit-logs"], a[href*="/admin/backups"]',
    },
  ],
}

export default function GuidedTour({ isOpen, user, onComplete }) {
  const role = user?.role || 'teacher'
  const steps = ROLE_STEPS[role] || ROLE_STEPS.teacher

  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Interactive Sandbox state
  const [demoStudents, setDemoStudents] = useState([
    { id: 1, name: "Aravind Kumar", roll: "22CS01", status: "present" },
    { id: 2, name: "Bhavani S.", roll: "22CS02", status: "present" },
    { id: 3, name: "Chandran M.", roll: "22CS03", status: "absent" },
  ])
  const [sandboxToggled, setSandboxToggled] = useState(false)

  const currentStep = steps[currentStepIndex] || steps[0]

  useEffect(() => {
    if (!isOpen) return

    if (!currentStep.targetSelector) {
      setTargetRect(null)
      return
    }

    const updateRect = () => {
      const el = document.querySelector(currentStep.targetSelector)
      if (el) {
        const rect = el.getBoundingClientRect()
        setTargetRect({
          top: rect.top - 6,
          left: rect.left - 6,
          width: rect.width + 12,
          height: rect.height + 12,
        })
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      } else {
        setTargetRect(null)
      }
    }

    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect)
    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect)
    }
  }, [isOpen, currentStepIndex, currentStep])

  if (!isOpen) return null

  const handleFinishTour = async () => {
    setSubmitting(true)
    try {
      await policyApi.completeOnboarding()
      if (onComplete) onComplete()
    } catch {
      if (onComplete) onComplete()
    } finally {
      setSubmitting(false)
    }
  }

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(i => i + 1)
    } else {
      handleFinishTour()
    }
  }

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(i => i - 1)
    }
  }

  const toggleDemoStudent = (id) => {
    setDemoStudents(prev => prev.map(s => {
      if (s.id === id) {
        const next = s.status === 'present' ? 'absent' : (s.status === 'absent' ? 'od' : 'present')
        return { ...s, status: next }
      }
      return s
    }))
    setSandboxToggled(true)
  }

  return (
    <div className="fixed inset-0 z-[60] select-none">
      {/* Dimmed Overlay with Spotlight Cutout */}
      {targetRect ? (
        <svg className="absolute inset-0 w-full h-full pointer-events-none transition-all duration-300">
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx="12"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(15, 23, 42, 0.75)"
            mask="url(#spotlight-mask)"
          />
          {/* Spotlight Highlight Glow */}
          <rect
            x={targetRect.left}
            y={targetRect.top}
            width={targetRect.width}
            height={targetRect.height}
            rx="12"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="3"
            strokeDasharray="6 4"
            className="animate-pulse"
          />
        </svg>
      ) : (
        <div className="absolute inset-0 bg-slate-900/75 backdrop-blur-[2px] transition-opacity" />
      )}

      {/* Tour Dialog Card */}
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 pointer-events-auto space-y-4 animate-in zoom-in-95 duration-200">
          
          {/* Progress Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 px-2.5 py-1 rounded-full border border-primary-100 dark:border-primary-900/50">
                Step {currentStepIndex + 1} of {steps.length}
              </span>
              <div className="flex gap-1">
                {steps.map((_, idx) => (
                  <span
                    key={idx}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === currentStepIndex
                        ? 'w-5 bg-primary-600'
                        : idx < currentStepIndex
                        ? 'w-1.5 bg-primary-300 dark:bg-primary-800'
                        : 'w-1.5 bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleFinishTour}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              Skip Tour
            </button>
          </div>

          {/* Title & Description */}
          <div className="space-y-1.5">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{currentStep.title}</span>
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {currentStep.description}
            </p>
          </div>

          {/* Interactive Micro-Training Sandbox */}
          {currentStep.isInteractiveSandbox && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>SIMULATED CLASS: CS-A (Period 1)</span>
                <span className="text-primary-600 font-extrabold">Tap to toggle status</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {demoStudents.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleDemoStudent(s.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all active:scale-95 ${
                      s.status === 'present'
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                        : s.status === 'absent'
                        ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                        : 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    <div className="text-[10px] font-mono font-bold opacity-75">{s.roll}</div>
                    <div className="text-xs font-bold truncate mt-0.5">{s.name}</div>
                    <div className="text-[10px] uppercase font-black tracking-wider mt-1">
                      {s.status === 'present' ? '✓ Present' : s.status === 'absent' ? '✗ Absent' : '★ OD'}
                    </div>
                  </button>
                ))}
              </div>
              {sandboxToggled && (
                <div className="p-2 rounded-lg bg-emerald-100/70 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-[11px] font-bold flex items-center gap-1.5 animate-in fade-in">
                  <span>🎉 Great job! You know how fast attendance toggle works.</span>
                </div>
              )}
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={currentStepIndex === 0}
              onClick={handleBack}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                currentStepIndex > 0
                  ? 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  : 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
              }`}
            >
              ← Back
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={handleNext}
              className="px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 active:scale-[0.98] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Spinner size="xs" color="white" />
                  <span>Completing...</span>
                </>
              ) : currentStepIndex === steps.length - 1 ? (
                <span>Finish & Go to Dashboard ✓</span>
              ) : (
                <span>Next →</span>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
