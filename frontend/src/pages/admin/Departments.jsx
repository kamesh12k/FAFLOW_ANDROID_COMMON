import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useDepartment } from '../../context/DepartmentContext'
import { departmentsApi, adminApi } from '../../api/services'
import { Spinner, ErrorAlert, Modal, EmptyState } from '../../components/ui'

export default function AdminDepartments() {
  const { isSystemAdmin } = useAuth()
  const { refreshDepartments } = useDepartment()

  if (!isSystemAdmin) {
    return <Navigate to="/admin/dashboard" replace />
  }
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)

  // Add Department State
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', code: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Edit Department State
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedDept, setSelectedDept] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', code: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Delete Confirm State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deptToDelete, setDeptToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Administrator Management State
  const [globalUsers, setGlobalUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [userForm, setUserForm] = useState({ name: '', username: '', password: '', role: 'admin', department_id: '' })
  const [userSaving, setUserSaving] = useState(false)
  const [userError, setUserError] = useState('')

  const [userDeleteConfirmOpen, setUserDeleteConfirmOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState(null)
  const [userDeleting, setUserDeleting] = useState(false)
  const [userDeleteError, setUserDeleteError] = useState('')

  const load = () => departmentsApi.list(true).then(r => setDepartments(r.data)).finally(() => setLoading(false))
  const loadUsers = () => adminApi.listGlobalUsers().then(r => setGlobalUsers(r.data)).finally(() => setUsersLoading(false))

  useEffect(() => {
    load()
    loadUsers()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await departmentsApi.create({ name: form.name, code: form.code || null })
      setModalOpen(false)
      setForm({ name: '', code: '' })
      load()
      refreshDepartments?.()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create department.')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenEditModal = (dept) => {
    setSelectedDept(dept)
    setEditForm({
      name: dept.name,
      code: dept.code || '',
    })
    setEditError('')
    setEditModalOpen(true)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    setEditError('')
    setEditSaving(true)
    try {
      await departmentsApi.update(selectedDept.id, {
        name: editForm.name,
        code: editForm.code || null,
      })
      setEditModalOpen(false)
      load()
      refreshDepartments?.()
    } catch (err) {
      setEditError(err.response?.data?.detail || 'Failed to update department.')
    } finally {
      setEditSaving(false)
    }
  }

  const handleOpenDelete = (dept) => {
    setDeptToDelete(dept)
    setDeleteError('')
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = async () => {
    setDeleteError('')
    setDeleting(true)
    try {
      await departmentsApi.remove(deptToDelete.id)
      setDeleteConfirmOpen(false)
      load()
      refreshDepartments?.()
    } catch (err) {
      setDeleteError(err.response?.data?.detail || 'Failed to delete department.')
    } finally {
      setDeleting(false)
    }
  }


  const handleCreateUser = async (e) => {
    e.preventDefault()
    setUserError('')
    setUserSaving(true)
    try {
      if (userForm.role === 'principal') {
        await adminApi.createPrincipal({
          name: userForm.name,
          username: userForm.username,
          password: userForm.password,
        })
      } else {
        if (!userForm.department_id) {
          throw new Error('Please select a department for the HOD.')
        }
        await adminApi.createDepartmentAdmin(parseInt(userForm.department_id), {
          name: userForm.name,
          username: userForm.username,
          password: userForm.password,
        })
      }
      setUserModalOpen(false)
      setUserForm({ name: '', username: '', password: '', role: 'admin', department_id: '' })
      loadUsers()
    } catch (err) {
      setUserError(err.response?.data?.detail || err.message || 'Failed to register administrator.')
    } finally {
      setUserSaving(false)
    }
  }

  const handleOpenDeleteUser = (user) => {
    setUserToDelete(user)
    setUserDeleteError('')
    setUserDeleteConfirmOpen(true)
  }

  const handleDeleteUserConfirm = async () => {
    setUserDeleteError('')
    setUserDeleting(true)
    try {
      await adminApi.deleteGlobalUser(userToDelete.id)
      setUserDeleteConfirmOpen(false)
      loadUsers()
    } catch (err) {
      setUserDeleteError(err.response?.data?.detail || 'Failed to remove user.')
    } finally {
      setUserDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Departments</h1>
        <button onClick={() => setModalOpen(true)} className="btn-primary text-sm shrink-0 self-start sm:self-auto">+ Add Department</button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : departments.length === 0 ? <EmptyState message="No departments yet." /> : (
          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full text-sm" style={{ minWidth: '450px' }}>
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Name', 'Code', 'Created At', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {departments.map(d => (
                <tr key={d.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-medium text-gray-800">{d.name}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-500">{d.code || '—'}</td>
                  <td className="px-5 py-3 text-gray-500">{new Date(d.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <button onClick={() => handleOpenEditModal(d)} className="text-xs text-primary-600 hover:text-primary-800 font-semibold hover:underline">Edit</button>
                      <button onClick={() => handleOpenDelete(d)} className="text-xs text-red-500 hover:text-red-700 font-semibold hover:underline">Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Administrative Accounts Section */}
      <hr className="border-gray-200 my-8" />

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-gray-900">Administrative Accounts</h2>
            <p className="text-sm text-gray-500">Register HODs (Super Admins) for departments, or the college Principal.</p>
          </div>
          <button onClick={() => setUserModalOpen(true)} className="btn-primary text-sm shrink-0 self-start sm:self-auto">+ Register Administrator</button>
        </div>

        <div className="card overflow-hidden">
          {usersLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : globalUsers.length === 0 ? <EmptyState message="No administrators registered yet." /> : (
            <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-sm" style={{ minWidth: '550px' }}>
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Name', 'Username', 'Role', 'Department', ''].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {globalUsers.map(u => {
                    const dept = departments.find(d => d.id === u.department_id)
                    return (
                      <tr key={u.id} className="hover:bg-gray-50/50">
                        <td className="px-5 py-3 font-medium text-gray-800">{u.name}</td>
                        <td className="px-5 py-3 font-mono text-xs text-gray-500">{u.username}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                            u.role === 'principal' ? 'bg-amber-100 text-amber-700' : 'bg-primary-100 text-primary-700'
                          }`}>
                            {u.role === 'principal' ? 'Principal' : 'HOD (Super Admin)'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-600 font-medium">
                          {u.role === 'principal' ? 'Entire College' : (dept ? `${dept.name} (${dept.code || ''})` : '—')}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button onClick={() => handleOpenDeleteUser(u)} className="text-xs text-red-500 hover:text-red-700 font-semibold hover:underline">Remove</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Department Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Department">
        <form onSubmit={handleCreate} className="space-y-4">
          <ErrorAlert message={error} />
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Department Name</label>
            <input type="text" required className="input" placeholder="Computer Science" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Code</label>
            <input type="text" className="input" placeholder="CS" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      {/* Edit Department Modal */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Department">
        <form onSubmit={handleUpdate} className="space-y-4">
          <ErrorAlert message={editError} />
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Department Name</label>
            <input type="text" required className="input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Code</label>
            <input type="text" className="input" value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setEditModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={editSaving} className="btn-primary flex-1">{editSaving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Delete Department">
        <div className="space-y-4">
          <ErrorAlert message={deleteError} />
          <p className="text-sm text-gray-600">
            Are you sure you want to delete the department <strong className="text-gray-800">{deptToDelete?.name}</strong>? This action cannot be undone.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setDeleteConfirmOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="button" onClick={handleDeleteConfirm} disabled={deleting} className="btn-danger flex-1">{deleting ? 'Deleting…' : 'Delete'}</button>
          </div>
        </div>
      </Modal>

      {/* Add Administrator Modal */}
      <Modal open={userModalOpen} onClose={() => setUserModalOpen(false)} title="Register Administrator">
        <form onSubmit={handleCreateUser} className="space-y-4">
          <ErrorAlert message={userError} />
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
            <input type="text" required className="input" placeholder="Dr. Jane Doe" value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Temporary Username</label>
            <input type="text" required className="input" placeholder="jane_doe" value={userForm.username} onChange={e => setUserForm({ ...userForm, username: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Temporary Password</label>
            <input type="password" required className="input" placeholder="••••••••" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
            <select className="input" value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value, department_id: e.target.value === 'principal' ? '' : userForm.department_id })}>
              <option value="admin">HOD (Super Admin)</option>
              <option value="principal">Principal</option>
            </select>
          </div>
          {userForm.role === 'admin' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
              <select required className="input" value={userForm.department_id} onChange={e => setUserForm({ ...userForm, department_id: e.target.value })}>
                <option value="">-- Select Department --</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code || '—'})</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setUserModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={userSaving} className="btn-primary flex-1">{userSaving ? 'Registering…' : 'Register'}</button>
          </div>
        </form>
      </Modal>

      {/* Remove Administrator Confirmation Modal */}
      <Modal open={userDeleteConfirmOpen} onClose={() => setUserDeleteConfirmOpen(false)} title="Remove Administrator">
        <div className="space-y-4">
          <ErrorAlert message={userDeleteError} />
          <p className="text-sm text-gray-600">
            Are you sure you want to remove <strong className="text-gray-800">{userToDelete?.name}</strong>? They will no longer be able to log in.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setUserDeleteConfirmOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="button" onClick={handleDeleteUserConfirm} disabled={userDeleting} className="btn-danger flex-1">{userDeleting ? 'Removing…' : 'Remove'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
