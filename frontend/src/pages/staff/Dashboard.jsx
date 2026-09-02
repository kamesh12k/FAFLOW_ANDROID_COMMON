import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { staffPortalApi, managerLeavesApi } from '../../api/services'
import { useAuth } from '../../context/AuthContext'
import { Spinner } from '../../components/ui'
import { DoorIcon, UsersIcon, CheckCircleIcon, CalIcon, ClockIcon, BookIcon, DocIcon, PlusIcon } from '../../components/icons'

export default function StaffDashboard() {
  const { user, isManager, isAdmin } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [selectedDayOrder, setSelectedDayOrder] = useState(1)

  // Credit Adjustment Modal (for managers / admins inspecting the workspace)
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [adjustData, setAdjustData] = useState({
    change: '1.0',
    category: 'overtime_duty',
    reason: '',
  })
  const [processing, setProcessing] = useState(false)

  const loadDashboard = (roomId) => {
    setLoading(true)
    setError('')
    staffPortalApi.getDashboard(roomId ? { selected_room_id: roomId } : {})
      .then(res => {
        setData(res.data)
        if (res.data.today_day_order) {
          setSelectedDayOrder(res.data.today_day_order)
        }
      })
      .catch(err => setError(err.response?.data?.detail || 'Failed to load staff dashboard data'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadDashboard(selectedRoomId)
  }, [selectedRoomId])

  const profile = data?.profile
  const assignedRoom = data?.assigned_room
  const myControlledLabs = data?.my_controlled_labs || []
  const todaySchedule = data?.today_schedule || []
  const weeklySchedule = data?.weekly_schedule || []
  const allLabs = data?.all_labs || []
  const colleagues = data?.colleagues || []

  // Filter weekly schedule for selected day order
  const daySchedule = weeklySchedule.filter(s => s.day_order === selectedDayOrder)

  const handleCreditAdjust = async (e) => {
    e.preventDefault()
    if (!profile) return
    setProcessing(true)
    setError('')
    setSuccess('')
    try {
      await managerLeavesApi.adjustCredit({
        staff_id: profile.id,
        change: Number(adjustData.change),
        category: adjustData.category,
        reason: adjustData.reason,
      })
      setSuccess(`Credit ledger balance for ${profile.full_name} adjusted successfully!`)
      setAdjustModalOpen(false)
      setAdjustData({ change: '1.0', category: 'overtime_duty', reason: '' })
      loadDashboard(selectedRoomId)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to adjust staff credit balance')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      {/* Hero Welcome Banner */}
      <div className="card p-5 sm:p-7 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-xs font-bold text-indigo-200">
              <span>{profile?.category === 'laboratory' ? 'Laboratory Facility Staff' : 'Operational Staff Workspace'}</span>
              <span>&middot;</span>
              <span>{profile?.department_name || 'Institution-wide'}</span>
            </div>
            <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white">
              Welcome, {profile?.full_name || user?.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-xl">
              {profile?.designation || 'Staff Technician'} &middot; Code: <span className="font-mono font-bold text-white">{profile?.employee_code || user?.username}</span>
            </p>
          </div>

          {/* Quick Actions & Facility Switcher */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <Link
              to="/staff/leaves"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md active:scale-95 min-h-[42px]"
            >
              <DocIcon className="w-4 h-4" />
              <span>My Leaves & Ledger</span>
            </Link>

            {(isManager || isAdmin) && profile && (
              <button
                type="button"
                onClick={() => setAdjustModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition-all shadow-md active:scale-95 min-h-[42px]"
              >
                <PlusIcon className="w-4 h-4" />
                <span>Adjust Credits</span>
              </button>
            )}

            {allLabs.length > 0 && (
              <div className="bg-white/10 backdrop-blur-md p-2.5 rounded-2xl border border-white/15 min-w-[200px]">
                <label className="text-[10px] font-bold text-indigo-200 block mb-1 flex items-center gap-1">
                  <DoorIcon className="w-3.5 h-3.5" /> Campus Facilities:
                </label>
                <select
                  value={selectedRoomId || assignedRoom?.id || ''}
                  onChange={e => setSelectedRoomId(e.target.value)}
                  className="w-full bg-slate-900/90 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl border border-white/20 outline-none cursor-pointer"
                >
                  {allLabs.map(l => (
                    <option key={l.id} value={l.id} className="bg-slate-900 text-white">
                      Lab {l.room_number} ({l.department_name})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs sm:text-sm text-rose-700 font-semibold flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 font-bold">✕</button>
        </div>
      )}

      {success && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs sm:text-sm text-emerald-700 font-semibold flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="text-emerald-500 hover:text-emerald-700 font-bold">✕</button>
        </div>
      )}


      {loading && !data ? (
        <div className="flex justify-center items-center py-24">
          <Spinner />
        </div>
      ) : (
        <>
          {/* My Controlled Laboratories Quick-Switch Toolbar */}
          {myControlledLabs.length > 0 && (
            <div className="card p-4 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                  <DoorIcon className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span>My Controlled Laboratories</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold">{myControlledLabs.length} Labs</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Click any lab to switch its schedule and workstation occupancy</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {myControlledLabs.map(lab => {
                  const isActive = (selectedRoomId ? Number(selectedRoomId) === lab.id : assignedRoom?.id === lab.id)
                  return (
                    <button
                      key={lab.id}
                      type="button"
                      onClick={() => setSelectedRoomId(String(lab.id))}
                      className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 min-h-[42px] ${
                        isActive
                          ? 'bg-amber-600 text-white shadow-sm scale-105 ring-2 ring-amber-400 ring-offset-1'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <DoorIcon className="w-4 h-4" />
                      <span>Lab {lab.room_number}</span>
                      {isActive ? (
                        <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-md font-black">Active</span>
                      ) : (
                        <span className="text-[10px] text-slate-400">({lab.capacity} seats)</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Facility Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Assigned Lab Facility */}
            <div className="card p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Lab Facility</span>
                <span className="p-1.5 rounded-xl bg-amber-50 text-amber-600">
                  <DoorIcon className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-1">
                <h3 className="text-lg sm:text-xl font-black text-slate-900">
                  {assignedRoom ? `Room ${assignedRoom.room_number}` : 'Unassigned'}
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  Capacity: <strong className="text-slate-800">{assignedRoom?.capacity || 0} Workstations</strong>
                </p>
                <p className="text-[11px] text-slate-400 mt-1 font-medium truncate">
                  Dept: {assignedRoom?.department_name || 'General'}
                </p>
              </div>
            </div>

            {/* Card 2: Today's Schedule */}
            <div className="card p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Today's Schedule</span>
                <span className="p-1.5 rounded-xl bg-indigo-50 text-indigo-600">
                  <CalIcon className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-1">
                <h3 className="text-lg sm:text-xl font-black text-indigo-700">
                  {data?.today_day_order ? `Day Order ${data.today_day_order}` : 'Regular Day'}
                </h3>
                <p className="text-xs font-semibold text-slate-600 mt-0.5">
                  {todaySchedule.length} practical lab session{todaySchedule.length === 1 ? '' : 's'} today
                </p>
                <p className="text-[11px] text-slate-400 mt-1 font-medium capitalize">
                  Calendar Status: {data?.today_status?.replace('_', ' ') || 'Working'}
                </p>
              </div>
            </div>

            {/* Card 3: Shift & Leave Ledger Action */}
            <div className="card p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Shift & Duty</span>
                  <span className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600">
                    <ClockIcon className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-1">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 capitalize">
                    {profile?.shift_type || 'General'} Shift
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`w-2 h-2 rounded-full ${profile?.employment_status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span className="text-xs font-bold capitalize text-slate-600">
                      {profile?.employment_status?.replace('_', ' ') || 'Active'}
                    </span>
                  </div>
                </div>
              </div>
              <Link
                to="/staff/leaves"
                className="inline-flex items-center justify-center gap-1 text-[11px] font-extrabold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 py-1.5 px-3 rounded-lg transition-colors mt-2"
              >
                <span>Apply Leave / View Ledger</span>
                <span>&rarr;</span>
              </Link>
            </div>

            {/* Card 4: Reporting Manager */}
            <div className="card p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Reporting Manager</span>
                <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
                  <UsersIcon className="w-4 h-4" />
                </span>
              </div>
              <div className="text-lg sm:text-xl font-black text-slate-900 truncate">
                {profile?.created_by_manager_name || 'Operational Manager'}
              </div>
              <p className="text-xs text-slate-500 font-semibold">
                Facility Administration
              </p>
              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium truncate">
                Supervising Unit: <span className="font-semibold text-slate-700">{profile?.department_name}</span>
              </div>
            </div>
          </div>

          {/* Today's Lab Sessions */}
          <div className="card p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <CalIcon className="w-5 h-5 text-indigo-600" />
                  Today's Laboratory Schedule (Lab {assignedRoom?.room_number || 'Room'})
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Classes and batches conducting experiments in this facility today
                </p>
              </div>
              <span className="text-xs font-extrabold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-150">
                {data?.today_day_order ? `Day Order ${data.today_day_order}` : 'Day Schedule'}
              </span>
            </div>

            {todaySchedule.length === 0 ? (
              <div className="text-center py-8 text-slate-400 space-y-1">
                <DoorIcon className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-sm font-bold text-slate-700">No lab practicals scheduled for today in this room.</p>
                <p className="text-xs text-slate-400 font-medium">This facility is free for maintenance, setup, or open practice.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {todaySchedule.map(slot => (
                  <div key={slot.id} className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-black text-indigo-700 px-2.5 py-0.5 rounded-md bg-indigo-100">
                        Period {slot.period_number}
                      </span>
                      <span className="font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                        {slot.class_name || 'Assigned Class'}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">{slot.subject_name}</h4>
                      {slot.subject_code && (
                        <p className="text-xs font-mono font-bold text-slate-500">{slot.subject_code}</p>
                      )}
                    </div>
                    <div className="pt-2 border-t border-indigo-100/60 flex items-center justify-between text-xs text-slate-600">
                      <span>Faculty:</span>
                      <span className="font-bold text-slate-800">{slot.faculty_name}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Weekly Lab Matrix (Day 1 through Day 6) */}
          <div className="card p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <BookIcon className="w-5 h-5 text-amber-600" />
                  Weekly Laboratory Timetable Matrix
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Review timetable allocations across all 6 day orders for Lab {assignedRoom?.room_number || ''}
                </p>
              </div>

              {/* Day Order Selector Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {[1, 2, 3, 4, 5, 6].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDayOrder(d)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 ${
                      selectedDayOrder === d
                        ? 'bg-primary-600 text-white shadow-xs scale-105'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Day {d}
                  </button>
                ))}
              </div>
            </div>

            {daySchedule.length === 0 ? (
              <div className="text-center py-8 text-slate-400 space-y-1">
                <p className="text-sm font-bold text-slate-700">No lab sessions scheduled on Day Order {selectedDayOrder}.</p>
                <p className="text-xs text-slate-400 font-medium">Facility is available for scheduled maintenance.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {daySchedule.map(slot => (
                  <div key={slot.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-black text-slate-800 px-2 py-0.5 rounded bg-slate-200">
                        Period {slot.period_number}
                      </span>
                      <span className="font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                        {slot.class_name || 'Class Batch'}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{slot.subject_name}</h4>
                      {slot.subject_code && (
                        <p className="text-xs font-mono text-slate-500">{slot.subject_code}</p>
                      )}
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                      <span>Faculty:</span>
                      <span className="font-bold text-slate-800">{slot.faculty_name}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Department Colleagues */}
          {colleagues.length > 0 && (
            <div className="card p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-indigo-600" />
                Department Staff & Technicians
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {colleagues.map(col => (
                  <div key={col.id} className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1">
                    <div className="font-bold text-xs text-slate-900">{col.full_name}</div>
                    <div className="text-[11px] text-slate-500 font-medium">{col.designation}</div>
                    {col.assigned_room_number && (
                      <div className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        <DoorIcon className="w-3 h-3" /> Lab {col.assigned_room_number}
                      </div>
                    )}
                    {col.phone_number && (
                      <div className="text-[11px] text-slate-500 pt-1">📞 {col.phone_number}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Manager / Admin Credit Adjustment Modal */}
      {adjustModalOpen && profile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-base text-slate-900">Award / Adjust Leave Credits</h3>
              <button onClick={() => setAdjustModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <p><strong className="text-slate-700">Staff Member:</strong> {profile.full_name}</p>
              <p><strong className="text-slate-700">Employee Code:</strong> {profile.employee_code} &middot; {profile.designation}</p>
              <p><strong className="text-slate-700">Department:</strong> {profile.department_name}</p>
            </div>

            <form onSubmit={handleCreditAdjust} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Change (+/- Days) *</label>
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
                <label className="text-xs font-bold text-slate-700 block mb-1">Duty Description / Reason *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Compensatory credit for Sunday Lab Maintenance"
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
    </div>
  )
}

