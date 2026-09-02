import { useEffect, useState, useMemo } from 'react'
import { classesApi, departmentsApi, roomsApi } from '../../api/services'
import { Spinner, ErrorAlert, Modal, EmptyState } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'

export default function AdminClasses() {
  const { user, isSystemAdmin } = useAuth()

  const [classes, setClasses] = useState([])
  const [departments, setDepartments] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)

  // Single Add Class State
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', section: '', department_id: '', semester: 1, default_room_id: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Bulk Add Class (Range) State
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkForm, setBulkForm] = useState({
    mode: 'numeric_range', // 'numeric_range' or 'section_range'
    name_prefix: 'Year ',
    start_num: 1,
    end_num: 4,
    section: 'A',
    start_section: 'A',
    end_section: 'D',
    department_id: '',
    semester: 1,
    default_room_id: '',
    auto_increment_semester: true,
  })
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkSuccess, setBulkSuccess] = useState('')

  // Edit Class State
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedClass, setSelectedClass] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', section: '', department_id: '', semester: 1, default_room_id: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Delete Confirm State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [classToDelete, setClassToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const load = () => classesApi.list().then(r => setClasses(r.data)).finally(() => setLoading(false))

  useEffect(() => {
    load()
    roomsApi.list().then(r => setRooms(r.data)).catch(() => {})
    // Load ALL departments (include_global=true) so deptName lookup works for every class in the table.
    departmentsApi.list(true).then(r => {
      const allDepts = r.data
      setDepartments(allDepts)

      // Default department choices for form modals
      if (!isSystemAdmin && user?.department_id) {
        const userDeptId = String(user.department_id)
        setForm(f => ({ ...f, department_id: userDeptId }))
        setBulkForm(bf => ({ ...bf, department_id: userDeptId }))
      } else if (!isSystemAdmin && allDepts.length === 1) {
        const deptId = String(allDepts[0].id)
        setForm(f => ({ ...f, department_id: deptId }))
        setBulkForm(bf => ({ ...bf, department_id: deptId }))
      }
    })
  }, [isSystemAdmin, user])

  // Departments available for creation based on role
  const formDepts = (!isSystemAdmin && user?.department_id)
    ? departments.filter(d => d.id === user.department_id)
    : (!isSystemAdmin && departments.length === 1)
    ? departments
    : departments

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const targetDeptId = form.department_id || (formDepts.length === 1 ? formDepts[0].id : '')
      await classesApi.create({
        ...form,
        department_id: Number(targetDeptId),
        semester: Number(form.semester),
        default_room_id: form.default_room_id ? Number(form.default_room_id) : null,
      })
      setModalOpen(false)
      setForm({ name: '', section: '', department_id: !isSystemAdmin && user?.department_id ? String(user.department_id) : '', semester: 1, default_room_id: '' })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create class.')
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
      const targetDeptId = bulkForm.department_id || (formDepts.length === 1 ? formDepts[0].id : '')
      const res = await classesApi.bulkCreate({
        mode: bulkForm.mode,
        name_prefix: bulkForm.name_prefix,
        start_num: Number(bulkForm.start_num),
        end_num: Number(bulkForm.end_num),
        section: bulkForm.section,
        start_section: bulkForm.start_section,
        end_section: bulkForm.end_section,
        department_id: Number(targetDeptId),
        semester: Number(bulkForm.semester),
        default_room_id: bulkForm.default_room_id ? Number(bulkForm.default_room_id) : null,
        auto_increment_semester: Boolean(bulkForm.auto_increment_semester),
      })
      setBulkSuccess(res.data.message)
      setTimeout(() => {
        setBulkModalOpen(false)
        setBulkSuccess('')
      }, 1500)
      load()
    } catch (err) {
      setBulkError(err.response?.data?.detail || 'Failed to bulk create classes.')
    } finally {
      setBulkSaving(false)
    }
  }

  const getClassRangePreview = () => {
    const targetDeptId = bulkForm.department_id || (formDepts.length === 1 ? formDepts[0].id : '')
    if (!targetDeptId) return 'Select a department first'

    if (bulkForm.mode === 'section_range') {
      const startCode = (bulkForm.start_section || 'A').toUpperCase().charCodeAt(0)
      const endCode = (bulkForm.end_section || 'D').toUpperCase().charCodeAt(0)
      if (endCode < startCode || (endCode - startCode + 1) > 26) return 'Invalid section range'
      const count = endCode - startCode + 1
      const sample = []
      const limit = Math.min(count, 4)
      for (let i = 0; i < limit; i++) {
        const sec = String.fromCharCode(startCode + i)
        sample.push(`${bulkForm.name_prefix.trim()} (${sec}, Sem ${bulkForm.semester})`)
      }
      if (count > 4) sample.push('...')
      if (count > 4) {
        const lastSec = String.fromCharCode(endCode)
        sample.push(`${bulkForm.name_prefix.trim()} (${lastSec}, Sem ${bulkForm.semester})`)
      }
      return `${sample.join(' • ')} (${count} classes total)`
    } else {
      // numeric_range
      const start = Number(bulkForm.start_num) || 0
      const end = Number(bulkForm.end_num) || 0
      if (end < start || (end - start + 1) > 100) return 'Invalid numeric range'
      const count = end - start + 1
      const baseSem = Number(bulkForm.semester) || 1
      const sample = []
      const limit = Math.min(count, 4)
      for (let i = 0; i < limit; i++) {
        const num = start + i
        const name = `${bulkForm.name_prefix}${num}`.trim()
        const sem = bulkForm.auto_increment_semester ? Math.min(8, Math.max(1, baseSem + (i * 2))) : baseSem
        sample.push(`${name} (${bulkForm.section}, Sem ${sem})`)
      }
      if (count > 4) sample.push('...')
      if (count > 4) {
        const lastName = `${bulkForm.name_prefix}${end}`.trim()
        const lastSem = bulkForm.auto_increment_semester ? Math.min(8, Math.max(1, baseSem + ((count - 1) * 2))) : baseSem
        sample.push(`${lastName} (${bulkForm.section}, Sem ${lastSem})`)
      }
      return `${sample.join(' • ')} (${count} classes total)`
    }
  }

  const handleOpenEditModal = (cls) => {
    setSelectedClass(cls)
    setEditForm({
      name: cls.name,
      section: cls.section,
      department_id: cls.department_id,
      semester: cls.semester,
      default_room_id: cls.default_room_id ? String(cls.default_room_id) : '',
    })
    setEditError('')
    setEditModalOpen(true)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    setEditError('')
    setEditSaving(true)
    try {
      await classesApi.update(selectedClass.id, {
        name: editForm.name,
        section: editForm.section,
        department_id: Number(editForm.department_id),
        semester: Number(editForm.semester),
        default_room_id: editForm.default_room_id ? Number(editForm.default_room_id) : null,
      })
      setEditModalOpen(false)
      load()
    } catch (err) {
      setEditError(err.response?.data?.detail || 'Failed to update class.')
    } finally {
      setEditSaving(false)
    }
  }

  const handleOpenDelete = (cls) => {
    setClassToDelete(cls)
    setDeleteError('')
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = async () => {
    setDeleteError('')
    setDeleting(true)
    try {
      await classesApi.remove(classToDelete.id)
      setDeleteConfirmOpen(false)
      load()
    } catch (err) {
      setDeleteError(err.response?.data?.detail || 'Failed to delete class.')
    } finally {
      setDeleting(false)
    }
  }

  const deptName = (id) => departments.find(d => d.id === id)?.name || '—'
  const canManageClass = (c) => isSystemAdmin || !user?.department_id || c.department_id === user.department_id

  // Sorting & Filtering State
  const [sortField, setSortField] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterSemester, setFilterSemester] = useState('')

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const processedClasses = useMemo(() => {
    let list = [...classes]

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(c => 
        c.name.toLowerCase().includes(q) ||
        c.section.toLowerCase().includes(q) ||
        deptName(c.department_id).toLowerCase().includes(q) ||
        `sem ${c.semester}`.includes(q) ||
        `semester ${c.semester}`.includes(q) ||
        (c.default_room_number && c.default_room_number.toLowerCase().includes(q))
      )
    }

    // Department filter
    if (filterDept) {
      list = list.filter(c => String(c.department_id) === String(filterDept))
    }

    // Semester filter
    if (filterSemester) {
      list = list.filter(c => String(c.semester) === String(filterSemester))
    }

    // Sorting
    list.sort((a, b) => {
      let cmp = 0
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        if (cmp === 0) cmp = a.section.localeCompare(b.section)
      } else if (sortField === 'section') {
        cmp = a.section.localeCompare(b.section)
        if (cmp === 0) cmp = a.name.localeCompare(b.name, undefined, { numeric: true })
      } else if (sortField === 'department') {
        cmp = deptName(a.department_id).localeCompare(deptName(b.department_id))
        if (cmp === 0) cmp = a.name.localeCompare(b.name, undefined, { numeric: true })
      } else if (sortField === 'semester') {
        cmp = (a.semester || 0) - (b.semester || 0)
        if (cmp === 0) cmp = a.name.localeCompare(b.name, undefined, { numeric: true })
      } else if (sortField === 'room') {
        const rA = a.default_room_number || ''
        const rB = b.default_room_number || ''
        cmp = rA.localeCompare(rB, undefined, { numeric: true, sensitivity: 'base' })
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return list
  }, [classes, searchQuery, filterDept, filterSemester, sortField, sortDir, departments])

  const hasFilters = searchQuery || filterDept || filterSemester

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Classes</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage academic class sections and base room allocations</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button onClick={() => setBulkModalOpen(true)} className="btn-secondary text-sm flex items-center gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
            <span>⚡</span> Bulk Add (Range)
          </button>
          <button onClick={() => setModalOpen(true)} className="btn-primary text-sm">+ Add Class</button>
        </div>
      </div>

      {/* Search, Filter & Sorting Bar */}
      <div className="card p-3.5 bg-white border border-gray-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex-1 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">🔍</span>
            <input
              type="text"
              placeholder="Search by name, section, department, room..."
              className="input pl-9 text-xs py-2 w-full"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="input text-xs py-2 w-auto min-w-[140px]"
            value={filterDept}
            onChange={e => setFilterDept(e.target.value)}
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select
            className="input text-xs py-2 w-auto min-w-[120px]"
            value={filterSemester}
            onChange={e => setFilterSemester(e.target.value)}
          >
            <option value="">All Semesters</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
              <option key={s} value={s}>Semester {s}</option>
            ))}
          </select>

          {hasFilters && (
            <button
              onClick={() => { setSearchQuery(''); setFilterDept(''); setFilterSemester(''); }}
              className="text-xs text-gray-500 hover:text-gray-800 font-medium px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              ✕ Clear Filters
            </button>
          )}
        </div>

        <div className="text-xs text-gray-500 font-medium self-end md:self-center flex items-center gap-2">
          <span>Showing <b>{processedClasses.length}</b> of <b>{classes.length}</b> classes</span>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : classes.length === 0 ? (
          <EmptyState message="No classes yet." />
        ) : processedClasses.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-500">No classes match your filter criteria.</p>
            <button
              onClick={() => { setSearchQuery(''); setFilterDept(''); setFilterSemester(''); }}
              className="mt-2 text-xs text-primary-600 font-semibold hover:underline"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full text-sm" style={{ minWidth: '540px' }}>
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {[
                  { key: 'name', label: 'Name' },
                  { key: 'section', label: 'Section' },
                  { key: 'department', label: 'Department' },
                  { key: 'semester', label: 'Semester' },
                  { key: 'room', label: 'Base Room' },
                ].map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100/80 transition-colors"
                    title={`Sort by ${col.label}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.label}</span>
                      <span className="text-xs font-mono">
                        {sortField === col.key ? (
                          sortDir === 'asc' ? <span className="text-primary-600 font-bold">▲</span> : <span className="text-primary-600 font-bold">▼</span>
                        ) : (
                          <span className="text-gray-300">↕</span>
                        )}
                      </span>
                    </div>
                  </th>
                ))}
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {processedClasses.map(c => {
                const manageable = canManageClass(c)
                return (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-medium text-gray-800">{c.name}</td>
                    <td className="px-5 py-3 text-gray-500 font-mono text-xs">{c.section}</td>
                    <td className="px-5 py-3 text-gray-500">{deptName(c.department_id)}</td>
                    <td className="px-5 py-3 text-gray-500">Sem {c.semester}</td>
                    <td className="px-5 py-3 text-gray-500">
                      {c.default_room_number ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          🏢 {c.default_room_number} {c.default_room_type ? `(${c.default_room_type})` : ''}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {manageable ? (
                        <div className="flex justify-end gap-3">
                          <button onClick={() => handleOpenEditModal(c)} className="text-xs text-primary-600 hover:text-primary-800 font-semibold hover:underline">Edit</button>
                          <button onClick={() => handleOpenDelete(c)} className="text-xs text-red-500 hover:text-red-700 font-semibold hover:underline">Remove</button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 font-medium italic">🔒 Read-only</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Add Single Class Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Single Class">
        <form onSubmit={handleCreate} className="space-y-4">
          <ErrorAlert message={error} />
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Class name</label>
            <input type="text" required className="input" placeholder="Year 1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Section</label>
            <input type="text" required className="input" placeholder="A" value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
            <select
              required
              disabled={!isSystemAdmin && formDepts.length === 1}
              className="input disabled:bg-gray-100 disabled:cursor-not-allowed"
              value={form.department_id}
              onChange={e => setForm({ ...form, department_id: e.target.value })}
            >
              {(isSystemAdmin || formDepts.length > 1) && <option value="">Select Department…</option>}
              {formDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {!isSystemAdmin && formDepts.length === 1 && (
              <span className="text-[10px] text-indigo-600 font-semibold mt-1 flex items-center gap-1">
                🔒 Scoped to your department ({formDepts[0]?.name})
              </span>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Semester</label>
            <select className="input" value={form.semester} onChange={e => setForm({ ...form, semester: e.target.value })}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Base / Default Classroom (Optional)</label>
            <select
              className="input"
              value={form.default_room_id}
              onChange={e => setForm({ ...form, default_room_id: e.target.value })}
            >
              <option value="">No base room (Unassigned)</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>
                  {r.room_number} ({r.room_type} · Cap: {r.capacity})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">Assigns a dedicated home classroom for this class.</p>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      {/* Bulk Add Classes Modal (Range Generator) */}
      <Modal open={bulkModalOpen} onClose={() => setBulkModalOpen(false)} title="Bulk Add Classes (by Range)">
        <form onSubmit={handleBulkCreate} className="space-y-4">
          <ErrorAlert message={bulkError} />
          {bulkSuccess && (
            <div className="p-3 text-xs bg-green-50 text-green-700 rounded-md font-medium border border-green-200">
              {bulkSuccess}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Range Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`px-3 py-2 text-xs font-medium rounded-lg border text-center transition-colors ${
                  bulkForm.mode === 'numeric_range'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-semibold'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setBulkForm({ ...bulkForm, mode: 'numeric_range' })}
              >
                🔢 Years / Numbers (Year 1 .. 4)
              </button>
              <button
                type="button"
                className={`px-3 py-2 text-xs font-medium rounded-lg border text-center transition-colors ${
                  bulkForm.mode === 'section_range'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-semibold'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setBulkForm({ ...bulkForm, mode: 'section_range' })}
              >
                🔤 Section Range (Sec A .. D)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
            <select
              required
              disabled={!isSystemAdmin && formDepts.length === 1}
              className="input disabled:bg-gray-100 disabled:cursor-not-allowed"
              value={bulkForm.department_id}
              onChange={e => setBulkForm({ ...bulkForm, department_id: e.target.value })}
            >
              {(isSystemAdmin || formDepts.length > 1) && <option value="">Select Department…</option>}
              {formDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {!isSystemAdmin && formDepts.length === 1 && (
              <span className="text-[10px] text-indigo-600 font-semibold mt-1 flex items-center gap-1">
                🔒 Scoped to your department ({formDepts[0]?.name})
              </span>
            )}
          </div>

          {bulkForm.mode === 'numeric_range' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Name Prefix</label>
                  <input type="text" className="input" placeholder="Year " value={bulkForm.name_prefix} onChange={e => setBulkForm({ ...bulkForm, name_prefix: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Section</label>
                  <input type="text" required className="input" placeholder="A" value={bulkForm.section} onChange={e => setBulkForm({ ...bulkForm, section: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start Year / Number</label>
                  <input type="number" required min={1} className="input" value={bulkForm.start_num} onChange={e => setBulkForm({ ...bulkForm, start_num: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">End Year / Number</label>
                  <input type="number" required min={1} className="input" value={bulkForm.end_num} onChange={e => setBulkForm({ ...bulkForm, end_num: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Base Semester (Start)</label>
                  <select className="input" value={bulkForm.semester} onChange={e => setBulkForm({ ...bulkForm, semester: Number(e.target.value) })}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                  </select>
                </div>
                <div className="flex items-center pt-5">
                  <label className="inline-flex items-center cursor-pointer gap-2 text-xs text-gray-700 font-medium">
                    <input
                      type="checkbox"
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                      checked={bulkForm.auto_increment_semester}
                      onChange={e => setBulkForm({ ...bulkForm, auto_increment_semester: e.target.checked })}
                    />
                    Auto +2 Semesters per Year
                  </label>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Class Name</label>
                <input type="text" required className="input" placeholder="CSE Year 1" value={bulkForm.name_prefix} onChange={e => setBulkForm({ ...bulkForm, name_prefix: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start Section</label>
                  <input type="text" required maxLength={1} className="input uppercase" placeholder="A" value={bulkForm.start_section} onChange={e => setBulkForm({ ...bulkForm, start_section: e.target.value.toUpperCase() })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">End Section</label>
                  <input type="text" required maxLength={1} className="input uppercase" placeholder="D" value={bulkForm.end_section} onChange={e => setBulkForm({ ...bulkForm, end_section: e.target.value.toUpperCase() })} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Semester</label>
                <select className="input" value={bulkForm.semester} onChange={e => setBulkForm({ ...bulkForm, semester: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Base / Default Classroom (Optional)</label>
            <select
              className="input"
              value={bulkForm.default_room_id}
              onChange={e => setBulkForm({ ...bulkForm, default_room_id: e.target.value })}
            >
              <option value="">No base room (Unassigned)</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>
                  {r.room_number} ({r.room_type} · Cap: {r.capacity})
                </option>
              ))}
            </select>
          </div>

          <div className="p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-lg">
            <span className="text-[11px] font-semibold text-indigo-900 block mb-0.5">Range Live Preview:</span>
            <span className="text-xs font-mono text-indigo-700">{getClassRangePreview()}</span>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setBulkModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={bulkSaving} className="btn-primary flex-1">
              {bulkSaving ? 'Generating…' : '⚡ Generate & Create Classes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Class Modal */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Class">
        <form onSubmit={handleUpdate} className="space-y-4">
          <ErrorAlert message={editError} />
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Class name</label>
            <input type="text" required className="input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Section</label>
            <input type="text" required className="input" value={editForm.section} onChange={e => setEditForm({ ...editForm, section: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
            <select
              required
              disabled={!isSystemAdmin}
              className="input disabled:bg-gray-100 disabled:cursor-not-allowed"
              value={editForm.department_id}
              onChange={e => setEditForm({ ...editForm, department_id: e.target.value })}
            >
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {!isSystemAdmin && (
              <span className="text-[10px] text-gray-400 mt-0.5 block">Department ownership can only be modified by System Admin</span>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Semester</label>
            <select className="input" value={editForm.semester} onChange={e => setEditForm({ ...editForm, semester: e.target.value })}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Base / Default Classroom (Optional)</label>
            <select
              className="input"
              value={editForm.default_room_id}
              onChange={e => setEditForm({ ...editForm, default_room_id: e.target.value })}
            >
              <option value="">No base room (Unassigned)</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>
                  {r.room_number} ({r.room_type} · Cap: {r.capacity})
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setEditModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={editSaving} className="btn-primary flex-1">{editSaving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Delete Class">
        <div className="space-y-4">
          <ErrorAlert message={deleteError} />
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <span className="font-semibold text-gray-800">{classToDelete?.name} - {classToDelete?.section}</span>?
          </p>
          <p className="text-xs text-red-500 font-medium">This class cannot be deleted if it has slots on the academic timetable.</p>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setDeleteConfirmOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="button" onClick={handleDeleteConfirm} disabled={deleting} className="btn-danger flex-1">
              {deleting ? 'Deleting…' : 'Delete Class'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
