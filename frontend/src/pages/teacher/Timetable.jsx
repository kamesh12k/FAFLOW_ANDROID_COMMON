import { useEffect, useState, useCallback, useReducer, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { timetableApi, subjectsApi, classesApi, roomsApi, departmentsApi } from '../../api/services'
import { Spinner, Modal } from '../../components/ui'
import { PlusIcon } from '../../components/icons'

// ── Constants ─────────────────────────────────────────────────────────────────
const DAY_ORDERS = [1, 2, 3, 4, 5, 6]
const PERIODS = [1, 2, 3, 4, 5]

const DAY_SHORT = { 1: 'DO1', 2: 'DO2', 3: 'DO3', 4: 'DO4', 5: 'DO5', 6: 'DO6' }
const DAY_FULL = { 1: 'Day Order 1', 2: 'Day Order 2', 3: 'Day Order 3', 4: 'Day Order 4', 5: 'Day Order 5', 6: 'Day Order 6' }
const PERIOD_TIMES = {
  1: '8:00–9:00',
  2: '9:00–10:00',
  3: '10:15–11:15',
  4: '11:15–12:15',
  5: '1:00–2:00',
}

const SUBJECT_COLORS = [
  { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  { bg: '#FDF4FF', text: '#9333EA', border: '#E9D5FF' },
  { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' },
  { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  { bg: '#ECFEFF', text: '#0E7490', border: '#A5F3FC' },
  { bg: '#F0FDF4', text: '#166534', border: '#86EFAC' },
]

const colorMap = {}
let colorIdx = 0
function getColor(classId) {
  if (classId === null || classId === undefined) {
    return { bg: '#EEF2FF', text: '#4F46E5', border: '#C7D2FE' }
  }
  if (!colorMap[classId]) colorMap[classId] = SUBJECT_COLORS[colorIdx++ % SUBJECT_COLORS.length]
  return colorMap[classId]
}

function getSubjectColor(subjectId) {
  if (subjectId === null || subjectId === undefined) {
    return { bg: '#F8FAFC', text: '#475569', border: '#CBD5E1' }
  }
  const key = `subj_${subjectId}`
  if (!colorMap[key]) colorMap[key] = SUBJECT_COLORS[colorIdx++ % SUBJECT_COLORS.length]
  return colorMap[key]
}

function abbrev(name) {
  if (!name) return '?'
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 3)
}

function initials(name) {
  if (!name) return '??'
  const parts = name.trim().split(/\s+/)
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

function isLabRoom(room) {
  return !!room && room.room_type === 'lab'
}

function hourTypeForRoom(roomId, rms) {
  if (!roomId) return null
  const room = rms.find(r => r.id === Number(roomId))
  if (!room) return null
  return isLabRoom(room) ? 'Lab' : 'Theory'
}

// ── History reducer ───────────────────────────────────────────────────────────
function historyReducer(state, action) {
  switch (action.type) {
    case 'SET': return { past: [...state.past.slice(-19), state.present], present: action.payload, future: [] }
    case 'UNDO': if (!state.past.length) return state
      return { past: state.past.slice(0, -1), present: state.past[state.past.length - 1], future: [state.present, ...state.future] }
    case 'REDO': if (!state.future.length) return state
      return { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1) }
    case 'INIT': return { past: [], present: action.payload, future: [] }
    default: return state
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="tt-toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`tt-toast tt-toast--${t.type || 'success'}`}>
          <span className="tt-toast-dot" />
          {t.message}
        </div>
      ))}
    </div>
  )
}

// ── SVG icons ─────────────────────────────────────────────────────────────────
const IconSearch = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
const IconPaint = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M2 20c.5-1.5 2-2.5 3.5-2.5 2 0 3.5 1.5 3.5 3.5 0 1-1 1-1 2 0 .83.67 1.5 1.5 1.5C19 24.5 22 17 22 12A10 10 0 0 0 2 12c0 2.5.6 4.7 0 8z" /></svg>
const IconUndo = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" /></svg>
const IconRedo = () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><polyline points="15 14 20 9 15 4" /><path d="M4 20v-7a4 4 0 0 1 4-4h12" /></svg>
const IconTrash = () => <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
const IconChevron = () => <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" /></svg>
const IconCheck = () => <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
const IconWarning = () => <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>

