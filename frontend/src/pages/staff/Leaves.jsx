import { useState, useEffect } from 'react'
import { staffPortalApi } from '../../api/services'
import { useAuth } from '../../context/AuthContext'
import {
  CalendarIcon,
  PlusIcon,
  Spinner,
  ClockIcon,
  DoorIcon,
  CheckIcon,
  XMarkIcon,
} from '../../components/icons'

const LEAVE_TYPE_COLORS = {
  casual: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  medical: 'bg-rose-50 text-rose-700 border-rose-200',
  earned: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  on_duty: 'bg-blue-50 text-blue-700 border-blue-200',
  compensatory_off: 'bg-amber-50 text-amber-700 border-amber-200',
  other: 'bg-slate-100 text-slate-700 border-slate-200',
}

const STATUS_BADGES = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
}

export default function StaffMyLeaves() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('history') // 'history', 'ledger'
  const [leaves, setLeaves] = useState([])
  const [ledger, setLedger] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Apply Modal
  const [applyModalOpen, setApplyModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    leave_type: 'casual',
    is_half_day: false,
    half_day_session: 'forenoon',
    reason: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [leavesRes, ledgerRes] = await Promise.all([
        staffPortalApi.getMyLeaves(),
        staffPortalApi.getMyLedger(),
      ])
      setLeaves(leavesRes.data)
      setLedger(ledgerRes.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load your leave and ledger records')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleApply = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      await staffPortalApi.applyLeave({
        ...formData,
        end_date: formData.is_half_day ? formData.start_date : formData.end_date,
      })
      setSuccess('Leave request submitted successfully! Pending manager review.')
      setApplyModalOpen(false)
      setFormData({
        start_date: '',
        end_date: '',
        leave_type: 'casual',
        is_half_day: false,
        half_day_session: 'forenoon',
        reason: '',
      })
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit leave application')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async (leaveId) => {
    if (!window.confirm('Are you sure you want to cancel this leave request?')) return
    setError('')
    setSuccess('')
    try {
      await staffPortalApi.cancelLeave(leaveId)
      setSuccess('Leave request cancelled.')
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to cancel leave request')
    }
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-8">
      {/* Hero Welcome Banner */}
      <div className="card p-5 sm:p-7 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-xs font-bold text-indigo-200">
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Staff Workspace</span>
              <span>&middot;</span>
              <span>Leave & Credit Ledger</span>
            </div>
            <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white">
              My Leaves & Leave Ledger
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-xl">
              Apply for leave, track approval status from your reporting manager, and check your running credit balance.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setApplyModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md active:scale-95 self-start sm:self-auto min-h-[44px]"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Apply for Leave</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs sm:text-sm text-rose-700 font-semibold flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 font-bold">✕</button>
        </div>
      )}
      {success && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs sm:text-sm text-emerald-700 font-semibold flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="text-emerald-500 hover:text-emerald-700 font-bold">✕</button>
        </div>
      )}

      {/* Credit Balance Card */}
      {ledger && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-5 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Leave Credit Balance</p>
              <h3 className="text-2xl font-black text-slate-900">{ledger.current_balance} <span className="text-xs font-semibold text-slate-500">Days</span></h3>
            </div>
          </div>

          <div className="card p-5 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-center gap-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
              <ClockIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Leaves Approved</p>
              <h3 className="text-2xl font-black text-rose-700">{ledger.total_leaves_taken} <span className="text-xs font-semibold text-slate-500">Days</span></h3>
            </div>
          </div>

          <div className="card p-5 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <PlusIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Compensations / Earned</p>
              <h3 className="text-2xl font-black text-emerald-700">{ledger.total_credits_earned} <span className="text-xs font-semibold text-slate-500">Days</span></h3>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
            activeTab === 'history'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <CalendarIcon className="w-3.5 h-3.5" />
          <span>My Leave Applications ({leaves.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ledger')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
            activeTab === 'ledger'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <ClockIcon className="w-3.5 h-3.5" />
          <span>Credit Statement & Ledger</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : activeTab === 'history' ? (
        /* Applications List */
        <div className="space-y-3">
          {leaves.length === 0 ? (
            <div className="card p-8 text-center bg-white border border-slate-200 rounded-2xl">
              <CalendarIcon className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">No leave requests found.</p>
              <p className="text-xs text-slate-400 mt-1">Click "Apply for Leave" to submit your first request.</p>
            </div>
          ) : (
            leaves.map(l => (
              <div key={l.id} className="card p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize border ${LEAVE_TYPE_COLORS[l.leave_type] || LEAVE_TYPE_COLORS.other}`}>
                      {l.leave_type.replace('_', ' ')} Leave
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-black capitalize border ${STATUS_BADGES[l.status]}`}>
                      {l.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 font-medium">
                    Applied on: {l.created_at ? new Date(l.created_at).toLocaleDateString() : 'N/A'}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl text-xs">
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">Leave Duration</span>
                    <span className="font-extrabold text-slate-800">
                      {l.start_date} {l.start_date !== l.end_date && `to ${l.end_date}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">Total Days</span>
                    <span className="font-black text-indigo-700">
                      {l.days_count} Day{l.days_count > 1 ? 's' : ''} {l.is_half_day && `(${l.half_day_session})`}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-bold text-slate-400 block uppercase">Reason:</span>
                  <p className="text-xs text-slate-800 font-medium mt-0.5">{l.reason}</p>
                </div>

                {l.approval_remarks && (
                  <div className="p-2.5 rounded-xl bg-slate-100/70 border border-slate-200 text-xs">
                    <span className="font-bold text-slate-600 block">
                      {l.status === 'approved' ? 'Manager Approval Note' : 'Rejection Reason'} ({l.approved_by_name || 'Manager'}):
                    </span>
                    <p className="text-slate-700 italic">{l.approval_remarks}</p>
                  </div>
                )}

                {l.status === 'pending' && (
                  <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleCancel(l.id)}
                      className="px-4 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors min-h-[38px]"
                    >
                      Cancel Application
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        /* Ledger Timeline */
        <div className="card p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Leave Credit Transaction History</h3>
          <div className="space-y-2">
            {!ledger || ledger.transactions.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No ledger transactions recorded yet.</p>
            ) : (
              ledger.transactions.map(t => (
                <div key={t.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] capitalize ${
                        t.change > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {t.category.replace('_', ' ')}
                      </span>
                      <span className="text-slate-400 text-[11px] font-mono">
                        {t.created_at ? new Date(t.created_at).toLocaleString() : ''}
                      </span>
                    </div>
                    <p className="text-slate-800 font-medium">{t.reason}</p>
                    {t.created_by_name && (
                      <p className="text-[11px] text-slate-400">By Manager: <strong>{t.created_by_name}</strong></p>
                    )}
                  </div>

                  <div className="text-right whitespace-nowrap">
                    <span className={`font-black text-sm block ${t.change > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {t.change > 0 ? `+${t.change}` : t.change}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold block">
                      Balance: {t.balance_after}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Apply Leave Modal */}
      {applyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-base text-slate-900">Apply for Staff Leave</h3>
              <button onClick={() => setApplyModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleApply} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Leave Type *</label>
                <select
                  required
                  value={formData.leave_type}
                  onChange={e => setFormData({ ...formData, leave_type: e.target.value })}
                  className="input text-xs w-full min-h-[42px]"
                >
                  <option value="casual">Casual Leave (CL)</option>
                  <option value="medical">Medical Leave (ML)</option>
                  <option value="earned">Earned Leave (EL)</option>
                  <option value="on_duty">On-Duty (OD)</option>
                  <option value="compensatory_off">Compensatory Off (Comp-Off)</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="is_half_day"
                  checked={formData.is_half_day}
                  onChange={e => setFormData({ ...formData, is_half_day: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <label htmlFor="is_half_day" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Half-Day Leave (0.5 Day)
                </label>
              </div>

              {formData.is_half_day ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.start_date}
                      onChange={e => setFormData({ ...formData, start_date: e.target.value, end_date: e.target.value })}
                      className="input text-xs w-full min-h-[42px]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Session *</label>
                    <select
                      value={formData.half_day_session}
                      onChange={e => setFormData({ ...formData, half_day_session: e.target.value })}
                      className="input text-xs w-full min-h-[42px]"
                    >
                      <option value="forenoon">Forenoon (FN)</option>
                      <option value="afternoon">Afternoon (AN)</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Start Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.start_date}
                      onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                      className="input text-xs w-full min-h-[42px]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">End Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.end_date}
                      onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                      className="input text-xs w-full min-h-[42px]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Reason for Leave *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Please state the reason for your leave request..."
                  value={formData.reason}
                  onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  className="input text-xs w-full py-2"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setApplyModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow-sm"
                >
                  {submitting ? <Spinner className="w-4 h-4 text-white" /> : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
