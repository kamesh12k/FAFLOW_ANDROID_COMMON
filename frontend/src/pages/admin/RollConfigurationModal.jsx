import { useState, useEffect } from 'react'
import { classRollRulesApi } from '../../api/services'
import { Modal, Spinner, ErrorAlert, Button } from '../../components/ui'
import { CheckCircleIcon, AlertTriangleIcon } from '../../components/icons'

export default function RollConfigurationModal({ isOpen, onClose, selectedClass, onSaved }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Roll rule state
  const [prefix, setPrefix] = useState('')
  const [startNum, setStartNum] = useState(1)
  const [endNum, setEndNum] = useState(60)
  const [padding, setPadding] = useState(3)

  // Exceptions & Roster
  const [ruleId, setRuleId] = useState(null)
  const [exceptions, setExceptions] = useState([])
  const [rosterData, setRosterData] = useState(null)
  const [activeTab, setActiveTab] = useState('CONFIG') // 'CONFIG' or 'EFFECTIVE_ROSTER'

  // Form input for new exception
  const [otherRoll, setOtherRoll] = useState('')
  const [otherReason, setOtherReason] = useState('')
  const [excludeRoll, setExcludeRoll] = useState('')
  const [excludeReason, setExcludeReason] = useState('')

  const loadData = async () => {
    if (!selectedClass) return
    setLoading(true)
    setError('')
    try {
      const [ruleRes, rosterRes] = await Promise.all([
        classRollRulesApi.getRule(selectedClass.id),
        classRollRulesApi.getEffectiveRoster(selectedClass.id)
      ])

      const r = ruleRes.data
      if (r) {
        setRuleId(r.id)
        setPrefix(r.prefix)
        setStartNum(r.start_number)
        setEndNum(r.end_number)
        setPadding(r.padding || 3)
        setExceptions(r.exceptions || [])
      } else {
        // Default smart suggestion based on class name or year e.g. 25UCS
        const yr = new Date().getFullYear().toString().slice(-2)
        setPrefix(`${yr}CS`)
        setStartNum(1)
        setEndNum(60)
        setPadding(3)
        setExceptions([])
      }

      setRosterData(rosterRes.data)
    } catch (err) {
      console.error('Failed to load roll configuration', err)
      setError(err.response?.data?.detail || 'Failed to load roll configuration')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen, selectedClass])

  const handleSaveRule = async (e) => {
    e.preventDefault()
    if (!prefix.trim()) {
      setError('Please provide a roll number prefix (e.g. 25UCS)')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await classRollRulesApi.saveRule(selectedClass.id, {
        prefix: prefix.trim().toUpperCase(),
        start_number: parseInt(startNum, 10),
        end_number: parseInt(endNum, 10),
        padding: parseInt(padding, 10),
        is_active: true
      })
      setSuccess('Roll range rule saved successfully!')
      await loadData()
      if (onSaved) onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save roll range rule')
    } finally {
      setSaving(false)
    }
  }

  const handleAddException = async (type) => {
    const roll = type === 'INCLUDE' ? otherRoll : excludeRoll
    const reason = type === 'INCLUDE' ? otherReason : excludeReason

    if (!roll.trim()) {
      setError(`Please enter a roll number to ${type === 'INCLUDE' ? 'add' : 'exclude'}`)
      return
    }

    try {
      setError('')
      await classRollRulesApi.addException(selectedClass.id, {
        roll_number: roll.trim().toUpperCase(),
        exception_type: type,
        reason: reason.trim() || null
      })
      if (type === 'INCLUDE') {
        setOtherRoll('')
        setOtherReason('')
      } else {
        setExcludeRoll('')
        setExcludeReason('')
      }
      await loadData()
      if (onSaved) onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add exception')
    }
  }

  const handleDeleteException = async (exceptionId) => {
    try {
      setError('')
      await classRollRulesApi.deleteException(selectedClass.id, exceptionId)
      await loadData()
      if (onSaved) onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to remove exception')
    }
  }

  const handleClearAllExceptions = async (type) => {
    const targetList = exceptions.filter(e => e.exception_type === type)
    if (targetList.length === 0) return
    try {
      setError('')
      await Promise.all(targetList.map(e => classRollRulesApi.deleteException(selectedClass.id, e.id)))
      await loadData()
      if (onSaved) onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to clear all exceptions')
    }
  }

  const validation = rosterData?.validation
  const expectedCount = Math.max(0, endNum - startNum + 1)
  const includes = exceptions.filter(e => e.exception_type === 'INCLUDE')
  const excludes = exceptions.filter(e => e.exception_type === 'EXCLUDE')

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Roll Configuration: ${selectedClass?.name || ''} - ${selectedClass?.section || ''}`} maxWidth="max-w-4xl">
      {loading ? (
        <div className="p-12 text-center">
          <Spinner className="w-8 h-8 mx-auto text-indigo-600" />
          <p className="mt-3 text-sm text-slate-500 font-medium">Resolving class roll rules & effective roster...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {error && <ErrorAlert message={error} onClose={() => setError('')} />}
          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
              {success}
            </div>
          )}

          {/* KPI Summary Pill Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="text-[10px] font-bold uppercase text-slate-500">Expected in Range</div>
              <div className="text-xl font-black text-slate-900 mt-0.5">{expectedCount}</div>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <div className="text-[10px] font-bold uppercase text-emerald-700">Resolved Students</div>
              <div className="text-xl font-black text-emerald-700 mt-0.5">{validation?.effective_count || 0}</div>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl">
              <div className="text-[10px] font-bold uppercase text-blue-700">Additional (Others)</div>
              <div className="text-xl font-black text-blue-700 mt-0.5">+{includes.length}</div>
            </div>
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl">
              <div className="text-[10px] font-bold uppercase text-rose-700">Excluded</div>
              <div className="text-xl font-black text-rose-700 mt-0.5">-{excludes.length}</div>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl col-span-2 sm:col-span-1">
              <div className="text-[10px] font-bold uppercase text-amber-700">Missing in DB</div>
              <div className="text-xl font-black text-amber-700 mt-0.5">{validation?.missing_rolls?.length || 0}</div>
            </div>
          </div>

          {/* Validation Warnings Alert */}
          {validation?.missing_rolls?.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-3">
              <AlertTriangleIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Missing Student Records in Database: </span>
                {validation.missing_rolls.slice(0, 10).join(', ')}
                {validation.missing_rolls.length > 10 && ` and ${validation.missing_rolls.length - 10} more`}.
                <div className="text-[11px] text-amber-700 mt-1">
                  These roll numbers fall in the range but have not been created yet via bulk import.
                </div>
              </div>
            </div>
          )}

          {validation?.conflicts?.length > 0 && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 flex items-start gap-3">
              <AlertTriangleIcon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Configuration Conflicts Detected:</span>
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  {validation.conflicts.map((c, idx) => (
                    <li key={idx}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Tab Selection */}
          <div className="flex border-b border-slate-200 gap-4">
            <button
              onClick={() => setActiveTab('CONFIG')}
              className={`pb-2 text-xs font-bold transition-all border-b-2 ${
                activeTab === 'CONFIG'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Roll Configuration & Exceptions
            </button>
            <button
              onClick={() => setActiveTab('EFFECTIVE_ROSTER')}
              className={`pb-2 text-xs font-bold transition-all border-b-2 ${
                activeTab === 'EFFECTIVE_ROSTER'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Resolved Effective Students ({validation?.effective_count || 0})
            </button>
          </div>

          {activeTab === 'CONFIG' ? (
            <div className="space-y-6">
              {/* Primary Range Form */}
              <form onSubmit={handleSaveRule} className="p-4 bg-white border border-slate-200 rounded-2xl space-y-4">
                <div className="text-xs font-black uppercase text-slate-600 tracking-wider">
                  1. Primary Roll Number Range
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Prefix</label>
                    <input
                      type="text"
                      value={prefix}
                      onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                      placeholder="e.g. 25UCS"
                      className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl uppercase tracking-wider"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Start Number</label>
                    <input
                      type="number"
                      value={startNum}
                      onChange={(e) => setStartNum(e.target.value)}
                      min="1"
                      className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">End Number</label>
                    <input
                      type="number"
                      value={endNum}
                      onChange={(e) => setEndNum(e.target.value)}
                      min="1"
                      className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Digit Padding</label>
                    <input
                      type="number"
                      value={padding}
                      onChange={(e) => setPadding(e.target.value)}
                      min="1"
                      max="6"
                      className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400 font-medium">
                    Preview: {prefix}{String(startNum).padStart(padding, '0')} → {prefix}{String(endNum).padStart(padding, '0')} ({expectedCount} students)
                  </span>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                  >
                    {saving ? 'Saving Range...' : 'Save Primary Range'}
                  </button>
                </div>
              </form>

              {/* Additional Students ("Others" / INCLUDE) */}
              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black uppercase text-slate-600 tracking-wider">
                    2. Additional Students (Others / Lateral Entry)
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                      {includes.length} Included
                    </span>
                    {includes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleClearAllExceptions('INCLUDE')}
                        className="text-[10px] font-bold text-rose-600 hover:text-rose-800 hover:underline"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {includes.map((inc) => (
                    <div
                      key={inc.id}
                      className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs font-bold flex items-center gap-2"
                    >
                      <span>{inc.roll_number}</span>
                      {inc.student_name && <span className="text-[10px] text-blue-600 font-normal">({inc.student_name})</span>}
                      {inc.reason && <span className="text-[10px] text-slate-400">[{inc.reason}]</span>}
                      <button
                        onClick={() => handleDeleteException(inc.id)}
                        className="text-blue-400 hover:text-rose-600 font-black ml-1 text-sm leading-none"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {includes.length === 0 && (
                    <span className="text-xs text-slate-400 italic">No additional students configured.</span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
                  <input
                    type="text"
                    value={otherRoll}
                    onChange={(e) => setOtherRoll(e.target.value.toUpperCase())}
                    placeholder="Roll No e.g. 24UCS072"
                    className="flex-1 px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-xl uppercase"
                  />
                  <input
                    type="text"
                    value={otherReason}
                    onChange={(e) => setOtherReason(e.target.value)}
                    placeholder="Reason (Optional, e.g. Lateral Entry)"
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddException('INCLUDE')}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    + Add Student
                  </button>
                </div>
              </div>

              {/* Excluded Students (EXCLUDE) */}
              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black uppercase text-slate-600 tracking-wider">
                    3. Excluded Students (Transferred / Inactive / Detained)
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200">
                      {excludes.length} Excluded
                    </span>
                    {excludes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleClearAllExceptions('EXCLUDE')}
                        className="text-[10px] font-bold text-rose-600 hover:text-rose-800 hover:underline"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {excludes.map((exc) => (
                    <div
                      key={exc.id}
                      className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs font-bold flex items-center gap-2"
                    >
                      <span className="line-through">{exc.roll_number}</span>
                      {exc.reason && <span className="text-[10px] text-rose-600 font-normal">({exc.reason})</span>}
                      <button
                        onClick={() => handleDeleteException(exc.id)}
                        className="text-rose-400 hover:text-rose-700 font-black ml-1 text-sm leading-none"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {excludes.length === 0 && (
                    <span className="text-xs text-slate-400 italic">No excluded students configured.</span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
                  <input
                    type="text"
                    value={excludeRoll}
                    onChange={(e) => setExcludeRoll(e.target.value.toUpperCase())}
                    placeholder="Roll No e.g. 25UCS014"
                    className="flex-1 px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-xl uppercase"
                  />
                  <input
                    type="text"
                    value={excludeReason}
                    onChange={(e) => setExcludeReason(e.target.value)}
                    placeholder="Reason (e.g. Transferred / Detained)"
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddException('EXCLUDE')}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    Exclude Roll
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Resolved Students Table */
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4">#</th>
                      <th className="py-2.5 px-4">Roll Number</th>
                      <th className="py-2.5 px-4">Quick Suffix</th>
                      <th className="py-2.5 px-4">Student Name</th>
                      <th className="py-2.5 px-4">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rosterData?.students?.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          No active students resolved for this class yet.
                        </td>
                      </tr>
                    ) : (
                      rosterData?.students?.map((st, idx) => (
                        <tr key={st.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2 px-4 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2 px-4 font-black text-slate-900">{st.roll_number}</td>
                          <td className="py-2 px-4 font-mono font-bold text-indigo-600">{st.roll_suffix}</td>
                          <td className="py-2 px-4 text-slate-800 font-medium">{st.name}</td>
                          <td className="py-2 px-4">
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                                st.source === 'ADDITIONAL'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {st.source === 'ADDITIONAL' ? 'Additional / Other' : 'Primary Range'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-200">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
