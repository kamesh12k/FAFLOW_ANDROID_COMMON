import { useState, useEffect } from 'react'
import { managersApi, departmentsApi } from '../../api/services'
import { Spinner, Modal, EmptyState } from '../../components/ui'
import { PlusIcon, SearchIcon, UsersIcon, CheckCircleIcon, XCircleIcon } from '../../components/icons'

export default function Managers() {
  const [managers, setManagers] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    department_id: '',
  })

  const loadData = async () => {
    try {
      setLoading(true)
      const [mgrRes, deptRes] = await Promise.all([
        managersApi.list(),
        departmentsApi.list(true),
      ])
      setManagers(mgrRes.data)
      setDepartments(deptRes.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load managers')
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
      await managersApi.create({
        name: formData.name,
        username: formData.username,
        password: formData.password,
        department_id: formData.department_id ? Number(formData.department_id) : null,
      })
      setSuccess(`Manager account for '${formData.name}' created successfully!`)
      setCreateModalOpen(false)
      setFormData({ name: '', username: '', password: '', department_id: '' })
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create manager account')
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
      await managersApi.update(editTarget.id, {
        name: formData.name,
        department_id: formData.department_id === '' ? 0 : Number(formData.department_id),
        password: formData.password || undefined,
        is_active: formData.is_active,
      })
      setSuccess(`Manager account updated successfully!`)
      setEditTarget(null)
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update manager account')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    setError('')
    try {
      await managersApi.delete(deleteTarget.id)
      setSuccess(`Manager account deleted.`)
      setDeleteTarget(null)
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete manager')
    } finally {
      setSaving(false)
    }
  }

  const openEditModal = (mgr) => {
    setEditTarget(mgr)
    setFormData({
      name: mgr.name,
      username: mgr.username,
      password: '',
      department_id: mgr.department_id ? String(mgr.department_id) : '',
      is_active: mgr.is_active,
    })
  }

  const filteredManagers = managers.filter(m => {
    const q = search.toLowerCase()
    return m.name.toLowerCase().includes(q) || (m.username && m.username.toLowerCase().includes(q))
  })

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Manager Management</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Create and configure operational managers for laboratory and non-teaching staff.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormData({ name: '', username: '', password: '', department_id: '' })
            setCreateModalOpen(true)
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm shadow-primary-500/20 shrink-0 min-h-[44px]"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Add Manager</span>
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

      {/* Search Bar */}
      <div className="relative">
        <SearchIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search managers by name or username…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 min-h-[44px]"
        />
      </div>

      {/* Desktop Table View (>= lg) */}
      <div className="hidden lg:block card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filteredManagers.length === 0 ? (
          <EmptyState message="No manager accounts found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  {['Name & Username', 'Assigned Scope', 'Status', 'Credentials', 'Created Date', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredManagers.map(mgr => (
                  <tr key={mgr.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-extrabold text-slate-900">{mgr.name}</div>
                      <div className="text-xs text-slate-400 font-mono">@{mgr.username}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                        mgr.department_id
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-150'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-150'
                      }`}>
                        {mgr.department_name}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {mgr.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircleIcon className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          <XCircleIcon className="w-3.5 h-3.5" /> Disabled
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {mgr.must_change_credentials ? (
                        <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Temporary Password
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-500">
                          Configured
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">
                      {mgr.created_at ? new Date(mgr.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(mgr)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(mgr)}
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

      {/* Mobile Card View (< lg) */}
      <div className="block lg:hidden space-y-3">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filteredManagers.length === 0 ? (
          <div className="card p-6 text-center">
            <UsersIcon className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700">No manager accounts found.</p>
          </div>
        ) : (
          filteredManagers.map(mgr => (
            <div key={mgr.id} className="card p-4 border border-slate-200 bg-white rounded-2xl shadow-xs space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">{mgr.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">@{mgr.username}</p>
                </div>
                {mgr.is_active ? (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Active
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                    Disabled
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Scope:</span>
                <span className={`px-2 py-0.5 rounded-md font-bold text-xs ${
                  mgr.department_id ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {mgr.department_name}
                </span>
                {mgr.must_change_credentials && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                    Temp Credentials
                  </span>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => openEditModal(mgr)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 min-h-[40px]"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(mgr)}
                  className="px-3.5 py-2 rounded-xl border border-rose-200 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 min-h-[40px]"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Manager Modal */}
      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create Operational Manager">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Dr. Rajesh Kumar"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="input text-xs w-full min-h-[44px]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Username *</label>
            <input
              type="text"
              required
              placeholder="e.g. mgr_rajesh"
              value={formData.username}
              onChange={e => setFormData({ ...formData, username: e.target.value })}
              className="input text-xs w-full min-h-[44px]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Initial Password *</label>
            <input
              type="password"
              required
              placeholder="Min. 8 characters"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              className="input text-xs w-full min-h-[44px]"
            />
            <span className="text-[11px] text-slate-400 block mt-1">
              Manager will be prompted to set a private password upon first login.
            </span>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Manager Scope</label>
            <select
              value={formData.department_id}
              onChange={e => setFormData({ ...formData, department_id: e.target.value })}
              className="input text-xs w-full min-h-[44px]"
            >
              <option value="">Institution-wide (All Labs & Staff)</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>Department of {d.name} ({d.code})</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold min-h-[44px] disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create Manager'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Manager Modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Manager Account">
        {editTarget && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="input text-xs w-full min-h-[44px]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Scope</label>
              <select
                value={formData.department_id}
                onChange={e => setFormData({ ...formData, department_id: e.target.value })}
                className="input text-xs w-full min-h-[44px]"
              >
                <option value="">Institution-wide (All Labs & Staff)</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>Department of {d.name} ({d.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Reset Password (Optional)</label>
              <input
                type="password"
                placeholder="Leave blank to keep existing password"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                className="input text-xs w-full min-h-[44px]"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="mgr_active_checkbox"
                checked={formData.is_active}
                onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-primary-600 rounded"
              />
              <label htmlFor="mgr_active_checkbox" className="text-xs font-bold text-slate-800">
                Account Active
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold min-h-[44px] disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Manager Account">
        {deleteTarget && (
          <div className="space-y-4">
            <div className="p-3.5 bg-rose-50 border border-rose-150 rounded-xl text-xs text-rose-900">
              <p className="font-extrabold text-sm">Are you sure you want to delete {deleteTarget.name}?</p>
              <p className="mt-1">This manager will no longer be able to log in or manage operational staff.</p>
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
