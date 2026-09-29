import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { campusStructureApi, departmentsApi, roomsApi, classesApi } from '../../api/services'
import { Spinner, ErrorAlert, Modal, Badge } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function formatRoomNumber(pattern, num, floorNum, blockPrefix = '') {
  const floorCode = floorNum === 0 ? '0' : (floorNum < 0 ? `B${Math.abs(floorNum)}` : String(floorNum))
  let res = pattern || '{floor_code}{number:02d}'
  res = res.replace(/{block_prefix}/g, blockPrefix ? `${blockPrefix}-` : '')
  res = res.replace(/{floor_code}/g, floorCode)
  const num2d = String(num).padStart(2, '0')
  const num3d = String(num).padStart(3, '0')
  res = res.replace(/{number:02d}/g, num2d)
  res = res.replace(/{number:03d}/g, num3d)
  res = res.replace(/{number}/g, String(num))
  res = res.replace(/{num}/g, String(num))
  res = res.replace(/{n}/g, num2d)
  return res.trim()
}

const ROOM_TYPE_COLORS = {
  classroom:        { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  laboratory:       { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  lab:              { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  seminar_hall:     { bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200' },
  seminar_room:     { bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200' },
  lecture_hall:     { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  examination_hall: { bg: 'bg-rose-50',   text: 'text-rose-700',   border: 'border-rose-200' },
  staff_room:       { bg: 'bg-slate-50',  text: 'text-slate-600',  border: 'border-slate-200' },
  office:           { bg: 'bg-emerald-50',text: 'text-emerald-700',border: 'border-emerald-200' },
  auditorium:       { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  meeting_room:     { bg: 'bg-cyan-50',   text: 'text-cyan-700',   border: 'border-cyan-200' },
  store_room:       { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  other:            { bg: 'bg-gray-50',   text: 'text-gray-600',   border: 'border-gray-200' },
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
function BulkAssignDeptModal({ target, type, departments: propDepartments = [], classes: propClasses = [], onClose, onSuccess }) {
  const [departments, setDepartments] = useState(propDepartments)
  const [classes, setClasses] = useState(propClasses)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState(
    type === 'block' && (target?.floors?.length || 0) > 0
      ? 'multi_floor'
      : (type === 'floor' && (target?.rooms?.length || 0) > 1 ? 'split' : 'whole')
  )
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [floorAllocations, setFloorAllocations] = useState({})
  const [primaryDeptId, setPrimaryDeptId] = useState(target?.department_id ? String(target.department_id) : '')
  const [quickDeptId, setQuickDeptId] = useState('')
  const [overwrite, setOverwrite] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Floor Split Mode state
  const floorRooms = useMemo(() => {
    if (type !== 'floor' || !target?.rooms) return []
    return [...target.rooms].sort((a, b) => (a.room_number || '').localeCompare(b.room_number || '', undefined, { numeric: true }))
  }, [target, type])

  const [roomAllocations, setRoomAllocations] = useState({})
  const [rangeFromId, setRangeFromId] = useState('')
  const [rangeToId, setRangeToId] = useState('')
  const [rangeDeptId, setRangeDeptId] = useState('')
  const [rangeClassId, setRangeClassId] = useState('')

  const floors = (type === 'block' ? target?.floors : null) || []

  useEffect(() => {
    if (departments.length === 0) {
      departmentsApi.list(true)
        .then(r => setDepartments(r.data || []))
        .catch(() => setDepartments([]))
    }
    if (classes.length === 0) {
      classesApi.list()
        .then(r => setClasses(r.data || []))
        .catch(() => setClasses([]))
    }
  }, [departments.length, classes.length])

  useEffect(() => {
    if (type === 'block' && target?.floors) {
      const initialAlloc = {}
      target.floors.forEach(f => {
        const roomsWithDept = (f.rooms || []).filter(rm => rm.department_id)
        if (roomsWithDept.length > 0) {
          initialAlloc[f.id] = String(roomsWithDept[0].department_id)
        } else {
          initialAlloc[f.id] = ''
        }
      })
      setFloorAllocations(initialAlloc)
    } else if (type === 'floor' && target?.rooms) {
      const initial = {}
      target.rooms.forEach(r => {
        initial[r.id] = {
          department_id: r.department_id ? String(r.department_id) : '',
          primary_class_id: r.primary_class_id ? String(r.primary_class_id) : ''
        }
      })
      setRoomAllocations(initial)
      if (floorRooms.length > 0) {
        setRangeFromId(String(floorRooms[0].id))
        setRangeToId(String(floorRooms[floorRooms.length - 1].id))
      }
    }
  }, [target, type, floorRooms])

  const deptMap = useMemo(() => {
    const m = {}
    departments.forEach(d => { m[d.id] = d.name })
    return m
  }, [departments])

  const handleApplyQuickDept = () => {
    if (!quickDeptId) return
    const updated = {}
    floors.forEach(f => {
      updated[f.id] = quickDeptId === 'none' ? 'none' : quickDeptId
    })
    setFloorAllocations(updated)
  }

  const handleApplyRange = () => {
    if (!rangeFromId || !rangeToId || !rangeDeptId) return
    const idxFrom = floorRooms.findIndex(r => String(r.id) === String(rangeFromId))
    const idxTo = floorRooms.findIndex(r => String(r.id) === String(rangeToId))
    if (idxFrom === -1 || idxTo === -1) return
    const start = Math.min(idxFrom, idxTo)
    const end = Math.max(idxFrom, idxTo)

    setRoomAllocations(prev => {
      const next = { ...prev }
      for (let i = start; i <= end; i++) {
        const rm = floorRooms[i]
        const assignedDept = rangeDeptId === 'none' ? '' : rangeDeptId
        next[rm.id] = {
          ...next[rm.id],
          department_id: assignedDept,
          primary_class_id: rangeClassId
            ? (rangeClassId === 'none' ? '' : rangeClassId)
            : (assignedDept && next[rm.id]?.primary_class_id ? next[rm.id].primary_class_id : '')
        }
      }
      return next
    })
  }

  const handleRoomDeptChange = (roomId, newDeptId) => {
    setRoomAllocations(prev => ({
      ...prev,
      [roomId]: {
        ...prev[roomId],
        department_id: newDeptId,
      }
    }))
  }

  const handleRoomClassChange = (roomId, newClassId) => {
    setRoomAllocations(prev => {
      const current = prev[roomId] || { department_id: '', primary_class_id: '' }
      let dept = current.department_id
      if (newClassId && !dept) {
        const cls = classes.find(c => String(c.id) === String(newClassId))
        if (cls?.department_id) {
          dept = String(cls.department_id)
        }
      }
      return {
        ...prev,
        [roomId]: {
          department_id: dept,
          primary_class_id: newClassId,
        }
      }
    })
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError('')
    try {
      if (type === 'floor') {
        if (mode === 'split') {
          // Find changed rooms
          const changed = []
          target.rooms.forEach(orig => {
            const alloc = roomAllocations[orig.id] || {}
            const origDept = orig.department_id ? String(orig.department_id) : ''
            const origClass = orig.primary_class_id ? String(orig.primary_class_id) : ''
            const newDept = alloc.department_id || ''
            const newClass = alloc.primary_class_id || ''
            if (newDept !== origDept || newClass !== origClass) {
              changed.push({
                id: orig.id,
                department_id: newDept ? Number(newDept) : null,
                primary_class_id: newClass ? Number(newClass) : null
              })
            }
          })

          if (changed.length > 0) {
            await Promise.all(
              changed.map(c =>
                roomsApi.update(c.id, {
                  department_id: c.department_id,
                  primary_class_id: c.primary_class_id
                })
              )
            )
          }
        } else {
          const payload = {
            department_id: selectedDeptId === '' ? null : Number(selectedDeptId),
            overwrite_existing: overwrite,
          }
          await campusStructureApi.bulkAssignFloorDepartment(target.id, payload)
        }
      } else if (mode === 'multi_floor') {
        const mappedFloors = {}
        for (const [fId, dId] of Object.entries(floorAllocations)) {
          if (dId === 'none') {
            mappedFloors[fId] = null
          } else if (dId !== '') {
            mappedFloors[fId] = Number(dId)
          }
        }
        const payload = {
          floor_allocations: mappedFloors,
          primary_department_id: primaryDeptId ? Number(primaryDeptId) : null,
          overwrite_existing: overwrite,
        }
        await campusStructureApi.allocateBlockDepartments(target.id, payload)
      } else {
        const payload = {
          department_id: selectedDeptId === '' ? null : Number(selectedDeptId),
          overwrite_existing: overwrite,
        }
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
          {type === 'block' && floors.length > 0 && (
            <div className="flex rounded-xl bg-slate-100 p-1 gap-1">
              <button
                type="button"
                onClick={() => setMode('multi_floor')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                  mode === 'multi_floor'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                🏢 Multi-Dept Floor Allocation
              </button>
              <button
                type="button"
                onClick={() => setMode('whole')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                  mode === 'whole'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Single Department (Whole Block)
              </button>
            </div>
          )}

          {type === 'floor' && floorRooms.length > 1 && (
            <div className="flex rounded-2xl bg-slate-100 p-1 gap-1">
              <button
                type="button"
                onClick={() => setMode('split')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all ${
                  mode === 'split'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                🔀 Multi-Dept Split / Wing Partition
              </button>
              <button
                type="button"
                onClick={() => setMode('whole')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                  mode === 'whole'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Single Department (Whole Floor)
              </button>
            </div>
          )}

          {type === 'floor' && mode === 'split' ? (
            <div className="space-y-4">
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl text-xs text-indigo-900 leading-relaxed">
                Partition <strong>{titleName}</strong> into wings or sections by assigning different departments and classes to different rooms. You can use the Quick Range Allocator or change room dropdowns below.
              </div>

              {/* Quick Range Allocator */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-2 shadow-xs">
                <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                  ⚡ Quick Range Allocator
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">From Room</label>
                    <select
                      value={rangeFromId}
                      onChange={e => setRangeFromId(e.target.value)}
                      className="w-full text-xs font-bold border border-slate-200 rounded-xl px-2 py-1.5 bg-white focus:outline-none focus:border-indigo-500"
                    >
                      {floorRooms.map(r => (
                        <option key={r.id} value={r.id}>🚪 {r.room_number}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">To Room</label>
                    <select
                      value={rangeToId}
                      onChange={e => setRangeToId(e.target.value)}
                      className="w-full text-xs font-bold border border-slate-200 rounded-xl px-2 py-1.5 bg-white focus:outline-none focus:border-indigo-500"
                    >
                      {floorRooms.map(r => (
                        <option key={r.id} value={r.id}>🚪 {r.room_number}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Assign Dept</label>
                    <select
                      value={rangeDeptId}
                      onChange={e => setRangeDeptId(e.target.value)}
                      className="w-full text-xs font-bold border border-slate-200 rounded-xl px-2 py-1.5 bg-white focus:outline-none focus:border-indigo-500 truncate"
                    >
                      <option value="">-- Choose Dept --</option>
                      <option value="none">-- Unassigned (Clear) --</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>🏢 {d.name} {d.code ? `(${d.code})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleApplyRange}
                      disabled={!rangeDeptId}
                      className="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95"
                    >
                      Apply to Range
                    </button>
                  </div>
                </div>
              </div>

              {/* Room by Room Table */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 px-2 pb-1">
                  <span>Room ({floorRooms.length} Total)</span>
                  <span>Assigned Department & Class</span>
                </div>
                <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {floorRooms.map(rm => {
                    const alloc = roomAllocations[rm.id] || { department_id: '', primary_class_id: '' }
                    const rmDeptNum = alloc.department_id ? Number(alloc.department_id) : null
                    const deptClasses = rmDeptNum ? classes.filter(c => c.department_id === rmDeptNum) : []
                    const otherCls = rmDeptNum ? classes.filter(c => c.department_id !== rmDeptNum) : classes

                    return (
                      <div key={rm.id} className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-2 min-w-0 shrink-0">
                          <div className="px-2.5 py-1 rounded-xl bg-slate-900 text-white font-mono font-black text-xs tracking-wider shrink-0 select-all border border-slate-800 flex items-center gap-1">
                            <span className="text-[10px]">🚪</span>
                            <span className="shrink-0">{rm.room_number}</span>
                          </div>
                          {rm.name && rm.name !== rm.room_number && (
                            <span className="text-[11px] text-slate-400 font-semibold truncate max-w-[80px]">
                              {rm.name}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500 font-semibold bg-slate-100 px-1.5 py-0.5 rounded capitalize">
                            {rm.room_type || 'class'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
                          {/* Department Select */}
                          <select
                            value={alloc.department_id}
                            onChange={e => handleRoomDeptChange(rm.id, e.target.value)}
                            className="flex-1 border border-slate-200 rounded-xl px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-indigo-500 font-bold truncate"
                          >
                            <option value="">-- No Dept (Unassigned) --</option>
                            {departments.map(d => (
                              <option key={d.id} value={d.id}>🏢 {d.name} {d.code ? `(${d.code})` : ''}</option>
                            ))}
                          </select>

                          {/* Class Select */}
                          <select
                            value={alloc.primary_class_id}
                            onChange={e => handleRoomClassChange(rm.id, e.target.value)}
                            className="flex-1 border border-slate-200 rounded-xl px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-indigo-500 font-semibold truncate"
                          >
                            <option value="">-- No Class --</option>
                            {deptClasses.length > 0 && (
                              <optgroup label="⭐ Dept Classes">
                                {deptClasses.map(c => (
                                  <option key={c.id} value={c.id}>
                                    🎓 {c.name} {c.section ? `(${c.section})` : ''}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {otherCls.length > 0 && (
                              <optgroup label={deptClasses.length > 0 ? "🌐 Other Classes" : "All Classes"}>
                                {otherCls.map(c => (
                                  <option key={c.id} value={c.id}>
                                    🎓 {c.name} {c.section ? `(${c.section})` : ''} {c.department_id && deptMap[c.department_id] ? `(${deptMap[c.department_id]})` : ''}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : type === 'block' && mode === 'multi_floor' && floors.length > 0 ? (
            <div className="space-y-3">
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 leading-relaxed">
                Assign different departments to each floor of <strong>{titleName}</strong>. Faculty from all assigned departments will automatically be eligible for duty scheduling in this block.
              </div>

              {/* Quick Fill Toolbar */}
              <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[11px] font-bold text-slate-500 shrink-0">Quick Fill All Floors:</span>
                <select
                  value={quickDeptId}
                  onChange={e => setQuickDeptId(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:border-indigo-400"
                >
                  <option value="">-- Choose department --</option>
                  <option value="none">Clear / Unassign</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name} {d.code ? `(${d.code})` : ''}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleApplyQuickDept}
                  disabled={!quickDeptId}
                  className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 disabled:opacity-40 text-slate-700 rounded-lg text-xs font-bold transition-all shrink-0"
                >
                  Apply to All
                </button>
              </div>

              {/* Primary Department Selector */}
              <div className="pt-1">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Primary Block Department <span className="font-normal text-slate-400">(Optional lead department)</span>
                </label>
                <select
                  value={primaryDeptId}
                  onChange={e => setPrimaryDeptId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                >
                  <option value="">-- Auto-detect / Shared Block --</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name} {d.code ? `(${d.code})` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Per-Floor Rows */}
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {floors.map(f => {
                  const roomCount = (f.rooms || []).length
                  const currentAlloc = floorAllocations[f.id] || ''
                  return (
                    <div key={f.id} className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800 text-xs truncate">{f.floor_name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({roomCount} {roomCount === 1 ? 'room' : 'rooms'})</span>
                        </div>
                      </div>
                      <select
                        value={currentAlloc}
                        onChange={e => setFloorAllocations(prev => ({ ...prev, [f.id]: e.target.value }))}
                        className="w-56 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-indigo-500 font-medium"
                      >
                        <option value="">-- Keep Existing --</option>
                        <option value="none">-- Unassigned / Clear Dept --</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.id}>{d.name} {d.code ? `(${d.code})` : ''}</option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="overwrite_multi_dept"
                  checked={overwrite}
                  onChange={e => setOverwrite(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <label htmlFor="overwrite_multi_dept" className="text-xs text-slate-600">
                  Overwrite rooms that already have a department assigned on these floors
                </label>
              </div>
            </div>
          ) : (
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
            </>
          )}

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-[2] py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm disabled:opacity-50 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
            >
              {saving ? <><Spinner size="sm" /> Applying...</> : (
                type === 'floor' && mode === 'split'
                  ? '💾 Save Multi-Dept Floor Assignments'
                  : mode === 'multi_floor' && type === 'block'
                  ? '🏢 Allocate Departments to Block'
                  : `🏢 Apply to ${type === 'floor' ? 'Floor' : 'Block'}`
              )}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick Edit Room Modal (In-Place, Zero Navigation)
// ─────────────────────────────────────────────────────────────────────────────
function QuickEditRoomModal({ room, departments, classes, onClose, onSuccess }) {
  const [form, setForm] = useState({
    room_number: room?.room_number || '',
    room_name: room?.name || room?.room_name || '',
    room_type: room?.room_type || 'classroom',
    capacity: room?.capacity || 60,
    department_id: room?.department_id || '',
    primary_class_id: room?.primary_class_id || '',
    is_exam_eligible: Boolean(room?.is_exam_eligible),
    exam_capacity: room?.exam_capacity || '',
    required_invigilators: room?.required_invigilators || 1,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await roomsApi.update(room.id, {
        room_number: form.room_number.trim(),
        room_name: form.room_name.trim() || null,
        room_type: form.room_type,
        capacity: parseInt(form.capacity) || 60,
        department_id: form.department_id ? parseInt(form.department_id) : null,
        primary_class_id: form.primary_class_id ? parseInt(form.primary_class_id) : null,
        is_exam_eligible: Boolean(form.is_exam_eligible),
        exam_capacity: form.exam_capacity ? parseInt(form.exam_capacity) : null,
        required_invigilators: parseInt(form.required_invigilators) || 1,
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(formatError(err, 'Failed to update room'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Room Number *</label>
          <input
            value={form.room_number}
            onChange={e => upd('room_number', e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary-400"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Room Type *</label>
          <select
            value={form.room_type}
            onChange={e => upd('room_type', e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
          >
            <option value="classroom">🚪 Classroom</option>
            <option value="laboratory">🧪 Laboratory</option>
            <option value="seminar_hall">🏛️ Seminar Hall</option>
            <option value="examination_hall">📝 Examination Hall</option>
            <option value="staff_room">👥 Staff Room</option>
            <option value="office">💼 Office</option>
            <option value="auditorium">🎭 Auditorium</option>
            <option value="meeting_room">🤝 Meeting Room</option>
            <option value="store_room">📦 Store Room</option>
            <option value="other">🏷️ Other</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-bold text-slate-600 mb-1">Department</label>
          <select
            value={form.department_id}
            onChange={e => upd('department_id', e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
          >
            <option value="">-- No Department Assigned --</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name} {d.code ? `(${d.code})` : ''}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-bold text-slate-600 mb-1">Home Classroom Mapping (Optional)</label>
          <select
            value={form.primary_class_id}
            onChange={e => upd('primary_class_id', e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
          >
            <option value="">-- No Home Class (Floating / Shared Room) --</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>
                🎓 {c.name} {c.section ? `(${c.section})` : ''} {c.department_name ? `- ${c.department_name}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Capacity (Seats)</label>
          <input
            type="number"
            min={1}
            value={form.capacity}
            onChange={e => upd('capacity', e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Room Name (Optional)</label>
          <input
            value={form.room_name}
            onChange={e => upd('room_name', e.target.value)}
            placeholder="e.g. CAD Lab, Turing Hall"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
          />
        </div>
      </div>

      <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_exam_eligible}
            onChange={e => upd('is_exam_eligible', e.target.checked)}
            className="w-4 h-4 text-purple-600 rounded"
          />
          <span className="text-xs font-bold text-purple-900">📝 Eligible as Examination Hall</span>
        </label>
        {form.is_exam_eligible && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="block text-[10px] font-bold text-purple-800 mb-0.5">Exam Capacity</label>
              <input
                type="number"
                value={form.exam_capacity}
                onChange={e => upd('exam_capacity', e.target.value)}
                placeholder={`${Math.floor(form.capacity / 2)} (alternate seating)`}
                className="w-full border border-purple-200 rounded-lg px-2 py-1 text-xs bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-purple-800 mb-0.5">Invigilators</label>
              <input
                type="number"
                min={1}
                value={form.required_invigilators}
                onChange={e => upd('required_invigilators', e.target.value)}
                className="w-full border border-purple-200 rounded-lg px-2 py-1 text-xs bg-white"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !form.room_number}
          className="flex-[2] py-2.5 rounded-xl bg-primary-600 text-white font-bold text-sm disabled:opacity-50 hover:bg-primary-700 transition-all flex items-center justify-center gap-2"
        >
          {saving ? <><Spinner size="sm" /> Saving...</> : '💾 Save Room'}
        </button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tree Node components
// ─────────────────────────────────────────────────────────────────────────────
function RoomCard({ room, departments = [], classes = [], onEdit, onRefresh, readOnly }) {
  const [updating, setUpdating] = useState(false)
  const [updatingField, setUpdatingField] = useState(null)
  const [localDeptId, setLocalDeptId] = useState(room.department_id ? String(room.department_id) : '')
  const [localClassId, setLocalClassId] = useState(room.primary_class_id ? String(room.primary_class_id) : '')

  useEffect(() => {
    setLocalDeptId(room.department_id ? String(room.department_id) : '')
    setLocalClassId(room.primary_class_id ? String(room.primary_class_id) : '')
  }, [room.department_id, room.primary_class_id])

  const deptMap = useMemo(() => {
    const m = {}
    departments.forEach(d => { m[d.id] = d.name })
    return m
  }, [departments])

  const { roomDeptClasses, otherClasses } = useMemo(() => {
    const currentDeptNum = localDeptId ? Number(localDeptId) : null
    if (!currentDeptNum) {
      return { roomDeptClasses: [], otherClasses: classes }
    }
    const forDept = []
    const others = []
    classes.forEach(c => {
      if (c.department_id === currentDeptNum) {
        forDept.push(c)
      } else {
        others.push(c)
      }
    })
    return { roomDeptClasses: forDept, otherClasses: others }
  }, [classes, localDeptId])

  const handleTypeChange = async (e) => {
    const newType = e.target.value
    if (newType === room.room_type) return
    setUpdating(true)
    setUpdatingField('type')
    try {
      await roomsApi.update(room.id, { room_type: newType })
      onRefresh?.()
    } catch (err) {
      alert(formatError(err, 'Failed to update room type'))
    } finally {
      setUpdating(false)
      setUpdatingField(null)
    }
  }

  const handleDeptChange = async (e) => {
    const val = e.target.value
    const newDeptId = val ? Number(val) : null
    if (newDeptId === (room.department_id || null)) return
    setLocalDeptId(val)
    setUpdating(true)
    setUpdatingField('dept')
    try {
      await roomsApi.update(room.id, { department_id: newDeptId })
      onRefresh?.()
    } catch (err) {
      setLocalDeptId(room.department_id ? String(room.department_id) : '')
      alert(formatError(err, 'Failed to update room department'))
    } finally {
      setUpdating(false)
      setUpdatingField(null)
    }
  }

  const handleClassChange = async (e) => {
    const val = e.target.value
    const newClassId = val ? Number(val) : null
    if (newClassId === (room.primary_class_id || null)) return
    setLocalClassId(val)
    setUpdating(true)
    setUpdatingField('class')
    try {
      const payload = { primary_class_id: newClassId }
      if (newClassId) {
        const cls = classes.find(c => c.id === newClassId)
        if (cls?.department_id && !room.department_id) {
          payload.department_id = cls.department_id
          setLocalDeptId(String(cls.department_id))
        }
      }
      await roomsApi.update(room.id, payload)
      onRefresh?.()
    } catch (err) {
      setLocalClassId(room.primary_class_id ? String(room.primary_class_id) : '')
      alert(formatError(err, 'Failed to assign class to room'))
    } finally {
      setUpdating(false)
      setUpdatingField(null)
    }
  }

  const handleToggleExam = async () => {
    if (readOnly) return
    setUpdating(true)
    setUpdatingField('exam')
    try {
      await roomsApi.update(room.id, { is_exam_eligible: !room.is_exam_eligible })
      onRefresh?.()
    } catch (err) {
      alert(formatError(err, 'Failed to toggle exam hall status'))
    } finally {
      setUpdating(false)
      setUpdatingField(null)
    }
  }

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all space-y-3 relative group">
      {/* Top Header: Dedicated Unclipped Room Number & Type Selector */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 shrink-0 min-w-0">
          <div className="px-2.5 py-1 rounded-xl bg-slate-900 text-white font-mono font-black text-sm tracking-wider shadow-sm flex items-center gap-1.5 shrink-0 select-all border border-slate-800">
            <span className="text-xs">🚪</span>
            <span className="shrink-0">{room.room_number}</span>
          </div>
          {room.name && room.name !== room.room_number && (
            <span className="text-slate-400 font-semibold text-xs truncate max-w-[80px]" title={room.name}>
              {room.name}
            </span>
          )}
        </div>

        {!readOnly ? (
          <select
            value={room.room_type || 'classroom'}
            onChange={handleTypeChange}
            disabled={updating}
            title="Change room type"
            className="text-[11px] font-bold py-1 px-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-700 shrink-0"
          >
            <option value="classroom">🚪 Class</option>
            <option value="laboratory">🧪 Lab</option>
            <option value="seminar_hall">🏛️ Seminar</option>
            <option value="examination_hall">📝 Exam Hall</option>
            <option value="staff_room">👥 Staff</option>
            <option value="office">💼 Office</option>
            <option value="auditorium">🎭 Audit.</option>
            <option value="meeting_room">🤝 Meeting</option>
            <option value="store_room">📦 Store</option>
            <option value="other">🏷️ Other</option>
          </select>
        ) : (
          <RoomTypeBadge type={room.room_type} />
        )}
      </div>

      {/* Middle 1: Inline Department Selector (1-Click) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          <span>🏢 Department</span>
          {updatingField === 'dept' && <span className="text-indigo-600 font-semibold animate-pulse">Saving...</span>}
        </div>
        {!readOnly ? (
          <select
            value={localDeptId}
            onChange={handleDeptChange}
            disabled={updating}
            title="Assign department to this room (can differ across rooms on the same wing or floor)"
            className={`w-full text-xs font-bold py-1.5 px-2 rounded-xl border transition-all cursor-pointer truncate ${
              localDeptId
                ? 'bg-slate-50 hover:bg-white text-slate-800 border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                : 'bg-amber-50/70 hover:bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            <option value="">-- No Dept (Unassigned) --</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>
                {d.name} {d.code ? `(${d.code})` : ''}
              </option>
            ))}
          </select>
        ) : (
          <div className="text-xs font-bold text-slate-700 truncate py-1">
            {room.department_name ? `🏢 ${room.department_name}` : <span className="text-slate-400 italic font-normal">No Dept Assigned</span>}
          </div>
        )}
      </div>

      {/* Middle 2: Inline Class Selector (1-Click) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          <span>🎓 Home Class</span>
          {updatingField === 'class' && <span className="text-indigo-600 font-semibold animate-pulse">Saving...</span>}
        </div>
        {!readOnly ? (
          <select
            value={localClassId}
            onChange={handleClassChange}
            disabled={updating}
            title="Assign class to this room (classes can belong to different departments on the same floor)"
            className={`w-full text-xs font-semibold py-1.5 px-2 rounded-xl border transition-all cursor-pointer truncate ${
              localClassId
                ? 'bg-indigo-50/70 hover:bg-indigo-50 text-indigo-900 border-indigo-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                : 'bg-slate-50 hover:bg-white text-slate-600 border-slate-200'
            }`}
          >
            <option value="">-- No Class (Floating / Shared) --</option>
            {roomDeptClasses.length > 0 && (
              <optgroup label={`⭐ ${departments.find(d => String(d.id) === String(localDeptId))?.name || 'Department'} Classes`}>
                {roomDeptClasses.map(c => (
                  <option key={c.id} value={c.id}>
                    🎓 {c.name} {c.section ? `(${c.section})` : ''} {c.semester ? `· Sem ${c.semester}` : ''}
                  </option>
                ))}
              </optgroup>
            )}
            {otherClasses.length > 0 && (
              <optgroup label={roomDeptClasses.length > 0 ? "🌐 Other Department Classes" : "All College Classes"}>
                {otherClasses.map(c => (
                  <option key={c.id} value={c.id}>
                    🎓 {c.name} {c.section ? `(${c.section})` : ''} {c.department_id && deptMap[c.department_id] ? `(${deptMap[c.department_id]})` : ''}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        ) : (
          <div className="text-xs font-bold text-indigo-700 truncate py-1">
            {room.primary_class_name ? `🎓 ${room.primary_class_name}` : <span className="text-slate-400 italic font-normal">No Class</span>}
          </div>
        )}
      </div>

      {/* Bottom Bar: Exam Hall Toggle, Capacity, & Edit */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-xs">
        <div className="flex items-center gap-1.5">
          {!readOnly ? (
            <button
              onClick={handleToggleExam}
              disabled={updating}
              title="Click to toggle Exam Hall status"
              className={`text-[10px] px-2 py-0.5 rounded-lg font-bold transition-all border ${
                room.is_exam_eligible
                  ? 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200'
                  : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'
              }`}
            >
              {room.is_exam_eligible ? '✓ Exam Hall' : '+ Exam'}
            </button>
          ) : room.is_exam_eligible ? (
            <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-md font-bold">
              📝 Exam
            </span>
          ) : null}

          {room.capacity ? (
            <span className="text-[10px] font-semibold text-slate-500">{room.capacity} seats</span>
          ) : null}
        </div>

        {!readOnly && (
          <button
            onClick={() => onEdit?.(room)}
            title="Advanced room settings (custom name, exam capacity, invigilators)"
            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all text-xs"
          >
            ✏️
          </button>
        )}
      </div>
    </div>
  )
}

function RoomRow({ room, departments = [], classes = [], onEdit, onRefresh, readOnly }) {
  const [updating, setUpdating] = useState(false)
  const [updatingField, setUpdatingField] = useState(null)
  const [localDeptId, setLocalDeptId] = useState(room.department_id ? String(room.department_id) : '')
  const [localClassId, setLocalClassId] = useState(room.primary_class_id ? String(room.primary_class_id) : '')

  useEffect(() => {
    setLocalDeptId(room.department_id ? String(room.department_id) : '')
    setLocalClassId(room.primary_class_id ? String(room.primary_class_id) : '')
  }, [room.department_id, room.primary_class_id])

  const deptMap = useMemo(() => {
    const m = {}
    departments.forEach(d => { m[d.id] = d.name })
    return m
  }, [departments])

  const { roomDeptClasses, otherClasses } = useMemo(() => {
    const currentDeptNum = localDeptId ? Number(localDeptId) : null
    if (!currentDeptNum) {
      return { roomDeptClasses: [], otherClasses: classes }
    }
    const forDept = []
    const others = []
    classes.forEach(c => {
      if (c.department_id === currentDeptNum) {
        forDept.push(c)
      } else {
        others.push(c)
      }
    })
    return { roomDeptClasses: forDept, otherClasses: others }
  }, [classes, localDeptId])

  const handleTypeChange = async (e) => {
    const newType = e.target.value
    if (newType === room.room_type) return
    setUpdating(true)
    setUpdatingField('type')
    try {
      await roomsApi.update(room.id, { room_type: newType })
      onRefresh?.()
    } catch (err) {
      alert(formatError(err, 'Failed to update room type'))
    } finally {
      setUpdating(false)
      setUpdatingField(null)
    }
  }

  const handleDeptChange = async (e) => {
    const val = e.target.value
    const newDeptId = val ? Number(val) : null
    if (newDeptId === (room.department_id || null)) return
    setLocalDeptId(val)
    setUpdating(true)
    setUpdatingField('dept')
    try {
      await roomsApi.update(room.id, { department_id: newDeptId })
      onRefresh?.()
    } catch (err) {
      setLocalDeptId(room.department_id ? String(room.department_id) : '')
      alert(formatError(err, 'Failed to update room department'))
    } finally {
      setUpdating(false)
      setUpdatingField(null)
    }
  }

  const handleClassChange = async (e) => {
    const val = e.target.value
    const newClassId = val ? Number(val) : null
    if (newClassId === (room.primary_class_id || null)) return
    setLocalClassId(val)
    setUpdating(true)
    setUpdatingField('class')
    try {
      const payload = { primary_class_id: newClassId }
      if (newClassId) {
        const cls = classes.find(c => c.id === newClassId)
        if (cls?.department_id && !room.department_id) {
          payload.department_id = cls.department_id
          setLocalDeptId(String(cls.department_id))
        }
      }
      await roomsApi.update(room.id, payload)
      onRefresh?.()
    } catch (err) {
      setLocalClassId(room.primary_class_id ? String(room.primary_class_id) : '')
      alert(formatError(err, 'Failed to assign class to room'))
    } finally {
      setUpdating(false)
      setUpdatingField(null)
    }
  }

  const handleToggleExam = async () => {
    if (readOnly) return
    setUpdating(true)
    setUpdatingField('exam')
    try {
      await roomsApi.update(room.id, { is_exam_eligible: !room.is_exam_eligible })
      onRefresh?.()
    } catch (err) {
      alert(formatError(err, 'Failed to toggle exam hall status'))
    } finally {
      setUpdating(false)
      setUpdatingField(null)
    }
  }

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 hover:bg-white transition-all flex-wrap md:flex-nowrap group shadow-xs">
      {/* Dedicated Unclipped Room Number Badge */}
      <div className="px-2.5 py-1 rounded-xl bg-slate-900 text-white font-mono font-black text-xs tracking-wider shrink-0 select-all border border-slate-800 flex items-center gap-1.5 shadow-xs">
        <span className="text-[11px]">🚪</span>
        <span className="shrink-0">{room.room_number}</span>
      </div>

      {room.name && room.name !== room.room_number && (
        <span className="text-slate-400 text-xs truncate max-w-[100px] shrink-0" title={room.name}>
          {room.name}
        </span>
      )}

      {/* Room Type Selector */}
      {!readOnly ? (
        <select
          value={room.room_type || 'classroom'}
          onChange={handleTypeChange}
          disabled={updating}
          title="Change room type"
          className="text-[11px] font-bold py-1 px-2 rounded-xl border border-slate-200 bg-white hover:border-indigo-400 focus:outline-none focus:border-indigo-500 cursor-pointer text-slate-700 shrink-0"
        >
          <option value="classroom">🚪 Class</option>
          <option value="laboratory">🧪 Lab</option>
          <option value="seminar_hall">🏛️ Seminar</option>
          <option value="examination_hall">📝 Exam Hall</option>
          <option value="staff_room">👥 Staff</option>
          <option value="office">💼 Office</option>
          <option value="auditorium">🎭 Audit.</option>
          <option value="meeting_room">🤝 Meeting</option>
          <option value="store_room">📦 Store</option>
          <option value="other">🏷️ Other</option>
        </select>
      ) : (
        <RoomTypeBadge type={room.room_type} />
      )}

      {/* Inline 1-Click Department Selector */}
      <div className="flex-1 min-w-[140px] max-w-[220px]">
        {!readOnly ? (
          <select
            value={localDeptId}
            onChange={handleDeptChange}
            disabled={updating}
            title="Assign department to this room (can differ across rooms on the same floor)"
            className={`w-full text-xs font-bold py-1 px-2 rounded-xl border transition-all cursor-pointer truncate ${
              localDeptId
                ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 focus:border-indigo-500'
                : 'bg-amber-50/70 hover:bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            <option value="">-- No Dept (Unassigned) --</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>
                🏢 {d.name} {d.code ? `(${d.code})` : ''}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs font-bold text-slate-700 truncate" title={room.department_name}>
            {room.department_name ? `🏢 ${room.department_name}` : <span className="text-slate-400 italic font-normal">No Dept</span>}
          </span>
        )}
      </div>

      {/* Inline 1-Click Class Selector */}
      <div className="flex-1 min-w-[140px] max-w-[220px]">
        {!readOnly ? (
          <select
            value={localClassId}
            onChange={handleClassChange}
            disabled={updating}
            title="Assign class to this room (classes can belong to different departments)"
            className={`w-full text-xs font-semibold py-1 px-2 rounded-xl border transition-all cursor-pointer truncate ${
              localClassId
                ? 'bg-indigo-50/70 hover:bg-indigo-50 text-indigo-900 border-indigo-200 focus:border-indigo-500'
                : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
            }`}
          >
            <option value="">-- No Class (Floating) --</option>
            {roomDeptClasses.length > 0 && (
              <optgroup label={`⭐ ${departments.find(d => String(d.id) === String(localDeptId))?.name || 'Department'} Classes`}>
                {roomDeptClasses.map(c => (
                  <option key={c.id} value={c.id}>
                    🎓 {c.name} {c.section ? `(${c.section})` : ''} {c.semester ? `· Sem ${c.semester}` : ''}
                  </option>
                ))}
              </optgroup>
            )}
            {otherClasses.length > 0 && (
              <optgroup label={roomDeptClasses.length > 0 ? "🌐 Other Department Classes" : "All College Classes"}>
                {otherClasses.map(c => (
                  <option key={c.id} value={c.id}>
                    🎓 {c.name} {c.section ? `(${c.section})` : ''} {c.department_id && deptMap[c.department_id] ? `(${deptMap[c.department_id]})` : ''}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        ) : (
          <span className="text-xs font-bold text-indigo-700 truncate" title={room.primary_class_name}>
            {room.primary_class_name ? `🎓 ${room.primary_class_name}` : <span className="text-slate-400 italic font-normal">No Class</span>}
          </span>
        )}
      </div>

      {/* Exam Hall Toggle */}
      {!readOnly ? (
        <button
          onClick={handleToggleExam}
          disabled={updating}
          title="Click to toggle Exam Hall eligibility"
          className={`text-[10px] px-2 py-1 rounded-lg font-bold transition-all border shrink-0 ${
            room.is_exam_eligible
              ? 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200'
              : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'
          }`}
        >
          {room.is_exam_eligible ? '✓ Exam' : '+ Exam'}
        </button>
      ) : room.is_exam_eligible ? (
        <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-md font-bold shrink-0">
          📝 Exam
        </span>
      ) : null}

      {room.capacity ? (
        <span className="text-[11px] text-slate-500 font-semibold shrink-0 ml-auto">{room.capacity} seats</span>
      ) : null}

      {!readOnly && (
        <button
          onClick={() => onEdit?.(room)}
          title="Advanced room settings"
          className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all text-xs shrink-0 cursor-pointer ml-1"
        >
          ✏️
        </button>
      )}
    </div>
  )
}

function FloorNode({ floor, departments = [], classes = [], onBulkAssignDept, onEditRoom, onRefresh, readOnly }) {
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
            title="Bulk assign department or split rooms on this floor"
            className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition-all"
          >
            + Dept
          </button>
        )}
      </div>
      {open && rooms.length > 0 && (
        <div className="space-y-1 pb-2">
          {rooms.map(r => (
            <RoomRow
              key={r.id}
              room={r}
              departments={departments}
              classes={classes}
              onEdit={onEditRoom}
              onRefresh={onRefresh}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
      {open && rooms.length === 0 && (
        <p className="text-xs text-slate-400 pl-6 py-1 italic">No rooms yet</p>
      )}
    </div>
  )
}

function BlockNode({
  block,
  departments = [],
  classes = [],
  onEdit,
  onDelete,
  onDuplicate,
  onAddFloor,
  onGenerateRooms,
  onBulkAssignDept,
  onEditRoom,
  onRefresh,
  onConfigureDuties,
  canManageDuties,
  readOnly,
  searchQuery = '',
  typeFilter = 'all'
}) {
  const [selectedFloorId, setSelectedFloorId] = useState('all') // 'all' | floor.id
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'list'
  const floors = block.floors || []
  const totalRooms = floors.reduce((acc, f) => acc + (f.rooms?.length || 0), 0)

  // Filter rooms based on search and type
  const filterRoom = (r) => {
    if (typeFilter === 'exam' && !r.is_exam_eligible) return false
    if (typeFilter === 'lab' && !['laboratory', 'lab'].includes(r.room_type)) return false
    if (typeFilter === 'classroom' && r.room_type !== 'classroom') return false
    if (typeFilter === 'seminar' && !['seminar_hall', 'seminar_room', 'auditorium'].includes(r.room_type)) return false
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const matchNum = (r.room_number || '').toLowerCase().includes(q)
      const matchName = (r.name || '').toLowerCase().includes(q)
      const matchDept = (r.department_name || '').toLowerCase().includes(q)
      const matchClass = (r.primary_class_name || '').toLowerCase().includes(q)
      const matchType = (r.room_type || '').toLowerCase().includes(q)
      if (!matchNum && !matchName && !matchDept && !matchClass && !matchType) return false
    }
    return true
  }

  // Floors with filtered rooms
  const floorsWithFilteredRooms = useMemo(() => {
    return floors.map(f => ({
      ...f,
      filteredRooms: (f.rooms || []).filter(filterRoom)
    }))
  }, [floors, searchQuery, typeFilter])

  const totalFilteredRooms = floorsWithFilteredRooms.reduce((acc, f) => acc + f.filteredRooms.length, 0)

  // Displayed floors
  const displayedFloors = selectedFloorId === 'all'
    ? floorsWithFilteredRooms.filter(f => f.filteredRooms.length > 0 || !searchQuery)
    : floorsWithFilteredRooms.filter(f => f.id === selectedFloorId)

  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all mb-5">
      {/* ── Block Executive Header ── */}
      <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-base font-black shrink-0 shadow-lg border border-white/20"
            style={{ background: block.color_hex || '#4F46E5' }}
          >
            {(block.prefix || block.name || 'B').charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-black tracking-tight text-white">{block.name}</h2>
              {block.prefix && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white/10 text-indigo-200 border border-white/10">
                  Prefix: {block.prefix}
                </span>
              )}
              {canManageDuties && onConfigureDuties && (
                <button
                  onClick={() => onConfigureDuties(block)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all flex items-center gap-1"
                  title="Configure & auto-assign block discipline duties"
                >
                  <span>🛡️</span> Discipline Zone
                </button>
              )}
            </div>

            <p className="text-slate-400 text-xs mt-0.5">
              {floors.length} Floors · {totalRooms} Total Rooms
              {searchQuery || typeFilter !== 'all' ? ` (${totalFilteredRooms} matching filter)` : ''}
            </p>

            {/* Associated Departments in Block */}
            {block.associated_departments && block.associated_departments.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">🏢 Departments:</span>
                {block.associated_departments.map(d => (
                  <span key={d.id} className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-400/25">
                    {d.name} {d.code ? `(${d.code})` : ''} · {d.room_count} rm{d.room_count !== 1 ? 's' : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Hub on Block Header */}
        {!readOnly && (
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            {canManageDuties && onConfigureDuties && (
              <button
                onClick={() => onConfigureDuties(block)}
                title="Configure discipline & wing duties and auto-assign block teachers"
                className="px-3 py-1.5 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all shadow-sm flex items-center gap-1 active:scale-95"
              >
                <span>🛡️</span> Block Duties
              </button>
            )}

            <button
              onClick={() => onGenerateRooms(block)}
              title="Bulk pattern generator for rooms in this block"
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm flex items-center gap-1 active:scale-95"
            >
              <span>⚡</span> Generate Rooms
            </button>

            <button
              onClick={() => onBulkAssignDept(block)}
              title="Bulk allocate departments to rooms on this block"
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all flex items-center gap-1 active:scale-95"
            >
              <span>🏢</span> Allocate Depts
            </button>

            <button
              onClick={() => onAddFloor(block)}
              title="Add a new floor to this block"
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all flex items-center gap-1 active:scale-95"
            >
              <span>+</span> Floor
            </button>

            <div className="flex items-center gap-1 ml-1 pl-1 border-l border-white/15">
              <button
                onClick={() => onEdit(block)}
                title="Edit block properties"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-all"
              >
                ✏️
              </button>
              <button
                onClick={() => onDuplicate(block)}
                title="Duplicate block"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-all"
              >
                📋
              </button>
              <button
                onClick={() => onDelete(block)}
                title="Delete block and rooms"
                className="p-1.5 rounded-lg text-rose-300 hover:text-rose-100 hover:bg-rose-500/20 transition-all"
              >
                🗑️
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── INTERACTIVE FLOOR SELECTOR STRIP & CONTROLS ── */}
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Floors:</span>
          <button
            onClick={() => setSelectedFloorId('all')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              selectedFloorId === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            All Floors ({totalRooms})
          </button>

          {floors.map(f => {
            const isSelected = selectedFloorId === f.id
            const roomCount = f.rooms?.length || 0
            return (
              <button
                key={f.id}
                onClick={() => setSelectedFloorId(f.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>{f.floor_name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-slate-500'
                }`}>
                  {roomCount}
                </span>
              </button>
            )
          })}
        </div>

        {/* View mode toggle: Grid vs List */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-0.5 shadow-sm">
          <button
            onClick={() => setViewMode('grid')}
            title="Grid Card View"
            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              viewMode === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>⊞</span> Grid
          </button>
          <button
            onClick={() => setViewMode('list')}
            title="Dense List View"
            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>☰</span> List
          </button>
        </div>
      </div>

      {/* ── ROOMS CONTENT ── */}
      <div className="p-5 space-y-6">
        {displayedFloors.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs italic">
            {searchQuery ? `No rooms match "${searchQuery}" in this block.` : 'No floors or rooms in this block yet. Click "+ Floor" or "⚡ Generate Rooms" above.'}
          </div>
        ) : (
          displayedFloors.map(floor => {
            const rooms = floor.filteredRooms || []
            const floorDeptCounts = {}
            ;(floor.rooms || []).forEach(r => {
              const dName = r.department_name || 'Unassigned'
              floorDeptCounts[dName] = (floorDeptCounts[dName] || 0) + 1
            })

            return (
              <div key={floor.id} className="space-y-3">
                {/* Floor Sub-Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 flex-wrap gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base">🏬</span>
                    <h3 className="font-extrabold text-sm text-slate-800">{floor.floor_name}</h3>
                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
                      {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}
                    </span>
                    <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      🏢 Wing Duty Supervision Floor
                    </span>

                    {/* Department Allocation Breakdown Pills */}
                    <div className="flex items-center gap-1.5 flex-wrap ml-1">
                      {Object.entries(floorDeptCounts).map(([name, count]) => (
                        <span
                          key={name}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                            name === 'Unassigned'
                              ? 'bg-amber-50 text-amber-800 border-amber-200/80'
                              : 'bg-indigo-50 text-indigo-800 border-indigo-200/80'
                          }`}
                        >
                          {name === 'Unassigned' ? '⚠️' : '🏢'} {name}: {count}
                        </span>
                      ))}
                    </div>
                  </div>

                  {!readOnly && (
                    <button
                      onClick={() => onBulkAssignDept(floor)}
                      title={`Assign department or split wings/rooms on ${floor.floor_name}`}
                      className="text-[11px] font-black text-indigo-700 hover:text-indigo-900 bg-indigo-50/80 hover:bg-indigo-100 px-3 py-1.5 rounded-xl border border-indigo-200/90 transition-all flex items-center gap-1.5 shadow-xs active:scale-95 shrink-0"
                    >
                      <span>🏢</span> + Assign Dept / Split Floor
                    </button>
                  )}
                </div>

                {/* Rooms Grid or List */}
                {rooms.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2 pl-4">No rooms on this floor matching criteria.</p>
                ) : viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {rooms.map(r => (
                      <RoomCard
                        key={r.id}
                        room={r}
                        departments={departments}
                        classes={classes}
                        onEdit={onEditRoom}
                        onRefresh={onRefresh}
                        readOnly={readOnly}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {rooms.map(r => (
                      <RoomRow
                        key={r.id}
                        room={r}
                        departments={departments}
                        classes={classes}
                        onEdit={onEditRoom}
                        onRefresh={onRefresh}
                        readOnly={readOnly}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
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
    room_number_pattern: '{block_prefix}{floor_code}{number:02d}',
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
    { label: 'A-001, A-002… / A-101, A-102… (Block Prefix + Floor + 2-Digit, Recommended)', value: '{block_prefix}{floor_code}{number:02d}' },
    { label: 'Block-A-101 … (Prefix with dash)', value: '{block_prefix}-{floor_code}-{n}' },
    { label: '001, 002… / 101, 102… (Standard 3-Digit, Single-Block)', value: '{floor_code}{number:02d}' },
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
        const sanitizedOverrides = {}
        for (const [k, v] of Object.entries(overrides)) {
          let clean = v
          if (clean === 'seminar_room' || clean === 'seminar') clean = 'seminar_hall'
          if (clean === 'lecture_hall' || clean === 'lecture') clean = 'classroom'
          sanitizedOverrides[k] = clean
        }
        let cleanBaseType = form.room_type || 'classroom'
        if (cleanBaseType === 'seminar_room' || cleanBaseType === 'seminar') cleanBaseType = 'seminar_hall'
        if (cleanBaseType === 'lecture_hall' || cleanBaseType === 'lecture') cleanBaseType = 'classroom'

        floorConfigs.push({
          floor_number: f,
          floor_name: floorName,
          room_count: roomsPerFloor,
          start_num: startNum,
          pattern: pattern,
          room_type: cleanBaseType,
          capacity: capacity,
          room_type_overrides: Object.keys(sanitizedOverrides).length > 0 ? sanitizedOverrides : undefined,
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
                <option value="seminar_hall">Seminar Hall</option>
                <option value="examination_hall">Examination Hall</option>
                <option value="staff_room">Staff Room</option>
                <option value="office">Office</option>
                <option value="auditorium">Auditorium</option>
                <option value="meeting_room">Meeting Room</option>
                <option value="store_room">Store Room</option>
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

          {/* Interactive Live Mixed Room Types Matrix (In-Place, Zero Navigation) */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span>🧪 Live Floor & Room Layout</span>
                  <span className="text-[10px] font-normal text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-200">Click any room to cycle its type</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Rooms on the same floor don't have to be identical. Click any room chip below to customize it into a <strong>Lab</strong> or <strong>Seminar Hall</strong> directly right now:
                </p>
              </div>
              <div className="flex items-center gap-1 text-[10px] flex-wrap">
                <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">🚪 Class</span>
                <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-semibold">🧪 Lab</span>
                <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 font-semibold">🏛️ Seminar</span>
                <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-semibold">📝 Exam</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">💼 Office</span>
              </div>
            </div>

            {/* Live interactive rooms by floor */}
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {Array.from({ length: Math.max(1, parseInt(form.num_floors) || 1) }).map((_, f) => {
                const floorName = f === 0 ? 'Ground Floor' : (f === 1 ? 'First Floor' : (f === 2 ? 'Second Floor' : (f === 3 ? 'Third Floor' : `Floor ${f}`)))
                const floorRoomsCount = Math.min(40, Math.max(1, parseInt(form.rooms_per_floor) || 10))
                const startNum = parseInt(form.start_number) || 1
                const pattern = form.room_number_pattern || '{floor_code}{number:02d}'
                const blockCode = (form.block_prefix || form.block_name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4) || 'BLK').toUpperCase()

                return (
                  <div key={f} className="bg-white rounded-xl p-2.5 border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <span>🏢 {floorName}</span>
                        <span className="text-[10px] font-normal text-slate-400">({floorRoomsCount} rooms)</span>
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const targetIdx = Math.min(3, floorRoomsCount)
                            const curNum = startNum + targetIdx - 1
                            const roomNo = formatRoomNumber(pattern, curNum, f, blockCode)
                            setMixedRoomsConfig(prev => ({
                              ...prev,
                              [f]: { ...(prev[f] || {}), [roomNo]: 'laboratory', [String(curNum)]: 'laboratory' }
                            }))
                          }}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 font-medium"
                        >
                          + Lab
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const targetIdx = Math.min(4, floorRoomsCount)
                            const curNum = startNum + targetIdx - 1
                            const roomNo = formatRoomNumber(pattern, curNum, f, blockCode)
                            setMixedRoomsConfig(prev => ({
                              ...prev,
                              [f]: { ...(prev[f] || {}), [roomNo]: 'seminar_hall', [String(curNum)]: 'seminar_hall' }
                            }))
                          }}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 font-medium"
                        >
                          + Seminar
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: floorRoomsCount }).map((_, rIdx) => {
                        const curNum = startNum + rIdx
                        const roomNo = formatRoomNumber(pattern, curNum, f, blockCode)
                        const currentType = (mixedRoomsConfig[f]?.[roomNo] || mixedRoomsConfig[f]?.[String(curNum)]) || form.room_type || 'classroom'

                        const typeStyles = {
                          classroom: 'bg-blue-50 border-blue-200 text-blue-700 hover:border-blue-400',
                          laboratory: 'bg-violet-100 border-violet-300 text-violet-800 font-bold hover:border-violet-500 shadow-xs',
                          lab: 'bg-violet-100 border-violet-300 text-violet-800 font-bold hover:border-violet-500 shadow-xs',
                          seminar_hall: 'bg-teal-100 border-teal-300 text-teal-800 font-bold hover:border-teal-500 shadow-xs',
                          seminar_room: 'bg-teal-100 border-teal-300 text-teal-800 font-bold hover:border-teal-500 shadow-xs',
                          examination_hall: 'bg-rose-100 border-rose-300 text-rose-800 font-bold hover:border-rose-500',
                          office: 'bg-emerald-100 border-emerald-300 text-emerald-800 font-bold hover:border-emerald-500',
                          staff_room: 'bg-slate-100 border-slate-300 text-slate-700 hover:border-slate-500',
                          auditorium: 'bg-purple-100 border-purple-300 text-purple-800 font-bold hover:border-purple-500',
                        }
                        const typeIcons = {
                          classroom: '🚪',
                          laboratory: '🧪',
                          lab: '🧪',
                          seminar_hall: '🏛️',
                          seminar_room: '🏛️',
                          examination_hall: '📝',
                          office: '💼',
                          staff_room: '👥',
                          auditorium: '🎭',
                        }

                        return (
                          <button
                            key={curNum}
                            type="button"
                            onClick={() => {
                              const types = ['classroom', 'laboratory', 'seminar_hall', 'examination_hall', 'office', 'staff_room']
                              const nextIdx = (types.indexOf(currentType) + 1) % types.length
                              const nextType = types[nextIdx]
                              setMixedRoomsConfig(prev => {
                                const fObj = { ...(prev[f] || {}) }
                                fObj[roomNo] = nextType
                                fObj[String(curNum)] = nextType
                                return { ...prev, [f]: fObj }
                              })
                            }}
                            title={`Click to cycle type: ${roomNo} (${currentType})`}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs border transition-all cursor-pointer select-none ${typeStyles[currentType] || typeStyles.classroom}`}
                          >
                            <span className="font-mono font-bold">{roomNo}</span>
                            <span className="text-[11px]">{typeIcons[currentType] || '🚪'}</span>
                            <span className="text-[9px] uppercase tracking-tighter opacity-85">
                              {currentType === 'laboratory' || currentType === 'lab' ? 'Lab' : currentType === 'seminar_hall' || currentType === 'seminar_room' ? 'Seminar' : currentType === 'examination_hall' ? 'Exam' : currentType === 'classroom' ? 'Class' : currentType}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1">
            <p className="font-bold text-slate-700 mb-1">📋 Summary</p>
            <p>Block: <span className="font-bold text-slate-800">{form.block_name}</span></p>
            <p>{form.num_floors} floor{form.num_floors>1?'s':''} × {form.rooms_per_floor} rooms = <span className="font-black text-primary-600">{form.num_floors * form.rooms_per_floor} total rooms</span></p>
            <p>Default: {form.room_type.replace(/_/g,' ')} · Numbering: <strong>001-0{form.rooms_per_floor < 10 ? '0' : ''}{form.rooms_per_floor}</strong> (Ground), <strong>101-1{form.rooms_per_floor < 10 ? '0' : ''}{form.rooms_per_floor}</strong> (1st Floor)</p>
            {Object.keys(mixedRoomsConfig).length > 0 && (
              <p className="text-violet-700 font-semibold text-[11px] pt-1">
                🧪 Customized Mixed Types: {Object.entries(mixedRoomsConfig).flatMap(([_, rMap]) => Object.entries(rMap).filter(([k]) => isNaN(k)).map(([r, t]) => `${r} (${t})`)).join(', ') || 'Configured'}
              </p>
            )}
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

  const sanitizeType = (t) => {
    if (t === 'seminar_room' || t === 'seminar') return 'seminar_hall'
    if (t === 'lecture_hall' || t === 'lecture') return 'classroom'
    return t || 'classroom'
  }

  const sanitizeOverridesMap = (raw) => {
    const out = {}
    for (const [k, v] of Object.entries(raw || {})) {
      out[k] = sanitizeType(v)
    }
    return out
  }

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
        room_type: sanitizeType(form.room_type),
        capacity: parseInt(form.capacity) || 60,
        room_type_overrides: sanitizeOverridesMap(roomTypeOverrides),
      })
      setPreview(res.data)
    } catch (e) {
      setError(formatError(e, 'Preview failed'))
    } finally {
      setPreviewing(false)
    }
  }

  const handleToggleRoomType = (roomNumber, currentType) => {
    const types = ['classroom', 'laboratory', 'seminar_hall', 'examination_hall', 'office', 'staff_room']
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
        room_type: sanitizeType(form.room_type),
        capacity: parseInt(form.capacity) || 60,
        room_type_overrides: sanitizeOverridesMap(roomTypeOverrides),
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
                {['classroom', 'laboratory', 'seminar_hall', 'examination_hall', 'staff_room', 'office', 'auditorium', 'meeting_room', 'store_room', 'other'].map(t => (
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
// Block Duty Configuration & Auto-Assignment Modal (Principal & System Admin)
// ─────────────────────────────────────────────────────────────────────────────
function BlockDutyConfigModal({ block, onClose, onSuccess }) {
  const [scope, setScope] = useState('SPECIFIC_DATE') // 'SPECIFIC_DATE' | 'NEXT_6_DAY_ORDERS'
  const [targetDate, setTargetDate] = useState(() => new Date().toISOString().split('T')[0])
  const [wingDutyEnabled, setWingDutyEnabled] = useState(true)
  const [teachersPerWing, setTeachersPerWing] = useState(1)
  const [disciplineDutyEnabled, setDisciplineDutyEnabled] = useState(true)
  const [teachersPerDiscipline, setTeachersPerDiscipline] = useState(2)
  const [enforceDeptOnly, setEnforceDeptOnly] = useState(true)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const depts = block?.associated_departments || []
  const floors = block?.floors || []

  const handleSaveAndAssign = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = {
        target_date: scope === 'SPECIFIC_DATE' ? targetDate : null,
        scope: scope,
        wing_duty_enabled: wingDutyEnabled,
        teachers_per_wing: Number(teachersPerWing),
        discipline_duty_enabled: disciplineDutyEnabled,
        teachers_per_discipline: Number(teachersPerDiscipline),
        enforce_block_department_only: enforceDeptOnly,
      }
      const res = await campusStructureApi.configureBlockDuties(block.id, payload)
      setResult(res.data)
      if (onSuccess) onSuccess()
    } catch (e) {
      setError(formatError(e, 'Failed to configure and assign block duties'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">{error}</div>}

      {/* Block Information & Respected Department Header */}
      <div className="p-3.5 bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl text-white shadow-sm border border-indigo-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-sm">
              {(block.prefix || block.code || block.name || 'B').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm tracking-tight">{block.name}</h3>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {block.code || block.prefix}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                {floors.length} Floor{floors.length !== 1 ? 's' : ''} · Wing & Discipline Duties
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Principal / SysAdmin Controls
          </span>
        </div>

        {/* Respected Departments */}
        <div className="mt-3 pt-2.5 border-t border-indigo-900/60">
          <div className="text-[10px] font-black uppercase tracking-wider text-indigo-300 mb-1">
            Respected Department(s) for this Block:
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {depts.length > 0 ? (
              depts.map(d => (
                <span key={d.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-indigo-500/30 text-indigo-100 border border-indigo-400/40">
                  🏢 {d.name} {d.code ? `(${d.code})` : ''} · {d.room_count} rooms
                </span>
              ))
            ) : block.department_name ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-indigo-500/30 text-indigo-100 border border-indigo-400/40">
                🏢 {block.department_name}
              </span>
            ) : (
              <span className="text-xs text-amber-300 italic font-medium">
                ⚠️ No specific department mapped to rooms yet (system-wide teachers will be evaluated)
              </span>
            )}
          </div>
        </div>
      </div>

      {result ? (
        /* Results View */
        <div className="space-y-4 py-1">
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-base shrink-0">
              ✓
            </div>
            <div>
              <h4 className="text-sm font-black text-emerald-950">Duties Successfully Configured & Assigned</h4>
              <p className="text-xs text-emerald-800 mt-0.5">{result.message}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <div className="text-[10px] uppercase font-bold text-slate-500">Configured Duties</div>
              <div className="text-xl font-black text-slate-900 mt-0.5">{result.total_duties_configured}</div>
            </div>
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-center">
              <div className="text-[10px] uppercase font-bold text-indigo-700">Assigned Staff</div>
              <div className="text-xl font-black text-indigo-800 mt-0.5">{result.total_teachers_assigned}</div>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
              <div className="text-[10px] uppercase font-bold text-amber-700">Unfilled Slots</div>
              <div className="text-xl font-black text-amber-800 mt-0.5">{result.unfilled_slots}</div>
            </div>
          </div>

          {result.assignments && result.assignments.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-700 mb-1.5">Assigned Respected Department Faculty:</p>
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="py-2 px-3">Duty Title</th>
                      <th className="py-2 px-3">Area / Floor</th>
                      <th className="py-2 px-3">Assigned Faculty</th>
                      <th className="py-2 px-3">Department</th>
                      <th className="py-2 px-3">Match Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.assignments.map((a, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-900">{a.duty_title}</td>
                        <td className="py-2 px-3 text-slate-600">{a.area_or_floor}</td>
                        <td className="py-2 px-3 font-bold text-indigo-700">{a.teacher_name}</td>
                        <td className="py-2 px-3">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {a.department_name}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-emerald-700 font-bold">{a.score} pts</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => setResult(null)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Configure Again
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              Done (Close)
            </button>
          </div>
        </div>
      ) : (
        /* Configuration Form */
        <div className="space-y-4">
          {/* Scope Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Schedule Scope</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope('SPECIFIC_DATE')}
                className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
                  scope === 'SPECIFIC_DATE'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div>📅 Specific Date</div>
                <div className="text-[10px] font-normal text-slate-500 mt-0.5">Assign duties for a single day</div>
              </button>
              <button
                type="button"
                onClick={() => setScope('NEXT_6_DAY_ORDERS')}
                className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
                  scope === 'NEXT_6_DAY_ORDERS'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div>🔄 Next 6 Day Orders</div>
                <div className="text-[10px] font-normal text-slate-500 mt-0.5">Full cycle rotation (Day 1 - 6)</div>
              </button>
            </div>
          </div>

          {scope === 'SPECIFIC_DATE' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Target Date</label>
              <input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className="w-full p-2.5 text-xs font-medium border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* Duty Types & Required Teachers */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="text-xs font-black uppercase tracking-wider text-slate-600">Duty Requirements</div>

            {/* Wing Duties */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wingDutyEnabled}
                    onChange={e => setWingDutyEnabled(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-800">Wing / Corridor Duties</span>
                </label>
                <span className="text-[10px] font-semibold text-slate-500">{floors.length} Floor(s) in Block</span>
              </div>

              {wingDutyEnabled && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="text-[11px] text-slate-600 font-medium">Teachers required per wing / floor:</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={teachersPerWing}
                      onChange={e => setTeachersPerWing(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 p-1.5 text-center text-xs font-bold border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-[10px] text-slate-500 font-bold">
                      (= {teachersPerWing * floors.length} total)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Discipline Duties */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={disciplineDutyEnabled}
                    onChange={e => setDisciplineDutyEnabled(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-800">Discipline Duties</span>
                </label>
                <span className="text-[10px] font-semibold text-slate-500">Break & Dispersal Intervals</span>
              </div>

              {disciplineDutyEnabled && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="text-[11px] text-slate-600 font-medium">Teachers required per interval duty:</div>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={teachersPerDiscipline}
                    onChange={e => setTeachersPerDiscipline(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 p-1.5 text-center text-xs font-bold border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* Enforce Department */}
            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enforceDeptOnly}
                  onChange={e => setEnforceDeptOnly(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-slate-700">
                  Strictly assign only teachers belonging to this block's respected department(s)
                </span>
              </label>
            </div>
          </div>

          {/* Preset Rules Box */}
          <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-indigo-900">
              ⚡ Preset Auto-Assignment Rules (Applied on Save):
            </div>
            <ul className="text-[11px] text-indigo-900 space-y-0.5 list-disc pl-4 font-medium">
              <li>Assigned to <span className="font-bold">respected block department teachers</span> with priority scoring.</li>
              <li>Requires verified <span className="font-bold">check-in attendance</span> (no checked-out staff).</li>
              <li>Prioritizes teachers with a <span className="font-bold">free period immediately before the break</span> (+15 bonus).</li>
              <li>Prevents overlapping timetable classes, substitutions, and concurrent duties.</li>
              <li>Maintains balanced weekly duty rotation across faculty members.</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || (!wingDutyEnabled && !disciplineDutyEnabled)}
              onClick={handleSaveAndAssign}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-200 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <><Spinner size="sm" /> Auto-Assigning...</> : 'Save & Auto-Assign Staff'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Block Create/Edit Modal
// ─────────────────────────────────────────────────────────────────────────────
const BLOCK_COLORS = ['#4F46E5','#0EA5E9','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6']

function BlockModal({ block, departments = [], onClose, onSuccess }) {
  const isEdit = !!block
  const [form, setForm] = useState({
    name: block?.name || '',
    prefix: block?.code || block?.prefix || '',
    color_hex: block?.color_hex || BLOCK_COLORS[0],
    description: block?.description || '',
    department_id: block?.department_id ? String(block.department_id) : '',
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
        department_id: form.department_id ? Number(form.department_id) : null,
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
          <label className="block text-xs font-bold text-slate-600 mb-1">Primary Department (Optional)</label>
          <select
            value={form.department_id}
            onChange={e => upd('department_id', e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
          >
            <option value="">-- No Primary Department / Multi-Dept Block --</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name} {d.code ? `(${d.code})` : ''}</option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400 mt-1">If this block is primarily occupied by a single department, choose it here. You can also assign multiple departments across different floors.</p>
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
// Room & Department Mapping Panel (In-Place, Zero Navigation)
// ─────────────────────────────────────────────────────────────────────────────
function RoomMappingPanel({ tree, departments, classes, onRefresh, canEdit, onBulkAssignDept }) {
  const [expandedBlocks, setExpandedBlocks] = useState({})
  const [expandedFloors, setExpandedFloors] = useState({})
  const [saving, setSaving] = useState({})
  const [bulkSaving, setBulkSaving] = useState({})
  const [filterDept, setFilterDept] = useState('')
  const [filterType, setFilterType] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const blocks = tree?.blocks || []

  const toggleBlock = (id) => setExpandedBlocks(p => ({ ...p, [id]: !p[id] }))
  const toggleFloor = (key) => setExpandedFloors(p => ({ ...p, [key]: !p[key] }))

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 2500) }

  const updateRoom = async (room, patch) => {
    const key = room.id
    setSaving(p => ({ ...p, [key]: true }))
    try {
      await roomsApi.update(room.id, patch)
      flash(`✅ Room ${room.room_number} updated`)
      onRefresh()
    } catch {}
    finally { setSaving(p => ({ ...p, [key]: false })) }
  }

  const bulkAssignFloor = async (floor, deptId) => {
    const key = `f${floor.id}`
    setBulkSaving(p => ({ ...p, [key]: true }))
    try {
      await campusStructureApi.bulkAssignFloorDepartment(floor.id, {
        department_id: deptId ? parseInt(deptId) : null,
        overwrite_existing: true,
      })
      flash(`✅ All rooms on ${floor.floor_name} updated`)
      onRefresh()
    } catch {}
    finally { setBulkSaving(p => ({ ...p, [key]: false })) }
  }

  const bulkAssignBlock = async (block, deptId) => {
    const key = `b${block.id}`
    setBulkSaving(p => ({ ...p, [key]: true }))
    try {
      await campusStructureApi.bulkAssignBlockDepartment(block.id, {
        department_id: deptId ? parseInt(deptId) : null,
        overwrite_existing: true,
      })
      flash(`✅ All rooms in ${block.name} updated`)
      onRefresh()
    } catch {}
    finally { setBulkSaving(p => ({ ...p, [key]: false })) }
  }

  const matchesSearch = (room, block, floor) => {
    if (!searchQ) return true
    const q = searchQ.toLowerCase()
    return (
      room.room_number?.toLowerCase().includes(q) ||
      block.name?.toLowerCase().includes(q) ||
      floor.floor_name?.toLowerCase().includes(q) ||
      room.department_name?.toLowerCase().includes(q)
    )
  }

  const allRoomCount = blocks.reduce((a, b) => a + (b.floors || []).reduce((fa, f) => fa + (f.rooms || []).length, 0), 0)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="Search rooms, blocks, dept…"
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary-400" />
        </div>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400 min-w-[140px]">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          <option value="none">Unassigned</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400">
          <option value="">All Types</option>
          <option value="classroom">Classroom</option>
          <option value="laboratory">Lab</option>
          <option value="seminar_hall">Seminar Hall</option>
          <option value="examination_hall">Examination Hall</option>
          <option value="staff_room">Staff Room</option>
          <option value="office">Office</option>
          <option value="auditorium">Auditorium</option>
          <option value="meeting_room">Meeting Room</option>
          <option value="store_room">Store Room</option>
        </select>
        <button onClick={() => {
          const allOpen = {}
          blocks.forEach(b => { allOpen[b.id] = true; (b.floors||[]).forEach(f => { allOpen[`${b.id}-${f.id}`] = true }) })
          setExpandedBlocks(allOpen)
          setExpandedFloors(allOpen)
        }} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">
          Expand All
        </button>
        <span className="text-xs text-slate-400 font-semibold">{allRoomCount} rooms total</span>
      </div>

      {successMsg && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-semibold">{successMsg}</div>
      )}

      {blocks.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">
          No blocks yet — use the Hierarchy tab to create blocks and rooms first.
        </div>
      )}

      {blocks.map(block => {
        // Check if this block has any matching rooms
        const blockFloors = block.floors || []
        const blockRoomsAll = blockFloors.flatMap(f => f.rooms || [])
        const blockVisible = blockFloors.some(f =>
          (f.rooms || []).some(room => {
            if (filterDept === 'none' && room.department_id) return false
            if (filterDept && filterDept !== 'none' && String(room.department_id) !== String(filterDept)) return false
            if (filterType && room.room_type !== filterType) return false
            if (!matchesSearch(room, block, f)) return false
            return true
          })
        )
        if ((filterDept || filterType || searchQ) && !blockVisible) return null

        const isBlockOpen = expandedBlocks[block.id]
        return (
          <div key={block.id} className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
            {/* Block Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 cursor-pointer"
              onClick={() => toggleBlock(block.id)}>
              <span className="text-lg transition-transform duration-200" style={{ display: 'inline-block', transform: isBlockOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▾</span>
              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: block.color_hex || '#4F46E5' }} />
              <div className="flex-1 min-w-0">
                <p className="font-black text-slate-800 text-sm">{block.name}</p>
                <p className="text-[11px] text-slate-500">
                  {blockFloors.length} floors · {blockRoomsAll.length} rooms
                  {block.associated_departments?.length > 0 && (
                    <span className="ml-2">
                      {block.associated_departments.map(d => (
                        <span key={d.id} className="inline-block bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-indigo-200 mr-1">{d.code || d.name}</span>
                      ))}
                    </span>
                  )}
                </p>
              </div>
              {canEdit && (
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  {onBulkAssignDept && (
                    <button
                      type="button"
                      onClick={() => onBulkAssignDept(block)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all flex items-center gap-1 shrink-0"
                      title="Open Multi-Department Floor Allocation for this block"
                    >
                      🏢 Allocate Depts
                    </button>
                  )}
                  <select
                    defaultValue=""
                    onChange={e => { if (e.target.value !== '') bulkAssignBlock(block, e.target.value === 'none' ? null : e.target.value) }}
                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary-400 max-w-[160px]"
                    title="Bulk assign all rooms in block to a single department">
                    <option value="">🏢 Assign Whole Block…</option>
                    <option value="none">— Clear Department —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {bulkSaving[`b${block.id}`] && <span className="text-xs text-primary-600">Saving…</span>}
                </div>
              )}
            </div>

            {/* Floors */}
            {isBlockOpen && blockFloors.map(floor => {
              const floorKey = `${block.id}-${floor.id}`
              const isFloorOpen = expandedFloors[floorKey]
              const rooms = (floor.rooms || []).filter(room => {
                if (filterDept === 'none' && room.department_id) return false
                if (filterDept && filterDept !== 'none' && String(room.department_id) !== String(filterDept)) return false
                if (filterType && room.room_type !== filterType) return false
                if (!matchesSearch(room, block, floor)) return false
                return true
              })
              if ((filterDept || filterType || searchQ) && rooms.length === 0) return null

              return (
                <div key={floor.id} className="border-t border-slate-100">
                  {/* Floor header */}
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50/70 cursor-pointer hover:bg-slate-100/70 transition-all"
                    onClick={() => toggleFloor(floorKey)}>
                    <span className="text-sm transition-transform duration-200" style={{ display: 'inline-block', transform: isFloorOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▾</span>
                    <p className="flex-1 font-bold text-slate-700 text-xs">{floor.floor_name} <span className="font-normal text-slate-400">({(floor.rooms||[]).length} rooms)</span></p>
                    {canEdit && (
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <select
                          defaultValue=""
                          onChange={e => { if (e.target.value !== '') bulkAssignFloor(floor, e.target.value === 'none' ? null : e.target.value) }}
                          className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-primary-400 max-w-[160px]"
                          title="Bulk assign all rooms on this floor to a department">
                          <option value="">Assign Floor…</option>
                          <option value="none">— Clear —</option>
                          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        {bulkSaving[`f${floor.id}`] && <span className="text-xs text-primary-600">Saving…</span>}
                      </div>
                    )}
                  </div>

                  {/* Rooms grid */}
                  {isFloorOpen && (
                    <div className="px-4 pb-3 pt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {rooms.map(room => {
                        const c = ROOM_TYPE_COLORS[room.room_type] || ROOM_TYPE_COLORS.other
                        const isSaving = saving[room.id]
                        return (
                          <div key={room.id} className={`border ${c.border} ${c.bg} rounded-xl p-3 space-y-2`}>
                            {/* Room identifier */}
                            <div className="flex items-center justify-between">
                              <span className={`font-black text-sm ${c.text} font-mono`}>{room.room_number}</span>
                              <RoomTypeBadge type={room.room_type} />
                            </div>

                            {canEdit ? (
                              <div className="space-y-2">
                                {/* Department */}
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Department</label>
                                  <select
                                    defaultValue={room.department_id || ''}
                                    key={`dept-${room.id}-${room.department_id}`}
                                    onChange={e => updateRoom(room, { department_id: e.target.value ? parseInt(e.target.value) : null })}
                                    disabled={isSaving}
                                    className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-primary-400 bg-white">
                                    <option value="">— No Dept —</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                  </select>
                                </div>

                                {/* Home Class */}
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Home Class (Optional)</label>
                                  <select
                                    defaultValue={room.primary_class_id || ''}
                                    key={`cls-${room.id}-${room.primary_class_id}`}
                                    onChange={e => updateRoom(room, { primary_class_id: e.target.value ? parseInt(e.target.value) : null })}
                                    disabled={isSaving}
                                    className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-primary-400 bg-white">
                                    <option value="">— No Class —</option>
                                    {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                                  </select>
                                </div>

                                {/* Type + Exam toggle */}
                                <div className="flex items-center gap-2">
                                  <select
                                    defaultValue={room.room_type || 'classroom'}
                                    key={`type-${room.id}-${room.room_type}`}
                                    onChange={e => updateRoom(room, { room_type: e.target.value })}
                                    disabled={isSaving}
                                    className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-primary-400 bg-white">
                                    <option value="classroom">🚪 Classroom</option>
                                    <option value="laboratory">🧪 Lab</option>
                                    <option value="seminar_hall">🏛️ Seminar Hall</option>
                                    <option value="examination_hall">📝 Exam Hall</option>
                                    <option value="staff_room">👥 Staff Room</option>
                                    <option value="office">💼 Office</option>
                                    <option value="auditorium">🎭 Auditorium</option>
                                    <option value="meeting_room">🤝 Meeting Room</option>
                                    <option value="store_room">📦 Store Room</option>
                                    <option value="other">🏷️ Other</option>
                                  </select>
                                  <label className="flex items-center gap-1 cursor-pointer" title="Exam eligible">
                                    <input type="checkbox"
                                      defaultChecked={room.is_exam_eligible}
                                      key={`exam-${room.id}-${room.is_exam_eligible}`}
                                      onChange={e => updateRoom(room, { is_exam_eligible: e.target.checked })}
                                      disabled={isSaving}
                                      className="w-3.5 h-3.5 rounded" />
                                    <span className="text-[10px] text-slate-500 font-semibold whitespace-nowrap">Exam</span>
                                  </label>
                                </div>
                                {isSaving && <p className="text-[10px] text-primary-600 font-semibold">Saving…</p>}
                              </div>
                            ) : (
                              <div className="text-xs text-slate-500 space-y-0.5">
                                {room.department_name && <p>🏢 {room.department_name}</p>}
                                {room.primary_class_name && <p>📚 {room.primary_class_name}</p>}
                                {room.is_exam_eligible && <p className="text-amber-600 font-semibold">✅ Exam Hall</p>}
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {rooms.length === 0 && <p className="col-span-full text-xs text-slate-400 text-center py-4">No rooms match the current filters.</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
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
  const { user, isAdmin, isSystemAdmin, isPrincipal } = useAuth()
  const canEdit = !readOnly && (isAdmin || isSystemAdmin || isPrincipal)
  const canManageDuties = isPrincipal || isSystemAdmin || user?.role === 'principal' || user?.role === 'system_admin' || (user?.role === 'admin' && (!user?.admin_level || user?.admin_level === 'super_admin'))

  const [activeTab, setActiveTab] = useState('tree')
  const [tree, setTree] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 1-Click Fast Navigation & Live Filters
  const [activeBlockId, setActiveBlockId] = useState('all') // 'all' | number
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all') // all, exam, lab, classroom, seminar

  // Modals
  const [wizardOpen, setWizardOpen] = useState(false)
  const [blockModal, setBlockModal] = useState(null) // null | block | 'new'
  const [dutyModal, setDutyModal] = useState(null) // null | block
  const [floorModal, setFloorModal] = useState(null) // null | block
  const [generateModal, setGenerateModal] = useState(null) // null | block
  const [bulkDeptModal, setBulkDeptModal] = useState(null) // null | { target, type: 'floor' | 'block' }
  const [roomEditModal, setRoomEditModal] = useState(null) // null | room
  const [departments, setDepartments] = useState([])
  const [classes, setClasses] = useState([])
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

  useEffect(() => {
    fetchData()
    departmentsApi.list(true).then(r => setDepartments(r.data || [])).catch(() => setDepartments([]))
    classesApi.list().then(r => setClasses(r.data || [])).catch(() => setClasses([]))
  }, [fetchData])

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

  // Filter blocks based on 1-click activeBlockId
  const displayedBlocks = useMemo(() => {
    if (activeBlockId === 'all') return blocks
    return blocks.filter(b => b.id === Number(activeBlockId))
  }, [blocks, activeBlockId])

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
      {/* ── TOP EXECUTIVE COMMAND BAR ── */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>🏛️</span> Campus Structure Builder
            </h1>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              {tree?.institution_name || 'Campus'} · Physical Infrastructure & Spatial Allocation
            </p>
          </div>

          {canEdit && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleExport}
                disabled={exportLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all active:scale-95"
              >
                {exportLoading ? <Spinner size="sm" /> : '📥'} Export CSV
              </button>
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer transition-all active:scale-95">
                📤 Import CSV
                <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
              </label>
              <button
                onClick={() => setWizardOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black text-xs hover:from-violet-700 hover:to-indigo-700 transition-all shadow-md shadow-indigo-600/20 active:scale-95"
              >
                🏗️ Smart Auto-Fill
              </button>
              <button
                onClick={() => setBlockModal('new')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all shadow-sm active:scale-95"
              >
                + Add Block
              </button>
            </div>
          )}
        </div>

        {/* Import result feedback */}
        {importResult && (
          <div className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between ${
            importResult.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <span>{importResult.type === 'success'
              ? `✅ Imported — ${importResult.data?.blocks_created ?? 0} blocks, ${importResult.data?.rooms_created ?? 0} rooms created`
              : `❌ ${importResult.message}`
            }</span>
            <button onClick={() => setImportResult(null)} className="text-base leading-none opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* ── INTERACTIVE KPI SUMMARY STRIP ── */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
            <button
              onClick={() => setActiveBlockId('all')}
              className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-left hover:border-slate-300 transition-all"
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Blocks</span>
              <span className="text-xl font-black text-slate-900 mt-0.5 block">{metrics.total_blocks}</span>
            </button>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Floors</span>
              <span className="text-xl font-black text-slate-900 mt-0.5 block">{metrics.total_floors}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Rooms</span>
              <span className="text-xl font-black text-slate-900 mt-0.5 block">{metrics.total_rooms}</span>
            </div>
            <div className={`p-3 rounded-2xl border transition-all ${metrics.warnings?.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Warnings</span>
              <span className="text-xl font-black text-amber-900 mt-0.5 block">{metrics.warnings?.length || 0}</span>
            </div>
          </div>
        )}

        {/* Warnings List */}
        {metrics?.warnings?.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-800 space-y-1">
            <p className="font-extrabold flex items-center gap-1.5">
              <span>⚠️</span> Configuration Warnings
            </p>
            {metrics.warnings.map((w, i) => <p key={i} className="text-[11px]">• {w}</p>)}
          </div>
        )}

        {/* ── 1-CLICK BLOCK SWITCHER HORIZONTAL STRIP ── */}
        {blocks.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <span>🏢</span> Jump to Block
              </span>
              <span className="text-[10px] font-semibold text-slate-400">1-click to focus any block</span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setActiveBlockId('all')}
                className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeBlockId === 'all'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                All Blocks ({blocks.length})
              </button>

              {blocks.map(b => {
                const isSelected = String(activeBlockId) === String(b.id)
                const fCount = b.floors?.length || 0
                const rCount = (b.floors || []).reduce((acc, f) => acc + (f.rooms?.length || 0), 0)
                return (
                  <button
                    key={b.id}
                    onClick={() => setActiveBlockId(b.id)}
                    className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-500/20'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: b.color_hex || '#4F46E5' }}
                    />
                    <span>{b.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {fCount}F · {rCount}R
                    </span>
                  </button>
                )
              })}

              {canEdit && (
                <button
                  onClick={() => setBlockModal('new')}
                  className="px-3 py-2 rounded-2xl text-xs font-bold text-indigo-600 hover:bg-indigo-50 border border-dashed border-indigo-300 transition-all whitespace-nowrap"
                >
                  + Add Block
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── LIVE SEARCH & QUICK FILTER BAR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm">
            🔍
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search room number, name, department, or class..."
            className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Room Type Quick Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Rooms' },
            { id: 'exam', label: '📝 Exam Halls' },
            { id: 'lab', label: '🧪 Labs' },
            { id: 'classroom', label: '🚪 Classrooms' },
            { id: 'seminar', label: '🏛️ Seminar / Audit.' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setTypeFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                typeFilter === f.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TABS (Hierarchy, Mapping, Search) ── */}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { id: 'tree', label: '🌳 Campus Hierarchy & Layout' },
          { id: 'mapping', label: '🗺️ Room & Dept Mapping' },
          { id: 'search', label: '🔍 Deep Search' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-extrabold border-b-2 transition-all -mb-px whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
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
      ) : activeTab === 'mapping' ? (
        <RoomMappingPanel
          tree={tree}
          departments={departments}
          classes={classes}
          onRefresh={fetchData}
          canEdit={canEdit}
          onBulkAssignDept={target => setBulkDeptModal({
            target: target.floor_name ? target : target,
            type: target.floor_name ? 'floor' : 'block'
          })}
        />
      ) : (
        <div>
          {displayedBlocks.length === 0 ? (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
              <div className="text-5xl mb-3">🏛️</div>
              <p className="font-extrabold text-slate-800 text-base">No Blocks Found</p>
              <p className="text-slate-400 text-xs mt-1 mb-4">
                {blocks.length === 0
                  ? 'Use the Smart Auto-Fill wizard to build your entire campus in seconds, or add blocks manually.'
                  : 'No blocks match the current search or block filter.'}
              </p>
              {canEdit && blocks.length === 0 && (
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setWizardOpen(true)}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black text-xs hover:opacity-90 transition-all shadow-md"
                  >
                    🏗️ Launch Auto-Fill Wizard
                  </button>
                  <button
                    onClick={() => setBlockModal('new')}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                  >
                    + Add Block Manually
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {displayedBlocks.map(block => (
                <BlockNode
                  key={block.id}
                  block={block}
                  departments={departments}
                  classes={classes}
                  readOnly={!canEdit}
                  canManageDuties={canManageDuties}
                  onConfigureDuties={b => setDutyModal(b)}
                  onEdit={b => setBlockModal(b)}
                  onDelete={b => setDeleteConfirm(b)}
                  onDuplicate={handleDuplicate}
                  onAddFloor={b => setFloorModal(b)}
                  onGenerateRooms={b => setGenerateModal(b)}
                  onEditRoom={room => setRoomEditModal(room)}
                  onRefresh={fetchData}
                  searchQuery={searchQuery}
                  typeFilter={typeFilter}
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
            departments={departments}
            onClose={() => setBlockModal(null)}
            onSuccess={fetchData}
          />
        )}
      </Modal>

      {/* Block Duties Configuration & Auto-Assignment Modal (Principal & System Admin Only) */}
      <Modal
        isOpen={dutyModal !== null}
        onClose={() => setDutyModal(null)}
        title={`🛡️ Block Duty Assignment & Auto-Scheduling — ${dutyModal?.name || ''}`}
        maxWidth="max-w-3xl"
      >
        {dutyModal && (
          <BlockDutyConfigModal
            block={dutyModal}
            onClose={() => setDutyModal(null)}
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
        title={bulkDeptModal?.type === 'floor' ? `🏢 Assign Department / Split Floor — ${bulkDeptModal?.target?.floor_name}` : `🏢 Allocate Departments — ${bulkDeptModal?.target?.name}`}
        maxWidth="max-w-3xl"
      >
        {bulkDeptModal && (
          <BulkAssignDeptModal
            target={bulkDeptModal.target}
            type={bulkDeptModal.type}
            departments={departments}
            classes={classes}
            onClose={() => setBulkDeptModal(null)}
            onSuccess={fetchData}
          />
        )}
      </Modal>

      {/* Quick Edit Room Modal (In-Place, Zero Navigation) */}
      <Modal
        isOpen={roomEditModal !== null}
        onClose={() => setRoomEditModal(null)}
        title={`🚪 Edit Room ${roomEditModal?.room_number || ''}`}
      >
        {roomEditModal && (
          <QuickEditRoomModal
            room={roomEditModal}
            departments={departments}
            classes={classes}
            onClose={() => setRoomEditModal(null)}
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
