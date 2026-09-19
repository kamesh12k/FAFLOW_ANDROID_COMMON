import { useState, useEffect } from 'react'
import { policyApi } from '../../api/services'
import { Spinner, ErrorAlert } from '../ui'

export default function HelpGuideModal({ isOpen, onClose, onReplayTour, user }) {
  const [activeTab, setActiveTab] = useState('guides')
  const [policyData, setPolicyData] = useState(null)
  const [loadingPolicy, setLoadingPolicy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    if (activeTab === 'policies' && !policyData) {
      setLoadingPolicy(true)
      policyApi.getCurrent()
        .then(res => setPolicyData(res.data))
        .catch(err => setError(err.response?.data?.detail || 'Could not fetch policies.'))
        .finally(() => setLoadingPolicy(false))
    }
  }, [isOpen, activeTab, policyData])

  if (!isOpen) return null

  const isTeacher = user?.role === 'teacher'
  const isAdmin = user?.role === 'admin' || user?.role === 'system_admin'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold">
              💡
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Help & Workflow Guides
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Institutional documentation, key workflows, and guided tour.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 flex gap-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={() => setActiveTab('guides')}
            className={`pb-2.5 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'guides'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            📋 Quick Workflows
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('policies')}
            className={`pb-2.5 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'policies'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            🛡️ Privacy & Policies
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('shortcuts')}
            className={`pb-2.5 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'shortcuts'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            ⌨️ Keyboard Shortcuts
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <ErrorAlert message={error} />

          {activeTab === 'guides' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-950/40 dark:to-blue-950/30 border border-primary-100 dark:border-primary-900/50 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Need a visual refresher?
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Replay the interactive guided walkthrough anytime.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    if (onReplayTour) onReplayTour()
                  }}
                  className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
                >
                  ▶ Replay Guided Tour
                </button>
              </div>

              {/* Workflow Cheatsheets */}
              <div className="grid gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>1. Taking Student Attendance</span>
                  </h5>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Navigate to <strong>Attendance</strong>, pick your period slot, and type absent roll suffixes (e.g. <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[11px]">12, 15, 22</code>) or tap student cards directly to toggle Present / Absent / On-Duty. Use <strong>Clear All Entries</strong> to reset anytime.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>2. Applying for Leave</span>
                  </h5>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Open <strong>Leave</strong>, choose Single Day, Multi-Day, or Custom Periods, pick affected period chips, and submit. The system automatically inspects your timetable slots for conflicts.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>3. Faculty Credits & Proxy Rewards</span>
                  </h5>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Whenever you cover a substitution class for a colleague on leave, you earn institutional credit points. Check your balance in <strong>Credits</strong>.
                  </p>
                </div>

                {isAdmin && (
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>4. HOD Leave Approval & Substitution</span>
                    </h5>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Review faculty leave requests under <strong>Leaves</strong>. Click <strong>Approve</strong> or <strong>Reject</strong>. Head to <strong>Today's Substitutions</strong> to assign or auto-match replacement teachers.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'policies' && (
            <div className="space-y-4">
              {loadingPolicy ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Spinner size="md" />
                  <span className="text-xs">Loading policies...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Accepted Version: {user?.policy_version_accepted || 'v1.0.0'}</span>
                    <span>Effective: {policyData?.effective_date || '2026-09-01'}</span>
                  </div>
                  {policyData?.sections?.map(section => (
                    <div key={section.id} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-1">
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white">{section.title}</h5>
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{section.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Open Command Palette & Global Search</span>
                <kbd className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                  Ctrl + K
                </kbd>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Close Modals / Drawers</span>
                <kbd className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                  Escape
                </kbd>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  )
}
