import { useState, useEffect } from 'react'
import {
  managerLeavesApi,
  operationalStaffApi,
} from '../../api/services'
import { useAuth } from '../../context/AuthContext'
import {
  CalendarIcon,
  CheckIcon,
  XMarkIcon,
  Spinner,
  DoorIcon,
  ClockIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
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

export default function StaffLeaves() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('pending') // 'pending', 'history', 'credits'
  const [leaves, setLeaves] = useState([])
  const [credits, setCredits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Modals state
  const [actionModal, setActionModal] = useState(null) // { type: 'approve'|'reject', leave: Object }
  const [approvalRemarks, setApprovalRemarks] = useState('')
  const [processing, setProcessing] = useState(false)

  // Credit Adjustment Modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [adjustData, setAdjustData] = useState({
    staff_id: '',
    change: '1.0',
    category: 'overtime_duty',
    reason: '',
  })

  // Leave Limit / Quota Modal
  const [quotaModalOpen, setQuotaModalOpen] = useState(false)
  const [quotaData, setQuotaData] = useState({
    staff_id: '',
    staff_name: '',
    annual_quota: '12.0',
    adjust_balance: true,
    reason: '',
  })

  // Staff Ledger Drawer
  const [ledgerStaff, setLedgerStaff] = useState(null)
  const [ledgerSummary, setLedgerSummary] = useState(null)
  const [loadingLedger, setLoadingLedger] = useState(false)

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const sFilter = activeTab === 'pending' ? 'pending' : (statusFilter || undefined)
      const [creditsRes, leavesRes] = await Promise.all([
        managerLeavesApi.getCredits({ category_filter: categoryFilter || undefined }),
        activeTab !== 'credits'
          ? managerLeavesApi.list({ status_filter: sFilter, category_filter: categoryFilter || undefined })
          : Promise.resolve({ data: [] }),
      ])
      setCredits(creditsRes.data)
      if (activeTab !== 'credits') {
        setLeaves(leavesRes.data)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load staff leave records')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [activeTab, categoryFilter, statusFilter])

  const handleApproveReject = async () => {
    if (!actionModal) return
    setProcessing(true)
    setError('')
    setSuccess('')
    try {
      if (actionModal.type === 'approve') {
        await managerLeavesApi.approve(actionModal.leave.id, approvalRemarks)
        setSuccess(`Leave request for ${actionModal.leave.staff_name} approved! Deducted ${actionModal.leave.days_count} day(s) from credits.`)
      } else {
        await managerLeavesApi.reject(actionModal.leave.id, approvalRemarks)
        setSuccess(`Leave request for ${actionModal.leave.staff_name} rejected.`)
      }
      setActionModal(null)
      setApprovalRemarks('')
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || `Failed to ${actionModal.type} leave request`)
    } finally {
      setProcessing(false)
    }
  }

  const handleCreditAdjust = async (e) => {
    e.preventDefault()
    setProcessing(true)
    setError('')
    setSuccess('')
    try {
      await managerLeavesApi.adjustCredit({
        staff_id: Number(adjustData.staff_id),
        change: Number(adjustData.change),
        category: adjustData.category,
        reason: adjustData.reason,
      })
      setSuccess(`Credit ledger balance adjusted successfully!`)
      setAdjustModalOpen(false)
      setAdjustData({ staff_id: '', change: '1.0', category: 'overtime_duty', reason: '' })
      loadData()
      if (ledgerStaff && ledgerStaff.staff_id === Number(adjustData.staff_id)) {
        openStaffLedger(ledgerStaff)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to adjust staff credit balance')
    } finally {
      setProcessing(false)
    }
  }

  const handleUpdateQuota = async (e) => {
    e.preventDefault()
    setProcessing(true)
    setError('')
    setSuccess('')
    try {
      await managerLeavesApi.updateQuota({
        staff_id: Number(quotaData.staff_id),
        annual_quota: Number(quotaData.annual_quota),
        adjust_balance: Boolean(quotaData.adjust_balance),
        reason: quotaData.reason || `Annual leave quota limit set to ${quotaData.annual_quota} days`,
      })
      setSuccess(`Annual leave limit for ${quotaData.staff_name || 'staff'} set to ${quotaData.annual_quota} days!`)
      setQuotaModalOpen(false)
      loadData()
      if (ledgerStaff && ledgerStaff.staff_id === Number(quotaData.staff_id)) {
        openStaffLedger(ledgerStaff)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update leave quota limit')
    } finally {
      setProcessing(false)
    }
  }


  const openStaffLedger = async (st) => {
    setLedgerStaff(st)
    setLoadingLedger(true)
    try {
      const res = await managerLeavesApi.getStaffLedger(st.staff_id || st.id)
      setLedgerSummary(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load staff leave ledger')
    } finally {
      setLoadingLedger(false)
    }
  }

  const filteredLeaves = leaves.filter(l => {
    const q = search.toLowerCase()
    return (
      l.staff_name.toLowerCase().includes(q) ||
      l.employee_code.toLowerCase().includes(q) ||
      l.reason.toLowerCase().includes(q) ||
      l.leave_type.toLowerCase().includes(q)
    )
  })

  const filteredCredits = credits.filter(c => {
    const q = search.toLowerCase()
    return (
      c.staff_name.toLowerCase().includes(q) ||
      c.employee_code.toLowerCase().includes(q) ||
      c.designation.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6 pb-24 lg:pb-8">
      {/* Page Header */}
      <div className="card p-5 sm:p-7 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-xs font-bold text-indigo-200">
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Operational Staff Management</span>
              <span>&middot;</span>
              <span>Leave Accounting</span>
            </div>
            <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white">
              Staff Leaves & Leave Ledger
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-xl">
              Review and approve leave applications for laboratory and non-teaching staff, track credit balances, and audit ledger entries.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"

            onClick={() => {
              const firstStaff = credits[0]
              setQuotaData({
                staff_id: firstStaff ? String(firstStaff.staff_id) : '',
                staff_name: firstStaff ? firstStaff.staff_name : '',
                annual_quota: firstStaff ? String(firstStaff.annual_quota || 12.0) : '12.0',
                adjust_balance: true,
                reason: '',
              })
              setQuotaModalOpen(true)
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition-all shadow-md active:scale-95 self-start sm:self-auto min-h-[44px]"
          >
            <SettingsIcon className="w-4 h-4" />
            <span>Set Leave Limit / Quota</span>
          </button>

            <button
              type="button"
              onClick={() => setAdjustModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md active:scale-95 self-start sm:self-auto min-h-[44px]"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Award / Adjust Credits</span>
            </button>
          </div>
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

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
            activeTab === 'pending'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <ClockIcon className="w-3.5 h-3.5" />
          <span>Pending Approvals</span>
        </button>

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
          <span>All Leave History</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('credits')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
            activeTab === 'credits'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <DoorIcon className="w-3.5 h-3.5" />
          <span>Credit Balances & Ledger</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by staff name, code, reason..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9 text-xs w-full min-h-[42px]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="input text-xs min-h-[42px]"
          >
            <option value="">All Categories</option>
            <option value="laboratory">Laboratory Staff</option>
            <option value="non_teaching">Non-Teaching Staff</option>
          </select>

          {activeTab === 'history' && (
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="input text-xs min-h-[42px]"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          )}
        </div>
      </div>

      {/* Content Rendering */}
      {loading ? (
        <div className="flex justify-center items-center py-24"><Spinner /></div>
      ) : activeTab === 'credits' ? (
        /* Credits Table & Cards */
        <div className="space-y-4">
          <div className="hidden md:block overflow-x-auto card rounded-2xl border border-slate-200 shadow-xs bg-white">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3.5">Staff Member</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Department</th>
                  <th className="px-5 py-3.5">Annual Limit / Quota</th>
                  <th className="px-5 py-3.5">Leave Balance</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCredits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">No staff credit records found.</td>
                  </tr>
                ) : (
                  filteredCredits.map(c => (
                    <tr key={c.staff_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-extrabold text-slate-900">{c.staff_name}</div>
                        <div className="text-slate-400 font-mono text-[11px]">{c.employee_code} &middot; {c.designation}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="capitalize font-bold text-slate-700">{c.category.replace('_', ' ')}</span>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-600">{c.department_name}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-black text-xs">
                          {c.annual_quota || 12.0} Days/Yr
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-black border ${
                          c.balance > 5
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : (c.balance > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200')
                        }`}>
                          {c.balance} Days
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openStaffLedger(c)}
                            className="px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-xs font-bold text-indigo-700 transition-colors"
                          >
                            Statement
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAdjustData({ ...adjustData, staff_id: String(c.staff_id) })
                              setAdjustModalOpen(true)
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-xs font-bold text-amber-800 transition-colors"
                          >
                            Adjust
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setQuotaData({
                                staff_id: String(c.staff_id),
                                staff_name: c.staff_name,
                                annual_quota: String(c.annual_quota || 12.0),
                                adjust_balance: true,
                                reason: '',
                              })
                              setQuotaModalOpen(true)
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
                          >
                            Set Limit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards for Credits (< md) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredCredits.map(c => (
              <div key={c.staff_id} className="card p-4 border border-slate-200 rounded-2xl bg-white shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">{c.staff_name}</h3>
                    <p className="text-xs text-slate-400 font-mono">{c.employee_code} &middot; {c.designation}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2.5 py-1 rounded-xl text-xs font-black border block ${
                      c.balance > 5
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : (c.balance > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200')
                    }`}>
                      {c.balance} Days
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Quota: {c.annual_quota || 12.0}d</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Category: <strong className="capitalize text-slate-700">{c.category.replace('_', ' ')}</strong></span>
                  <span>{c.department_name}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => openStaffLedger(c)}
                    className="py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700 hover:bg-indigo-100 text-center"
                  >
                    Statement
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustData({ ...adjustData, staff_id: String(c.staff_id) })
                      setAdjustModalOpen(true)
                    }}
                    className="py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800 hover:bg-amber-100 text-center"
                  >
                    Adjust
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuotaData({
                        staff_id: String(c.staff_id),
                        staff_name: c.staff_name,
                        annual_quota: String(c.annual_quota || 12.0),
                        adjust_balance: true,
                        reason: '',
                      })
                      setQuotaModalOpen(true)
                    }}
                    className="py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 text-center"
                  >
                    Set Limit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (

        /* Leaves List (Pending or History) */
        <div className="space-y-3">
          {filteredLeaves.length === 0 ? (
            <div className="card p-8 text-center bg-white border border-slate-200 rounded-2xl">
              <CalendarIcon className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">No {activeTab === 'pending' ? 'pending' : ''} leave requests found.</p>
            </div>
          ) : (
            filteredLeaves.map(l => (
              <div key={l.id} className="card p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl shadow-xs hover:shadow-sm transition-all space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-sm sm:text-base text-slate-900">{l.staff_name}</h3>
                      <span className="text-xs text-slate-400 font-mono">({l.employee_code})</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold capitalize">
                        {l.category.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">Department: {l.department_name}</p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize border ${LEAVE_TYPE_COLORS[l.leave_type] || LEAVE_TYPE_COLORS.other}`}>
                      {l.leave_type.replace('_', ' ')} Leave
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-black capitalize border ${STATUS_BADGES[l.status]}`}>
                      {l.status}
                    </span>
                  </div>
                </div>

                {/* Leave Date Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl text-xs">
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">Duration</span>
                    <span className="font-extrabold text-slate-800">
                      {l.start_date} {l.start_date !== l.end_date && `to ${l.end_date}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">Days Count</span>
                    <span className="font-black text-indigo-700">
                      {l.days_count} Day{l.days_count > 1 ? 's' : ''} {l.is_half_day && `(${l.half_day_session})`}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">Applied On</span>
                    <span className="font-semibold text-slate-700">
                      {l.created_at ? new Date(l.created_at).toLocaleDateString() : 'N/A'}
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
                      {l.status === 'approved' ? 'Approval Remarks' : 'Rejection Remarks'} by {l.approved_by_name || 'Manager'}:
                    </span>
                    <p className="text-slate-700 italic">{l.approval_remarks}</p>
                  </div>
                )}

                {/* Action Buttons for Pending Leaves */}
                {l.status === 'pending' && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setActionModal({ type: 'reject', leave: l })
                        setApprovalRemarks('')
                      }}
                      className="px-4 py-2 rounded-xl border border-rose-200 hover:bg-rose-50 text-xs font-bold text-rose-600 transition-all min-h-[40px]"
                    >
                      Reject Request
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActionModal({ type: 'approve', leave: l })
                        setApprovalRemarks('')
                      }}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all shadow-sm min-h-[40px] flex items-center gap-1.5"
                    >
                      <CheckIcon className="w-4 h-4" />
                      <span>Approve Leave</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Approve / Reject Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-base text-slate-900">
                {actionModal.type === 'approve' ? 'Approve Staff Leave' : 'Reject Staff Leave'}
              </h3>
              <button onClick={() => setActionModal(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl text-xs space-y-1">
              <p><strong className="text-slate-700">Staff:</strong> {actionModal.leave.staff_name} ({actionModal.leave.employee_code})</p>
              <p><strong className="text-slate-700">Duration:</strong> {actionModal.leave.start_date} to {actionModal.leave.end_date} ({actionModal.leave.days_count} Days)</p>
              <p><strong className="text-slate-700">Reason:</strong> {actionModal.leave.reason}</p>
            </div>

            {actionModal.type === 'approve' && (
              <p className="text-xs text-amber-700 font-semibold bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                ℹ️ Approving will automatically deduct <strong>{actionModal.leave.days_count} day(s)</strong> from this staff member's leave credit ledger.
              </p>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {actionModal.type === 'approve' ? 'Approval Remarks (Optional)' : 'Rejection Remarks *'}
              </label>
              <textarea
                rows={3}
                required={actionModal.type === 'reject'}
                placeholder={actionModal.type === 'approve' ? 'e.g. Approved. Keys handed over to lab backup.' : 'e.g. Insufficient staff on duty during lab exams.'}
                value={approvalRemarks}
                onChange={e => setApprovalRemarks(e.target.value)}
                className="input text-xs w-full py-2"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={handleApproveReject}
                className={`px-5 py-2 rounded-xl text-white text-xs font-black shadow-sm ${
                  actionModal.type === 'approve' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {processing ? <Spinner className="w-4 h-4 text-white" /> : `Confirm ${actionModal.type === 'approve' ? 'Approval' : 'Rejection'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credit Adjustment Modal */}
      {adjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-base text-slate-900">Award / Adjust Staff Leave Credits</h3>
              <button onClick={() => setAdjustModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreditAdjust} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Select Staff Member *</label>
                <select
                  required
                  value={adjustData.staff_id}
                  onChange={e => setAdjustData({ ...adjustData, staff_id: e.target.value })}
                  className="input text-xs w-full min-h-[42px]"
                >
                  <option value="">Select Staff...</option>
                  {credits.map(c => (
                    <option key={c.staff_id} value={c.staff_id}>
                      {c.staff_name} ({c.employee_code}) — Current: {c.balance} Days
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Credit Change (+/- Days) *</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    placeholder="+1.0 or -1.0"
                    value={adjustData.change}
                    onChange={e => setAdjustData({ ...adjustData, change: e.target.value })}
                    className="input text-xs w-full min-h-[42px]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Category *</label>
                  <select
                    value={adjustData.category}
                    onChange={e => setAdjustData({ ...adjustData, category: e.target.value })}
                    className="input text-xs w-full min-h-[42px]"
                  >
                    <option value="overtime_duty">Overtime Duty</option>
                    <option value="lab_maintenance_duty">Lab Maintenance</option>
                    <option value="exam_support_duty">Exam Duty Support</option>
                    <option value="manual_adjustment">Manual Adjustment</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Reason / Duty Description *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Compensatory credit for Sunday Lab Server configuration"
                  value={adjustData.reason}
                  onChange={e => setAdjustData({ ...adjustData, reason: e.target.value })}
                  className="input text-xs w-full py-2"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow-sm"
                >
                  {processing ? <Spinner className="w-4 h-4 text-white" /> : 'Save Credit Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Ledger Statement Drawer / Modal */}
      {ledgerStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 space-y-4 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-base text-slate-900">{ledgerStaff.staff_name} — Leave Credit Ledger</h3>
                <p className="text-xs text-slate-400 font-mono">{ledgerStaff.employee_code} &middot; {ledgerStaff.department_name}</p>
              </div>
              <button onClick={() => setLedgerStaff(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            {loadingLedger ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : ledgerSummary ? (
              <div className="space-y-4">
                {/* Ledger Summary Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="card p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Annual Limit</span>
                    <span className="text-base sm:text-lg font-black text-slate-900">{ledgerSummary.annual_quota || 12.0} Days</span>
                  </div>
                  <div className="card p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-center">
                    <span className="text-[10px] uppercase font-bold text-indigo-600 block">Current Balance</span>
                    <span className="text-base sm:text-lg font-black text-indigo-900">{ledgerSummary.current_balance} Days</span>
                  </div>
                  <div className="card p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
                    <span className="text-[10px] uppercase font-bold text-rose-600 block">Leaves Taken</span>
                    <span className="text-base sm:text-lg font-black text-rose-900">{ledgerSummary.total_leaves_taken} Days</span>
                  </div>
                  <div className="card p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                    <span className="text-[10px] uppercase font-bold text-emerald-600 block">Credits Earned</span>
                    <span className="text-base sm:text-lg font-black text-emerald-900">{ledgerSummary.total_credits_earned} Days</span>
                  </div>
                </div>

                {/* Ledger Transactions Timeline */}
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2">Ledger Transaction History</h4>
                  <div className="space-y-2">
                    {ledgerSummary.transactions.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">No transactions recorded yet.</p>
                    ) : (
                      ledgerSummary.transactions.map(t => (
                        <div key={t.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start justify-between gap-3 text-xs">
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
                              Bal: {t.balance_after}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Set Staff Annual Leave Quota / Limit Modal */}
      {quotaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-base text-slate-900">Set Staff Annual Leave Limit</h3>
              <button onClick={() => setQuotaModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleUpdateQuota} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Staff Member *</label>
                <select
                  required
                  value={quotaData.staff_id}
                  onChange={e => {
                    const sel = credits.find(c => String(c.staff_id) === e.target.value)
                    setQuotaData({
                      ...quotaData,
                      staff_id: e.target.value,
                      staff_name: sel ? sel.staff_name : '',
                      annual_quota: sel ? String(sel.annual_quota || 12.0) : '12.0',
                    })
                  }}
                  className="input text-xs w-full min-h-[42px]"
                >
                  <option value="">Select Staff Member...</option>
                  {credits.map(c => (
                    <option key={c.staff_id} value={c.staff_id}>
                      {c.staff_name} ({c.employee_code}) — Quota: {c.annual_quota || 12.0}d &middot; Bal: {c.balance}d
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Annual Leave Limit (Days / Year) *</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  required
                  placeholder="e.g. 15.0 or 18.0"
                  value={quotaData.annual_quota}
                  onChange={e => setQuotaData({ ...quotaData, annual_quota: e.target.value })}
                  className="input text-xs w-full min-h-[42px]"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={quotaData.adjust_balance}
                    onChange={e => setQuotaData({ ...quotaData, adjust_balance: e.target.checked })}
                    className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
                  />
                  <span>Automatically adjust current ledger balance</span>
                </label>
                <p className="text-[11px] text-slate-500 pl-6">
                  If checked, the quota difference (e.g. +3.0 days) will immediately be credited to the staff member's available balance with an audit log.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Reason / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Management policy quota revision"
                  value={quotaData.reason}
                  onChange={e => setQuotaData({ ...quotaData, reason: e.target.value })}
                  className="input text-xs w-full py-2"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuotaModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow-sm"
                >
                  {processing ? <Spinner className="w-4 h-4 text-white" /> : 'Save Leave Limit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

