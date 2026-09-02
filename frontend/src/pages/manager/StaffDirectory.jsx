import { useState, useEffect } from 'react'
import { operationalStaffApi } from '../../api/services'
import { Spinner, EmptyState } from '../../components/ui'
import { SearchIcon, UsersIcon, DoorIcon, BookIcon } from '../../components/icons'

export default function StaffDirectory() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryTab, setCategoryTab] = useState('all') // 'all' | 'laboratory' | 'non_teaching'
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    operationalStaffApi.list()
      .then(res => setStaff(res.data))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load staff directory'))
      .finally(() => setLoading(false))
  }, [])

  const filteredStaff = staff.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = (
      s.full_name.toLowerCase().includes(q) ||
      s.employee_code.toLowerCase().includes(q) ||
      s.designation.toLowerCase().includes(q) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.department_name && s.department_name.toLowerCase().includes(q))
    )
    const matchCat = categoryTab === 'all' || s.category === categoryTab
    return matchSearch && matchCat
  })

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Staff Directory</h1>
        <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
          Browse and look up operational, laboratory, and non-teaching personnel.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs sm:text-sm text-rose-700 font-semibold">
          {error}
        </div>
      )}

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setCategoryTab('all')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              categoryTab === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All Staff ({staff.length})
          </button>
          <button
            type="button"
            onClick={() => setCategoryTab('laboratory')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              categoryTab === 'laboratory'
                ? 'bg-white text-amber-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Laboratory ({staff.filter(s => s.category === 'laboratory').length})
          </button>
          <button
            type="button"
            onClick={() => setCategoryTab('non_teaching')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              categoryTab === 'non_teaching'
                ? 'bg-white text-indigo-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Non-Teaching ({staff.filter(s => s.category === 'non_teaching').length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <SearchIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search directory…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-primary-500 min-h-[44px]"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : filteredStaff.length === 0 ? (
        <div className="card p-12 text-center bg-white rounded-2xl border border-slate-200">
          <BookIcon className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No staff found</h3>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your category filter or search keywords.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.map(st => (
            <div
              key={st.id}
              className="card p-4 sm:p-5 border border-slate-200 bg-white rounded-2xl shadow-xs space-y-3 hover:border-slate-300 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900">{st.full_name}</h3>
                  </div>
                  <p className="text-xs font-semibold text-slate-600">{st.designation}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                  st.employment_status === 'active'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  {st.employment_status.replace('_', ' ')}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Employee Code</span>
                  <span className="font-mono font-bold text-slate-800">{st.employee_code}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Category</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                    st.category === 'laboratory'
                      ? 'bg-amber-50 text-amber-800'
                      : 'bg-indigo-50 text-indigo-800'
                  }`}>
                    {st.category === 'laboratory' ? 'Laboratory' : 'Non-Teaching'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Department</span>
                  <span className="font-semibold text-slate-800 text-right">{st.department_name}</span>
                </div>
                {st.assigned_room_number && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Lab Facility</span>
                    <span className="font-bold text-amber-700">Room {st.assigned_room_number}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Shift</span>
                  <span className="capitalize font-semibold text-slate-800">{st.shift_type}</span>
                </div>
              </div>

              {(st.phone_number || st.email) && (
                <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-0.5">
                  {st.phone_number && <div>📞 {st.phone_number}</div>}
                  {st.email && <div className="truncate">✉️ {st.email}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