export default function MyTimetable() {
  const { user } = useAuth()
  const selectedTeacherId = String(user?.id || '')

  // ── Master data ──────────────────────────────────────────────────────────
  const [subjects, setSubjects] = useState([])
  const [classes, setClasses] = useState([])
  const [rooms, setRooms] = useState([])
  const [departments, setDepartments] = useState([])
  const [masterReady, setMasterReady] = useState(false)

  // ── UI state ──────────────────────────────────────────────────────────────
  const [leftTab, setLeftTab] = useState('classes')
  const [classSearch, setClassSearch] = useState('')
  const [classDepartmentFilter, setClassDepartmentFilter] = useState(user?.department_id ? String(user.department_id) : '')
  const [subjectSearch, setSubjectSearch] = useState('')
  const [subjectDepartmentFilter, setSubjectDepartmentFilter] = useState(user?.department_id ? String(user.department_id) : '')
  const [roomFilter, setRoomFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeClass, setActiveClass] = useState(null)
  const [activeSubject, setActiveSubject] = useState(null)
  const [selectedCell, setSelectedCell] = useState(null)
  const [paintMode, setPaintMode] = useState(false)
  const [isPainting, setIsPainting] = useState(false)
  const [paintHover, setPaintHover] = useState(null)
  const [dragClass, setDragClass] = useState(null)
  const [dragSubject, setDragSubject] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [conflicts, setConflicts] = useState({})
  const [conflictDetail, setConflictDetail] = useState(null)
  const [toasts, setToasts] = useState([])
  const [editRoom, setEditRoom] = useState('')
  const [editSubject, setEditSubject] = useState('')
  const [editClass, setEditClass] = useState('')
  const [editSubjectSearch, setEditSubjectSearch] = useState('')
  const [poppedCells, setPoppedCells] = useState(new Set())
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)

  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [quickRoomId, setQuickRoomId] = useState('')
  const [combineClassMode, setCombineClassMode] = useState(false)


  // ── Mobile-only state ─────────────────────────────────────────────────────
  const [mobileSelectedDay, setMobileSelectedDay] = useState(1)
  const [mobileAssignCell, setMobileAssignCell] = useState(null)
  const [mobileClassId, setMobileClassId] = useState('')
  const [mobileSubjectId, setMobileSubjectId] = useState('')
  const [mobileRoomId, setMobileRoomId] = useState('')
  const [mobileDeptFilter, setMobileDeptFilter] = useState('')
  const [mobileClassSearch, setMobileClassSearch] = useState('')
  const [mobileEditRoomSlot, setMobileEditRoomSlot] = useState(null)
  const [mobileNewRoomId, setMobileNewRoomId] = useState('')
  const [mobileNewSubjectId, setMobileNewSubjectId] = useState('')
  const [mobileNewClassId, setMobileNewClassId] = useState('')

  useEffect(() => {
    setSelectedClassId('')
    setSelectedSubjectId('')
    setSelectedRoomId('')
    if (selectedCell?.slot) {
      setEditRoom(selectedCell.slot.room_id ? String(selectedCell.slot.room_id) : '')
      setEditSubject(selectedCell.slot.subject_id ? String(selectedCell.slot.subject_id) : '')
      setEditClass(selectedCell.slot.class_id ? String(selectedCell.slot.class_id) : '')
      setEditSubjectSearch('')
    } else {
      setEditRoom('')
      setEditSubject('')
      setEditClass('')
      setEditSubjectSearch('')
    }
  }, [selectedCell])

  // ── Slot history ──────────────────────────────────────────────────────────
  const [history, dispatch] = useReducer(historyReducer, { past: [], present: [], future: [] })
  const slots = history.present

  const toastId = useRef(0)
  const toast = useCallback((message, type = 'success') => {
    const id = ++toastId.current
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }, [])

  // ── Enrich slot ───────────────────────────────────────────────────────────
  const enrich = useCallback((slot, subjs, clss, rms) => ({
    ...slot,
    subject_name: slot.subject_id ? (subjs.find(x => x.id === slot.subject_id)?.name || `Subject #${slot.subject_id}`) : 'Assigned',
    subject_code: slot.subject_id ? (subjs.find(x => x.id === slot.subject_id)?.code || '???') : '',
    class_name: (() => { const c = clss.find(x => x.id === slot.class_id); return c ? `${c.name}-${c.section}` : `Class #${slot.class_id}` })(),
    room_name: rms.find(x => x.id === slot.room_id)?.room_number || '',
    hour_type: hourTypeForRoom(slot.room_id, rms),
  }), [])

  // ── Load master data ──────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([subjectsApi.list(false, true), classesApi.list(), roomsApi.list(), departmentsApi.list(true)])
      .then(([s, c, r, d]) => {
        setSubjects(s.data); setClasses(c.data); setRooms(r.data); setDepartments(d.data)
        setMasterReady(true)
      })
      .catch(() => toast('Failed to load master data', 'error'))
  }, [toast])

  // Auto-sync teacher department filter defaults
  useEffect(() => {
    if (user?.department_id) {
      setClassDepartmentFilter(prev => prev === '' ? String(user.department_id) : prev)
      setSubjectDepartmentFilter(prev => prev === '' ? String(user.department_id) : prev)
    }
  }, [user])

  // ── Load slots ────────────────────────────────────────────────────────────
  const loadSlots = useCallback((subjs, clss, rms) => {
    if (!selectedTeacherId || !masterReady) return
    setLoading(true)
    timetableApi.getByTeacher(selectedTeacherId)
      .then(r => {
        dispatch({ type: 'INIT', payload: r.data.map(s => enrich(s, subjs, clss, rms)) })
        setSelectedCell(null); setActiveClass(null); setActiveSubject(null)
      })
      .catch(() => toast('Failed to load timetable', 'error'))
      .finally(() => setLoading(false))
  }, [selectedTeacherId, masterReady, enrich, toast])

  useEffect(() => {
    if (masterReady && selectedTeacherId) loadSlots(subjects, classes, rooms)
  }, [selectedTeacherId, masterReady, loadSlots, subjects, classes, rooms])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = e => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); dispatch({ type: 'UNDO' }); toast('Undone', 'warn')
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); dispatch({ type: 'REDO' }); toast('Redone', 'warn')
      } else if (e.key === 'p' || e.key === 'P') {
        setPaintMode(m => !m)
      } else if (e.key === 'Escape') {
        setActiveClass(null); setActiveSubject(null); setSelectedCell(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toast])

  const slotAt = (day, period) => slots.find(s => s.day_order === day && s.period_number === period)

  const showConflict = useCallback((detail, day, period) => {
    const message = typeof detail === 'string' ? detail : (detail?.reason || 'This timetable entry conflicts with an existing booking.')
    setConflicts(current => ({ ...current, [`${day}-${period}`]: { message, detail } }))
    setConflictDetail(typeof detail === 'string' ? { title: 'Timetable conflict', reason: detail } : detail)
  }, [])

  const popCell = (day, period) => {
    const key = `${day}-${period}`
    setPoppedCells(s => new Set([...s, key]))
    setTimeout(() => setPoppedCells(s => { const n = new Set(s); n.delete(key); return n }), 300)
  }

  // ── Assign slot ───────────────────────────────────────────────────────────
  const assignSlot = useCallback(async (day, period, overridePayload) => {
    let targetClass = overridePayload?.cls || activeClass?.cls
    let targetSubject = overridePayload?.sub || activeSubject?.sub
    const targetRoomId = overridePayload?.roomId !== undefined ? overridePayload.roomId : quickRoomId

    if (!targetClass && targetSubject) {
      targetClass = classes.find(c => c.department_id === targetSubject.department_id && c.semester === targetSubject.semester)
        || classes.find(c => c.department_id === targetSubject.department_id)
        || classes[0]
    }

    if (!targetClass) {
      toast('Please select a class section to assign', 'warn')
      return
    }

    const occupiedSlot = slotAt(day, period)
    if (occupiedSlot) {
      toast(`${DAY_SHORT[day]} · P${period} is already occupied`, 'warn')
      return
    }

    setSaving(true)
    try {
      let res
      try {
        res = await timetableApi.createSlot({
          teacher_id: Number(selectedTeacherId),
          subject_id: targetSubject ? targetSubject.id : null,
          class_id: targetClass.id,
          room_id: targetRoomId ? Number(targetRoomId) : null,
          day_order: day,
          period_number: period,
          allow_combined_class: combineClassMode,
        })
      } catch (err1) {
        if (err1.response?.status === 409) throw err1
        res = await timetableApi.submitMyEntry({
          class_id: targetClass.id,
          subject_id: targetSubject ? targetSubject.id : null,
          room_id: targetRoomId ? Number(targetRoomId) : null,
          day_order: day,
          period_number: period,
          allow_combined_class: combineClassMode,
        })
      }

      const enriched = enrich(res.data, subjects, classes, rooms)
      dispatch({ type: 'SET', payload: [...slots, enriched] })
      popCell(day, period)
      const hourTag = enriched.hour_type ? ` · ${enriched.hour_type}` : ''
      const subTag = targetSubject ? `${targetSubject.code} · ` : ''
      toast(`${subTag}${targetClass.name}-${targetClass.section} → ${DAY_SHORT[day]} P${period}${hourTag}`)
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to assign slot'
      toast(typeof detail === 'string' ? detail : (detail.title || 'Timetable conflict'), 'error')
      if (detail && typeof detail === 'object') {
        if (detail.requested && !detail.requested.teacher_name) {
          detail.requested.teacher_name = user?.name || 'You'
        }
        if (detail.existing) {
          if (!detail.existing.teacher_name && detail.existing.teacher_id) {
            const knownSlot = slots.find(s => s.teacher_id === detail.existing.teacher_id)
            if (knownSlot?.teacher_name) detail.existing.teacher_name = knownSlot.teacher_name
          }
          if (!detail.existing.class_name && detail.existing.class_id) {
            const c = classes.find(cl => cl.id === detail.existing.class_id)
            if (c) detail.existing.class_name = `${c.name}-${c.section}`
          }
          if (!detail.existing.subject_name && detail.existing.subject_id) {
            const s = subjects.find(sub => sub.id === detail.existing.subject_id)
            if (s) detail.existing.subject_name = s.name
          }
        }
      }
      showConflict(detail, day, period)
    } finally { setSaving(false) }
  }, [activeClass, activeSubject, selectedTeacherId, slots, subjects, classes, rooms, enrich, toast, quickRoomId, showConflict, user, combineClassMode])

  // ── Remove slot ───────────────────────────────────────────────────────────
  const removeSlot = useCallback(async slotObj => {
    if (!slotObj) return
    setSaving(true)
    try {
      await timetableApi.deleteSlot(slotObj.id)
      dispatch({ type: 'SET', payload: slots.filter(s => s.id !== slotObj.id) })
      setSelectedCell(null)
      toast('Slot removed', 'warn')
    } catch (err) {
      toast(err.response?.data?.detail || 'Failed to remove slot', 'error')
    } finally { setSaving(false) }
  }, [slots, toast])

  // ── Clear all ─────────────────────────────────────────────────────────────
  const clearAll = useCallback(async () => {
    setConfirmClearOpen(false)
    setSaving(true)
    try {
      await timetableApi.clearTeacherTimetable(selectedTeacherId)
      dispatch({ type: 'INIT', payload: [] })
      setSelectedCell(null)
      toast('Timetable cleared', 'warn')
    } catch { toast('Failed to clear timetable', 'error') }
    finally { setSaving(false) }
  }, [selectedTeacherId, toast])

  // ── Update slot ───────────────────────────────────────────────────────────
  const updateSlot = useCallback(async (slotObj, updates = {}) => {
    if (!slotObj) return
    setSaving(true)
    try {
      await timetableApi.deleteSlot(slotObj.id)
      const nextClassId = updates.class_id !== undefined ? updates.class_id : slotObj.class_id
      const nextSubjectId = updates.subject_id !== undefined ? updates.subject_id : slotObj.subject_id
      const nextRoomId = updates.room_id !== undefined ? updates.room_id : slotObj.room_id

      const res = await timetableApi.createSlot({
        teacher_id: slotObj.teacher_id,
        subject_id: nextSubjectId ? Number(nextSubjectId) : null,
        class_id: Number(nextClassId),
        room_id: nextRoomId ? Number(nextRoomId) : null,
        day_order: slotObj.day_order,
        period_number: slotObj.period_number,
        allow_combined_class: updates.allow_combined_class !== undefined ? updates.allow_combined_class : (slotObj.allow_combined_class || combineClassMode),
      })
      const updated = enrich(res.data, subjects, classes, rooms)
      dispatch({ type: 'SET', payload: slots.map(s => s.id === slotObj.id ? updated : s) })
      setSelectedCell(prev => prev ? { ...prev, slot: updated } : prev)
      if (updates.subject_id !== undefined) setEditSubject(updates.subject_id ? String(updates.subject_id) : '')
      if (updates.class_id !== undefined) setEditClass(String(updates.class_id))
      if (updates.room_id !== undefined) setEditRoom(updates.room_id ? String(updates.room_id) : '')
      toast('Slot updated successfully')
    } catch (err) {
      toast(err.response?.data?.detail || 'Failed to update slot', 'error')
      loadSlots(subjects, classes, rooms)
    } finally { setSaving(false) }
  }, [slots, subjects, classes, rooms, enrich, toast, combineClassMode, loadSlots])

  const updateRoom = (slotObj, roomId) => updateSlot(slotObj, { room_id: roomId })

  const handleAssignFromPanel = async () => {
    if (!selectedCell || !selectedClassId || !selectedTeacherId) return
    setSaving(true)
    try {
      let res
      try {
        res = await timetableApi.createSlot({
          teacher_id: Number(selectedTeacherId),
          subject_id: selectedSubjectId ? Number(selectedSubjectId) : null,
          class_id: Number(selectedClassId),
          room_id: selectedRoomId ? Number(selectedRoomId) : null,
          day_order: selectedCell.day_order,
          period_number: selectedCell.period_number,
          allow_combined_class: combineClassMode,
        })
      } catch (err1) {

        if (err1.response?.status === 409) throw err1
        res = await timetableApi.submitMyEntry({
          class_id: Number(selectedClassId),
          subject_id: selectedSubjectId ? Number(selectedSubjectId) : null,
          room_id: selectedRoomId ? Number(selectedRoomId) : null,
          day_order: selectedCell.day_order,
          period_number: selectedCell.period_number,
          allow_combined_class: combineClassMode,
        })
      }
      const enrichedSlot = enrich(res.data, subjects, classes, rooms)
      dispatch({ type: 'SET', payload: [...slots, enrichedSlot] })
      popCell(selectedCell.day_order, selectedCell.period_number)
      toast('Slot assigned successfully')
      setSelectedCell(null)
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to assign slot'
      toast(typeof detail === 'string' ? detail : (detail.title || 'Timetable conflict'), 'error')
      if (detail && typeof detail === 'object') {
        if (detail.existing) {
          if (!detail.existing.teacher_name && detail.existing.teacher_id) {
            const knownSlot = slots.find(s => s.teacher_id === detail.existing.teacher_id)
            if (knownSlot?.teacher_name) detail.existing.teacher_name = knownSlot.teacher_name
          }
          if (!detail.existing.class_name && detail.existing.class_id) {
            const c = classes.find(cl => cl.id === detail.existing.class_id)
            if (c) detail.existing.class_name = `${c.name}-${c.section}`
          }
          if (!detail.existing.subject_name && detail.existing.subject_id) {
            const s = subjects.find(sub => sub.id === detail.existing.subject_id)
            if (s) detail.existing.subject_name = s.name
          }
        }
      }
      showConflict(detail, selectedCell.day_order, selectedCell.period_number)
    } finally {
      setSaving(false)
    }
  }

  // ── Mobile Assign Handler ─────────────────────────────────────────────────
  const handleMobileAssign = async () => {
    if (!mobileAssignCell || !mobileClassId || !selectedTeacherId) return
    setSaving(true)
    try {
      let res
      try {
        res = await timetableApi.createSlot({
          teacher_id: Number(selectedTeacherId),
          subject_id: mobileSubjectId ? Number(mobileSubjectId) : null,
          class_id: Number(mobileClassId),
          room_id: mobileRoomId ? Number(mobileRoomId) : null,
          day_order: mobileAssignCell.day_order,
          period_number: mobileAssignCell.period_number,
          allow_combined_class: combineClassMode,
        })
      } catch (err1) {
        if (err1.response?.status === 409) throw err1
        res = await timetableApi.submitMyEntry({
          class_id: Number(mobileClassId),
          subject_id: mobileSubjectId ? Number(mobileSubjectId) : null,
          room_id: mobileRoomId ? Number(mobileRoomId) : null,
          day_order: mobileAssignCell.day_order,
          period_number: mobileAssignCell.period_number,
          allow_combined_class: combineClassMode,
        })
      }
      const enrichedSlot = enrich(res.data, subjects, classes, rooms)
      dispatch({ type: 'SET', payload: [...slots, enrichedSlot] })
      toast(`Assigned ${enrichedSlot.class_name} to DO${mobileAssignCell.day_order} P${mobileAssignCell.period_number}`)
      setMobileAssignCell(null)
      setMobileClassId('')
      setMobileSubjectId('')
      setMobileRoomId('')
    } catch (err) {
      const rawDetail = err.response?.data?.detail || 'Failed to assign slot'
      let detail = rawDetail
      if (typeof rawDetail === 'string') {
        const cls = classes.find(c => c.id === Number(mobileClassId))
        const subj = subjects.find(s => s.id === Number(mobileSubjectId))
        const rm = rooms.find(r => r.id === Number(mobileRoomId))
        detail = {
          title: 'Class already scheduled',
          conflict_type: 'class',
          reason: rawDetail,
          resolution: 'Tap "Combine Class & Assign" below to assign as co-staff or joint class.',
          requested: {
            teacher_id: Number(selectedTeacherId),
            teacher_name: user?.name || 'You',
            class_id: Number(mobileClassId),
            class_name: cls ? `${cls.name}-${cls.section}` : `Class #${mobileClassId}`,
            subject_id: mobileSubjectId ? Number(mobileSubjectId) : null,
            subject_name: subj?.name || '',
            room_id: mobileRoomId ? Number(mobileRoomId) : null,
            room_name: rm?.room_number || '',
            day_order: mobileAssignCell.day_order,
            period_number: mobileAssignCell.period_number,
          }
        }
      } else if (detail && typeof detail === 'object' && !detail.requested) {
        detail.requested = {
          teacher_id: Number(selectedTeacherId),
          teacher_name: user?.name || 'You',
          class_id: Number(mobileClassId),
          subject_id: mobileSubjectId ? Number(mobileSubjectId) : null,
          room_id: mobileRoomId ? Number(mobileRoomId) : null,
          day_order: mobileAssignCell.day_order,
          period_number: mobileAssignCell.period_number,
        }
      }
      toast(typeof detail === 'string' ? detail : (detail.title || 'Timetable conflict'), 'error')
      showConflict(detail, mobileAssignCell.day_order, mobileAssignCell.period_number)
    } finally {
      setSaving(false)
    }

  }

  // ── Mobile Update Slot Handler ────────────────────────────────────────────
  const handleMobileUpdateRoom = async () => {
    if (!mobileEditRoomSlot) return
    await updateSlot(mobileEditRoomSlot, {
      subject_id: mobileNewSubjectId !== '' ? (mobileNewSubjectId ? Number(mobileNewSubjectId) : null) : undefined,
      class_id: mobileNewClassId ? Number(mobileNewClassId) : undefined,
      room_id: mobileNewRoomId !== '' ? (mobileNewRoomId ? Number(mobileNewRoomId) : null) : undefined,
    })
    setMobileEditRoomSlot(null)
    setMobileNewRoomId('')
    setMobileNewSubjectId('')
    setMobileNewClassId('')
  }

  // ── Cell click ────────────────────────────────────────────────────────────
  const handleCellClick = useCallback((day, period) => {
    const slot = slotAt(day, period)
    if ((activeClass || activeSubject) && !slot) { assignSlot(day, period); return }
    setSelectedCell({ day_order: day, period_number: period, slot })
    if (slot) setEditRoom(slot.room_id ? String(slot.room_id) : '')
  }, [activeClass, activeSubject, assignSlot, slots])

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDrop = useCallback((day, period) => {
    setDragOver(null)
    if (dragClass) {
      assignSlot(day, period, { cls: dragClass.cls })
      setDragClass(null)
    } else if (dragSubject) {
      assignSlot(day, period, { sub: dragSubject.sub })
      setDragSubject(null)
    }
  }, [dragClass, dragSubject, assignSlot])

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredClasses = classes
    .filter(c =>
      (!classDepartmentFilter || String(c.department_id) === String(classDepartmentFilter)) &&
      (!classSearch || c.name.toLowerCase().includes(classSearch.toLowerCase()) || (c.section || '').toLowerCase().includes(classSearch.toLowerCase()))
    )
    .sort((a, b) => {
      if (user?.department_id) {
        const aIsMine = a.department_id === user.department_id
        const bIsMine = b.department_id === user.department_id
        if (aIsMine && !bIsMine) return -1
        if (!aIsMine && bIsMine) return 1
      }
      return `${a.name}-${a.section}`.localeCompare(`${b.name}-${b.section}`)
    })

  const filteredSubjects = subjects
    .filter(s =>
      (!subjectDepartmentFilter || String(s.department_id) === String(subjectDepartmentFilter)) &&
      (!subjectSearch || s.name.toLowerCase().includes(subjectSearch.toLowerCase()) || s.code.toLowerCase().includes(subjectSearch.toLowerCase()))
    )
    .sort((a, b) => {
      if (user?.department_id) {
        const aIsMine = a.department_id === user.department_id
        const bIsMine = b.department_id === user.department_id
        if (aIsMine && !bIsMine) return -1
        if (!aIsMine && bIsMine) return 1
      }
      return (a.code || '').localeCompare(b.code || '')
    })

  const conflictRequested = conflictDetail?.requested
  const requestedTeacherName = user?.name || 'Teacher'
  const requestedClass = conflictRequested?.class_id ? classes.find(c => c.id === Number(conflictRequested.class_id)) : null
  const requestedClassName = requestedClass ? `${requestedClass.name}-${requestedClass.section}` : 'Not selected'
  const requestedSubjectName = conflictRequested?.subject_id ? (subjects.find(s => s.id === Number(conflictRequested.subject_id))?.name || `Subject #${conflictRequested.subject_id}`) : 'Assigned session'
  const requestedRoomName = conflictRequested?.room_id ? (rooms.find(r => r.id === Number(conflictRequested.room_id))?.room_number || `Room #${conflictRequested.room_id}`) : 'No room selected'

  const creditsSummary = classes
    .map(c => ({ ...c, count: slots.filter(sl => sl.class_id === c.id).length }))
    .filter(c => c.count > 0)

  return (
    <div className="space-y-4">
      <Toast toasts={toasts} />

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* ── MOBILE-ONLY PRESENTATION (Visible < 1024px) ──────────────────── */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      <div className="tt-mobile-view block lg:hidden space-y-4 pb-24">
        {/* Mobile Header Card */}
        <div className="card p-4 border border-slate-200 bg-white rounded-2xl shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-md shadow-primary-500/20 shrink-0">
                {initials(user?.name)}
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-black text-slate-900 leading-tight truncate">My Timetable</h1>
                <p className="text-xs font-semibold text-slate-500 truncate">{user?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => { dispatch({ type: 'UNDO' }); toast('Undone', 'warn') }}
                disabled={!history.past.length}
                className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 flex items-center justify-center disabled:opacity-30 min-h-[36px]"
                title="Undo"
              >
                <IconUndo />
              </button>
              <button
                type="button"
                onClick={() => { dispatch({ type: 'REDO' }); toast('Redone', 'warn') }}
                disabled={!history.future.length}
                className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 flex items-center justify-center disabled:opacity-30 min-h-[36px]"
                title="Redo"
              >
                <IconRedo />
              </button>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="font-bold text-primary-700 bg-primary-50 px-2.5 py-1 rounded-lg">
              {slots.length} total period{slots.length !== 1 ? 's' : ''} assigned
            </span>
            {slots.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmClearOpen(true)}
                disabled={saving}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 px-2 py-1"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Mobile Combine Class Switch Card */}
        <div className="card p-3 border border-purple-200 bg-purple-50/70 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
              👥
            </div>
            <div>
              <p className="text-xs font-black text-purple-950 leading-tight">Combine Class / Multi-Staff</p>
              <p className="text-[10px] font-semibold text-purple-700">Assign 2+ staff or merge sections</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setCombineClassMode(m => {
                const next = !m
                toast(
                  next
                    ? '👥 Combine Class ON: You can now assign multiple staff or sections'
                    : 'Combine Class OFF',
                  'info'
                )
                return next
              })
            }}
            className={`px-3.5 py-1.5 rounded-xl font-black text-xs transition-all shadow-xs min-h-[36px] ${
              combineClassMode
                ? 'bg-purple-600 text-white shadow-purple-500/25 ring-2 ring-purple-600 ring-offset-1'
                : 'bg-white border border-purple-300 text-purple-700 hover:bg-purple-100'
            }`}
          >
            {combineClassMode ? 'ON 🟢' : 'OFF ⚪'}
          </button>
        </div>

        {/* Day Order Selector (Segmented Grid) */}

        <div>
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Select Day Order</span>
            <span className="text-xs font-extrabold text-primary-600">{DAY_FULL[mobileSelectedDay]}</span>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {DAY_ORDERS.map(day => {
              const daySlotCount = slots.filter(s => s.day_order === day).length
              const isActive = mobileSelectedDay === day
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setMobileSelectedDay(day)}
                  className={`py-2.5 px-1 rounded-xl border text-center transition-all min-h-[48px] flex flex-col items-center justify-center ${
                    isActive
                      ? 'bg-primary-600 border-primary-600 text-white shadow-sm shadow-primary-500/25'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs font-black tracking-tight">{DAY_SHORT[day]}</span>
                  <span className={`text-[10px] font-bold mt-0.5 ${isActive ? 'text-primary-100' : 'text-slate-400'}`}>
                    {daySlotCount} cls
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected Day Schedule Title */}
        <div className="flex items-center justify-between px-1 pt-1">
          <h2 className="text-sm font-black text-slate-800">{DAY_FULL[mobileSelectedDay]} Schedule</h2>
          <span className="text-xs font-semibold text-slate-500">
            {slots.filter(s => s.day_order === mobileSelectedDay).length} of 5 periods active
          </span>
        </div>

        {/* Period Cards (1 to 5) Stack */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : (
            PERIODS.map(period => {
              const slot = slotAt(mobileSelectedDay, period)
              const color = slot ? getColor(slot.class_id) : null

              return (
                <div
                  key={period}
                  className={`card p-4 rounded-2xl border transition-all ${
                    slot
                      ? 'bg-white border-slate-200 shadow-xs'
                      : 'bg-slate-50/70 border-dashed border-slate-250'
                  }`}
                  style={slot && color ? { borderLeftColor: color.border, borderLeftWidth: '4px' } : {}}
                >
                  {/* Period Header */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-extrabold">
                        Period {period}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 font-mono">
                        {PERIOD_TIMES[period]}
                      </span>
                    </div>

                    {slot ? (
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide ${
                        slot.hour_type === 'Lab' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {slot.hour_type || 'Theory'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-400 bg-slate-200/60 uppercase tracking-wide">
                        Free Period
                      </span>
                    )}
                  </div>

                  {/* Period Body */}
                  {slot ? (
                    <div className="pt-3 space-y-3">
                      <div>
                        <div className="text-sm font-extrabold text-slate-900">
                          {slot.subject_code ? `${slot.subject_code} — ` : ''}{slot.subject_name}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-primary-50 text-primary-700 border border-primary-150">
                            Class: {slot.class_name}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            Room: {slot.room_name || 'No Room (Theory)'}
                          </span>
                        </div>
                      </div>

                      {/* Mobile Period Actions */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setMobileEditRoomSlot(slot)
                            setMobileNewRoomId(slot.room_id ? String(slot.room_id) : '')
                            setMobileNewSubjectId(slot.subject_id ? String(slot.subject_id) : '')
                            setMobileNewClassId(slot.class_id ? String(slot.class_id) : '')
                          }}
                          className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors min-h-[40px]"
                        >
                          Edit Slot
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSlot(slot)}
                          disabled={saving}
                          className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors min-h-[40px]"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-3 flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-400 font-medium italic">
                        No class scheduled
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setMobileAssignCell({ day_order: mobileSelectedDay, period_number: period })
                          setMobileClassId('')
                          setMobileSubjectId('')
                          setMobileRoomId(quickRoomId || '')
                          setMobileDeptFilter('')
                          setMobileClassSearch('')
                        }}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-primary-500/20 min-h-[44px]"
                      >
                        <PlusIcon className="w-4 h-4" />
                        <span>Assign Class</span>
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Mobile Assigned Summary */}
        {creditsSummary.length > 0 && (
          <div className="card p-4 border border-slate-200 bg-white rounded-2xl shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Weekly Class Distribution
            </span>
            <div className="flex flex-wrap gap-2">
              {creditsSummary.map(c => {
                const color = getColor(c.id)
                return (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border"
                    style={{ backgroundColor: color.bg, borderColor: color.border, color: color.text }}
                  >
                    <strong>{c.name}-{c.section}</strong>
                    <span className="opacity-80">· {c.count} period{c.count !== 1 ? 's' : ''}</span>
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* ── DESKTOP-ONLY PRESENTATION (Visible >= 1024px) ────────────────── */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      <div className="tt-desktop-view hidden lg:flex tt-root">
        {/* ── Header ── */}
        <header className="tt-header">
          <div className="tt-brand">
            <svg className="tt-brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              <rect x="8" y="14" width="3" height="3" rx=".5" />
            </svg>
            <div>
              <h1 className="tt-title">My Timetable Editor</h1>
              <p className="tt-subtitle">
                Select a class → click or drag cells &nbsp;·&nbsp;
                <kbd className="tt-kbd">P</kbd> paint &nbsp;·&nbsp;
                <kbd className="tt-kbd">Esc</kbd> deselect
              </p>
            </div>
          </div>

          <div className="tt-controls">
            <div className="tt-action-row">
              <button
                className={`tt-btn ${paintMode ? 'tt-btn--paint-on' : 'tt-btn--paint-off'}`}
                onClick={() => setPaintMode(m => !m)}
                title="Toggle paint mode (P)"
              >
                {paintMode && <span className="tt-paint-pulse" />}
                <IconPaint />
                Paint {paintMode ? 'on' : 'off'}
              </button>

              <button
                type="button"
                className={`tt-btn ${combineClassMode ? 'tt-btn--combine-on' : 'tt-btn--combine-off'}`}
                onClick={() => {
                  setCombineClassMode(m => {
                    const next = !m
                    toast(
                      next
                        ? '👥 Combine Class ON: You can now assign multiple staff to one class/period'
                        : 'Combine Class OFF',
                      'info'
                    )
                    return next
                  })
                }}
                title="Toggle Combine Class mode to assign two or more staff to one class"
              >
                👥 Combine Class {combineClassMode ? 'ON' : 'OFF'}
              </button>


              <div className="tt-btn-group">
                <button
                  className="tt-btn tt-btn--icon"
                  onClick={() => { dispatch({ type: 'UNDO' }); toast('Undone', 'warn') }}
                  disabled={!history.past.length}
                  title="Undo (Ctrl+Z)"
                ><IconUndo /></button>
                <button
                  className="tt-btn tt-btn--icon"
                  onClick={() => { dispatch({ type: 'REDO' }); toast('Redone', 'warn') }}
                  disabled={!history.future.length}
                  title="Redo (Ctrl+Y)"
                ><IconRedo /></button>
              </div>

              {slots.length > 0 && (
                <button
                  className="tt-btn tt-btn--danger"
                  onClick={() => setConfirmClearOpen(true)}
                  disabled={saving}
                  title="Clear all slots"
                >
                  <IconTrash /> Clear all
                </button>
              )}

              {saving && (
                <span className="tt-saving">
                  <span className="tt-saving-dot" /> Saving…
                </span>
              )}
            </div>
          </div>
        </header>

        {/* ── Three-panel body ── */}
        <div className="tt-body">
          {/* ── LEFT: class / subject panel ── */}
          <aside className="tt-left">
            {/* Tab switcher: Classes | Subjects */}
            <div className="tt-left-nav">
              <button
                type="button"
                className={`tt-left-nav-btn ${leftTab === 'classes' ? 'tt-left-nav-btn--active' : ''}`}
                onClick={() => setLeftTab('classes')}
              >
                Classes
                <span className="tt-badge" style={{ marginLeft: 4 }}>{filteredClasses.length}</span>
              </button>
              <button
                type="button"
                className={`tt-left-nav-btn ${leftTab === 'subjects' ? 'tt-left-nav-btn--active' : ''}`}
                onClick={() => setLeftTab('subjects')}
              >
                Subjects
                <span className="tt-badge" style={{ marginLeft: 4 }}>{filteredSubjects.length}</span>
              </button>
            </div>

            {leftTab === 'classes' ? (
              <>
                <div className="tt-input-icon-wrap" style={{ width: '100%' }}>
                  <IconSearch />
                  <input
                    className="tt-input tt-input--icon tt-input--sm"
                    placeholder="Filter classes…"
                    value={classSearch}
                    onChange={e => setClassSearch(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <select
                  className="tt-select"
                  value={classDepartmentFilter}
                  onChange={e => setClassDepartmentFilter(e.target.value)}
                  style={{ width: '100%', marginTop: 8 }}
                >
                  <option value="">All departments</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} {user?.department_id === dept.id ? ' (My Dept)' : ''}
                    </option>
                  ))}
                </select>

                <div className="tt-panel-label">
                  Classes
                  <span className="tt-badge">{filteredClasses.length}</span>
                </div>

                {/* Class cards */}
                <div className="tt-subject-list">
                  {filteredClasses.map(c => {
                    const color = getColor(c.id)
                    const isActive = activeClass?.cls?.id === c.id
                    const slotCount = slots.filter(sl => sl.class_id === c.id).length
                    const subjectCount = subjects.filter(s => s.department_id === c.department_id && s.semester === c.semester).length

                    return (
                      <div
                        key={c.id}
                        draggable
                        onDragStart={() => setDragClass({ cls: c, color })}
                        onDragEnd={() => setDragClass(null)}
                        onClick={() => setActiveClass(isActive ? null : { cls: c, color })}
                        className={`tt-subject-card ${isActive ? 'tt-subject-card--active' : ''}`}
                        style={{ '--sc': color.border, '--sc-bg': color.bg, '--sc-text': color.text }}
                      >
                        <div className="sc-stripe" />
                        <div className="sc-body">
                          <div className="sc-code">{c.name}-{c.section}</div>
                          <div className="sc-name">
                            Sem {c.semester} {c.department_id === user?.department_id ? '· Dept' : ''}
                            {subjectCount > 0 ? ` · ${subjectCount} subj` : ''}
                          </div>
                        </div>
                        {slotCount > 0 && (
                          <div className="sc-count" style={{ color: isActive ? color.text : undefined }}>
                            {slotCount}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {filteredClasses.length === 0 && (
                    <div className="tt-empty-list">No classes found</div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Subjects View */}
                <div className="tt-input-icon-wrap" style={{ width: '100%' }}>
                  <IconSearch />
                  <input
                    className="tt-input tt-input--icon tt-input--sm"
                    placeholder="Filter subjects…"
                    value={subjectSearch}
                    onChange={e => setSubjectSearch(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <select
                  className="tt-select"
                  value={subjectDepartmentFilter}
                  onChange={e => setSubjectDepartmentFilter(e.target.value)}
                  style={{ width: '100%', marginTop: 8 }}
                >
                  <option value="">All departments</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} {user?.department_id === dept.id ? ' (My Dept)' : ''}
                    </option>
                  ))}
                </select>

                <div className="tt-panel-label">
                  Subjects
                  <span className="tt-badge">{filteredSubjects.length}</span>
                </div>

                <div className="tt-subject-list">
                  {filteredSubjects.map(s => {
                    const color = getSubjectColor(s.id)
                    const isActive = activeSubject?.sub?.id === s.id
                    const slotCount = slots.filter(sl => sl.subject_id === s.id).length
                    const isLab = s.subject_type === 'lab'

                    return (
                      <div
                        key={s.id}
                        draggable
                        onDragStart={() => setDragSubject({ sub: s, color })}
                        onDragEnd={() => setDragSubject(null)}
                        onClick={() => {
                          if (isActive) {
                            setActiveSubject(null)
                          } else {
                            setActiveSubject({ sub: s, color })
                            if (!activeClass) {
                              const matchedClass = classes.find(c => c.department_id === s.department_id && c.semester === s.semester) || classes.find(c => c.department_id === s.department_id) || classes[0]
                              if (matchedClass) {
                                setActiveClass({ cls: matchedClass, color: getColor(matchedClass.id) })
                              }
                            }
                          }
                        }}
                        className={`tt-subject-card ${isActive ? 'tt-subject-card--active' : ''}`}
                        style={{ '--sc': color.border, '--sc-bg': color.bg, '--sc-text': color.text }}
                      >
                        <div className="sc-stripe" />
                        <div className="sc-body">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                            <div className="sc-code">{s.code}</div>
                            <span
                              style={{
                                fontSize: '9px',
                                fontWeight: '700',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: isLab ? '#FEF3C7' : '#EEF2FF',
                                color: isLab ? '#92400E' : '#3730A3',
                                textTransform: 'uppercase',
                              }}
                            >
                              {isLab ? 'Lab' : 'Theory'}
                            </span>
                          </div>
                          <div className="sc-name" title={s.name}>{s.name}</div>
                          <div className="sc-class">Sem {s.semester} · {s.credits} cr</div>
                        </div>
                        {slotCount > 0 && (
                          <div className="sc-count" style={{ color: isActive ? color.text : undefined }}>
                            {slotCount}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {filteredSubjects.length === 0 && (
                    <div className="tt-empty-list">No subjects found</div>
                  )}
                </div>
              </>
            )}

            <div className="tt-panel-label" style={{ marginTop: 4 }}>Assign as</div>
            <div className="tt-quickroom-row">
              <button
                type="button"
                className={`tt-quickroom-chip ${!quickRoomId ? 'tt-quickroom-chip--active' : ''}`}
                onClick={() => setQuickRoomId('')}
                title="Assign without a room (Theory hour)"
              >
                Theory
              </button>
              {rooms.filter(isLabRoom).map(r => (
                <button
                  key={r.id}
                  type="button"
                  className={`tt-quickroom-chip tt-quickroom-chip--lab ${quickRoomId === String(r.id) ? 'tt-quickroom-chip--active' : ''}`}
                  onClick={() => setQuickRoomId(String(r.id))}
                  title={`Assign in ${r.room_number} (Lab hour)`}
                >
                  {r.room_number}
                </button>
              ))}
            </div>

            {/* Active selection indicator */}
            {(activeClass || activeSubject) && (
              <div
                className="tt-active-hint"
                style={{
                  '--hint-border': (activeSubject?.color || activeClass?.color)?.border || '#C7D2FE',
                  '--hint-bg': (activeSubject?.color || activeClass?.color)?.bg || '#EEF2FF',
                  '--hint-text': (activeSubject?.color || activeClass?.color)?.text || '#4338CA',
                }}
              >
                <IconCheck />
                <span>
                  {activeSubject && activeClass ? (
                    <>
                      <strong>{activeSubject.sub.code} ({activeSubject.sub.name})</strong> for <strong>{activeClass.cls.name}-{activeClass.cls.section}</strong>
                    </>
                  ) : activeSubject ? (
                    <>
                      <strong>{activeSubject.sub.code} ({activeSubject.sub.name})</strong> selected
                    </>
                  ) : (
                    <>
                      <strong>{activeClass.cls.name}-{activeClass.cls.section}</strong> selected
                    </>
                  )}
                  {' '}— click empty cells to assign as{' '}
                  {quickRoomId ? <><strong>Lab</strong> ({rooms.find(r => r.id === Number(quickRoomId))?.room_number})</> : <strong>Theory</strong>}
                </span>
              </div>
            )}
          </aside>

          {/* ── CENTER: grid ── */}
          <main
            className={`tt-center ${paintMode && (activeClass || activeSubject) ? 'tt-center--paint' : ''}`}
            onMouseDown={() => { if (paintMode) setIsPainting(true) }}
            onMouseUp={() => setIsPainting(false)}
            onMouseLeave={() => { setIsPainting(false); setPaintHover(null) }}
          >
            {loading ? (
              <div className="tt-loading">
                <Spinner />
                <span>Loading schedule…</span>
              </div>
            ) : (
              <div className="tt-grid-wrapper">
                <div className="tt-grid-head">
                  <div className="tt-corner" />
                  {PERIODS.map(p => (
                    <div key={p} className="tt-period-head">
                      <span className="ph-num">Period {p}</span>
                      <span className="ph-time">{PERIOD_TIMES[p]}</span>
                    </div>
                  ))}
                </div>

                {DAY_ORDERS.map(day => (
                  <div key={day} className="tt-grid-row">
                    <div className="tt-day-label">
                      <span className="dl-short">{DAY_SHORT[day]}</span>
                      <span className="dl-full">{DAY_FULL[day]}</span>
                    </div>

                    {PERIODS.map(period => {
                      const slot = slotAt(day, period)
                      const color = slot ? getColor(slot.class_id) : null
                      const isSelected = selectedCell?.day_order === day && selectedCell?.period_number === period
                      const isDragOver = dragOver?.day === day && dragOver?.period === period
                      const isPaintHov = paintHover?.day === day && paintHover?.period === period
                      const conflict = conflicts[`${day}-${period}`]
                      const isPopped = poppedCells.has(`${day}-${period}`)

                      let cellBg = '#FAFAFA'
                      if (slot) cellBg = isSelected ? (color?.border || '#E5E7EB') : (color?.bg || '#F9FAFB')
                      else if (isDragOver) cellBg = '#EEF2FF'
                      else if (isPaintHov && (activeClass || activeSubject)) cellBg = '#F5F3FF'
                      else if (isSelected) cellBg = '#F0F9FF'

                      let borderColor = '#E4E7EC'
                      if (conflict) borderColor = '#EF4444'
                      else if (isSelected) borderColor = color?.border || '#6366F1'
                      else if (isDragOver) borderColor = '#818CF8'
                      else if (slot) borderColor = color?.border || '#E4E7EC'

                      return (
                        <div
                          key={period}
                          className={[
                            'tt-cell',
                            slot ? 'tt-cell--filled' : 'tt-cell--empty',
                            isSelected ? 'tt-cell--selected' : '',
                            isDragOver ? 'tt-cell--drag-over' : '',
                            conflict ? 'tt-cell--conflict' : '',
                            isPopped ? 'tt-cell--pop' : '',
                          ].join(' ')}
                          style={{
                            '--cb': cellBg,
                            '--cbr': borderColor,
                            '--ct': color?.text || '#374151',
                            '--csel': color?.border || '#818CF8',
                          }}
                          onClick={() => handleCellClick(day, period)}
                          onMouseEnter={() => {
                            setPaintHover({ day, period })
                            if (paintMode && isPainting && (activeClass || activeSubject) && !slot) assignSlot(day, period)
                          }}
                          onMouseLeave={() => setPaintHover(null)}
                          onDragOver={e => { e.preventDefault(); setDragOver({ day, period }) }}
                          onDragLeave={() => setDragOver(null)}
                          onDrop={() => handleDrop(day, period)}
                          title={conflict || (slot ? `${slot.subject_id ? slot.subject_name : 'Assigned'} · ${slot.class_name}` : `${DAY_SHORT[day]} · Period ${period}`)}
                        >
                          {slot && color && (
                            <div className="cell-top-bar" style={{ background: color.border }} />
                          )}

                          {slot ? (
                            <div className="cell-content">
                              <span className="cell-code">{slot.subject_id ? (slot.subject_code || abbrev(slot.subject_name)) : "Assigned"}</span>
                              <span className="cell-class">{slot.class_name}</span>
                              {slot.room_name && <span className="cell-room">{slot.room_name}</span>}
                              {slot.hour_type && (
                                <span className={`cell-hour-badge cell-hour-badge--${slot.hour_type.toLowerCase()}`}>
                                  {slot.hour_type}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="cell-plus">
                              {isDragOver ? '↓' : '+'}
                            </span>
                          )}

                          {conflict && <span className="cell-conflict-dot" />}
                        </div>
                      )
                    })}
                  </div>
                ))}

                {creditsSummary.length > 0 && (
                  <div className="tt-credits">
                    <span className="credits-label">Slots assigned</span>
                    <div className="credits-chips">
                      {creditsSummary.map(c => {
                        const color = getColor(c.id)
                        return (
                          <span key={c.id} className="credit-chip"
                            style={{ '--chip-bg': color.bg, '--chip-border': color.border, '--chip-text': color.text }}>
                            <strong>{c.name}-{c.section}</strong>&nbsp;·&nbsp;{c.count}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>

          {/* ── RIGHT: detail panel ── */}
          <aside className="tt-right">
            <div className="tt-teacher-card">
              <div className="teacher-avatar">
                {initials(user?.name)}
              </div>
              <div className="teacher-info">
                <div className="teacher-name">{user?.name}</div>
                <div className="teacher-slots">{slots.length} slot{slots.length !== 1 ? 's' : ''} assigned</div>
              </div>
            </div>

            {selectedCell ? (
              <div className="tt-cell-detail">
                <div className="cd-chips">
                  <span className="cd-chip cd-chip--day">{DAY_SHORT[selectedCell.day_order]}</span>
                  <span className="cd-chip cd-chip--period">Period {selectedCell.period_number}</span>
                  <span className="cd-chip cd-chip--time">{PERIOD_TIMES[selectedCell.period_number]}</span>
                </div>

                {selectedCell.slot ? (
                  <>
                    <div className="cd-subject" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span>{selectedCell.slot.subject_name}</span>
                      {selectedCell.slot.subject_id && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: '700',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: '#EEF2FF',
                            color: '#4338CA',
                          }}
                        >
                          {selectedCell.slot.subject_code}
                        </span>
                      )}
                    </div>
                    <div className="cd-class">{selectedCell.slot.class_name}</div>

                    {/* Change Subject */}
                    <div className="cd-section" style={{ marginTop: 8 }}>
                      <label className="cd-label">
                        Subject
                        <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '500', marginLeft: 4 }}>
                          (Change / Assign)
                        </span>
                      </label>
                      <input
                        className="tt-input tt-input--sm"
                        placeholder="Filter subjects…"
                        value={editSubjectSearch}
                        onChange={e => setEditSubjectSearch(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', marginBottom: 5 }}
                      />
                      <select
                        className="tt-select tt-select--sm"
                        value={editSubject}
                        onChange={e => {
                          const val = e.target.value
                          setEditSubject(val)
                          updateSlot(selectedCell.slot, { subject_id: val || null })
                        }}
                        style={{ width: '100%', boxSizing: 'border-box' }}
                      >
                        <option value="">None / General Duty</option>
                        {(() => {
                          const q = editSubjectSearch.toLowerCase()
                          const filtered = subjects.filter(s =>
                            !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
                          )
                          const currentClass = classes.find(c => c.id === selectedCell.slot.class_id)
                          const deptId = currentClass?.department_id || user?.department_id

                          const deptSubjects = filtered.filter(s => s.department_id === deptId)
                          const otherSubjects = filtered.filter(s => s.department_id !== deptId)

                          return (
                            <>
                              {deptSubjects.length > 0 && (
                                <optgroup label="Department Subjects">
                                  {deptSubjects.map(s => (
                                    <option key={s.id} value={s.id}>
                                      {s.code} · {s.name} ({s.subject_type === 'lab' ? 'Lab' : 'Theory'}, Sem {s.semester})
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              {otherSubjects.length > 0 && (
                                <optgroup label="Other Subjects">
                                  {otherSubjects.map(s => (
                                    <option key={s.id} value={s.id}>
                                      {s.code} · {s.name} ({s.subject_type === 'lab' ? 'Lab' : 'Theory'}, Sem {s.semester})
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </>
                          )
                        })()}
                      </select>
                    </div>

                    {/* Change Class Section */}
                    <div className="cd-section" style={{ marginTop: 8 }}>
                      <label className="cd-label">
                        Class Section
                      </label>
                      <select
                        className="tt-select tt-select--sm"
                        value={editClass}
                        onChange={e => {
                          const val = e.target.value
                          setEditClass(val)
                          updateSlot(selectedCell.slot, { class_id: val })
                        }}
                        style={{ width: '100%', boxSizing: 'border-box' }}
                      >
                        {classes.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} - {c.section} (Sem {c.semester})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Change Room */}
                    <div className="cd-section" style={{ marginTop: 8 }}>
                      <label className="cd-label">
                        Room
                        {(() => {
                          const ht = hourTypeForRoom(editRoom, rooms)
                          return ht ? (
                            <span className={`cd-hour-chip cd-hour-chip--${ht.toLowerCase()}`}>{ht} hour</span>
                          ) : null
                        })()}
                      </label>
                      <input
                        className="tt-input tt-input--sm"
                        placeholder="Filter rooms…"
                        value={roomFilter}
                        onChange={e => setRoomFilter(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', marginBottom: 5 }}
                      />
                      <select
                        className="tt-select tt-select--sm"
                        value={editRoom}
                        onChange={e => {
                          const val = e.target.value
                          setEditRoom(val)
                          updateSlot(selectedCell.slot, { room_id: val || null })
                        }}
                        style={{ width: '100%', boxSizing: 'border-box' }}
                      >
                        <option value="">No room assigned (Theory)</option>
                        {rooms
                          .filter(r => !roomFilter || r.room_number.toLowerCase().includes(roomFilter.toLowerCase()))
                          .map(r => (
                            <option key={r.id} value={r.id}>
                              {r.room_number} ({r.room_type === 'lab' ? 'Lab' : 'Classroom'})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="cd-actions" style={{ marginTop: 12 }}>
                      <button
                        className="tt-btn tt-btn--danger tt-btn--full"
                        onClick={() => removeSlot(selectedCell.slot)}
                        disabled={saving}
                      >
                        <IconTrash /> Remove slot
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="cd-empty-assign">
                    <p className="cd-assign-title">Assign slot to this cell</p>
                    <p className="cd-assign-desc font-xs text-slate-500">Pick details below to assign to {DAY_SHORT[selectedCell.day_order]} P{selectedCell.period_number}:</p>
                    <div className="space-y-3 mt-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Select Class *</label>
                        <select
                          className="input text-xs"
                          value={selectedClassId}
                          onChange={e => setSelectedClassId(e.target.value)}
                        >
                          <option value="">Choose class…</option>
                          {classes.map(c => <option key={c.id} value={c.id}>{c.name} - {c.section}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Select Subject (Optional)</label>
                        <select
                          className="input text-xs"
                          value={selectedSubjectId}
                          onChange={e => setSelectedSubjectId(e.target.value)}
                        >
                          <option value="">Choose subject…</option>
                          {subjects.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Select Room (Optional)</label>
                        <select
                          className="input text-xs"
                          value={selectedRoomId}
                          onChange={e => setSelectedRoomId(e.target.value)}
                        >
                          <option value="">No room assigned (Theory)</option>
                          {rooms.map(r => <option key={r.id} value={r.id}>{r.room_number} ({r.room_type === 'lab' ? 'Lab' : 'Classroom'})</option>)}
                        </select>
                      </div>

                      <button
                        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold w-full transition-colors cursor-pointer min-h-[40px]"
                        disabled={!selectedClassId || saving}
                        onClick={handleAssignFromPanel}
                      >
                        {saving ? 'Assigning…' : 'Assign Slot'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="tt-no-cell">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
                </svg>
                <span>Click any cell to inspect or assign details</span>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* ── Mobile Assign Slot Modal ── */}
      <Modal
        open={!!mobileAssignCell}
        onClose={() => setMobileAssignCell(null)}
        title={mobileAssignCell ? `Assign Class — ${DAY_SHORT[mobileAssignCell.day_order]} P${mobileAssignCell.period_number}` : 'Assign Class'}
      >
        {mobileAssignCell && (() => {
          const filteredMobileClasses = classes.filter(c =>
            (!mobileDeptFilter || String(c.department_id) === mobileDeptFilter) &&
            (!mobileClassSearch || c.name.toLowerCase().includes(mobileClassSearch.toLowerCase()) || (c.section || '').toLowerCase().includes(mobileClassSearch.toLowerCase()))
          )
          const availableMobileSubjects = mobileClassId
            ? subjects.filter(s => s.class_id === Number(mobileClassId))
            : subjects

          return (
            <div className="space-y-4">
              <div className="p-3 bg-primary-50 rounded-xl border border-primary-150 text-xs text-primary-900 font-semibold flex items-center justify-between">
                <span>{DAY_FULL[mobileAssignCell.day_order]}</span>
                <span className="font-mono">Period {mobileAssignCell.period_number} ({PERIOD_TIMES[mobileAssignCell.period_number]})</span>
              </div>

              {/* Class Selection & Filters */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">Select Class <span className="text-rose-500">*</span></label>
                  <span className="text-[10px] font-bold text-slate-400">{filteredMobileClasses.length} available</span>
                </div>

                <div className="space-y-2 mb-2">
                  <select
                    className="input text-xs w-full min-h-[40px]"
                    value={mobileDeptFilter}
                    onChange={e => setMobileDeptFilter(e.target.value)}
                  >
                    <option value="">All departments</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>

                  <input
                    type="text"
                    className="input text-xs w-full min-h-[40px]"
                    placeholder="Filter classes by name or section…"
                    value={mobileClassSearch}
                    onChange={e => setMobileClassSearch(e.target.value)}
                  />
                </div>

                <select
                  className="input text-xs w-full min-h-[44px] font-semibold"
                  value={mobileClassId}
                  onChange={e => {
                    setMobileClassId(e.target.value)
                    setMobileSubjectId('')
                  }}
                >
                  <option value="">Choose class…</option>
                  {filteredMobileClasses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} - {c.section}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject Selection */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Select Subject (Optional)</label>
                <select
                  className="input text-xs w-full min-h-[44px]"
                  value={mobileSubjectId}
                  onChange={e => setMobileSubjectId(e.target.value)}
                >
                  <option value="">Choose subject…</option>
                  {availableMobileSubjects.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                </select>
              </div>

              {/* Room Selection with Quick Chips */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Assign as Room / Lab</label>
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  <button
                    type="button"
                    onClick={() => setMobileRoomId('')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      !mobileRoomId
                        ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Theory (No Room)
                  </button>
                  {rooms.filter(isLabRoom).map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setMobileRoomId(String(r.id))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        mobileRoomId === String(r.id)
                          ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                          : 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
                      }`}
                    >
                      {r.room_number} (Lab)
                    </button>
                  ))}
                </div>

                <select
                  className="input text-xs w-full min-h-[44px]"
                  value={mobileRoomId}
                  onChange={e => setMobileRoomId(e.target.value)}
                >
                  <option value="">No room assigned (Theory)</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.room_number} ({r.room_type === 'lab' ? 'Lab' : 'Classroom'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Combine Class Checkbox */}
              <label className="flex items-center gap-2.5 p-3 bg-purple-50 border border-purple-200 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={combineClassMode}
                  onChange={e => setCombineClassMode(e.target.checked)}
                  className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-black text-purple-950">
                    👥 Combine Class / Multi-Staff
                  </span>
                  <span className="text-[10px] font-semibold text-purple-700">
                    Allow 2+ staff on this class or joint section
                  </span>
                </div>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">

                <button
                  type="button"
                  onClick={() => setMobileAssignCell(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!mobileClassId || saving}
                  onClick={handleMobileAssign}
                  className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold min-h-[44px]"
                >
                  {saving ? 'Assigning…' : 'Assign Slot'}
                </button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* ── Mobile Edit Room Modal ── */}
      <Modal
        open={!!mobileEditRoomSlot}
        onClose={() => setMobileEditRoomSlot(null)}
        title={mobileEditRoomSlot ? `Change Room — ${DAY_SHORT[mobileEditRoomSlot.day_order]} P${mobileEditRoomSlot.period_number}` : 'Change Room'}
      >
        {mobileEditRoomSlot && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <p className="font-extrabold text-slate-900">{mobileEditRoomSlot.class_name}</p>
              <p className="text-slate-500 mt-0.5">{mobileEditRoomSlot.subject_name}</p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Select Room / Lab</label>
              <select
                className="input text-xs w-full min-h-[44px]"
                value={mobileNewRoomId}
                onChange={e => setMobileNewRoomId(e.target.value)}
              >
                <option value="">No room assigned (Theory)</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.room_number} ({r.room_type === 'lab' ? 'Lab' : 'Classroom'})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMobileEditRoomSlot(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleMobileUpdateRoom}
                className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold min-h-[44px]"
              >
                {saving ? 'Updating…' : 'Save Room'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Clear confirmation modal */}
      {confirmClearOpen && (
        <Modal open={confirmClearOpen} onClose={() => setConfirmClearOpen(false)} title="Clear Timetable?">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to clear all slots for your timetable? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 min-h-[44px]" onClick={() => setConfirmClearOpen(false)}>
                Cancel
              </button>
              <button className="px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 min-h-[44px]" onClick={clearAll}>
                Yes, Clear All
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Conflict Modal Dialog */}
      <Modal open={!!conflictDetail} onClose={() => setConflictDetail(null)} title={conflictDetail?.title || 'Timetable conflict'}>
        <div className="tt-conflict-dialog">
          <div className="conflict-reason">
            <IconWarning />
            <div><strong>Why this happened</strong><p>{conflictDetail?.reason || 'This entry overlaps an existing timetable booking.'}</p></div>
          </div>
          <div className="conflict-time">
            {DAY_FULL[conflictRequested?.day_order] || 'Selected day'} · Period {conflictRequested?.period_number || '—'}
            {conflictRequested?.period_number && ` (${PERIOD_TIMES[conflictRequested.period_number]})`}
          </div>
          <div className="conflict-comparison">
            <section>
              <h4>Entry you tried to add</h4>
              <p><span>Teacher</span>{requestedTeacherName}</p>
              <p><span>Class</span>{requestedClassName}</p>
              <p><span>Subject</span>{requestedSubjectName}</p>
              <p><span>Room</span>{requestedRoomName}</p>
            </section>
            <section className="conflict-existing">
              <h4>Existing entry causing the conflict</h4>
              <p><span>Teacher</span>{conflictDetail?.existing?.teacher_name || `Teacher #${conflictDetail?.existing?.teacher_id || '—'}`}</p>
              <p><span>Class</span>{conflictDetail?.existing?.class_name || 'Unknown class'}</p>
              <p><span>Subject</span>{conflictDetail?.existing?.subject_name || 'Assigned session'}</p>
              <p><span>Room</span>{conflictDetail?.existing?.room_name || 'No room selected'}</p>
            </section>
          </div>
          <div className="conflict-resolution">
            <strong>How to fix it</strong>
            <p>{conflictDetail?.resolution || 'Choose a different class, room, day order, or period, or combine class.'}</p>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="tt-btn"
              onClick={() => setConflictDetail(null)}
              style={{ flex: 1, minWidth: '100px', justifyContent: 'center' }}
            >
              Close / Adjust
            </button>
            <button
              type="button"
              className="tt-btn tt-btn--combine-on min-h-[44px]"
              onClick={async () => {
                if (!conflictRequested) return
                setSaving(true)
                try {
                  let res
                  try {
                    res = await timetableApi.createSlot({
                      teacher_id: Number(conflictRequested.teacher_id || selectedTeacherId),
                      subject_id: conflictRequested.subject_id ? Number(conflictRequested.subject_id) : null,
                      class_id: Number(conflictRequested.class_id),
                      room_id: conflictRequested.room_id ? Number(conflictRequested.room_id) : null,
                      day_order: conflictRequested.day_order,
                      period_number: conflictRequested.period_number,
                      allow_combined_class: true,
                    })
                  } catch (err1) {
                    if (err1.response?.status === 409) throw err1
                    res = await timetableApi.submitMyEntry({
                      class_id: Number(conflictRequested.class_id),
                      subject_id: conflictRequested.subject_id ? Number(conflictRequested.subject_id) : null,
                      room_id: conflictRequested.room_id ? Number(conflictRequested.room_id) : null,
                      day_order: conflictRequested.day_order,
                      period_number: conflictRequested.period_number,
                      allow_combined_class: true,
                    })
                  }
                  const enrichedSlot = enrich(res.data, subjects, classes, rooms)
                  dispatch({ type: 'SET', payload: [...slots, enrichedSlot] })
                  popCell(conflictRequested.day_order, conflictRequested.period_number)
                  setConflicts(c => { const n = { ...c }; delete n[`${conflictRequested.day_order}-${conflictRequested.period_number}`]; return n })
                  setConflictDetail(null)
                  setMobileAssignCell(null)
                  setCombineClassMode(true)
                  toast('👥 Combined Class assigned / submitted successfully with co-staff!', 'success')
                } catch (err) {
                  toast(err.response?.data?.detail || 'Failed to combine class', 'error')
                } finally {
                  setSaving(false)
                }
              }}
              disabled={saving}
              style={{ flex: 1.5, minWidth: '160px', justifyContent: 'center', background: '#7C3AED', color: '#fff', border: '1px solid #6D28D9' }}
            >
              {saving ? 'Combining…' : '👥 Combine Class & Assign'}
            </button>
          </div>
        </div>
      </Modal>




      <style>{CSS}</style>
    </div>
  )
}



