import { useState, useEffect } from 'react'
import { operationalStaffApi, departmentsApi } from '../../api/services'
import { Spinner, Modal, EmptyState } from '../../components/ui'
import { PlusIcon, SearchIcon, DoorIcon, CheckCircleIcon, XCircleIcon } from '../../components/icons'

export default function LabStaff() {
  const [staff, setStaff] = useState([])
  const [labs, setLabs] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [roomFilter, setRoomFilter] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)

  // Form
  const [formData, setFormData] = useState({
    employee_code: '',
    full_name: '',
    designation: '',
    department_id: '',
    assigned_room_id: '',
    phone_number: '',
    email: '',
    shift_type: 'general',
    joining_date: '',
    employment_status: 'active',
    notes: '',
  })

  const loadData = async () => {
    try {
      setLoading(true)
      const [staffRes, labsRes, deptRes] = await Promise.all([
        operationalStaffApi.list({ category: 'laboratory' }),
        operationalStaffApi.getLabs(),
        departmentsApi.list(true),
      ])
      setStaff(staffRes.data)
      setLabs(labsRes.data)
      setDepartments(deptRes.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load laboratory staff')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const roomIds = (formData.assigned_room_ids || []).map(Number)
      await operationalStaffApi.create({
        ...formData,
        category: 'laboratory',
        department_id: formData.department_id ? Number(formData.department_id) : null,
        assigned_room_id: roomIds.length > 0 ? roomIds[0] : (formData.assigned_room_id ? Number(formData.assigned_room_id) : null),
        assigned_room_ids: roomIds,
        joining_date: formData.joining_date || null,
      })
      setSuccess(`Laboratory staff '${formData.full_name}' added successfully!`)
      setCreateModalOpen(false)
      setFormData({
        employee_code: '', full_name: '', designation: '', department_id: '',
        assigned_room_id: '', assigned_room_ids: [], phone_number: '', email: '', shift_type: 'general',
        joining_date: '', employment_status: 'active', notes: '', username: '', password: '',
      })
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add laboratory staff')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    if (!editTarget) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const roomIds = (formData.assigned_room_ids || []).map(Number)
      await operationalStaffApi.update(editTarget.id, {
        ...formData,
        category: 'laboratory',
        department_id: formData.department_id ? Number(formData.department_id) : null,
        assigned_room_id: roomIds.length > 0 ? roomIds[0] : (formData.assigned_room_id ? Number(formData.assigned_room_id) : 0),
        assigned_room_ids: roomIds,
        joining_date: formData.joining_date || null,
        username: formData.username || undefined,
        password: formData.password || undefined,
      })
      setSuccess(`Staff record updated successfully!`)
      setEditTarget(null)
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update staff')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      await operationalStaffApi.delete(deleteTarget.id)
      setSuccess(`Staff member removed.`)
      setDeleteTarget(null)
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete staff')
    } finally {
      setSaving(false)
    }
  }

  const openEditModal = (st) => {
    setEditTarget(st)
    const roomIds = st.assigned_room_ids || (st.assigned_room_id ? [st.assigned_room_id] : [])
    setFormData({
      employee_code: st.employee_code,
      full_name: st.full_name,
      designation: st.designation,
      department_id: st.department_id ? String(st.department_id) : '',
      assigned_room_id: st.assigned_room_id ? String(st.assigned_room_id) : '',
      assigned_room_ids: roomIds,
      phone_number: st.phone_number || '',
      email: st.email || '',
      shift_type: st.shift_type || 'general',
      joining_date: st.joining_date || '',
      employment_status: st.employment_status || 'active',
      notes: st.notes || '',
      username: st.username || '',
      password: '',
    })
  }



  const filteredStaff = staff.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = s.full_name.toLowerCase().includes(q) || s.employee_code.toLowerCase().includes(q) || s.designation.toLowerCase().includes(q)
    const matchStatus = !statusFilter || s.employment_status === statusFilter
    const matchRoom = !roomFilter || String(s.assigned_room_id) === roomFilter
    return matchSearch && matchStatus && matchRoom
  })

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Laboratory Staff</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Manage lab technicians, equipment supervisors, room bindings, and shifts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormData({
              employee_code: '', full_name: '', designation: '', department_id: '',
              assigned_room_id: '', phone_number: '', email: '', shift_type: 'general',
              joining_date: '', employment_status: 'active', notes: '',
            })
            setCreateModalOpen(true)
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm shadow-primary-500/20 shrink-0 min-h-[44px]"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Add Lab Staff</span>
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs sm:text-sm text-rose-700 font-semibold flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 text-xs font-bold ml-2">✕</button>
        </div>
      )}

      {success && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs sm:text-sm text-emerald-700 font-semibold flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="text-emerald-500 hover:text-emerald-700 text-xs font-bold ml-2">✕</button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        <div className="relative col-span-1 sm:col-span-1">
          <SearchIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search name, code, designation…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-primary-500 min-h-[44px]"
          />
        </div>

        <div>
          <select
            value={roomFilter}
            onChange={e => setRoomFilter(e.target.value)}
            className="input text-xs sm:text-sm font-semibold w-full min-h-[44px]"
          >
            <option value="">All Laboratories</option>
            {labs.map(l => (
              <option key={l.id} value={l.id}>Lab Room: {l.room_number}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="input text-xs sm:text-sm font-semibold w-full min-h-[44px]"
          >
            <option value="">All Statuses</option>
            <option value="active">Active On-Duty</option>
            <option value="on_leave">On Leave</option>
            <option value="transferred">Transferred</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Desktop Table View (>= lg) */}
      <div className="hidden lg:block card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filteredStaff.length === 0 ? (
          <EmptyState message="No laboratory staff records found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  {['Staff Member', 'Designation', 'Assigned Laboratory', 'Department', 'Shift', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStaff.map(st => (
                  <tr key={st.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-extrabold text-slate-900">{st.full_name}</div>
                      <div className="text-xs text-slate-400 font-mono">{st.employee_code}</div>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-700">
                      {st.designation}
                    </td>
                    <td className="px-5 py-3.5">
                      {st.assigned_rooms && st.assigned_rooms.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {st.assigned_rooms.map(r => (
                            <span key={r.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <DoorIcon className="w-3 h-3 text-amber-600" />
                              {r.room_number}
                            </span>
                          ))}
                        </div>
                      ) : (
                        st.assigned_room_number ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <DoorIcon className="w-3.5 h-3.5 text-amber-600" />
                            {st.assigned_room_number}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Unassigned</span>
                        )
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 font-semibold">
                      {st.department_name}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-bold capitalize text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        {st.shift_type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                        st.employment_status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : (st.employment_status === 'on_leave'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200')
                      }`}>
                        {st.employment_status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(st)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(st)}
                          className="px-3 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-xs font-bold text-rose-600 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile Card List (< lg) */}
      <div className="block lg:hidden space-y-3">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filteredStaff.length === 0 ? (
          <div className="card p-6 text-center">
            <DoorIcon className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700">No laboratory staff records found.</p>
          </div>
        ) : (
          filteredStaff.map(st => (
            <div key={st.id} className="card p-4 border border-slate-200 bg-white rounded-2xl shadow-xs space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">{st.full_name}</h3>
                  <p className="text-xs text-slate-500 font-semibold">{st.designation} &middot; <span className="font-mono text-slate-400">{st.employee_code}</span></p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                  st.employment_status === 'active'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  {st.employment_status.replace('_', ' ')}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {st.assigned_rooms && st.assigned_rooms.length > 0 ? (
                  st.assigned_rooms.map(r => (
                    <span key={r.id} className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded-md border border-amber-150 text-[11px]">
                      <DoorIcon className="w-3 h-3" /> {r.room_number}
                    </span>
                  ))
                ) : (
                  st.assigned_room_number && (
                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded-md border border-amber-150 text-[11px]">
                      <DoorIcon className="w-3 h-3" /> {st.assigned_room_number}
                    </span>
                  )
                )}
                <span className="bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-md text-[11px]">
                  Shift: {st.shift_type}
                </span>
                <span className="bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-md text-[11px]">
                  {st.department_name}
                </span>
              </div>



              {st.phone_number && (
                <p className="text-xs text-slate-500">📞 {st.phone_number}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => openEditModal(st)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 min-h-[40px]"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(st)}
                  className="px-3.5 py-2 rounded-xl border border-rose-200 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 min-h-[40px]"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={createModalOpen || !!editTarget}
        onClose={() => { setCreateModalOpen(false); setEditTarget(null) }}
        title={editTarget ? 'Edit Laboratory Staff' : 'Add Laboratory Staff'}
      >
        <form onSubmit={editTarget ? handleUpdate : handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Employee Code *</label>
              <input
                type="text"
                required
                placeholder="e.g. LAB-104"
                value={formData.employee_code}
                onChange={e => setFormData({ ...formData, employee_code: e.target.value })}
                className="input text-xs w-full min-h-[44px]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Suresh V"
                value={formData.full_name}
                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                className="input text-xs w-full min-h-[44px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Designation *</label>
              <input
                type="text"
                required
                placeholder="e.g. Senior Lab Technician"
                value={formData.designation}
                onChange={e => setFormData({ ...formData, designation: e.target.value })}
                className="input text-xs w-full min-h-[44px]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Controlled Laboratories (Select 1 or Multiple Labs)
              </label>
              <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl min-h-[44px] max-h-36 overflow-y-auto">
                {labs.length === 0 ? (
                  <span className="text-xs text-slate-400">No laboratory rooms found.</span>
                ) : (
                  labs.map(l => {
                    const isSelected = (formData.assigned_room_ids || []).includes(l.id) || formData.assigned_room_id == l.id
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => {
                          const current = [...(formData.assigned_room_ids || [])]
                          const next = isSelected ? current.filter(id => id !== l.id) : [...current, l.id]
                          setFormData({
                            ...formData,
                            assigned_room_ids: next,
                            assigned_room_id: next.length > 0 ? String(next[0]) : '',
                          })
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <DoorIcon className="w-3 h-3" />
                        <span>Lab {l.room_number}</span>
                        {isSelected && <span className="text-[10px]">✓</span>}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>


          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Department</label>
              <select
                value={formData.department_id}
                onChange={e => setFormData({ ...formData, department_id: e.target.value })}
                className="input text-xs w-full min-h-[44px]"
              >
                <option value="">Central / College-wide</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>Department of {d.name} ({d.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Shift Type</label>
              <select
                value={formData.shift_type}
                onChange={e => setFormData({ ...formData, shift_type: e.target.value })}
                className="input text-xs w-full min-h-[44px]"
              >
                <option value="general">General Shift</option>
                <option value="morning">Morning Shift</option>
                <option value="evening">Evening Shift</option>
                <option value="night">Night Shift</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Phone Number</label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={formData.phone_number}
                onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                className="input text-xs w-full min-h-[44px]"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Email</label>
              <input
                type="email"
                placeholder="staff@college.edu"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="input text-xs w-full min-h-[44px]"
              />
            </div>
          </div>

          {editTarget && (
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Employment Status</label>
              <select
                value={formData.employment_status}
                onChange={e => setFormData({ ...formData, employment_status: e.target.value })}
                className="input text-xs w-full min-h-[44px]"
              >
                <option value="active">Active</option>
                <option value="on_leave">On Leave</option>
                <option value="transferred">Transferred</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          )}

          {/* Portal Login Credentials Section */}
          <div className="p-3.5 bg-indigo-50/60 border border-indigo-150 rounded-xl space-y-2.5">
            <div>
              <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <span>🔐</span> Staff Portal Login Account
              </h4>
              <p className="text-[11px] text-slate-500 font-medium">
                Enables this staff member to log in to FAFLOW to view their assigned facility and roster.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Username (Login ID)</label>
                <input
                  type="text"
                  placeholder="Defaults to employee code"
                  value={formData.username || ''}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  className="input text-xs w-full min-h-[44px] bg-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {editTarget ? 'Reset Password (Optional)' : 'Portal Password *'}
                </label>
                <input
                  type="password"
                  required={!editTarget}
                  placeholder={editTarget ? 'Leave blank to keep unchanged' : 'Min. 8 characters'}
                  value={formData.password || ''}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className="input text-xs w-full min-h-[44px] bg-white"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Notes</label>
            <textarea
              rows={2}
              placeholder="Key skills, equipment expertise, etc."
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="input text-xs w-full"
            />
          </div>


          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => { setCreateModalOpen(false); setEditTarget(null) }}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold min-h-[44px] disabled:opacity-50"
            >
              {saving ? 'Saving…' : (editTarget ? 'Save Changes' : 'Add Staff')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Staff Record">
        {deleteTarget && (
          <div className="space-y-4">
            <div className="p-3.5 bg-rose-50 border border-rose-150 rounded-xl text-xs text-rose-900">
              <p className="font-extrabold text-sm">Are you sure you want to remove {deleteTarget.full_name} ({deleteTarget.employee_code})?</p>
              <p className="mt-1">This record will be permanently deleted from the laboratory staff directory.</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleDelete}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold min-h-[44px] disabled:opacity-50"
              >
                {saving ? 'Deleting…' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
