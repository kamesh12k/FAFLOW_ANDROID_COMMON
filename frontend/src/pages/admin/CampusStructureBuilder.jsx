import { useState, useEffect, useCallback, useRef } from 'react'
import { campusStructureApi, departmentsApi } from '../../api/services'
import { Spinner, ErrorAlert, Modal, Badge } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const ROOM_TYPE_COLORS = {
  classroom:    { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  laboratory:   { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  lecture_hall: { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  seminar_room: { bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200' },
  staff_room:   { bg: 'bg-slate-50',  text: 'text-slate-600',  border: 'border-slate-200' },
  office:       { bg: 'bg-emerald-50',text: 'text-emerald-700',border: 'border-emerald-200' },
  auditorium:   { bg: 'bg-rose-50',   text: 'text-rose-700',   border: 'border-rose-200' },
  other:        { bg: 'bg-gray-50',   text: 'text-gray-600',   border: 'border-gray-200' },
}

function formatError(e, fallback = 'Operation failed') {
  if (!e) return ''
  const detail = e?.response?.data?.detail ?? e?.message ?? e
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map(d => {
      if (typeof d === 'string') return d
      if (d && typeof d === 'object') {
        const field = Array.isArray(d.loc) ? d.loc.slice(-1)[0] : (d.loc || '')
        return field ? `${field}: ${d.msg || JSON.stringify(d)}` : (d.msg || JSON.stringify(d))
      }
      return String(d)
    }).join('; ')
  }
  if (typeof detail === 'object' && detail !== null) {
    return detail.msg || detail.message || JSON.stringify(detail)
  }
  return String(detail) || fallback
}

function RoomTypeBadge({ type }) {
  const c = ROOM_TYPE_COLORS[type] || ROOM_TYPE_COLORS.other
  const label = (type || 'other').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${c.bg} ${c.text} ${c.border}`}>
      {label}
    </span>
  )
}

function MetricCard({ label, value, icon, color = 'primary' }) {
  const colors = {
    primary: 'from-primary-500 to-primary-600',
    emerald: 'from-emerald-500 to-emerald-600',
    amber:   'from-amber-500 to-amber-600',
    rose:    'from-rose-500 to-rose-600',
  }
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white text-lg shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-black text-slate-800">{value ?? '—'}</p>
        <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">{label}</p>
      </div>
    </div>
  )
}

// Inline section label
function SectionLabel({ children }) {
  return <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 px-1 mb-2">{children}</p>
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Department Assignment Modal (Floor / Block)
// ─────────────────────────────────────────────────────────────────────────────
function BulkAssignDeptModal({ target, type, onClose, onSuccess }) {
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [overwrite, setOverwrite] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    departmentsApi.list(true)
      .then(r => setDepartments(r.data || []))
      .catch(() => setDepartments([]))
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = {
        department_id: selectedDeptId === '' ? null : Number(selectedDeptId),
        overwrite_existing: overwrite,
      }
      if (type === 'floor') {
        await campusStructureApi.bulkAssignFloorDepartment(target.id, payload)
      } else {
        await campusStructureApi.bulkAssignBlockDepartment(target.id, payload)
      }
      onSuccess()
      onClose()
    } catch (e) {
      setError(formatError(e, 'Failed to assign department to rooms'))
    } finally {
      setSaving(false)
    }
  }

  const titleName = type === 'floor' ? target?.floor_name : target?.name

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">{error}</div>}
      {loading ? <div className="flex justify-center py-6"><Spinner /></div> : (
        <>
          <p className="text-sm text-slate-600">
            Bulk assign a department to all rooms on <strong>{titleName}</strong> without setting them room-by-room.
          </p>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Select Department</label>
            <select
              value={selectedDeptId}
              onChange={e => setSelectedDeptId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
            >
              <option value="">-- Clear / Unassign Department (None) --</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name} {d.code ? `(${d.code})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="overwrite_dept"
              checked={overwrite}
              onChange={e => setOverwrite(e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded"
            />
            <label htmlFor="overwrite_dept" className="text-xs text-slate-600">
              Overwrite rooms that already have a department assigned
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-[2] py-2.5 rounded-xl bg-primary-600 text-white font-bold text-sm disabled:opacity-50 hover:bg-primary-700 transition-all flex items-center justify-center gap-2"
            >
              {saving ? <><Spinner size="sm" /> Applying...</> : `🏢 Apply to ${type === 'floor' ? 'Floor' : 'Block'}`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tree Node components
// ─────────────────────────────────────────────────────────────────────────────
function RoomRow({ room }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all flex-wrap sm:flex-nowrap">
      <span className="text-slate-300 text-xs">🚪</span>
      <span className="font-semibold text-slate-700 text-sm font-mono">{room.room_number}</span>
      {room.name && <span className="text-slate-400 text-xs truncate max-w-[100px]">{room.name}</span>}
      <RoomTypeBadge type={room.room_type} />
      {room.department_name && (
        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium truncate max-w-[120px]" title={room.department_name}>
          🏢 {room.department_name}
        </span>
      )}
      {room.primary_class_name && (
        <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-medium">
          🎓 {room.primary_class_name}
        </span>
      )}
      {room.is_exam_eligible && (
        <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded font-semibold" title={`Exam Hall (${room.exam_capacity || room.capacity || 0} seats)`}>
          📝 Exam Hall
        </span>
      )}
      {room.capacity && <span className="text-[10px] text-slate-400 font-semibold shrink-0 ml-auto">{room.capacity} seats</span>}
    </div>
  )
}

function FloorNode({ floor, onBulkAssignDept, readOnly }) {
  const [open, setOpen] = useState(true)
  const rooms = floor.rooms || []
  return (
    <div className="ml-4 border-l-2 border-slate-100 pl-3">
      <div className="flex items-center gap-2 py-1.5 text-sm font-bold text-slate-600 group w-full">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 flex-1 text-left hover:text-slate-800"
        >
          <span className={`text-slate-300 transition-transform text-xs ${open ? 'rotate-90' : ''}`}>▶</span>
          <span className="w-5 h-5 text-center">🏢</span>
          <span>{floor.floor_name}</span>
          <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-100">
            🏢 Wing Duty
          </span>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 ml-2">
            {rooms.length} room{rooms.length !== 1 ? 's' : ''}
          </span>
        </button>
        {!readOnly && (
          <button
            onClick={() => onBulkAssignDept(floor)}
            title="Bulk assign department to all rooms on this floor"
            className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition-all"
          >
            + Dept
          </button>
        )}
      </div>
      {open && rooms.length > 0 && (
        <div className="space-y-1 pb-2">
          {rooms.map(r => <RoomRow key={r.id} room={r} />)}
        </div>
      )}
      {open && rooms.length === 0 && (
        <p className="text-xs text-slate-400 pl-6 py-1 italic">No rooms yet</p>
      )}
    </div>
  )
}

function BlockNode({ block, onEdit, onDelete, onDuplicate, onAddFloor, onGenerateRooms, onBulkAssignDept, readOnly }) {
  const [open, setOpen] = useState(true)
  const floors = block.floors || []
  const roomCount = floors.reduce((acc, f) => acc + (f.rooms?.length || 0), 0)

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden mb-3 shadow-sm hover:shadow-md transition-shadow">
      {/* Block header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-slate-800 to-slate-700">
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 flex-1 text-left min-w-0">
          <span className={`text-slate-400 transition-transform text-xs ${open ? 'rotate-90' : ''}`}>▶</span>
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0 shadow-md"
            style={{ background: block.color_hex || '#4F46E5' }}
          >
            {(block.prefix || block.name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-white font-bold text-sm truncate">{block.name}</p>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                🛡️ Discipline Zone
              </span>
            </div>
            <p className="text-slate-400 text-[10px]">
              Prefix: {block.prefix || '—'} · {floors.length} floor{floors.length !== 1 ? 's' : ''} · {roomCount} rooms
            </p>
          </div>
        </button>
        {!readOnly && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onBulkAssignDept(block)} title="Bulk assign department to all rooms in this block"
              className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-all">
              + Dept
            </button>
            <button onClick={() => onGenerateRooms(block)} title="Bulk generate rooms"
              className="px-2 py-1 rounded-lg text-[11px] font-bold bg-primary-600/90 text-white hover:bg-primary-500 transition-all">
              + Rooms
            </button>
            <button onClick={() => onAddFloor(block)} title="Add floor"
              className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-600/80 text-slate-200 hover:bg-slate-600 transition-all">
              + Floor
            </button>
            <button onClick={() => onEdit(block)} title="Edit block"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-600 transition-all">
              ✏️
            </button>
            <button onClick={() => onDuplicate(block)} title="Duplicate block"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-600 transition-all">
              📋
            </button>
            <button onClick={() => onDelete(block)} title="Delete block"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all">
              🗑️
            </button>
          </div>
        )}
      </div>
      {/* Floors */}
      {open && (
        <div className="px-4 py-3 bg-white">
          {floors.length > 0
            ? floors.map(f => <FloorNode key={f.id} floor={f} onBulkAssignDept={onBulkAssignDept} readOnly={readOnly} />)
            : <p className="text-xs text-slate-400 italic py-1">No floors added yet.</p>
          }
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Smart Auto-Fill Wizard
// ─────────────────────────────────────────────────────────────────────────────
function AutoFillWizard({ onClose, onSuccess }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    block_name: '',
    block_prefix: '',
    num_floors: 2,
    rooms_per_floor: 10,
    room_number_pattern: '{floor_code}{number:02d}',
    room_type: 'classroom',
    room_capacity: 60,
    pad_digits: 2,
    start_number: 1,
  })
  // Optional mixed room presets per floor, e.g. floor 1 room 3 = lab, room 4 = seminar_room
  const [mixedRoomsConfig, setMixedRoomsConfig] = useState({}) // { [floorNum]: { [roomNum]: roomType } }
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const PATTERNS = [
    { label: '001, 002… / 101, 102… (Standard 3-Digit)', value: '{floor_code}{number:02d}' },
    { label: 'A001, A002… / A101, A102… (Prefix + 3-Digit)', value: '{block_prefix}{floor_code}{number:02d}' },
    { label: 'Block-A-101 …', value: '{block_prefix}-{floor_code}-{n}' },
    { label: 'Room 101, Room 102 …', value: 'Room {n}' },
  ]

  const handleSubmit = async () => {
    setSaving(true)
    setError('')
    try {
      const numFloors = Math.max(1, parseInt(form.num_floors) || 1)
      const roomsPerFloor = Math.max(1, parseInt(form.rooms_per_floor) || 10)
      const startNum = parseInt(form.start_number) || 1
      const capacity = parseInt(form.room_capacity) || 60
      const pattern = form.room_number_pattern || '{floor_code}{number:02d}'
      const blockCode = (form.block_prefix || form.block_name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4) || 'BLK').toUpperCase()

      const floorConfigs = []
      for (let f = 0; f < numFloors; f++) {
        const floorName = f === 0 ? 'Ground Floor' : (f === 1 ? 'First Floor' : (f === 2 ? 'Second Floor' : (f === 3 ? 'Third Floor' : `Floor ${f}`)))
        const overrides = mixedRoomsConfig[f] || {}
        floorConfigs.push({
          floor_number: f,
          floor_name: floorName,
          room_count: roomsPerFloor,
          start_num: startNum,
          pattern: pattern,
          room_type: form.room_type || 'classroom',
          capacity: capacity,
          room_type_overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
        })
      }

      const res = await campusStructureApi.smartAutofill({
        block_name: form.block_name.trim(),
        block_code: blockCode,
        description: `Auto-generated ${numFloors}-floor block`,
        floors: floorConfigs,
      })
      setResult(res.data)
      setStep(3)
    } catch (e) {
      setError(formatError(e, 'Auto-fill failed. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-2">
        {[1, 2, 3].map(s => (
          <div key={s} className={`flex items-center gap-1 ${s < 3 ? 'flex-1' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 transition-all ${
              step >= s ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-400'
            }`}>{s}</div>
            {s < 3 && <div className={`h-0.5 flex-1 rounded transition-all ${step > s ? 'bg-primary-600' : 'bg-slate-100'}`} />}
          </div>
        ))}
        <div className="text-xs text-slate-500 font-semibold ml-2 whitespace-nowrap">
          {step === 1 ? 'Block Info' : step === 2 ? 'Room Config & Mixed Types' : '✅ Done'}
        </div>
      </div>

      {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">{error}</div>}

      {step === 1 && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Block Name *</label>
            <input value={form.block_name} onChange={e => upd('block_name', e.target.value)}
              placeholder="e.g. A Block, Main Block, Engineering Block"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Block Prefix (for room numbering)</label>
            <input value={form.block_prefix} onChange={e => upd('block_prefix', e.target.value.toUpperCase())}
              placeholder="e.g. A, MB, ENG"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Number of Floors</label>
              <input type="number" min={1} max={20} value={form.num_floors} onChange={e => upd('num_floors', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Rooms Per Floor</label>
              <input type="number" min={1} max={100} value={form.rooms_per_floor} onChange={e => upd('rooms_per_floor', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400" />
            </div>
          </div>
          <button onClick={() => setStep(2)} disabled={!form.block_name}
            className="w-full py-2.5 rounded-xl bg-primary-600 text-white font-bold text-sm disabled:opacity-50 hover:bg-primary-700 transition-all">
            Next: Room Configuration →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Room Numbering Pattern</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {PATTERNS.map(p => (
                <button key={p.value} onClick={() => upd('room_number_pattern', p.value)}
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all text-left ${
                    form.room_number_pattern === p.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}>
                  <div className="font-bold">{p.label}</div>
                  <div className="font-mono text-[10px] text-slate-400 mt-0.5 truncate">{p.value}</div>
                </button>
              ))}
            </div>
            <input value={form.room_number_pattern} onChange={e => upd('room_number_pattern', e.target.value)}
              placeholder="Custom pattern"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-primary-400" />
            <p className="text-[10px] text-slate-400 mt-1">Ground floor will generate as <strong>001, 002...</strong> and 1st floor as <strong>101, 102...</strong></p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Default Room Type</label>
              <select value={form.room_type} onChange={e => upd('room_type', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-primary-400">
                <option value="classroom">Classroom</option>
                <option value="laboratory">Laboratory</option>
                <option value="lecture_hall">Lecture Hall</option>
                <option value="seminar_room">Seminar Room</option>
                <option value="staff_room">Staff Room</option>
                <option value="office">Office</option>
                <option value="auditorium">Auditorium</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Capacity</label>
              <input type="number" min={1} value={form.room_capacity} onChange={e => upd('room_capacity', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Pad Digits</label>
              <input type="number" min={0} max={4} value={form.pad_digits} onChange={e => upd('pad_digits', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary-400" />
            </div>
          </div>

          {/* Quick Mixed Types Setting (Lab, Seminar Hall) */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <p className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>🧪 Mixed Room Types (e.g. 103 Lab, 104 Seminar Hall)</span>
              <span className="text-[10px] font-normal text-slate-500">Rooms on same floor need not be identical</span>
            </p>
            <p className="text-[11px] text-slate-500">
              Need non-classroom venues like a Lab or Seminar Room on any floor? You can customize specific rooms after creation, or generate via the Floor "+ Rooms" generator with live per-room type assignment.
            </p>
          </div>

          {/* Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1">
            <p className="font-bold text-slate-700 mb-1">📋 Summary</p>
            <p>Block: <span className="font-bold text-slate-800">{form.block_name}</span></p>
            <p>{form.num_floors} floor{form.num_floors>1?'s':''} × {form.rooms_per_floor} rooms = <span className="font-black text-primary-600">{form.num_floors * form.rooms_per_floor} total rooms</span></p>
            <p>Default: {form.room_type.replace(/_/g,' ')} · Numbering: <strong>001-0{form.rooms_per_floor < 10 ? '0' : ''}{form.rooms_per_floor}</strong> (Ground), <strong>101-1{form.rooms_per_floor < 10 ? '0' : ''}{form.rooms_per_floor}</strong> (1st Floor)</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
              ← Back
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="flex-[2] py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm disabled:opacity-50 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
              {saving ? <><Spinner size="sm" /> Building...</> : '🏗️ Build Campus Block'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <div className="space-y-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <p className="font-black text-emerald-700 text-lg">Block Created Successfully!</p>
            <p className="text-sm text-emerald-600 mt-1">
              {(result.total_floors_created ?? result.floors_created ?? 0)} floor{(result.total_floors_created ?? result.floors_created ?? 0) !== 1 ? 's' : ''} ·{' '}
              {(result.total_rooms_created ?? result.rooms_created ?? 0)} room{(result.total_rooms_created ?? result.rooms_created ?? 0) !== 1 ? 's' : ''} created
            </p>
          </div>
          <button onClick={() => { onSuccess(); onClose() }}
            className="w-full py-2.5 rounded-xl bg-primary-600 text-white font-bold text-sm hover:bg-primary-700 transition-all">
            View Campus Structure
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Room Generator
// ─────────────────────────────────────────────────────────────────────────────
function BulkRoomGenerator({ block, onClose, onSuccess }) {
  const [floors, setFloors] = useState([])
  const [loadingFloors, setLoadingFloors] = useState(true)
  const [form, setForm] = useState({
    floor_id: '',
    room_number_pattern: '{floor_code}{number:02d}',
    start_num: 1,
    end_num: 10,
    pad_digits: 2,
    room_type: 'classroom',
    capacity: 60,
  })
  const [roomTypeOverrides, setRoomTypeOverrides] = useState({}) // { "103": "laboratory", "104": "seminar_room" }
  const [preview, setPreview] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    campusStructureApi.listFloors(block.id)
      .then(r => {
        setFloors(r.data || [])
        if (r.data?.length > 0) setForm(f => ({ ...f, floor_id: r.data[0].id }))
      })
      .finally(() => setLoadingFloors(false))
  }, [block.id])

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handlePreview = async () => {
    setPreviewing(true)
    setError('')
    try {
      const count = Math.max(1, (parseInt(form.end_num) || 10) - (parseInt(form.start_num) || 1) + 1)
      const res = await campusStructureApi.previewRooms({
        block_id: block?.id,
        floor_id: parseInt(form.floor_id),
        pattern: form.room_number_pattern || '{floor_code}{number:02d}',
        start_num: parseInt(form.start_num) || 1,
        count: count,
        pad_digits: parseInt(form.pad_digits) || 0,
        room_type: form.room_type || 'classroom',
        capacity: parseInt(form.capacity) || 60,
        room_type_overrides: roomTypeOverrides,
      })
      setPreview(res.data)
    } catch (e) {
      setError(formatError(e, 'Preview failed'))
    } finally {
      setPreviewing(false)
    }
  }

  const handleToggleRoomType = (roomNumber, currentType) => {
    const types = ['classroom', 'laboratory', 'seminar_room', 'lecture_hall', 'office', 'staff_room']
    const nextIdx = (types.indexOf(currentType) + 1) % types.length
    const nextType = types[nextIdx]
    setRoomTypeOverrides(prev => ({
      ...prev,
      [roomNumber]: nextType
    }))
    if (preview?.preview_items) {
      setPreview(prev => ({
        ...prev,
        preview_items: prev.preview_items.map(it =>
          it.room_number === roomNumber ? { ...it, room_type: nextType } : it
        )
      }))
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    try {
      const count = Math.max(1, (parseInt(form.end_num) || 10) - (parseInt(form.start_num) || 1) + 1)
      await campusStructureApi.generateRooms({
        block_id: block?.id,
        floor_id: parseInt(form.floor_id),
        pattern: form.room_number_pattern || '{floor_code}{number:02d}',
        start_num: parseInt(form.start_num) || 1,
        count: count,
        pad_digits: parseInt(form.pad_digits) || 2,
        room_type: form.room_type || 'classroom',
        capacity: parseInt(form.capacity) || 60,
        room_type_overrides: roomTypeOverrides,
      })
      onSuccess()
      onClose()
    } catch (e) {
      setError(formatError(e, 'Generation failed'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">{error}</div>}
      {loadingFloors ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-1">Select Floor *</label>
              <select value={form.floor_id} onChange={e => { upd('floor_id', e.target.value); setPreview(null) }}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400">
                {floors.map(f => <option key={f.id} value={f.id}>{f.floor_name} (Floor {f.floor_number})</option>)}
                {floors.length === 0 && <option value="">No floors — add one first</option>}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-1">Room Number Pattern</label>
              <input value={form.room_number_pattern} onChange={e => { upd('room_number_pattern', e.target.value); setPreview(null) }}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary-400" />
              <p className="text-[10px] text-slate-400 mt-0.5">Use <code>{'{floor_code}{number:02d}'}</code> for 001, 002... (Ground) and 101, 102... (1st Floor)</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Start Number</label>
              <input type="number" value={form.start_num} onChange={e => { upd('start_num', e.target.value); setPreview(null) }}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">End Number</label>
              <input type="number" value={form.end_num} onChange={e => { upd('end_num', e.target.value); setPreview(null) }}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Default Room Type</label>
              <select value={form.room_type} onChange={e => { upd('room_type', e.target.value); setPreview(null) }}
                className="w-full border border-slate-200 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-primary-400">
                {Object.keys(ROOM_TYPE_COLORS).map(t => (
                  <option key={t} value={t}>{t.replace(/_/g,' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Capacity</label>
              <input type="number" value={form.capacity} onChange={e => upd('capacity', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400" />
            </div>
          </div>

          {/* Preview Panel */}
          <button onClick={handlePreview} disabled={previewing || !form.floor_id}
            className="w-full py-2 rounded-xl border-2 border-dashed border-primary-300 text-primary-600 font-bold text-sm hover:bg-primary-50 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {previewing ? <><Spinner size="sm" /> Loading preview...</> : '👁️ Preview Rooms & Configure Mixed Types'}
          </button>

          {preview && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-56 overflow-y-auto space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-600">
                  {preview.preview_items?.length} rooms to create · <span className="text-slate-400 font-normal">Click a room badge to cycle type (e.g. Lab, Seminar)</span>
                </p>
                {preview.duplicate_count > 0 && (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                    ⚠️ {preview.duplicate_count} duplicates
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(preview.preview_items || []).map((item, i) => {
                  const currentType = roomTypeOverrides[item.room_number] || item.room_type || form.room_type
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleToggleRoomType(item.room_number, currentType)}
                      title={`Click to change type: current is ${currentType}`}
                      className={`p-2 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        item.is_duplicate
                          ? 'bg-amber-50 border-amber-300 text-amber-900'
                          : 'bg-white border-slate-200 hover:border-primary-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs">{item.room_number}</span>
                        {item.is_duplicate && <span className="text-[10px]">⚠️</span>}
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <RoomTypeBadge type={currentType} />
                        <span className="text-[9px] text-slate-400">change ↻</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
              Cancel
            </button>
            <button onClick={handleGenerate} disabled={generating || (preview?.duplicate_count > 0 && !preview?.can_proceed) || !form.floor_id}
              className="flex-[2] py-2.5 rounded-xl bg-primary-600 text-white font-bold text-sm disabled:opacity-50 hover:bg-primary-700 transition-all flex items-center justify-center gap-2">
              {generating ? <><Spinner size="sm" /> Generating...</> : `🏗️ Generate ${form.end_num - form.start_num + 1} Rooms`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Floor Modal
// ─────────────────────────────────────────────────────────────────────────────
function AddFloorModal({ block, onClose, onSuccess }) {
  const [form, setForm] = useState({ floor_name: '', floor_number: 0, floor_code: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setSaving(true)
    setError('')
    try {
      await campusStructureApi.createFloor({
        block_id: block.id,
        floor_name: form.floor_name.trim(),
        floor_number: parseInt(form.floor_number) || 0,
        display_order: parseInt(form.floor_number) || 0,
      })
      onSuccess()
      onClose()
    } catch (e) {
      setError(formatError(e, 'Failed to add floor'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">{error}</div>}
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1">Floor Name *</label>
        <input value={form.floor_name} onChange={e => setForm(f => ({ ...f, floor_name: e.target.value }))}
          placeholder="e.g. Ground Floor, First Floor"
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Floor Number</label>
          <input type="number" value={form.floor_number} onChange={e => setForm(f => ({ ...f, floor_number: e.target.value }))}
            placeholder="0 = Ground"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Floor Code (optional)</label>
          <input value={form.floor_code} onChange={e => setForm(f => ({ ...f, floor_code: e.target.value.toUpperCase() }))}
            placeholder="GF, 1F, 2F …"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary-400" />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={saving || !form.floor_name}
          className="flex-[2] py-2.5 rounded-xl bg-primary-600 text-white font-bold text-sm disabled:opacity-50 hover:bg-primary-700 transition-all flex items-center justify-center gap-2">
          {saving ? <><Spinner size="sm" /> Adding...</> : '+ Add Floor'}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Block Create/Edit Modal
// ─────────────────────────────────────────────────────────────────────────────
const BLOCK_COLORS = ['#4F46E5','#0EA5E9','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6']

function BlockModal({ block, onClose, onSuccess }) {
  const isEdit = !!block
  const [form, setForm] = useState({
    name: block?.name || '',
    prefix: block?.code || block?.prefix || '',
    color_hex: block?.color_hex || BLOCK_COLORS[0],
    description: block?.description || '',
    is_active: block?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    setSaving(true)
    setError('')
    try {
      const code = (form.prefix || form.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4) || 'BLK').toUpperCase()
      const payload = {
        name: form.name.trim(),
        code: code,
        description: form.description || null,
        is_active: form.is_active ?? true,
      }
      if (isEdit) {
        await campusStructureApi.updateBlock(block.id, payload)
      } else {
        await campusStructureApi.createBlock({ ...payload, floors_count: 1 })
      }
      onSuccess()
      onClose()
    } catch (e) {
      setError(formatError(e, 'Failed to save block'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-bold text-slate-600 mb-1">Block Name *</label>
          <input value={form.name} onChange={e => upd('name', e.target.value)}
            placeholder="e.g. A Block, Main Block"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Prefix</label>
          <input value={form.prefix} onChange={e => upd('prefix', e.target.value.toUpperCase())}
            placeholder="A, MB, ENG"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary-400" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Color</label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {BLOCK_COLORS.map(c => (
              <button key={c} onClick={() => upd('color_hex', c)}
                style={{ background: c }}
                className={`w-6 h-6 rounded-full border-2 transition-all ${form.color_hex === c ? 'border-slate-800 scale-110' : 'border-transparent'}`} />
            ))}
          </div>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-bold text-slate-600 mb-1">Description</label>
          <textarea value={form.description} onChange={e => upd('description', e.target.value)} rows={2}
            placeholder="Optional notes about this block"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400 resize-none" />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={saving || !form.name}
          className="flex-[2] py-2.5 rounded-xl bg-primary-600 text-white font-bold text-sm disabled:opacity-50 hover:bg-primary-700 transition-all flex items-center justify-center gap-2">
          {saving ? <><Spinner size="sm" /> Saving...</> : (isEdit ? '💾 Update Block' : '+ Create Block')}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Search Panel
// ─────────────────────────────────────────────────────────────────────────────
function SearchPanel() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (!query || query.length < 2) { setResults(null); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await campusStructureApi.search(query)
        setResults(res.data)
      } catch { setResults(null) }
      finally { setSearching(false) }
    }, 350)
  }, [query])

  return (
    <div className="space-y-3">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search rooms, blocks, departments…"
          className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary-400" />
        {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2"><Spinner size="sm" /></span>}
      </div>
      {results && (
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {results.results?.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-6">No results for "{query}"</p>
          )}
          {results.results?.map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-slate-100 bg-white hover:border-slate-200 transition-all">
              <span className="text-lg">🚪</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm truncate">{item.room_number}</p>
                <p className="text-xs text-slate-500 truncate">
                  {[item.block_name, item.floor_name].filter(Boolean).join(' › ')}
                  {item.department_name ? ` · ${item.department_name}` : ''}
                </p>
              </div>
              <RoomTypeBadge type={item.room_type} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function CampusStructureBuilder({ readOnly = false }) {
  const { isAdmin, isSystemAdmin } = useAuth()
  const canEdit = !readOnly && (isAdmin || isSystemAdmin)

  const [activeTab, setActiveTab] = useState('tree')
  const [tree, setTree] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Modals
  const [wizardOpen, setWizardOpen] = useState(false)
  const [blockModal, setBlockModal] = useState(null) // null | block | 'new'
  const [floorModal, setFloorModal] = useState(null) // null | block
  const [generateModal, setGenerateModal] = useState(null) // null | block
  const [bulkDeptModal, setBulkDeptModal] = useState(null) // null | { target, type: 'floor' | 'block' }
  const [deleteConfirm, setDeleteConfirm] = useState(null) // null | block
  const [deleting, setDeleting] = useState(false)

  const [exportLoading, setExportLoading] = useState(false)
  const importRef = useRef(null)
  const [importResult, setImportResult] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [treeRes, metricsRes] = await Promise.all([
        campusStructureApi.getTree(),
        campusStructureApi.getMetrics(),
      ])
      setTree(treeRes.data)
      setMetrics(metricsRes.data)
    } catch (e) {
      setError(formatError(e, 'Failed to load campus structure'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDeleteBlock = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      await campusStructureApi.deleteBlock(deleteConfirm.id)
      setDeleteConfirm(null)
      fetchData()
    } catch (e) {
      alert(formatError(e, 'Failed to delete block'))
    } finally {
      setDeleting(false)
    }
  }

  const handleDuplicate = async (block) => {
    const newName = prompt(`Duplicate "${block.name}"\nEnter name for the new block:`, `${block.name} (Copy)`)
    if (!newName) return
    try {
      const newCode = (block.code ? `${block.code}_COPY` : `${block.name.slice(0, 3)}_CPY`).toUpperCase().slice(0, 50)
      await campusStructureApi.duplicateBlock(block.id, {
        new_block_name: newName.trim(),
        new_block_code: newCode,
      })
      fetchData()
    } catch (e) {
      alert(formatError(e, 'Failed to duplicate block'))
    }
  }

  const handleExport = async () => {
    setExportLoading(true)
    try {
      const res = await campusStructureApi.exportCsv()
      const blob = new Blob([res.data], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'campus_structure.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('Export failed')
    } finally {
      setExportLoading(false)
    }
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const validateRes = await campusStructureApi.validateImport(file)
      const v = validateRes.data
      if (!v.is_valid) {
        setImportResult({ type: 'error', message: v.errors?.join(', ') || 'Validation failed' })
        return
      }
      const commitRes = await campusStructureApi.commitImport(file)
      setImportResult({ type: 'success', data: commitRes.data })
      fetchData()
    } catch (e) {
      setImportResult({ type: 'error', message: formatError(e, 'Import failed') })
    } finally {
      e.target.value = ''
    }
  }

  const blocks = tree?.blocks || []

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-slate-800">🏛️ Campus Structure Builder</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {tree?.institution_name || 'Campus'} · Visual hierarchy of your physical infrastructure
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleExport} disabled={exportLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all">
              {exportLoading ? <Spinner size="sm" /> : '📥'} Export CSV
            </button>
            <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-all">
              📤 Import CSV
              <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
            </label>
            <button onClick={() => setWizardOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-primary-600 text-white font-bold text-sm hover:from-violet-700 hover:to-primary-700 transition-all shadow-sm">
              🏗️ Smart Auto-Fill
            </button>
            <button onClick={() => setBlockModal('new')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 text-white font-bold text-sm hover:bg-primary-700 transition-all shadow-sm">
              + Add Block
            </button>
          </div>
        )}
      </div>

      {/* Import result feedback */}
      {importResult && (
        <div className={`p-3 rounded-xl border text-sm flex items-center justify-between ${
          importResult.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-rose-50 border-rose-200 text-rose-700'
        }`}>
          <span>{importResult.type === 'success'
            ? `✅ Imported — ${importResult.data?.blocks_created ?? 0} blocks, ${importResult.data?.rooms_created ?? 0} rooms created`
            : `❌ ${importResult.message}`
          }</span>
          <button onClick={() => setImportResult(null)} className="text-lg leading-none opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Blocks" value={metrics.total_blocks} icon="🏢" color="primary" />
          <MetricCard label="Floors" value={metrics.total_floors} icon="🏬" color="emerald" />
          <MetricCard label="Rooms" value={metrics.total_rooms} icon="🚪" color="amber" />
          <MetricCard label="Warnings" value={metrics.warnings?.length || 0} icon="⚠️" color={metrics.warnings?.length > 0 ? 'rose' : 'emerald'} />
        </div>
      )}

      {/* Warnings */}
      {metrics?.warnings?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700 space-y-1">
          <p className="font-bold">⚠️ Configuration Warnings</p>
          {metrics.warnings.map((w, i) => <p key={i} className="text-xs">• {w}</p>)}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {[
          { id: 'tree', label: '🌳 Hierarchy' },
          { id: 'search', label: '🔍 Search' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all -mb-px ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : error ? (
        <ErrorAlert message={error} onRetry={fetchData} />
      ) : activeTab === 'search' ? (
        <SearchPanel />
      ) : (
        <div>
          {blocks.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
              <div className="text-5xl mb-3">🏛️</div>
              <p className="font-bold text-slate-700 text-lg">No Blocks Yet</p>
              <p className="text-slate-400 text-sm mt-1 mb-4">Use the Smart Auto-Fill wizard to build your entire campus in seconds, or add blocks manually.</p>
              {canEdit && (
                <div className="flex items-center justify-center gap-3">
                  <button onClick={() => setWizardOpen(true)}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-primary-600 text-white font-bold text-sm hover:opacity-90 transition-all">
                    🏗️ Launch Auto-Fill Wizard
                  </button>
                  <button onClick={() => setBlockModal('new')}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                    + Add Block Manually
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {blocks.map(block => (
                <BlockNode
                  key={block.id}
                  block={block}
                  readOnly={!canEdit}
                  onEdit={b => setBlockModal(b)}
                  onDelete={b => setDeleteConfirm(b)}
                  onDuplicate={handleDuplicate}
                  onAddFloor={b => setFloorModal(b)}
                  onGenerateRooms={b => setGenerateModal(b)}
                  onBulkAssignDept={target => setBulkDeptModal({
                    target: target.floor_name ? target : block,
                    type: target.floor_name ? 'floor' : 'block'
                  })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      {/* Smart Auto-Fill Wizard */}
      <Modal isOpen={wizardOpen} onClose={() => setWizardOpen(false)} title="🏗️ Smart Campus Auto-Fill Wizard">
        <AutoFillWizard onClose={() => setWizardOpen(false)} onSuccess={fetchData} />
      </Modal>

      {/* Block Create/Edit */}
      <Modal
        isOpen={blockModal !== null}
        onClose={() => setBlockModal(null)}
        title={blockModal === 'new' ? '+ Add Block' : `✏️ Edit ${blockModal?.name}`}
      >
        {blockModal !== null && (
          <BlockModal
            block={blockModal === 'new' ? null : blockModal}
            onClose={() => setBlockModal(null)}
            onSuccess={fetchData}
          />
        )}
      </Modal>

      {/* Add Floor */}
      <Modal isOpen={floorModal !== null} onClose={() => setFloorModal(null)}
        title={`+ Add Floor — ${floorModal?.name}`}>
        {floorModal && (
          <AddFloorModal block={floorModal} onClose={() => setFloorModal(null)} onSuccess={fetchData} />
        )}
      </Modal>

      {/* Bulk Room Generator */}
      <Modal isOpen={generateModal !== null} onClose={() => setGenerateModal(null)}
        title={`🏗️ Bulk Generate Rooms — ${generateModal?.name}`}>
        {generateModal && (
          <BulkRoomGenerator block={generateModal} onClose={() => setGenerateModal(null)} onSuccess={fetchData} />
        )}
      </Modal>

      {/* Bulk Assign Department Modal (Floor or Block) */}
      <Modal
        isOpen={bulkDeptModal !== null}
        onClose={() => setBulkDeptModal(null)}
        title={`🏢 Bulk Assign Department — ${bulkDeptModal?.type === 'floor' ? bulkDeptModal?.target?.floor_name : bulkDeptModal?.target?.name}`}
      >
        {bulkDeptModal && (
          <BulkAssignDeptModal
            target={bulkDeptModal.target}
            type={bulkDeptModal.type}
            onClose={() => setBulkDeptModal(null)}
            onSuccess={fetchData}
          />
        )}
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} title="Delete Block">
        <div className="space-y-4">
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
            <p className="font-bold text-rose-700 text-sm">⚠️ This will permanently delete:</p>
            <ul className="text-sm text-rose-600 mt-1 space-y-0.5 list-disc list-inside">
              <li>Block: <strong>{deleteConfirm?.name}</strong></li>
              <li>All floors and rooms in this block</li>
              <li>All duty and occupancy records for these rooms</li>
            </ul>
          </div>
          <p className="text-slate-500 text-sm">This action cannot be undone.</p>
          <div className="flex gap-2">
            <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
              Cancel
            </button>
            <button onClick={handleDeleteBlock} disabled={deleting}
              className="flex-[2] py-2.5 rounded-xl bg-rose-600 text-white font-bold text-sm disabled:opacity-50 hover:bg-rose-700 transition-all flex items-center justify-center gap-2">
              {deleting ? <><Spinner size="sm" /> Deleting...</> : '🗑️ Delete Block & All Rooms'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
