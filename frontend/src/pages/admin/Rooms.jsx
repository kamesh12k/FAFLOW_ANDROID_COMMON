import { useEffect, useState, useCallback } from 'react'
import { roomsApi, departmentsApi, dayOrderApi } from '../../api/services'
import { Spinner, ErrorAlert, Modal, EmptyState } from '../../components/ui'

export default function AdminRooms() {
  const [activeTab, setActiveTab] = useState('occupancy') // 'occupancy' | 'directory'

  // Room Directory State
  const [rooms, setRooms] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)

  // Occupancy State
  const [occupancyData, setOccupancyData] = useState(null)
  const [occupancyLoading, setOccupancyLoading] = useState(false)
  const [selectedDayOrder, setSelectedDayOrder] = useState(1)
  const [selectedPeriod, setSelectedPeriod] = useState(1)
  const [filterDept, setFilterDept] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // 'all' | 'vacant' | 'occupied'
  const [searchQuery, setSearchQuery] = useState('')

  // Single Add Room State
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ room_number: '', room_type: 'classroom', capacity: 40, department_id: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Bulk Add Room (Range) State
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkForm, setBulkForm] = useState({
    prefix: 'Room ',
    start_num: 101,
    end_num: 110,
    pad_digits: 0,
    room_type: 'classroom',
    capacity: 60,
    department_id: '',
  })
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkSuccess, setBulkSuccess] = useState('')

  // Edit Room State
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [editForm, setEditForm] = useState({ room_number: '', room_type: 'classroom', capacity: 40, department_id: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Delete Confirm State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [roomToDelete, setRoomToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const loadDirectory = () => roomsApi.list().then(r => setRooms(r.data)).finally(() => setLoading(false))

  const loadOccupancy = useCallback(async (dayOrder, periodNum, deptId, rType) => {
    setOccupancyLoading(true)
    try {
      const res = await roomsApi.getOccupancy({
        day_order: dayOrder,
        period_number: periodNum,
        department_id: deptId || undefined,
        room_type: rType || undefined,
      })
      setOccupancyData(res.data)
      if (res.data?.day_order && !dayOrder) {
        setSelectedDayOrder(res.data.day_order)
      }
    } catch (err) {
      console.error('Failed to load room occupancy:', err)
    } finally {
      setOccupancyLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDirectory()
    departmentsApi.list(true).then(r => setDepartments(r.data))
    loadOccupancy(selectedDayOrder, selectedPeriod, filterDept, filterType)
  }, [loadOccupancy, selectedDayOrder, selectedPeriod, filterDept, filterType])

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await roomsApi.create({
        ...form,
        capacity: Number(form.capacity),
        department_id: form.department_id ? Number(form.department_id) : null,
      })
      setModalOpen(false)
      setForm({ room_number: '', room_type: 'classroom', capacity: 40, department_id: '' })
      loadDirectory()
      loadOccupancy(selectedDayOrder, selectedPeriod, filterDept, filterType)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create room.')
    } finally {
      setSaving(false)
    }
  }

  const handleBulkCreate = async (e) => {
    e.preventDefault()
    setBulkError('')
    setBulkSuccess('')
    setBulkSaving(true)
    try {
      const res = await roomsApi.bulkCreate({
        prefix: bulkForm.prefix,
        start_num: Number(bulkForm.start_num),
        end_num: Number(bulkForm.end_num),
        pad_digits: Number(bulkForm.pad_digits),
        room_type: bulkForm.room_type,
        capacity: Number(bulkForm.capacity),
        department_id: bulkForm.department_id ? Number(bulkForm.department_id) : null,
      })
      setBulkSuccess(res.data.message)
      setTimeout(() => {
        setBulkModalOpen(false)
        setBulkSuccess('')
      }, 1500)
      loadDirectory()
      loadOccupancy(selectedDayOrder, selectedPeriod, filterDept, filterType)
    } catch (err) {
      setBulkError(err.response?.data?.detail || 'Failed to bulk create rooms.')
    } finally {
      setBulkSaving(false)
    }
  }

  const getRangePreview = () => {
    const start = Number(bulkForm.start_num) || 0
    const end = Number(bulkForm.end_num) || 0
    const pad = Number(bulkForm.pad_digits) || 0
    const prefix = bulkForm.prefix || ''
    if (end < start) return 'Invalid range (End < Start)'
    const count = end - start + 1
    if (count > 200) return `Too large (${count} rooms, max is 200)`
    const fmt = n => (pad > 0 ? `${prefix}${String(n).padStart(pad, '0')}` : `${prefix}${n}`)
    if (count <= 3) {
      return Array.from({ length: count }, (_, i) => fmt(start + i)).join(', ')
    }
    return `${fmt(start)}, ${fmt(start + 1)}, ..., ${fmt(end)} (${count} rooms)`
  }

  const handleOpenEditModal = (room) => {
    setSelectedRoom(room)
    editForm.room_number = room.room_number
    setEditForm({
      room_number: room.room_number,
      room_type: room.room_type,
      capacity: room.capacity,
      department_id: room.department_id || '',
    })
    setEditError('')
    setEditModalOpen(true)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    setEditError('')
    setEditSaving(true)
    try {
      await roomsApi.update(selectedRoom.id, {
        room_number: editForm.room_number,
        room_type: editForm.room_type,
        capacity: Number(editForm.capacity),
        department_id: editForm.department_id ? Number(editForm.department_id) : null,
      })
      setEditModalOpen(false)
      loadDirectory()
      loadOccupancy(selectedDayOrder, selectedPeriod, filterDept, filterType)
    } catch (err) {
      setEditError(err.response?.data?.detail || 'Failed to update room.')
    } finally {
      setEditSaving(false)
    }
  }

  const handleOpenDelete = (room) => {
    setRoomToDelete(room)
    setDeleteError('')
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = async () => {
    setDeleteError('')
    setDeleting(true)
    try {
      await roomsApi.remove(roomToDelete.id)
      setDeleteConfirmOpen(false)
      loadDirectory()
      loadOccupancy(selectedDayOrder, selectedPeriod, filterDept, filterType)
    } catch (err) {
      setDeleteError(err.response?.data?.detail || 'Failed to delete room.')
    } finally {
      setDeleting(false)
    }
  }

  const deptName = (id) => departments.find(d => d.id === id)?.name || '—'

  // Filtered rooms for occupancy view
  const filteredOccupancyRooms = (occupancyData?.rooms || []).filter(r => {
    if (filterStatus === 'vacant' && r.is_occupied) return false
    if (filterStatus === 'occupied' && !r.is_occupied) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchRoom = r.room_number.toLowerCase().includes(q)
      const matchDept = (r.department_name || '').toLowerCase().includes(q)
      const matchClass = (r.current_slot?.class_name || '').toLowerCase().includes(q)
      const matchSubject = (r.current_slot?.subject_name || '').toLowerCase().includes(q)
      const matchTeacher = (r.current_slot?.teacher_name || '').toLowerCase().includes(q)
      return matchRoom || matchDept || matchClass || matchSubject || matchTeacher
    }
    return true
  })

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Classrooms & Labs</h1>
          <p className="text-xs text-gray-500 mt-0.5">Real-time room occupancy status and venue management</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button onClick={() => setBulkModalOpen(true)} className="btn-secondary text-xs sm:text-sm flex items-center gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
            <span>⚡</span> Bulk Add (Range)
          </button>
          <button onClick={() => setModalOpen(true)} className="btn-primary text-xs sm:text-sm">+ Add Room</button>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('occupancy')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition ${
            activeTab === 'occupancy'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          📍 Classroom Occupancy Matrix
        </button>
        <button
          onClick={() => setActiveTab('directory')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition ${
            activeTab === 'directory'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          📋 Room Directory ({rooms.length})
        </button>
      </div>

      {/* ── TAB 1: CLASSROOM OCCUPANCY MATRIX ── */}
      {activeTab === 'occupancy' && (
        <div className="space-y-5">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card p-4 bg-white border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Total Rooms</p>
              <p className="text-2xl font-black text-gray-900 mt-1">{occupancyData?.summary?.total_rooms ?? '–'}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Configured Venues</p>
            </div>
            <div className="card p-4 bg-red-50/70 border border-red-100">
              <p className="text-xs font-bold text-red-600 uppercase tracking-wide">Occupied Now</p>
              <p className="text-2xl font-black text-red-700 mt-1">{occupancyData?.summary?.occupied_count ?? '–'}</p>
              <p className="text-[11px] text-red-600/80 mt-0.5">Period {selectedPeriod} (DO {selectedDayOrder})</p>
            </div>
            <div className="card p-4 bg-emerald-50/70 border border-emerald-100">
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Vacant / Free</p>
              <p className="text-2xl font-black text-emerald-700 mt-1">{occupancyData?.summary?.vacant_count ?? '–'}</p>
              <p className="text-[11px] text-emerald-600/80 mt-0.5">Available for use</p>
            </div>
            <div className="card p-4 bg-indigo-50/70 border border-indigo-100">
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide">Occupancy Rate</p>
              <p className="text-2xl font-black text-indigo-700 mt-1">{occupancyData?.summary?.occupancy_rate_percent ?? 0}%</p>
              <p className="text-[11px] text-indigo-600/80 mt-0.5">Campus Utilization</p>
            </div>
          </div>

          {/* Controls: Day Order, Period, Dept, Type, Status */}
          <div className="card p-4 space-y-3 bg-gray-50/60 border border-gray-200">
            {/* Row 1: Day Order & Period Selectors */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              {/* Day Order Selector */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-gray-500 uppercase mr-1">Day Order:</span>
                {[1, 2, 3, 4, 5, 6].map(d => (
                  <button
                    key={d}
                    onClick={() => setSelectedDayOrder(d)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                      selectedDayOrder === d
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    DO {d}
                  </button>
                ))}
              </div>

              {/* Period Selector */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-gray-500 uppercase mr-1">Period:</span>
                {[1, 2, 3, 4, 5].map(p => (
                  <button
                    key={p}
                    onClick={() => setSelectedPeriod(p)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                      selectedPeriod === p
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    Period {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 2: Search and Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search room, class, faculty..."
                className="input text-xs"
              />
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="input text-xs"
              >
                <option value="all">All Rooms (Vacant + Occupied)</option>
                <option value="vacant">🟢 Vacant / Available Only</option>
                <option value="occupied">🔴 Occupied Only</option>
              </select>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="input text-xs"
              >
                <option value="">All Types (Classroom & Lab)</option>
                <option value="classroom">Classrooms Only</option>
                <option value="lab">Labs Only</option>
              </select>
              <select
                value={filterDept}
                onChange={e => setFilterDept(e.target.value)}
                className="input text-xs"
              >
                <option value="">All Departments</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          {/* Room Occupancy Cards Grid */}
          {occupancyLoading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : filteredOccupancyRooms.length === 0 ? (
            <EmptyState message="No rooms match the selected criteria." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredOccupancyRooms.map(r => (
                <div
                  key={r.id}
                  className={`card p-4 rounded-2xl border transition hover:shadow-md ${
                    r.is_occupied
                      ? 'border-red-200 bg-white'
                      : 'border-emerald-200 bg-emerald-50/20'
                  }`}
                >
                  {/* Card Header: Room Number, Type, Status */}
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-gray-900 text-base">{r.room_number}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                          r.room_type === 'lab' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {r.room_type}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">{r.department_name} · {r.capacity} seats</p>
                    </div>

                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${
                      r.is_occupied
                        ? 'bg-red-100 text-red-700 border border-red-200'
                        : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${r.is_occupied ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                      {r.is_occupied ? 'Occupied' : 'Vacant'}
                    </span>
                  </div>

                  {/* Active Slot Details if Occupied */}
                  {r.is_occupied ? (
                    <div className="bg-red-50/50 border border-red-100 rounded-xl p-3 mb-3 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-red-900">{r.current_slot?.class_name}</span>
                        <span className="text-[10px] font-semibold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">{r.current_slot?.subject_code || 'Subject'}</span>
                      </div>
                      <p className="text-gray-600 text-[11px] truncate">{r.current_slot?.subject_name}</p>
                      <div className="pt-1 flex items-center justify-between text-[11px]">
                        <span className="text-gray-500">Faculty:</span>
                        <span className="font-bold text-gray-800">
                          {r.current_slot?.teacher_name || '—'}
                          {r.current_slot?.is_combined ? (
                            <span className="ml-1.5 text-[9px] font-black uppercase text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">👥 Combined</span>
                          ) : r.current_slot?.is_substituted ? (
                            <span className="ml-1 text-[9px] text-indigo-600 bg-indigo-50 px-1 rounded font-normal">(Cover)</span>
                          ) : null}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 mb-3 text-xs flex items-center justify-between text-emerald-800">
                      <span>Free during Period {selectedPeriod}</span>
                      <span className="font-bold">Available</span>
                    </div>
                  )}

                  {/* 5-Period Day Mini-Timeline */}
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Full Day Schedule (DO {selectedDayOrder})</p>
                    <div className="grid grid-cols-5 gap-1">
                      {[1, 2, 3, 4, 5].map(p => {
                        const slot = r.period_schedule?.[p]
                        const isPActive = selectedPeriod === p
                        return (
                          <div
                            key={p}
                            className={`p-1 text-center rounded-lg border text-[10px] transition ${
                              isPActive ? 'ring-2 ring-indigo-500' : ''
                            } ${
                              slot?.is_occupied
                                ? 'bg-red-50 border-red-200 text-red-700 font-bold'
                                : 'bg-gray-50 border-gray-200 text-gray-400 font-medium'
                            }`}
                            title={`Period ${p}: ${slot?.is_occupied ? `${slot.class_name || 'Class'} (${slot.subject_code || ''})` : 'Free'}`}
                          >
                            P{p}
                            <span className="block text-[8px] truncate mt-0.5">
                              {slot?.is_occupied ? (slot.class_name || 'Occ') : 'Free'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: ROOM DIRECTORY & MANAGEMENT ── */}
      {activeTab === 'directory' && (
        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : rooms.length === 0 ? <EmptyState message="No rooms yet." /> : (
            <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-sm" style={{ minWidth: '480px' }}>
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Room', 'Type', 'Capacity', 'Department', ''].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rooms.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-medium text-gray-800">{r.room_number}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${r.room_type === 'lab' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                          {r.room_type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500">{r.capacity} seats</td>
                      <td className="px-5 py-3 text-gray-500">{deptName(r.department_id)}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-3">
                          <button onClick={() => handleOpenEditModal(r)} className="text-xs text-primary-600 hover:text-primary-800 font-semibold hover:underline">Edit</button>
                          <button onClick={() => handleOpenDelete(r)} className="text-xs text-red-500 hover:text-red-700 font-semibold hover:underline">Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Single Room Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Single Room">
        <form onSubmit={handleCreate} className="space-y-4">
          <ErrorAlert message={error} />
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Room number</label>
            <input type="text" required className="input" placeholder="CS-101" value={form.room_number} onChange={e => setForm({ ...form, room_number: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
            <select className="input" value={form.room_type} onChange={e => setForm({ ...form, room_type: e.target.value })}>
              <option value="classroom">Classroom</option>
              <option value="lab">Lab</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Capacity</label>
            <input type="number" required min={1} className="input" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Department (optional)</label>
            <select className="input" value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}>
              <option value="">None (Global / Campus Venue)</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      {/* Bulk Add Rooms Modal (by Range) */}
      <Modal open={bulkModalOpen} onClose={() => setBulkModalOpen(false)} title="Bulk Add Rooms (by Range)">
        <form onSubmit={handleBulkCreate} className="space-y-4">
          <ErrorAlert message={bulkError} />
          {bulkSuccess && (
            <div className="p-3 text-xs bg-green-50 text-green-700 rounded-md font-medium border border-green-200">
              {bulkSuccess}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Prefix / Name</label>
              <input type="text" className="input" placeholder="Room " value={bulkForm.prefix} onChange={e => setBulkForm({ ...bulkForm, prefix: e.target.value })} />
              <span className="text-[10px] text-gray-400">e.g. "Room ", "Lab ", "LH-"</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Zero Padding (Digits)</label>
              <select className="input" value={bulkForm.pad_digits} onChange={e => setBulkForm({ ...bulkForm, pad_digits: e.target.value })}>
                <option value="0">None (101, 102...)</option>
                <option value="2">2 digits (01, 02...)</option>
                <option value="3">3 digits (001, 002...)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Start Number</label>
              <input type="number" required min={1} className="input" value={bulkForm.start_num} onChange={e => setBulkForm({ ...bulkForm, start_num: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">End Number</label>
              <input type="number" required min={1} className="input" value={bulkForm.end_num} onChange={e => setBulkForm({ ...bulkForm, end_num: e.target.value })} />
            </div>
          </div>

          <div className="p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-lg">
            <span className="text-[11px] font-semibold text-indigo-900 block mb-0.5">Range Live Preview:</span>
            <span className="text-xs font-mono text-indigo-700">{getRangePreview()}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Room Type</label>
              <select className="input" value={bulkForm.room_type} onChange={e => setBulkForm({ ...bulkForm, room_type: e.target.value })}>
                <option value="classroom">Classroom</option>
                <option value="lab">Lab</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Capacity (each)</label>
              <input type="number" required min={1} className="input" value={bulkForm.capacity} onChange={e => setBulkForm({ ...bulkForm, capacity: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Department (optional)</label>
            <select className="input" value={bulkForm.department_id} onChange={e => setBulkForm({ ...bulkForm, department_id: e.target.value })}>
              <option value="">None (Global Room)</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setBulkModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={bulkSaving} className="btn-primary flex-1">
              {bulkSaving ? 'Generating…' : '⚡ Generate & Create Rooms'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Room Modal */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Room">
        <form onSubmit={handleUpdate} className="space-y-4">
          <ErrorAlert message={editError} />
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Room number</label>
            <input type="text" required className="input" value={editForm.room_number} onChange={e => setEditForm({ ...editForm, room_number: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
            <select className="input" value={editForm.room_type} onChange={e => setEditForm({ ...editForm, room_type: e.target.value })}>
              <option value="classroom">Classroom</option>
              <option value="lab">Lab</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Capacity</label>
            <input type="number" required min={1} className="input" value={editForm.capacity} onChange={e => setEditForm({ ...editForm, capacity: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Department (optional)</label>
            <select className="input" value={editForm.department_id} onChange={e => setEditForm({ ...editForm, department_id: e.target.value })}>
              <option value="">None</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setEditModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={editSaving} className="btn-primary flex-1">{editSaving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Delete Room">
        <div className="space-y-4">
          <ErrorAlert message={deleteError} />
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <span className="font-semibold text-gray-800">Room {roomToDelete?.room_number}</span>?
          </p>
          <p className="text-xs text-red-500 font-medium">This room cannot be deleted if it is referenced in scheduled timetable slots.</p>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setDeleteConfirmOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="button" onClick={handleDeleteConfirm} disabled={deleting} className="btn-danger flex-1">
              {deleting ? 'Deleting…' : 'Delete Room'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
