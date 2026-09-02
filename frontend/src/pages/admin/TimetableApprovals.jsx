import { useEffect, useState, useMemo } from 'react'
import { timetableApi, teachersApi, classesApi, subjectsApi } from '../../api/services'
import { Spinner, EmptyState, ErrorAlert } from '../../components/ui'

const PERIOD_TIMES = {
  1: '8:00–9:00 AM',
  2: '9:00–10:00 AM',
  3: '10:15–11:15 AM',
  4: '11:15–12:15 PM',
  5: '1:00–2:00 PM',
}

export default function TimetableApprovals() {
  const [items, setItems] = useState([])
  const [maps, setMaps] = useState({ teachers: {}, classes: {}, subjects: {} })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null) // id | 'bulk_approve' | 'bulk_reject'
  const [error, setError] = useState('')
  const [banner, setBanner] = useState(null) // { type: 'success' | 'error', message }

  // Selection & Search
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  const showBanner = (type, message) => {
    setBanner({ type, message })
    setTimeout(() => setBanner(null), 5000)
  }

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [pending, teachers, classes, subjects] = await Promise.all([
        timetableApi.pendingSubmissions(),
        teachersApi.list(),
        classesApi.list(),
        subjectsApi.list(true)
      ])
      setItems(pending.data)
      setSelectedIds(new Set())
      setMaps({
        teachers: Object.fromEntries(teachers.data.map(x => [x.id, x])),
        classes: Object.fromEntries(classes.data.map(x => [x.id, x])),
        subjects: Object.fromEntries(subjects.data.map(x => [x.id, x]))
      })
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not load timetable submissions.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Filter items
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items
    const q = searchQuery.toLowerCase()
    return items.filter(item => {
      const teacher = maps.teachers[item.teacher_id]?.name || ''
      const cls = maps.classes[item.class_id] ? `${maps.classes[item.class_id].name} ${maps.classes[item.class_id].section}` : ''
      const subject = maps.subjects[item.subject_id]?.name || ''
      return teacher.toLowerCase().includes(q) || cls.toLowerCase().includes(q) || subject.toLowerCase().includes(q)
    })
  }, [items, searchQuery, maps])

  // Single Item One-Click Approval / Rejection
  const handleSingleReview = async (id, approved) => {
    setActionLoading(id)
    try {
      await timetableApi.reviewSubmission(id, { approved })
      const teacherName = maps.teachers[items.find(i => i.id === id)?.teacher_id]?.name || 'Teacher'
      showBanner('success', approved ? `⚡ Approved submission for ${teacherName}` : `Rejected submission for ${teacherName}`)
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not review submission.')
    } finally {
      setActionLoading(null)
    }
  }

  // One-Click Bulk Approval (Approve All or Selected)
  const handleBulkReview = async (approved, targetIds = null) => {
    const idsToReview = targetIds || (selectedIds.size > 0 ? Array.from(selectedIds) : items.map(i => i.id))
    if (idsToReview.length === 0) return

    const actionType = approved ? 'approve' : 'reject'
    setActionLoading(`bulk_${actionType}`)
    try {
      const res = await timetableApi.bulkReviewSubmissions(idsToReview, approved)
      const count = res.data?.success_count ?? idsToReview.length
      showBanner(
        'success',
        approved
          ? `⚡ One-Click Success! Approved ${count} timetable submission(s).`
          : `Rejected ${count} timetable submission(s).`
      )
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to process bulk review.')
    } finally {
      setActionLoading(null)
    }
  }

  // Toggle Checkbox selection
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i.id)))
    }
  }

  const toggleSelectOne = (id) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <Spinner size="lg" />
        <p className="text-sm text-gray-500 font-medium">Loading pending timetable submissions…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Message */}
      {banner && (
        <div className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between border shadow-sm transition-all ${
          banner.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          <span>{banner.message}</span>
          <button onClick={() => setBanner(null)} className="text-xs opacity-70 hover:opacity-100 font-bold ml-4">✕</button>
        </div>
      )}

      {/* Header Banner & One-Click Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">Timetable Approvals</h1>
            <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
              {items.length} Pending
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Review teacher-submitted timetable entries. Approve all pending requests with one click or review individually.
          </p>
        </div>

        {items.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            {selectedIds.size > 0 ? (
              <>
                <button
                  onClick={() => handleBulkReview(true)}
                  disabled={actionLoading !== null}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === 'bulk_approve' ? <Spinner size="sm" /> : '⚡'}
                  Approve Selected ({selectedIds.size})
                </button>
                <button
                  onClick={() => handleBulkReview(false)}
                  disabled={actionLoading !== null}
                  className="px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-xl border border-red-200 transition-all cursor-pointer disabled:opacity-50"
                >
                  Reject Selected ({selectedIds.size})
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleBulkReview(true)}
                  disabled={actionLoading !== null}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === 'bulk_approve' ? <Spinner size="sm" /> : <span>⚡</span>}
                  <span>One-Click Approve All ({items.length})</span>
                </button>
                <button
                  onClick={() => handleBulkReview(false)}
                  disabled={actionLoading !== null}
                  className="px-3 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl border border-gray-200 transition-all cursor-pointer disabled:opacity-50"
                >
                  Reject All
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <ErrorAlert message={error} />

      {/* Main Table Card */}
      <div className="card overflow-hidden border border-gray-200/80 rounded-2xl shadow-sm">
        {items.length > 0 && (
          <div className="p-3 sm:p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <input
              type="text"
              placeholder="Search teacher, class, or subject…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg w-full sm:max-w-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 font-medium shrink-0">
              Showing {filteredItems.length} of {items.length} pending requests
            </p>
          </div>
        )}

        {items.length === 0 ? (
          <EmptyState message="No pending timetable submissions. All teacher timetable entries are up to date!" />
        ) : filteredItems.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-10">No pending submissions match "{searchQuery}".</p>
        ) : (
          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full text-sm" style={{ minWidth: '760px' }}>
              <thead className="bg-gray-50/80 border-b border-gray-200/60">
                <tr>
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  {['Teacher', 'Class & Section', 'Subject', 'Schedule & Timing', 'Submission Date', 'One-Click Action'].map(h => (
                    <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredItems.map(item => {
                  const c = maps.classes[item.class_id]
                  const t = maps.teachers[item.teacher_id]
                  const s = maps.subjects[item.subject_id]
                  const isSelected = selectedIds.has(item.id)
                  const isProcessing = actionLoading === item.id

                  return (
                    <tr key={item.id} className={`hover:bg-indigo-50/30 transition-colors ${isSelected ? 'bg-indigo-50/40' : ''}`}>
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(item.id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {t?.name ? t.name.charAt(0) : 'T'}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{t?.name || `Teacher #${item.teacher_id}`}</p>
                            <p className="text-[11px] text-gray-400">{t?.department || 'Faculty'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-gray-800">
                        {c ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-800 rounded-lg text-xs font-semibold">
                            {c.name} ({c.section})
                          </span>
                        ) : `Class #${item.class_id}`}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-gray-800">{s?.name || '—'}</p>
                        {s?.code && <p className="text-[11px] text-gray-400 font-mono">{s.code}</p>}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-xs">
                          Day Order {item.day_order} · Period {item.period_number}
                        </span>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {PERIOD_TIMES[item.period_number] || ''}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-400">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Today'}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSingleReview(item.id, true)}
                            disabled={actionLoading !== null}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            {isProcessing ? <Spinner size="sm" /> : '⚡'} One-Click Approve
                          </button>
                          <button
                            onClick={() => handleSingleReview(item.id, false)}
                            disabled={actionLoading !== null}
                            className="px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
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
  )
}
