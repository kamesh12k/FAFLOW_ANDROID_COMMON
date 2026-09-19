import { useState } from 'react'
import { classRollRulesApi } from '../../api/services'
import { Modal, Spinner, ErrorAlert } from '../../components/ui'
import { CheckCircleIcon, AlertTriangleIcon } from '../../components/icons'

export default function BulkStudentImportModal({ isOpen, onClose, selectedClass, onImported }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [success, setSuccess] = useState('')

  const handlePreview = async () => {
    if (!content.trim()) {
      setError('Please paste or enter student roll numbers and names.')
      return
    }
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await classRollRulesApi.previewImport(selectedClass.id, content)
      setPreview(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to parse student data')
    } finally {
      setLoading(false)
    }
  }

  const handleCommit = async () => {
    if (!preview || preview.rows.length === 0) return
    setCommitting(true)
    setError('')
    try {
      const res = await classRollRulesApi.commitImport(selectedClass.id, { rows: preview.rows })
      setSuccess(res.data.message)
      setPreview(null)
      setContent('')
      if (onImported) onImported()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to import students')
    } finally {
      setCommitting(false)
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setContent(event.target.result)
    }
    reader.readAsText(file)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Bulk Student Import: ${selectedClass?.name || ''} - ${selectedClass?.section || ''}`} maxWidth="max-w-3xl">
      <div className="space-y-4">
        {error && <ErrorAlert message={error} onClose={() => setError('')} />}
        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
            {success}
          </div>
        )}

        {!preview ? (
          <div className="space-y-4">
            <div className="text-xs text-slate-500 font-medium">
              Paste or upload a CSV / list of students with <span className="font-bold text-slate-700">Roll Number</span> and <span className="font-bold text-slate-700">Student Name</span>.
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono text-slate-600">
              26UCS001, Arun Kumar<br />
              26UCS002, Bala Kumar<br />
              26UCS003, Charan Kumar
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Upload CSV or Text File</label>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Or Paste Direct Content</label>
              <textarea
                rows={6}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="26UCS001, Arun Kumar&#10;26UCS002, Bala Kumar"
                className="w-full p-3 text-xs font-mono border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading || !content.trim()}
                onClick={handlePreview}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
              >
                {loading ? 'Validating...' : 'Validate & Preview'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Validation Metrics */}
            <div className="grid grid-cols-4 gap-2">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <div className="text-[10px] uppercase font-bold text-slate-500">Total Rows</div>
                <div className="text-lg font-black text-slate-900 mt-0.5">{preview.total_rows}</div>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <div className="text-[10px] uppercase font-bold text-emerald-700">Valid Rows</div>
                <div className="text-lg font-black text-emerald-700 mt-0.5">{preview.valid_count}</div>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center">
                <div className="text-[10px] uppercase font-bold text-blue-700">Existing</div>
                <div className="text-lg font-black text-blue-700 mt-0.5">{preview.warning_count}</div>
              </div>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
                <div className="text-[10px] uppercase font-bold text-rose-700">Errors</div>
                <div className="text-lg font-black text-rose-700 mt-0.5">{preview.error_count}</div>
              </div>
            </div>

            {/* Preview Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                  <tr>
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Roll Number</th>
                    <th className="py-2 px-3">Name</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.rows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-400 font-mono">{r.row_number}</td>
                      <td className="py-2 px-3 font-bold text-slate-900">{r.roll_number}</td>
                      <td className="py-2 px-3 text-slate-700">{r.name}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            r.status === 'VALID'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : r.status === 'EXISTING_STUDENT'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-bold"
              >
                ← Back to Edit
              </button>
              <button
                type="button"
                disabled={committing || preview.valid_count === 0}
                onClick={handleCommit}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
              >
                {committing ? 'Importing...' : `Confirm & Import ${preview.valid_count} Students`}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
