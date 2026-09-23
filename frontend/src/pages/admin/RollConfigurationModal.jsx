import { useState, useEffect } from 'react'
import { classRollRulesApi } from '../../api/services'
import { Modal, Spinner, ErrorAlert, Button } from '../../components/ui'
import { CheckCircleIcon, AlertTriangleIcon, TrashIcon, PencilIcon, SearchIcon, CloseIcon } from '../../components/icons'

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

  // Student actions & search
  const [searchQuery, setSearchQuery] = useState('')
  const [editingStudent, setEditingStudent] = useState(null)
  const [editForm, setEditForm] = useState({ roll_number: '', name: '' })
  const [deletingStudent, setDeletingStudent] = useState(null)
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

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

  const handleStartEdit = (st) => {
    setEditingStudent(st)
    setEditForm({ roll_number: st.roll_number, name: st.name })
    setError('')
    setSuccess('')
  }

  const handleCancelEdit = () => {
    setEditingStudent(null)
    setEditForm({ roll_number: '', name: '' })
  }

  const handleSaveEdit = async () => {
    if (!editForm.roll_number.trim() || !editForm.name.trim()) {
      setError('Both roll number and student name are required.')
      return
    }
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      await classRollRulesApi.updateStudent(selectedClass.id, editingStudent.id, {
        roll_number: editForm.roll_number.trim().toUpperCase(),
        name: editForm.name.trim()
      })
      setSuccess(`Updated student ${editForm.roll_number.trim().toUpperCase()} successfully!`)
      setEditingStudent(null)
      await loadData()
      if (onSaved) onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update student details')
    } finally {
      setActionLoading(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingStudent) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      await classRollRulesApi.deleteStudent(selectedClass.id, deletingStudent.id)
      setSuccess(`Removed student ${deletingStudent.roll_number} from class roster.`)
      setDeletingStudent(null)
      await loadData()
      if (onSaved) onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to remove student from class')
    } finally {
      setActionLoading(false)
    }
  }

  const handleConfirmDeleteAll = async () => {
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await classRollRulesApi.clearAllStudents(selectedClass.id)
      setSuccess(res.data?.message || 'All students and roll configurations cleared successfully.')
      setShowDeleteAllConfirm(false)
      setRuleId(null)
      setPrefix('')
      setStartNum(1)
      setEndNum(60)
      setExceptions([])
      await loadData()
      if (onSaved) onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to clear class roster')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteRule = async () => {
    if (!window.confirm('Are you sure you want to delete this primary roll range rule?')) return
    setActionLoading(true)
    setError('')
    setSuccess('')
    try {
      await classRollRulesApi.deleteRule(selectedClass.id)
      setSuccess('Primary roll range rule deleted.')
      setRuleId(null)
      await loadData()
      if (onSaved) onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete roll rule')
    } finally {
      setActionLoading(false)
    }
  }

  const filteredStudents = (rosterData?.students || []).filter((st) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    return (
      st.roll_number.toLowerCase().includes(q) ||
      st.name.toLowerCase().includes(q) ||
      (st.roll_suffix && st.roll_suffix.toLowerCase().includes(q))
    )
  })

  const validation = rosterData?.validation
  const expectedCount = Math.max(0, endNum - startNum + 1)
  const includes = exceptions.filter(e => e.exception_type === 'INCLUDE')
  const excludes = exceptions.filter(e => e.exception_type === 'EXCLUDE')

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Roll Configuration: ${selectedClass?.name || ''} - ${selectedClass?.section || ''}`} size="xl" maxWidth="max-w-4xl">

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

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
                  <span className="text-[11px] text-slate-400 font-medium">
                    Preview: {prefix}{String(startNum).padStart(padding, '0')} → {prefix}{String(endNum).padStart(padding, '0')} ({expectedCount} students)
                  </span>
                  <div className="flex items-center gap-2">
                    {ruleId && (
                      <button
                        type="button"
                        disabled={actionLoading || saving}
                        onClick={handleDeleteRule}
                        className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                      >
                        Clear Range Rule
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                    >
                      {saving ? 'Saving Range...' : 'Save Primary Range'}
                    </button>
                  </div>
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
            /* Resolved Students Table Tab */
            <div className="space-y-3">
              {/* Table Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/70 p-2.5 rounded-2xl border border-slate-200">
                <div className="relative flex-1 max-w-xs">
                  <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by roll number or name..."
                    className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-200 rounded-xl bg-white focus:border-indigo-500 focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 justify-end">
                  <span className="text-[11px] text-slate-500 font-semibold px-2 py-1 bg-white border border-slate-200 rounded-lg">
                    {filteredStudents.length} of {rosterData?.students?.length || 0} students
                  </span>
                  {rosterData?.students?.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowDeleteAllConfirm(true)}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shrink-0"
                    >
                      <TrashIcon className="w-3.5 h-3.5 text-rose-600" />
                      <span>Delete All</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Students Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4 w-12">#</th>
                        <th className="py-2.5 px-4 w-32">Roll Number</th>
                        <th className="py-2.5 px-4 w-24">Quick Suffix</th>
                        <th className="py-2.5 px-4">Student Name</th>
                        <th className="py-2.5 px-4 w-32">Source</th>
                        <th className="py-2.5 px-4 w-36 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            {searchQuery ? 'No students match your search criteria.' : 'No active students resolved for this class yet.'}
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((st, idx) => {
                          const isEditing = editingStudent?.id === st.id

                          if (isEditing) {
                            return (
                              <tr key={st.id} className="bg-indigo-50/60 transition-colors">
                                <td className="py-2.5 px-4 text-slate-400 font-mono">{idx + 1}</td>
                                <td className="py-2 px-4">
                                  <input
                                    type="text"
                                    value={editForm.roll_number}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, roll_number: e.target.value.toUpperCase() }))}
                                    className="w-full px-2.5 py-1 text-xs font-bold border border-indigo-400 rounded-lg uppercase bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    placeholder="Roll No"
                                  />
                                </td>
                                <td className="py-2.5 px-4 font-mono font-bold text-indigo-600">
                                  {editForm.roll_number ? editForm.roll_number.slice(-3) : st.roll_suffix}
                                </td>
                                <td className="py-2 px-4">
                                  <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-2.5 py-1 text-xs font-medium border border-indigo-400 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    placeholder="Student Name"
                                  />
                                </td>
                                <td className="py-2.5 px-4">
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
                                <td className="py-2 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      disabled={actionLoading}
                                      onClick={handleSaveEdit}
                                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                                    >
                                      {actionLoading ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={actionLoading}
                                      onClick={handleCancelEdit}
                                      className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium transition-all"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          }

                          return (
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
                              <td className="py-2 px-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(st)}
                                    title="Edit Student Details"
                                    className="px-2 py-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 rounded-lg transition-colors font-semibold text-xs flex items-center gap-1"
                                  >
                                    <PencilIcon className="w-3 h-3 text-indigo-500" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingStudent(st)}
                                    title="Delete Student from Class"
                                    className="px-2 py-1 text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg transition-colors font-semibold text-xs flex items-center gap-1"
                                  >
                                    <TrashIcon className="w-3 h-3 text-rose-500" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Delete Single Student Confirmation Modal */}
          {deletingStudent && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                    <TrashIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">Remove Student?</h4>
                    <p className="text-xs text-slate-500">Remove from class roster</p>
                  </div>
                </div>
                <div className="text-xs text-slate-600 leading-relaxed space-y-2">
                  <p>
                    Are you sure you want to remove <span className="font-bold text-slate-900">{deletingStudent.roll_number}</span> (<span className="font-semibold text-slate-800">{deletingStudent.name}</span>) from this class roster?
                  </p>
                  {deletingStudent.source === 'PRIMARY_RANGE' && (
                    <div className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                      <strong>Note:</strong> This roll number is part of the primary roll range rule. It will be recorded in exclusions so it is no longer counted in the active class roster.
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => setDeletingStudent(null)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleConfirmDelete}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                  >
                    {actionLoading ? 'Removing...' : 'Delete Student'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete All Students Confirmation Modal */}
          {showDeleteAllConfirm && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                    <AlertTriangleIcon className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">Delete All Students &amp; Clear Roster?</h4>
                    <p className="text-xs text-slate-500">{selectedClass?.name} - {selectedClass?.section}</p>
                  </div>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 leading-relaxed space-y-1">
                  <div className="font-bold">⚠️ Warning: Irreversible Action</div>
                  <div>
                    This will clear all primary roll ranges, delete all inclusion and exclusion exceptions, and unenroll/remove all {rosterData?.students?.length || 0} students from this class roster.
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => setShowDeleteAllConfirm(false)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleConfirmDeleteAll}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                  >
                    {actionLoading ? 'Clearing Roster...' : 'Yes, Delete All'}
                  </button>
                </div>
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

