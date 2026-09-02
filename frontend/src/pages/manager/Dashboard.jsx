import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { operationalStaffApi } from '../../api/services'
import { useAuth } from '../../context/AuthContext'
import { Spinner } from '../../components/ui'
import { UsersIcon, DoorIcon, BookIcon, PlusIcon, CheckCircleIcon } from '../../components/icons'

export default function ManagerDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    operationalStaffApi.getStats()
      .then(res => setStats(res.data))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load dashboard metrics'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      {/* Hero Card */}
      <div className="card p-5 sm:p-6 bg-gradient-to-br from-slate-900 via-slate-850 to-indigo-950 text-white rounded-3xl shadow-sm relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-xs font-bold text-indigo-200">
            <span>Operational Management</span>
            <span>&middot;</span>
            <span>{user?.department || 'Institution-wide Scope'}</span>
          </div>
          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white">
            Welcome back, {user?.name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-xl">
            Oversee facility laboratory technicians, assistants, and administrative non-teaching personnel.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs sm:text-sm text-rose-700 font-semibold">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <>
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="card p-4 sm:p-5 border border-slate-200 bg-white rounded-2xl shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Staff</span>
                <span className="p-2 rounded-xl bg-primary-50 text-primary-600">
                  <UsersIcon className="w-5 h-5" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">
                {stats?.total_staff ?? 0}
              </div>
              <p className="text-[11px] font-semibold text-slate-500">Managed operational personnel</p>
            </div>

            <div className="card p-4 sm:p-5 border border-slate-200 bg-white rounded-2xl shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Lab Staff</span>
                <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <DoorIcon className="w-5 h-5" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">
                {stats?.total_lab_staff ?? 0}
              </div>
              <p className="text-[11px] font-semibold text-slate-500">{stats?.assigned_labs_count ?? 0} active laboratories</p>
            </div>

            <div className="card p-4 sm:p-5 border border-slate-200 bg-white rounded-2xl shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Non-Teaching</span>
                <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <BookIcon className="w-5 h-5" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">
                {stats?.total_non_teaching ?? 0}
              </div>
              <p className="text-[11px] font-semibold text-slate-500">Administrative & support staff</p>
            </div>

            <div className="card p-4 sm:p-5 border border-slate-200 bg-white rounded-2xl shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active On-Duty</span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <CheckCircleIcon className="w-5 h-5" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600">
                {stats?.active_staff ?? 0}
              </div>
              <p className="text-[11px] font-semibold text-slate-500">{stats?.on_leave_staff ?? 0} currently on leave</p>
            </div>
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/manager/lab-staff"
              className="card p-5 border border-slate-200 bg-white rounded-2xl hover:border-primary-500 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <DoorIcon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 group-hover:text-primary-600 transition-colors">
                  Laboratory Staff & Facilities
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  Manage lab technicians, equipment supervisors, room bindings, and shift allocations.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-primary-600">
                <span>View Lab Staff</span>
                <span>&rarr;</span>
              </div>
            </Link>

            <Link
              to="/manager/non-teaching-staff"
              className="card p-5 border border-slate-200 bg-white rounded-2xl hover:border-primary-500 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <UsersIcon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 group-hover:text-primary-600 transition-colors">
                  Non-Teaching Staff
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  Maintain administrative clerks, office assistants, library attendants, and departmental support.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-primary-600">
                <span>View Staff</span>
                <span>&rarr;</span>
              </div>
            </Link>

            <Link
              to="/manager/directory"
              className="card p-5 border border-slate-200 bg-white rounded-2xl hover:border-primary-500 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <BookIcon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 group-hover:text-primary-600 transition-colors">
                  Unified Staff Directory
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  Search across all operational personnel, contact information, employee codes, and work locations.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-primary-600">
                <span>Open Directory</span>
                <span>&rarr;</span>
              </div>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
