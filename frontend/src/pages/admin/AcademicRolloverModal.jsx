import { useState, useEffect } from 'react'
import { academicCalendarApi, classRollRulesApi } from '../../api/services'
import { Modal, Spinner, ErrorAlert } from '../../components/ui'
import { CheckCircleIcon, AlertTriangleIcon } from '../../components/icons'

export default function AcademicRolloverModal({ isOpen, onClose, departmentId, onCompleted }) {
  const [academicYears, setAcademicYears] = useState([])
  const [fromYearId, setFromYearId] = useState('')
  const [toYearId, setToYearId] = useState('')
  const [loadingYears, setLoadingYears] = useState(true)
  const [previewing, setPreviewing] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [previewData, setPreviewData] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setLoadingYears(true)
      setError('')
      setSuccess('')
      setPreviewData(null)
      academicCalendarApi.listAcademicYears()
        .then(res => {
          const years = res.data || []
          setAcademicYears(years)
          if (years.length >= 2) {
            // Sort by start_date ascending
            const sorted = [...years].sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
            // Active year as fromYear, next as toYear
            const activeIdx = sorted.findIndex(y => y.is_active)
            if (activeIdx !== -1 && activeIdx + 1 < sorted.length) {
              setFromYearId(sorted[activeIdx].id)
              setToYearId(sorted[activeIdx + 1].id)
            } else {
              setFromYearId(sorted[0].id)
              setToYearId(sorted[sorted.length - 1].id)
            }
          }
        })
        .catch(err => {
          console.error('Failed to load academic years', err)
          setError('Failed to load academic years')
        })
        .finally(() => setLoadingYears(false))
    }
  }, [isOpen])

  const handlePreview = async () => {
    if (!fromYearId || !toYearId) {
      setError('Please select both source and target academic years.')
      return
    }
    if (fromYearId === toYearId) {
      setError('Source and target academic years must be different.')
      return
    }
    setPreviewing(true)
    setError('')
    setSuccess('')
    try {
      const res = await classRollRulesApi.previewRollover(fromYearId, toYearId, departmentId)
      setPreviewData(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to preview rollover progression')
    } finally {
      setPreviewing(false)
    }
  }

  const handleExecute = async () => {
    if (!previewData || previewData.classes.length === 0) return
    const confirmed = window.confirm(
      `Are you sure you want to execute academic rollover to ${previewData.to_year_name}? This will promote ${previewData.total_eligible} students into their new classes for the upcoming year.`
    )
    if (!confirmed) return

    setExecuting(true)
    setError('')
    try {
      const res = await classRollRulesApi.executeRollover({
        from_year_id: parseInt(fromYearId, 10),
        to_year_id: parseInt(toYearId, 10),
        progressions: previewData.classes
      })
      setSuccess(res.data.message)
      setPreviewData(null)
      if (onCompleted) onCompleted()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to execute rollover')
    } finally {
      setExecuting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Academic Year Rollover Progression" maxWidth="max-w-4xl">
      <div className="space-y-4">
        {error && <ErrorAlert message={error} onClose={() => setError('')} />}
        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
            {success}
          </div>
        )}

        {loadingYears ? (
          <div className="p-8 text-center"><Spinner className="w-6 h-6 mx-auto text-indigo-600" /></div>
        ) : (
          <>
            {/* Year Selection */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Source Academic Year (Current)</label>
                <select
                  value={fromYearId}
                  onChange={(e) => setFromYearId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-white"
                >
                  {academicYears.map(y => (
                    <option key={y.id} value={y.id}>{y.name} {y.is_active ? '(Active)' : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Target Academic Year (Upcoming)</label>
                <select
                  value={toYearId}
                  onChange={(e) => setToYearId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-white"
                >
                  {academicYears.map(y => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={previewing || !fromYearId || !toYearId}
                onClick={handlePreview}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
              >
                {previewing ? 'Computing Progression...' : 'Preview Rollover Plan'}
              </button>
            </div>

            {/* Preview Results Table */}
            {previewData && (
              <div className="space-y-4 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-700">
                    Progression Proposal: <span className="text-indigo-600 font-black">{previewData.from_year_name} → {previewData.to_year_name}</span>
                  </div>
                  <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-xl border border-emerald-200">
                    {previewData.total_eligible} Students Eligible for Promotion
                  </span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                      <tr>
                        <th className="py-2.5 px-4">Current Class ({previewData.from_year_name})</th>
                        <th className="py-2.5 px-4">Action</th>
                        <th className="py-2.5 px-4">Target Class ({previewData.to_year_name})</th>
                        <th className="py-2.5 px-4 text-right">Students</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewData.classes.map((cls, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-bold text-slate-900">{cls.from_class_name}</td>
                          <td className="py-2.5 px-4">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                              cls.action === 'PROMOTE'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {cls.action}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-700 font-medium">{cls.to_class_name || '—'}</td>
                          <td className="py-2.5 px-4 text-right font-black text-slate-900">{cls.eligible_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <div className="text-[11px] text-slate-400">
                    Permanent student identities remain intact. New enrollment history records will be generated.
                  </div>
                  <button
                    type="button"
                    disabled={executing || previewData.classes.length === 0}
                    onClick={handleExecute}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                  >
                    {executing ? 'Executing Rollover...' : 'Confirm & Execute Rollover'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
