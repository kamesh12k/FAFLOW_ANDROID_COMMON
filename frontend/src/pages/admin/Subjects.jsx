import { useEffect, useState } from 'react'
import { subjectsApi, departmentsApi } from '../../api/services'
import { Spinner, ErrorAlert, Modal, EmptyState } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'

export default function AdminSubjects() {
  const { user, isSystemAdmin } = useAuth()

  const [subjects, setSubjects] = useState([])
  const [departments, setDepartments] = useState([])
  const [showArchived, setShowArchived] = useState(false)
  const [loading, setLoading] = useState(true)

  // Add Subject State
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', subject_type: 'theory', department_id: '', semester: 1 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Edit Subject State
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [editForm, setEditForm] = useState({ code: '', name: '', subject_type: 'theory', department_id: '', semester: 1 })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Delete Confirm State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [subjectToDelete, setSubjectToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const load = () => subjectsApi.list(showArchived, true).then(r => setSubjects(r.data)).finally(() => setLoading(false))

  useEffect(() => { load() }, [showArchived])
  useEffect(() => {
    departmentsApi.list(true).then(r => {
      const allDepts = r.data
      setDepartments(allDepts)
      if (!isSystemAdmin && user?.department_id) {
        setForm(f => ({ ...f, department_id: String(user.department_id) }))
      } else if (!isSystemAdmin && allDepts.length === 1) {
        setForm(f => ({ ...f, department_id: String(allDepts[0].id) }))
      }
    })
  }, [isSystemAdmin, user])

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
      await subjectsApi.create({ ...form, credits: 1, department_id: Number(targetDeptId), semester: Number(form.semester) })
      setModalOpen(false)
      setForm({ code: '', name: '', subject_type: 'theory', department_id: !isSystemAdmin && user?.department_id ? String(user.department_id) : '', semester: 1 })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create subject.')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenEditModal = (subject) => {
    setSelectedSubject(subject)
    setEditForm({
      code: subject.code,
      name: subject.name,
      subject_type: subject.subject_type,
      department_id: subject.department_id,
      semester: subject.semester,
    })
    setEditError('')
    setEditModalOpen(true)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    setEditError('')
    setEditSaving(true)
    try {
      await subjectsApi.update(selectedSubject.id, {
        code: editForm.code,
        name: editForm.name,
        subject_type: editForm.subject_type,
        department_id: Number(editForm.department_id),
        semester: Number(editForm.semester),
      })
      setEditModalOpen(false)
      load()
    } catch (err) {
      setEditError(err.response?.data?.detail || 'Failed to update subject.')
    } finally {
      setEditSaving(false)
    }
  }

  const handleOpenDelete = (subject) => {
    setSubjectToDelete(subject)
    setDeleteError('')
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = async () => {
    setDeleteError('')
    setDeleting(true)
    try {
      await subjectsApi.remove(subjectToDelete.id)
      setDeleteConfirmOpen(false)
      load()
    } catch (err) {
      setDeleteError(err.response?.data?.detail || 'Failed to delete subject.')
    } finally {
      setDeleting(false)
    }
  }

  const toggleArchive = async (s) => {
    try {
      if (s.is_archived) await subjectsApi.unarchive(s.id)
      else await subjectsApi.archive(s.id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to toggle subject status.')
    }
  }

  const deptName = (id) => departments.find(d => d.id === id)?.name || '—'
  const canManageSubject = (s) => isSystemAdmin || !user?.department_id || s.department_id === user.department_id

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Subjects</h1>
        <div className="flex items-center gap-3 flex-wrap self-start sm:self-auto">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer font-medium">
            <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
            Show archived
          </label>
          <button onClick={() => setModalOpen(true)} className="btn-primary text-sm">+ Add Subject</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : subjects.length === 0 ? <EmptyState message="No subjects yet." /> : (
          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full text-sm" style={{ minWidth: '550px' }}>
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Code', 'Name', 'Type', 'Department', 'Semester', 'Status', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {subjects.map(s => {
                const manageable = canManageSubject(s)
                return (
                  <tr key={s.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{s.code}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">{s.name}</td>
                    <td className="px-5 py-3 text-gray-500 capitalize">{s.subject_type}</td>
                    <td className="px-5 py-3 text-gray-500">{deptName(s.department_id)}</td>
                    <td className="px-5 py-3 text-gray-500">Sem {s.semester}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${s.is_archived ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>
                        {s.is_archived ? 'Archived' : 'Active'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {manageable ? (
                        <div className="flex justify-end gap-3">
                          <button onClick={() => handleOpenEditModal(s)} className="text-xs text-primary-600 hover:text-primary-800 font-semibold hover:underline">Edit</button>
                          <button onClick={() => toggleArchive(s)} className="text-xs text-gray-500 hover:text-gray-700 font-semibold hover:underline">
                            {s.is_archived ? 'Unarchive' : 'Archive'}
                          </button>
                          <button onClick={() => handleOpenDelete(s)} className="text-xs text-red-500 hover:text-red-700 font-semibold hover:underline">
                            Delete
                          </button>
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

      {/* Add Subject Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Subject">
        <form onSubmit={handleCreate} className="space-y-4">
          <ErrorAlert message={error} />
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Code</label>
            <input type="text" required className="input" placeholder="CS-202" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
            <input type="text" required className="input" placeholder="Data Structures" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
            <select className="input" value={form.subject_type} onChange={e => setForm({ ...form, subject_type: e.target.value })}>
              <option value="theory">Theory</option>
              <option value="lab">Lab</option>
            </select>
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
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Semester</label>
            <select className="input" value={form.semester} onChange={e => setForm({ ...form, semester: e.target.value })}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      {/* Edit Subject Modal */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Subject">
        <form onSubmit={handleUpdate} className="space-y-4">
          <ErrorAlert message={editError} />
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Code</label>
            <input type="text" required className="input" value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
            <input type="text" required className="input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
            <select className="input" value={editForm.subject_type} onChange={e => setEditForm({ ...editForm, subject_type: e.target.value })}>
              <option value="theory">Theory</option>
              <option value="lab">Lab</option>
            </select>
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
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Semester</label>
            <select className="input" value={editForm.semester} onChange={e => setEditForm({ ...editForm, semester: e.target.value })}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setEditModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={editSaving} className="btn-primary flex-1">{editSaving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Delete Subject">
        <div className="space-y-4">
          <ErrorAlert message={deleteError} />
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <span className="font-semibold text-gray-800">{subjectToDelete?.code} — {subjectToDelete?.name}</span>?
          </p>
          <p className="text-xs text-amber-600 font-medium">
            Deleting this subject will unbind it from any timetable slots and pending reviews. If this subject was taught previously, consider archiving it instead.
          </p>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setDeleteConfirmOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="button" onClick={handleDeleteConfirm} disabled={deleting} className="btn-danger flex-1">
              {deleting ? 'Deleting…' : 'Delete Subject'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