// ── Styles ────────────────────────────────────────────────────────────────────
const CSS = `
/* ─── Animations ─────────────────────────────────────────────────────────── */
@keyframes ttSlide   { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
@keyframes ttPop     { 0%,100% { transform:scale(1) } 45% { transform:scale(1.07) } }
@keyframes ttPulse   { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:.45; transform:scale(1.5) } }
@keyframes ttPaintPulse { 0%,100% { opacity:1 } 50% { opacity:.4 } }

/* ─── Root ───────────────────────────────────────────────────────────────── */
.tt-root {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 80px);
  min-height: 550px;
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
  background: #F7F8FC;
  color: #1E2532;
  font-size: 13px;
  line-height: 1.4;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid #E2E8F0;
}

/* ─── Header ─────────────────────────────────────────────────────────────── */
.tt-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 18px;
  background: #fff;
  border-bottom: 1px solid #E8EBEF;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.tt-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 150px;
}

.tt-brand-icon {
  width: 24px;
  height: 24px;
  color: #4F46E5;
  flex-shrink: 0;
}

.tt-title {
  font-size: 16px;
  font-weight: 700;
  color: #1E2532;
  margin: 0;
  letter-spacing: -0.3px;
}

.tt-subtitle {
  font-size: 11px;
  color: #94A3B8;
  margin: 2px 0 0;
  line-height: 1;
}

.tt-kbd {
  display: inline-block;
  padding: 1px 5px;
  background: #F1F5F9;
  border: 1px solid #E2E8F0;
  border-radius: 4px;
  font-size: 10px;
  font-family: inherit;
  color: #64748B;
}

.tt-controls {
  display: flex;
  flex-direction: column;
  gap: 7px;
  align-items: flex-end;
}

.tt-search-row,
.tt-action-row {
  display: flex;
  align-items: center;
  gap: 7px;
}

/* ─── Input / Select ─────────────────────────────────────────────────────── */
.tt-input-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.tt-input-icon-wrap svg {
  position: absolute;
  left: 9px;
  color: #94A3B8;
  pointer-events: none;
}

.tt-input {
  padding: 7px 10px;
  border: 1px solid #E4E7EC;
  border-radius: 8px;
  font-size: 12px;
  color: #334155;
  background: #fff;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}

.tt-input--icon { padding-left: 28px; }
.tt-input--sm   { padding: 5px 8px; font-size: 11px; border-radius: 7px; }

.tt-input:focus {
  border-color: #818CF8;
  box-shadow: 0 0 0 3px #EEF2FF;
}

.tt-select {
  padding: 7px 10px;
  border: 1px solid #E4E7EC;
  border-radius: 8px;
  font-size: 12px;
  color: #334155;
  background: #fff;
  cursor: pointer;
  outline: none;
  transition: border-color .15s;
}

.tt-select:focus { border-color: #818CF8; }
.tt-select--sm   { padding: 5px 8px; font-size: 11px; border-radius: 7px; }

/* ─── Buttons ────────────────────────────────────────────────────────────── */
.tt-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border: 1px solid #E4E7EC;
  border-radius: 8px;
  background: #fff;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all .14s;
  white-space: nowrap;
  font-family: inherit;
}

.tt-btn:hover:not(:disabled) { background: #F8FAFC; border-color: #C9D3DD; color: #1E2532; }
.tt-btn:disabled { opacity: .38; cursor: not-allowed; }

.tt-btn--paint-off { color: #475569; }
.tt-btn--paint-on  { background: #EEF2FF; border-color: #818CF8; color: #4338CA; }

.tt-paint-pulse {
  position: absolute;
  top: 6px;
  right: 7px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #6366F1;
  animation: ttPaintPulse 1.2s ease-in-out infinite;
}

.tt-btn--icon {
  padding: 6px 9px;
}

.tt-btn--danger {
  background: #FEF2F2;
  border-color: #FECACA;
  color: #DC2626;
}

.tt-btn--danger:hover:not(:disabled) { background: #FEE2E2; border-color: #FCA5A5; }

.tt-btn--primary {
  background: #4F46E5;
  border-color: #4F46E5;
  color: #fff;
  justify-content: center;
}

.tt-btn--primary:hover:not(:disabled) {
  background: #4338CA;
  border-color: #4338CA;
  color: #fff;
}

.tt-btn-group {
  display: flex;
  border: 1px solid #E4E7EC;
  border-radius: 8px;
  overflow: hidden;
}

.tt-btn-group .tt-btn {
  border-radius: 0;
  border: none;
  border-right: 1px solid #E4E7EC;
}

.tt-btn-group .tt-btn:last-child { border-right: none; }

.tt-saving {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #94A3B8;
  padding: 5px 9px;
  background: #F8FAFC;
  border-radius: 7px;
  border: 1px solid #E4E7EC;
}

.tt-saving-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #94A3B8;
  animation: ttPaintPulse 1s ease-in-out infinite;
}

/* ─── Body ───────────────────────────────────────────────────────────────── */
.tt-body {
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 14px 16px;
}

/* ─── Left panel ─────────────────────────────────────────────────────────── */
.tt-left {
  width: 210px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
  overflow-y: auto;
  padding-right: 2px;
}

.tt-left-nav {
  display: flex;
  background: #E2E8F0;
  border-radius: 9px;
  padding: 3px;
  gap: 3px;
  margin-bottom: 2px;
}

.tt-left-nav-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px 6px;
  font-size: 11px;
  font-weight: 600;
  color: #64748B;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all .15s ease;
  font-family: inherit;
}

.tt-left-nav-btn:hover {
  color: #1E2532;
}

.tt-left-nav-btn--active {
  background: #fff;
  color: #4F46E5;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  font-weight: 700;
}

.tt-panel-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 700;
  color: #94A3B8;
  text-transform: uppercase;
  letter-spacing: .08em;
  padding: 2px 0;
}

.tt-badge {
  background: #F1F5F9;
  color: #64748B;
  border-radius: 99px;
  padding: 1px 6px;
  font-size: 9px;
  font-weight: 700;
}

.tt-subject-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
}

.tt-subject-card {
  display: flex;
  align-items: stretch;
  border-radius: 10px;
  border: 1.5px solid #E8EBEF;
  background: #fff;
  cursor: grab;
  overflow: hidden;
  transition: border-color .12s, transform .1s, box-shadow .12s;
  box-shadow: 0 1px 2px rgba(30,37,50,.04);
  user-select: none;
}

.tt-subject-card:hover {
  border-color: var(--sc);
  box-shadow: 0 3px 8px rgba(30,37,50,.08);
  transform: translateY(-1px);
}

.tt-subject-card--active {
  background: var(--sc-bg);
  border-color: var(--sc);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--sc) 30%, transparent);
  transform: translateY(-1px);
}

.sc-stripe {
  width: 4px;
  background: var(--sc);
  flex-shrink: 0;
}

.sc-body {
  flex: 1;
  padding: 8px 10px;
  min-width: 0;
}

.sc-code {
  font-size: 12px;
  font-weight: 700;
  color: #1E2532;
  font-family: 'SF Mono', 'Fira Mono', monospace;
  letter-spacing: .01em;
}

.tt-subject-card--active .sc-code { color: var(--sc-text); }

.sc-name {
  font-size: 10px;
  color: #64748B;
  margin-top: 2px;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sc-count {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  font-size: 13px;
  font-weight: 700;
  color: #D1D5DB;
  min-width: 30px;
}

.tt-empty-list {
  font-size: 11px;
  color: #94A3B8;
  text-align: center;
  padding: 14px 0;
}

.tt-quickroom-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 2px;
}

.tt-quickroom-chip {
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  padding: 5px 10px;
  border-radius: 999px;
  border: 1.5px solid #E4E7EC;
  background: #fff;
  color: #64748B;
  cursor: pointer;
  transition: all .12s;
}

.tt-quickroom-chip:hover { border-color: #C7D2FE; color: #4F46E5; }

.tt-quickroom-chip--active {
  background: #EEF2FF;
  border-color: #6366F1;
  color: #4338CA;
}

.tt-quickroom-chip--lab.tt-quickroom-chip--active {
  background: #FFFBEB;
  border-color: #F59E0B;
  color: #B45309;
}

.tt-active-hint {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 9px 11px;
  background: var(--hint-bg, #EEF2FF);
  border: 1px solid var(--hint-border, #C7D2FE);
  border-radius: 9px;
  font-size: 11px;
  color: var(--hint-text, #4338CA);
  line-height: 1.5;
  margin-top: 2px;
  flex-shrink: 0;
}

.tt-active-hint svg { margin-top: 1px; flex-shrink: 0; }

/* ─── Center ────────────────────────────────────────────────────────────── */
.tt-center {
  flex: 1;
  min-width: 0;
  overflow: auto;
  cursor: default;
}

.tt-center--paint { cursor: crosshair; }

.tt-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 10px;
  color: #94A3B8;
  font-size: 12px;
}

/* ─── Grid ───────────────────────────────────────────────────────────────── */
.tt-grid-wrapper { min-width: 440px; }

.tt-grid-head,
.tt-grid-row {
  display: grid;
  grid-template-columns: 78px repeat(5, 1fr);
  gap: 5px;
  margin-bottom: 5px;
}

.tt-corner { }

.tt-period-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 4px;
  background: #fff;
  border: 1px solid #E8EBEF;
  border-radius: 8px;
  gap: 2px;
}

.ph-num  { font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: .05em; }
.ph-time { font-size: 9px; color: #94A3B8; font-family: 'SF Mono', 'Fira Mono', monospace; }

.tt-day-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 1px solid #E8EBEF;
  border-radius: 9px;
  height: 84px;
  gap: 1px;
}

.dl-short { font-size: 13px; font-weight: 700; color: #334155; }
.dl-full  { font-size: 8px; color: #94A3B8; letter-spacing: .04em; text-transform: uppercase; }

/* ─── Cell ───────────────────────────────────────────────────────────────── */
.tt-cell {
  position: relative;
  height: 84px;
  background: var(--cb, #FAFAFA);
  border: 2px solid var(--cbr, #E4E7EC);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  overflow: hidden;
  transition: transform .1s ease, box-shadow .1s ease;
}

.tt-cell:hover { transform: scale(1.025); }

.tt-cell--selected {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--csel, #818CF8) 30%, transparent);
}

.tt-cell--drag-over { border-style: dashed; }
.tt-cell--pop { animation: ttPop .28s ease; }

.cell-top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  border-radius: 8px 8px 0 0;
  opacity: .8;
}

.cell-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0 5px;
  width: 100%;
}

.cell-code {
  font-size: 13px;
  font-weight: 800;
  color: var(--ct, #374151);
  font-family: 'SF Mono', 'Fira Mono', monospace;
  letter-spacing: .03em;
}

.cell-class {
  font-size: 9px;
  color: #6B7280;
  text-align: center;
  line-height: 1.2;
}

.cell-room {
  font-size: 8px;
  color: #9CA3AF;
  margin-top: 1px;
}

.cell-hour-badge {
  font-size: 7px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .05em;
  padding: 1px 5px;
  border-radius: 999px;
  margin-top: 2px;
}

.cell-hour-badge--theory { background: #EFF6FF; color: #1D4ED8; }
.cell-hour-badge--lab    { background: #FFFBEB; color: #B45309; }

.cell-plus {
  font-size: 20px;
  color: #D1D5DB;
  font-weight: 300;
  transition: all .1s;
  line-height: 1;
}

.tt-cell--drag-over .cell-plus { color: #818CF8; font-size: 22px; }

.cell-conflict-dot {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #EF4444;
  animation: ttPulse 1.4s ease-in-out infinite;
}

/* ─── Credits ────────────────────────────────────────────────────────────── */
.tt-credits {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  padding: 9px 12px;
  background: #fff;
  border: 1px solid #E8EBEF;
  border-radius: 9px;
  flex-wrap: wrap;
}

.credits-label {
  font-size: 10px;
  font-weight: 700;
  color: #94A3B8;
  text-transform: uppercase;
  letter-spacing: .07em;
  white-space: nowrap;
}

.credits-chips { display: flex; flex-wrap: wrap; gap: 5px; }

.credit-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 99px;
  background: var(--chip-bg);
  border: 1px solid var(--chip-border);
  font-size: 10px;
  color: var(--chip-text);
  font-weight: 500;
}

/* ─── Right panel ────────────────────────────────────────────────────────── */
.tt-right {
  width: 224px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  padding-left: 2px;
}

.tt-teacher-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 13px;
  background: #fff;
  border: 1px solid #E8EBEF;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(30,37,50,.04);
  flex-shrink: 0;
}

.teacher-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: linear-gradient(135deg, #818CF8 0%, #6366F1 100%);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .5px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(99,102,241,.35);
}

.teacher-name  { font-size: 13px; font-weight: 700; color: #1E2532; }
.teacher-slots { font-size: 10px; color: #94A3B8; margin-top: 5px; }

.tt-cell-detail {
  padding: 13px;
  background: #fff;
  border: 1px solid #E8EBEF;
  border-radius: 12px;
  flex: 1;
  min-height: 0;
}

.cd-chips {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.cd-chip {
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}

.cd-chip--day    { background: #EEF2FF; color: #4F46E5; }
.cd-chip--period { background: #F1F5F9; color: #475569; }
.cd-chip--time   { background: #F8FAFC; color: #94A3B8; font-family: 'SF Mono','Fira Mono',monospace; font-size: 10px; }

.cd-subject { font-size: 14px; font-weight: 700; color: #1E2532; line-height: 1.3; }
.cd-class   { font-size: 11px; color: #64748B; margin-top: 3px; }
.cd-section { margin-top: 14px; }

.cd-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  color: #94A3B8;
  text-transform: uppercase;
  letter-spacing: .07em;
  margin-bottom: 6px;
}

.cd-hour-chip {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .04em;
}

.cd-hour-chip--theory { background: #EFF6FF; color: #1D4ED8; }
.cd-hour-chip--lab    { background: #FFFBEB; color: #B45309; }

.tt-remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 13px;
  width: 100%;
  padding: 8px 0;
  border-radius: 8px;
  border: 1px solid #FECACA;
  background: #FEF2F2;
  color: #DC2626;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all .14s;
  font-family: inherit;
}

.tt-no-cell {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background: #FAFAFA;
  border: 1.5px dashed #E4E7EC;
  border-radius: 12px;
  color: #CBD5E1;
  font-size: 12px;
  text-align: center;
  gap: 10px;
  line-height: 1.6;
}

.tt-toast-wrap {
  position: fixed;
  bottom: 80px; /* above mobile bottom nav */
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 7px;
  pointer-events: none;
}
@media (min-width: 1024px) {
  .tt-toast-wrap {
    bottom: 22px;
    right: 22px;
  }
}

.tt-toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  box-shadow: 0 4px 18px rgba(0,0,0,.13);
  animation: ttSlide .2s ease;
  max-width: 300px;
  border: 1px solid #A7F3D0;
  background: #ECFDF5;
  color: #065F46;
}

.tt-toast-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10B981;
  flex-shrink: 0;
}

.tt-toast--error { background:#FEF2F2; color:#991B1B; border-color:#FECACA; }
.tt-toast--error .tt-toast-dot { background:#EF4444; }
.tt-toast--warn  { background:#FFFBEB; color:#92400E; border-color:#FDE68A; }
.tt-toast--warn  .tt-toast-dot { background:#F59E0B; }

/* ─── Conflict Dialog ─── */
.conflicts-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 700;
  color: #991B1B;
  text-transform: uppercase;
  letter-spacing: .07em;
  margin-bottom: 7px;
}

.conflict-item {
  font-size: 10px;
  color: #DC2626;
  margin-bottom: 4px;
  line-height: 1.45;
}
.conflict-view-btn { border: 0; background: transparent; color: #B91C1C; padding: 0 0 0 5px; font-size: 10px; font-weight: 700; cursor: pointer; text-decoration: underline; }
.tt-conflict-dialog { padding: 4px; color: #374151; }
.conflict-reason { display: flex; gap: 10px; padding: 12px; border: 1px solid #FECACA; background: #FEF2F2; border-radius: 10px; color: #991B1B; }
.conflict-reason svg { width: 21px; height: 21px; flex: 0 0 auto; }
.conflict-reason strong, .conflict-resolution strong { display: block; font-size: 13px; }
.conflict-reason p, .conflict-resolution p { margin: 3px 0 0; font-size: 12px; line-height: 1.45; }
.conflict-time { margin: 12px 0; padding: 9px 11px; border-radius: 8px; background: #F3F4F6; font-size: 12px; font-weight: 700; color: #374151; }
.conflict-comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.conflict-comparison section { border: 1px solid #DBEAFE; background: #F8FBFF; border-radius: 10px; padding: 10px; }
.conflict-comparison .conflict-existing { border-color: #FECACA; background: #FFF8F8; }
.conflict-comparison h4 { margin: 0 0 8px; font-size: 11px; color: #1D4ED8; }
.conflict-existing h4 { color: #B91C1C; }
.conflict-comparison p { display: flex; justify-content: space-between; gap: 8px; margin: 4px 0; font-size: 11px; font-weight: 600; }
.conflict-comparison p span { color: #6B7280; font-weight: 500; }
.conflict-resolution { margin: 12px 0; padding: 10px 12px; border-left: 3px solid #2563EB; background: #EFF6FF; border-radius: 0 8px 8px 0; color: #1E3A8A; }
@media (max-width: 560px) { .conflict-comparison { grid-template-columns: 1fr; } }

/* ─── Responsive display controls ─── */
@media (max-width: 1023px) {
  .tt-root,
  .tt-desktop-view {
    display: none !important;
  }
  .tt-mobile-view {
    display: block !important;
  }
  .tt-body {
    flex-direction: column;
    overflow: visible;
    height: auto;
    padding: 10px;
    gap: 12px;
  }
  .tt-left {
    width: 100%;
    max-height: 250px;
    padding-right: 0;
    border-bottom: 1px solid #E4E7EC;
    padding-bottom: 10px;
  }
  .tt-subject-list {
    flex-direction: row;
    overflow-x: auto;
    gap: 8px;
    padding-bottom: 8px;
  }
  .tt-subject-card {
    flex: 0 0 150px;
  }
  .tt-center {
    width: 100%;
    overflow-x: auto;
    border: 1px solid #E4E7EC;
    border-radius: 12px;
    background: #fff;
    padding: 8px;
  }
  .tt-right {
    width: 100%;
    padding-left: 0;
    overflow-y: visible;
  }
}

@media (min-width: 1024px) {
  .tt-mobile-view {
    display: none !important;
  }
  .tt-desktop-view {
    display: flex !important;
  }
}
`


