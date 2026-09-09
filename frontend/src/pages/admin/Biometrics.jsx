import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { biometricsApi, departmentsApi } from '../../api/services'
import { Spinner, ErrorAlert, Modal, EmptyState } from '../../components/ui'

export default function AdminBiometrics() {
  const { isSystemAdmin, isAdmin } = useAuth()
  const [faculty, setFaculty] = useState([])
  const [departments, setDepartments] = useState([])
  const [selectedDept, setSelectedDept] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Reset Biometric State
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [selectedFaculty, setSelectedFaculty] = useState(null)
  const [resetting, setResetting] = useState(false)

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [facRes, deptRes] = await Promise.all([
        biometricsApi.listFaculty({ include_cross_department: true }),
        departmentsApi.list(false)
      ])
      setFaculty(facRes.data || [])
      setDepartments(deptRes.data || [])
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load faculty biometric registration records.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredFaculty = faculty.filter(f => {
    const matchesSearch = f.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          f.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          f.username?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesDept = !selectedDept || String(f.department_id) === String(selectedDept)
    return matchesSearch && matchesDept
  })

  const enrolledCount = faculty.filter(f => Boolean(f.has_face_enrolled)).length
  const pendingCount = faculty.filter(f => !f.has_face_enrolled).length

  const handleResetBiometric = async () => {
    if (!selectedFaculty) return
    setResetting(true)
    setError('')
    try {
      await biometricsApi.resetBiometrics(selectedFaculty.id)
      setSuccessMsg(`Biometric profile for ${selectedFaculty.name} has been reset. The faculty member must re-enroll their face template via the mobile app.`)
      setResetModalOpen(false)
      setSelectedFaculty(null)
      loadData()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reset biometric template.')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Biometrics & Face Registration Control</h1>
          <p className="text-sm text-gray-500 mt-1">
            System Administrator console for institutional facial templates, real biometric enrollment tracking, and device authorization resets.
          </p>
        </div>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-900 font-bold ml-4">✕</button>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Registered Faculty</span>
          <p className="text-2xl font-bold text-gray-900 mt-1">{faculty.length}</p>
          <span className="text-xs text-gray-500 mt-1 block">Active institutional faculty accounts</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Face Templates Enrolled</span>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{enrolledCount}</p>
          <span className="text-xs text-gray-500 mt-1 block">Verified 512-D ArcFace profiles in hardware Keystore</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Pending Enrollment</span>
          <p className="text-2xl font-bold text-amber-700 mt-1">{pendingCount}</p>
          <span className="text-xs text-gray-500 mt-1 block">Awaiting physical phone face capture</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search faculty by name, email, or staff ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white shadow-sm"
          />
        </div>
        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white shadow-sm"
        >
          <option value="">All Departments</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
          ))}
        </select>
      </div>

      {/* Faculty Biometric Registry Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : filteredFaculty.length === 0 ? (
        <EmptyState
          title="No Faculty Matching Search"
          description="Try clearing your search query or department filters."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 text-xs font-semibold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">Faculty Member</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Biometric Status</th>
                  <th className="px-6 py-4">Verification Method</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredFaculty.map((f) => {
                  const isEnrolled = Boolean(f.has_face_enrolled)
                  return (
                    <tr key={f.id} className="hover:bg-gray-50/75 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{f.name}</div>
                        <div className="text-xs text-gray-500">{f.email || `Staff #${f.id}`}</div>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-700">
                        {f.department || 'General Academic'}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                            isEnrolled
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isEnrolled ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          {isEnrolled ? 'Face Enrolled' : 'Pending Enrollment'}
                        </span>
                        {isEnrolled && f.face_enrolled_at && (
                          <div className="text-[11px] text-gray-400 mt-1">
                            {new Date(f.face_enrolled_at).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-gray-500">
                        {isEnrolled ? 'ArcFace 512-D (Hardware Keystore)' : 'Not Enrolled'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isEnrolled ? (
                          <button
                            onClick={() => {
                              setSelectedFaculty(f)
                              setResetModalOpen(true)
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
                          >
                            Reset Biometrics
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Awaiting Mobile Capture</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {resetModalOpen && selectedFaculty && (
        <Modal
          open={resetModalOpen}
          title="Reset Faculty Biometric Face Profile"
          onClose={() => setResetModalOpen(false)}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to reset the stored facial recognition template for <strong className="text-gray-900">{selectedFaculty.name}</strong>?
            </p>
            <p className="text-xs text-gray-500 bg-amber-50 border border-amber-200 p-3 rounded-xl">
              This will clear their existing facial template and allow the faculty member to re-enroll their face from the FAFLOW mobile app.
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetBiometric}
                disabled={resetting}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {resetting && <Spinner size="sm" />}
                Confirm Reset
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
