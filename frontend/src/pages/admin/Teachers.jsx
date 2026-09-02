import { useEffect, useMemo, useRef, useState } from 'react'
import { teachersApi, departmentsApi, campusOperationsApi } from '../../api/services'
import { Spinner, ErrorAlert, Modal } from '../../components/ui'

// ---------- tiny inline icons (no extra deps) ----------
const Icon = ({ children, className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {children}
  </svg>
)
const IconSearch = (p) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Icon>
const IconX = (p) => <Icon {...p}><path d="M18 6 6 18M6 6l12 12" /></Icon>
const IconChevronUp = (p) => <Icon {...p}><path d="m18 15-6-6-6 6" /></Icon>
const IconChevronDown = (p) => <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>
const IconChevronsUpDown = (p) => <Icon {...p}><path d="m7 15 5 5 5-5M7 9l5-5 5 5" /></Icon>
const IconDownload = (p) => <Icon {...p}><path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16" /></Icon>
const IconCopy = (p) => <Icon {...p}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></Icon>
const IconCheck = (p) => <Icon {...p}><path d="M20 6 9 17l-5-5" /></Icon>
const IconPlus = (p) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>
const IconDice = (p) => <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1" fill="currentColor" /><circle cx="16" cy="16" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /></Icon>
const IconEye = (p) => <Icon {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></Icon>
const IconEyeOff = (p) => <Icon {...p}><path d="M17.94 17.94A10.9 10.9 0 0 1 12 19c-6.5 0-10-7-10-7a18.6 18.6 0 0 1 4.22-5.15M9.9 4.24A9.9 9.9 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" /><path d="M2 2l20 20" /></Icon>

// ---------- helpers ----------
const PALETTE = [
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-sky-100', text: 'text-sky-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700' },
]
function hashStr(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) { h = str.charCodeAt(i) + ((h << 5) - h); h |= 0 }
  return Math.abs(h)
}
function colorFor(str) { return PALETTE[hashStr(str || '') % PALETTE.length] }
function initialsOf(name) {
  return (name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('') || '?'
}
function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  let pw = ''
  for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)]
  return pw
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Avatar({ name }) {
  const c = colorFor(name)
  return (
    <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-[11px] font-semibold ${c.bg} ${c.text}`}>
      {initialsOf(name)}
    </div>
  )
}

function SortHeader({ label, sortKey, sortConfig, onSort, className = '' }) {
  const active = sortConfig.key === sortKey
  return (
    <th className={`px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-gray-700 ${active ? 'text-gray-700' : ''}`}
      >
        {label}
        {active
          ? (sortConfig.direction === 'asc' ? <IconChevronUp className="h-3.5 w-3.5" /> : <IconChevronDown className="h-3.5 w-3.5" />)
          : <IconChevronsUpDown className="h-3.5 w-3.5 opacity-40" />}
      </button>
    </th>
  )
}

function StatCard({ label, value, accent }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent || 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

export default function Teachers() {
  const [teachers, setTeachers] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)

  // Banner (lightweight inline feedback, no toast dependency)
  const [banner, setBanner] = useState(null) // { type: 'success' | 'error', message }
  const showBanner = (type, message) => setBanner({ type, message })
  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(null), 4000)
    return () => clearTimeout(t)
  }, [banner])

  // Search / filter / sort / pagination
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const searchInputRef = useRef(null)

  // Selection / bulk actions
  const [selected, setSelected] = useState(() => new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  // Copy-to-clipboard feedback
  const [copiedId, setCopiedId] = useState(null)

  // Add Teacher Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', department: '', department_id: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)

  // Edit Teacher Modal State
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '', department: '', department_id: '', is_active: true })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [showEditPassword, setShowEditPassword] = useState(false)

  // Preferences Modal State
  const [prefModalOpen, setPrefModalOpen] = useState(false)
  const [selectedTeacherPref, setSelectedTeacherPref] = useState(null)
  const [prefForm, setPrefForm] = useState({
    accept_auto_assignments: true,
    allow_emergency_assignments: true,
    max_weekly_substitutions: 3,
    prefer_morning_classes: false,
    prefer_same_department: true
  })
  const [prefLoading, setPrefLoading] = useState(false)
  const [prefSaving, setPrefSaving] = useState(false)
  const [prefError, setPrefError] = useState('')
  const [prefSuccess, setPrefSuccess] = useState('')

  // Bulk Import Modal State
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkInput, setBulkInput] = useState('')
  const [bulkDeptId, setBulkDeptId] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkResult, setBulkResult] = useState(null)

  const handleBulkSubmit = async (e) => {
    e.preventDefault()
    setBulkError('')
    setBulkResult(null)
    const lines = bulkInput.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) {
      setBulkError('Please paste or type at least one teacher record (Name, Email).')
      return
    }

    const items = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const parts = line.split(/[,;\t]+/).map(p => p.trim()).filter(Boolean)
      if (parts.length < 2) {
        setBulkError(`Line ${i + 1} is invalid: "${line}". Expected format: Name, Email`)
        return
      }
      const [name, email, deptName] = parts
      let targetDeptId = bulkDeptId ? Number(bulkDeptId) : null
      if (deptName) {
        const found = departments.find(d => d.name?.toLowerCase() === deptName.toLowerCase() || d.code?.toLowerCase() === deptName.toLowerCase())
        if (found) targetDeptId = found.id
      }
      items.push({ name, email, department_id: targetDeptId })
    }

    setBulkSaving(true)
    try {
      const res = await teachersApi.bulkCreate({
        department_id: bulkDeptId ? Number(bulkDeptId) : undefined,
        teachers: items,
      })
      setBulkResult(res.data)
      showBanner('success', `Imported ${res.data.created_count} teachers successfully!`)
      load()
    } catch (err) {
      setBulkError(err.response?.data?.detail || 'Failed to bulk import teachers.')
    } finally {
      setBulkSaving(false)
    }
  }


  const handleOpenPreferencesModal = async (teacher) => {
    setSelectedTeacherPref(teacher)
    setPrefError('')
    setPrefSuccess('')
    setPrefModalOpen(true)
    setPrefLoading(true)
    try {
      const { data } = await campusOperationsApi.teacherPreferences(teacher.id)
      setPrefForm({
        accept_auto_assignments: data.accept_auto_assignments ?? true,
        allow_emergency_assignments: data.allow_emergency_assignments ?? true,
        max_weekly_substitutions: data.max_weekly_substitutions ?? 3,
        prefer_morning_classes: data.prefer_morning_classes ?? false,
        prefer_same_department: data.prefer_same_department ?? true
      })
    } catch (err) {
      setPrefError('Failed to load preferences.')
    } finally {
      setPrefLoading(false)
    }
  }

  const handleSavePreferences = async (e) => {
    e.preventDefault()
    setPrefError('')
    setPrefSuccess('')
    setPrefSaving(true)
    try {
      await campusOperationsApi.updateTeacherPreferences(selectedTeacherPref.id, prefForm)
      setPrefSuccess('Preferences updated successfully!')
      setTimeout(() => setPrefModalOpen(false), 1500)
    } catch (err) {
      setPrefError(err.response?.data?.detail || 'Failed to update preferences.')
    } finally {
      setPrefSaving(false)
    }
  }

  // Delete Teacher State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [teacherToDelete, setTeacherToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const load = () => {
    Promise.all([teachersApi.list(), departmentsApi.list()])
      .then(([t, d]) => {
        setTeachers(t.data)
        setDepartments(d.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // "/" focuses search, like most modern admin tools
  useEffect(() => {
    function handler(e) {
      const tag = document.activeElement?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Reset to page 1 and clear selection whenever filters change
  useEffect(() => {
    setPage(1)
    setSelected(new Set())
  }, [search, deptFilter, statusFilter, pageSize])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return teachers.filter(t => {
      const matchesSearch = !q || t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q)
      const matchesDept = deptFilter === 'all' || (t.department || '') === deptFilter
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? t.is_active : !t.is_active)
      return matchesSearch && matchesDept && matchesStatus
    })
  }, [teachers, search, deptFilter, statusFilter])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    const { key, direction } = sortConfig
    const dir = direction === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      let av, bv
      if (key === 'is_active') { av = a.is_active ? 1 : 0; bv = b.is_active ? 1 : 0 }
      else { av = String(a[key] || '').toLowerCase(); bv = String(b[key] || '').toLowerCase() }
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
    return arr
  }, [filtered, sortConfig])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageItems = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const startIdx = sorted.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endIdx = Math.min(currentPage * pageSize, sorted.length)

  const stats = useMemo(() => ({
    total: teachers.length,
    active: teachers.filter(t => t.is_active).length,
    disabled: teachers.filter(t => !t.is_active).length,
    departments: departments.length,
  }), [teachers, departments])

  const filtersActive = search.trim() !== '' || deptFilter !== 'all' || statusFilter !== 'all'
  const resetFilters = () => { setSearch(''); setDeptFilter('all'); setStatusFilter('all') }

  const handleSort = (key) => {
    setSortConfig(prev => prev.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' })
  }

  const allOnPageSelected = pageItems.length > 0 && pageItems.every(t => selected.has(t.id))
  const toggleSelectAllOnPage = () => {
    setSelected(prev => {
      const next = new Set(prev)
      if (allOnPageSelected) pageItems.forEach(t => next.delete(t.id))
      else pageItems.forEach(t => next.add(t.id))
      return next
    })
  }
  const toggleSelectOne = (id) => {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  const handleCopyEmail = (t) => {
    if (!navigator.clipboard) return
    navigator.clipboard.writeText(t.email).then(() => {
      setCopiedId(t.id)
      setTimeout(() => setCopiedId(null), 1500)
    })
  }

  const handleExportCsv = () => {
    const rows = [['Name', 'Email', 'Department', 'Status'], ...sorted.map(t => [t.name, t.email, t.department || '', t.is_active ? 'Active' : 'Disabled'])]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `teachers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await teachersApi.create({ ...form, role: 'teacher' })
      setModalOpen(false)
      setForm({ name: '', email: '', password: '', department: '', department_id: '' })
      setShowPassword(false)
      setEmailTouched(false)
      load()
      showBanner('success', `${form.name} was added as a teacher.`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create teacher.')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenEditModal = (teacher) => {
    setSelectedTeacher(teacher)
    setEditForm({
      name: teacher.name,
      email: teacher.email,
      password: '',
      department: teacher.department || '',
      department_id: teacher.department_id || '',
      is_active: teacher.is_active,
    })
    setEditError('')
    setShowEditPassword(false)
    setEditModalOpen(true)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    setEditError('')
    setEditSaving(true)
    try {
      await teachersApi.update(selectedTeacher.id, {
        name: editForm.name,
        email: editForm.email,
        department: editForm.department || null,
        department_id: editForm.department_id ? parseInt(editForm.department_id, 10) : null,
        is_active: editForm.is_active,
        password: editForm.password || null,
      })
      setEditModalOpen(false)
      load()
      showBanner('success', `Changes saved for ${editForm.name}.`)
    } catch (err) {
      setEditError(err.response?.data?.detail || 'Failed to update teacher.')
    } finally {
      setEditSaving(false)
    }
  }

  const handleOpenDelete = (teacher) => {
    setTeacherToDelete(teacher)
    setDeleteError('')
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = async () => {
    setDeleteError('')
    setDeleting(true)
    try {
      await teachersApi.remove(teacherToDelete.id)
      setDeleteConfirmOpen(false)
      load()
      showBanner('success', `${teacherToDelete.name} was removed.`)
    } catch (err) {
      setDeleteError(err.response?.data?.detail || 'Failed to delete teacher.')
    } finally {
      setDeleting(false)
    }
  }

  const handleBulkStatus = async (isActive) => {
    setBulkBusy(true)
    const ids = Array.from(selected)
    const results = await Promise.allSettled(ids.map(id => {
      const t = teachers.find(x => x.id === id)
      return teachersApi.update(id, { name: t.name, email: t.email, department: t.department || null, is_active: isActive, password: null })
    }))
    const failed = results.filter(r => r.status === 'rejected').length
    setBulkBusy(false)
    setSelected(new Set())
    load()
    showBanner(failed ? 'error' : 'success',
      failed ? `${ids.length - failed} updated, ${failed} failed.` : `${ids.length} teacher(s) ${isActive ? 'activated' : 'disabled'}.`)
  }

  const handleBulkDelete = async () => {
    setBulkBusy(true)
    const ids = Array.from(selected)
    const results = await Promise.allSettled(ids.map(id => teachersApi.remove(id)))
    const failed = results.filter(r => r.status === 'rejected').length
    setBulkBusy(false)
    setSelected(new Set())
    setBulkDeleteOpen(false)
    load()
    showBanner(failed ? 'error' : 'success',
      failed
        ? `${ids.length - failed} deleted, ${failed} failed (likely have assigned classes, leave requests, or substitute records).`
        : `${ids.length} teacher(s) deleted.`)
  }

  const emailInvalid = emailTouched && form.email.length > 0 && !EMAIL_RE.test(form.email)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900">Teachers</h1>
          <p className="text-sm text-gray-500">Manage teaching staff, departments, and account access.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <button
            onClick={() => {
              setBulkModalOpen(true)
              setBulkInput('')
              setBulkError('')
              setBulkResult(null)
            }}
            className="btn-secondary text-sm inline-flex items-center gap-1.5"
          >
            <IconCopy className="h-4 w-4" /> Bulk Import
          </button>
          <button onClick={() => setModalOpen(true)} className="btn-primary text-sm inline-flex items-center gap-1.5">
            <IconPlus className="h-4 w-4" /> Add Teacher
          </button>
        </div>
      </div>

      {banner && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium flex items-center justify-between border ${banner.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
          }`}>
          <span>{banner.message}</span>
          <button onClick={() => setBanner(null)} className="opacity-60 hover:opacity-100"><IconX className="h-4 w-4" /></button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Teachers" value={stats.total} />
        <StatCard label="Active" value={stats.active} accent="text-green-600" />
        <StatCard label="Disabled" value={stats.disabled} accent="text-gray-500" />
        <StatCard label="Departments" value={stats.departments} accent="text-primary-600" />
      </div>

      {/* Toolbar */}
      <div className="card p-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <IconSearch className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…  (press / to focus)"
            className="input pl-9"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <IconX className="h-4 w-4" />
            </button>
          )}
        </div>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="input sm:w-48">
          <option value="all">All departments</option>
          {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input sm:w-40">
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          <option value="disabled">Disabled only</option>
        </select>
        <button onClick={handleExportCsv} disabled={sorted.length === 0} className="btn-secondary text-sm inline-flex items-center gap-1.5 disabled:opacity-50">
          <IconDownload className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="card p-3 flex flex-wrap items-center gap-3 bg-primary-50 border-primary-100">
          <span className="text-sm font-semibold text-primary-800">{selected.size} selected</span>
          <button disabled={bulkBusy} onClick={() => handleBulkStatus(true)} className="text-xs font-semibold text-green-700 hover:underline disabled:opacity-50">Activate</button>
          <button disabled={bulkBusy} onClick={() => handleBulkStatus(false)} className="text-xs font-semibold text-gray-600 hover:underline disabled:opacity-50">Disable</button>
          <button disabled={bulkBusy} onClick={() => setBulkDeleteOpen(true)} className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">Delete</button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-gray-500 hover:underline">Clear selection</button>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <>
            <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-sm" style={{ minWidth: '640px' }}>
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={toggleSelectAllOnPage}
                        disabled={pageItems.length === 0}
                        aria-label="Select all teachers on this page"
                      />
                    </th>
                    <SortHeader label="Name" sortKey="name" sortConfig={sortConfig} onSort={handleSort} />
                    <SortHeader label="Email" sortKey="email" sortConfig={sortConfig} onSort={handleSort} className="hidden sm:table-cell" />
                    <SortHeader label="Department" sortKey="department" sortConfig={sortConfig} onSort={handleSort} className="hidden md:table-cell" />
                    <SortHeader label="Status" sortKey="is_active" sortConfig={sortConfig} onSort={handleSort} />
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pageItems.map(t => {
                    const dc = colorFor(t.department || '')
                    return (
                      <tr key={t.id} className={`hover:bg-gray-50/50 ${selected.has(t.id) ? 'bg-primary-50/40' : ''}`}>
                        <td className="px-5 py-3">
                          <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleSelectOne(t.id)} aria-label={`Select ${t.name}`} />
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={t.name} />
                            <div>
                              <div className="font-medium text-gray-800">{t.name}</div>
                              <div className="text-xs text-gray-400 sm:hidden">{t.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-gray-500 hidden sm:table-cell">
                          <div className="flex items-center gap-1.5">
                            <span>{t.email}</span>
                            <button onClick={() => handleCopyEmail(t)} className="text-gray-300 hover:text-gray-500" title="Copy email">
                              {copiedId === t.id ? <IconCheck className="h-3.5 w-3.5 text-green-500" /> : <IconCopy className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </td>
                        <td className="px-5 py-3 hidden md:table-cell">
                          {t.department
                            ? <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${dc.bg} ${dc.text}`}>{t.department}</span>
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {t.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex justify-end gap-3">
                            <button onClick={() => handleOpenPreferencesModal(t)} className="text-xs text-amber-600 hover:text-amber-800 font-semibold hover:underline">Preferences</button>
                            <button onClick={() => handleOpenEditModal(t)} className="text-xs text-primary-600 hover:text-primary-800 font-semibold hover:underline">Edit</button>
                            <button onClick={() => handleOpenDelete(t)} className="text-xs text-red-500 hover:text-red-700 font-semibold hover:underline">Remove</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {teachers.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">No teachers yet. Add one above.</td></tr>
                  )}
                  {teachers.length > 0 && sorted.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">
                        No teachers match your search or filters.{' '}
                        {filtersActive && <button onClick={resetFilters} className="text-primary-600 font-semibold hover:underline">Reset filters</button>}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {sorted.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-gray-100 text-xs text-gray-500">
                <span>Showing {startIdx}–{endIdx} of {sorted.length}</span>
                <div className="flex items-center gap-3">
                  <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className="input !py-1 !text-xs w-auto">
                    <option value={10}>10 / page</option>
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn-secondary !py-1 !px-2.5 text-xs disabled:opacity-40">Prev</button>
                    <span>Page {currentPage} of {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn-secondary !py-1 !px-2.5 text-xs disabled:opacity-40">Next</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Teacher Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Teacher">
        <form onSubmit={handleCreate} className="space-y-4">
          <ErrorAlert message={error} />
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Full name</label>
            <input type="text" required className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email" required
              className={`input ${emailInvalid ? 'border-red-300 focus:border-red-400' : ''}`}
              value={form.email}
              onBlur={() => setEmailTouched(true)}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
            {emailInvalid && <p className="text-[11px] text-red-500 mt-1">Enter a valid email address.</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
            <select
              required
              className="input"
              value={form.department_id || ''}
              onChange={e => {
                const id = e.target.value
                const d = departments.find(x => String(x.id) === String(id))
                setForm({ ...form, department_id: id ? parseInt(id, 10) : '', department: d ? d.name : '' })
              }}
            >
              <option value="">Select department…</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'} required
                className="input pr-16"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                <button type="button" title="Generate password" onClick={() => { setForm({ ...form, password: generatePassword() }); setShowPassword(true) }} className="text-gray-400 hover:text-gray-600">
                  <IconDice className="h-4 w-4" />
                </button>
                <button type="button" title={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(s => !s)} className="text-gray-400 hover:text-gray-600">
                  {showPassword ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      {/* Edit Teacher Modal */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Teacher">
        <form onSubmit={handleUpdate} className="space-y-4">
          <ErrorAlert message={editError} />
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Full name</label>
            <input type="text" required className="input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
            <input type="email" required className="input" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
            <select
              required
              className="input"
              value={editForm.department_id || ''}
              onChange={e => {
                const id = e.target.value
                const d = departments.find(x => String(x.id) === String(id))
                setEditForm({ ...editForm, department_id: id ? parseInt(id, 10) : '', department: d ? d.name : '' })
              }}
            >
              <option value="">Select department…</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">New Password (optional)</label>
            <div className="relative">
              <input
                type={showEditPassword ? 'text' : 'password'}
                placeholder="Leave blank to keep current"
                className="input pr-9"
                value={editForm.password}
                onChange={e => setEditForm({ ...editForm, password: e.target.value })}
              />
              <button type="button" title={showEditPassword ? 'Hide password' : 'Show password'} onClick={() => setShowEditPassword(s => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showEditPassword ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <span className="text-xs font-medium text-gray-700">Account Active Status</span>
              <p className="text-[10px] text-gray-400">Disabled accounts cannot log in or cover classes.</p>
            </div>
            <button
              type="button"
              onClick={() => setEditForm({ ...editForm, is_active: !editForm.is_active })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${editForm.is_active ? 'bg-primary-600' : 'bg-gray-200'
                }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${editForm.is_active ? 'translate-x-5' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setEditModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={editSaving} className="btn-primary flex-1">{editSaving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Delete Teacher">
        <div className="space-y-4">
          <ErrorAlert message={deleteError} />
          <p className="text-sm text-gray-600">
            Are you sure you want to delete the teacher <strong className="text-gray-800">{teacherToDelete?.name}</strong>? This action cannot be undone and will fail if the teacher has any associated timetable slots, leave requests, or substitute assignments.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setDeleteConfirmOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="button" onClick={handleDeleteConfirm} disabled={deleting} className="btn-danger flex-1">{deleting ? 'Deleting…' : 'Delete'}</button>
          </div>
        </div>
      </Modal>

      {/* Bulk Delete Confirmation Modal */}
      <Modal open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} title="Delete Teachers">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong className="text-gray-800">{selected.size}</strong> teacher(s)? This action cannot be undone, and any teacher with timetable slots, leave requests, or substitute assignments will be skipped.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setBulkDeleteOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="button" onClick={handleBulkDelete} disabled={bulkBusy} className="btn-danger flex-1">{bulkBusy ? 'Deleting…' : `Delete ${selected.size}`}</button>
          </div>
        </div>
      </Modal>

      {/* Teacher Preferences Override Modal */}
      <Modal open={prefModalOpen} onClose={() => setPrefModalOpen(false)} title={`Override Preferences - ${selectedTeacherPref?.name}`}>
        {prefLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <form onSubmit={handleSavePreferences} className="space-y-4">
            <ErrorAlert message={prefError} />
            {prefSuccess && (
              <div className="p-3 bg-green-50 text-green-755 text-xs font-bold rounded-xl border border-green-100">
                {prefSuccess}
              </div>
            )}

            <div className="space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={prefForm.accept_auto_assignments}
                  onChange={e => setPrefForm({ ...prefForm, accept_auto_assignments: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <p>Opt-in to Auto-Assignments</p>
                  <span className="block text-[10px] text-gray-450 font-normal">If disabled, this teacher is skipped during automatic substitution allocations</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={prefForm.allow_emergency_assignments}
                  onChange={e => setPrefForm({ ...prefForm, allow_emergency_assignments: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <p>Allow Emergency Assignments</p>
                  <span className="block text-[10px] text-gray-450 font-normal">Permit automatic assignments even if the leave is requested on short notice</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={prefForm.prefer_morning_classes}
                  onChange={e => setPrefForm({ ...prefForm, prefer_morning_classes: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <p>Prefer Morning Classes</p>
                  <span className="block text-[10px] text-gray-450 font-normal">Prioritize morning classes for substitution assignments when scoring compatibility</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={prefForm.prefer_same_department}
                  onChange={e => setPrefForm({ ...prefForm, prefer_same_department: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <p>Prefer Same Department</p>
                  <span className="block text-[10px] text-gray-450 font-normal">Prioritize teachers belonging to the same department during compatibility scoring</span>
                </div>
              </label>

              <div className="pt-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">Max Weekly Substitutions</label>
                <input
                  type="number"
                  min="0"
                  required
                  className="input"
                  value={prefForm.max_weekly_substitutions}
                  onChange={e => setPrefForm({ ...prefForm, max_weekly_substitutions: parseInt(e.target.value, 10) || 0 })}
                />
                <span className="block text-[10px] text-gray-450 mt-1">Maximum substitution allocations allowed within any 7-day window</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setPrefModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={prefSaving} className="btn-primary flex-1">
                {prefSaving ? 'Saving…' : 'Override Preferences'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Bulk Import Faculty Modal */}
      <Modal open={bulkModalOpen} onClose={() => setBulkModalOpen(false)} title="Bulk Import Faculty (CSV / Paste)">
        <form onSubmit={handleBulkSubmit} className="space-y-4">
          <ErrorAlert message={bulkError} />
          {bulkResult && (
            <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl text-xs space-y-1">
              <p className="font-bold">✓ Successfully created {bulkResult.created_count} faculty accounts.</p>
              {bulkResult.skipped_count > 0 && (
                <p className="text-amber-700">Skipped {bulkResult.skipped_count} items (already registered or invalid).</p>
              )}
              {bulkResult.errors?.length > 0 && (
                <ul className="list-disc pl-4 text-[11px] text-red-600 mt-1">
                  {bulkResult.errors.map((e, idx) => <li key={idx}>{e}</li>)}
                </ul>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Default Department (Fallback)</label>
            <select
              value={bulkDeptId}
              onChange={e => setBulkDeptId(e.target.value)}
              className="input text-xs"
            >
              <option value="">Select fallback department…</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Paste Faculty Records (one per line)
            </label>
            <p className="text-[11px] text-gray-500 mb-1.5">
              Format: <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800 font-mono">Full Name, email@college.edu</code>
            </p>
            <textarea
              rows={6}
              required
              value={bulkInput}
              onChange={e => setBulkInput(e.target.value)}
              placeholder={"Dr. Jane Doe, jane.doe@college.edu\nProf. John Smith, john.smith@college.edu"}
              className="input font-mono text-xs"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setBulkModalOpen(false)} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={bulkSaving} className="btn-primary flex-1">
              {bulkSaving ? 'Importing…' : 'Import Faculty'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}