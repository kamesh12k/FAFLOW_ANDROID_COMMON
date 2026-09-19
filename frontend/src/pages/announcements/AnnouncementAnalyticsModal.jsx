import { useState, useEffect } from 'react'
import { CloseIcon, SearchIcon, DownloadIcon, CheckCircleIcon, AlertTriangleIcon } from '../../components/icons'
import { Spinner } from '../../components/ui'
import { announcementApi } from '../../api/announcements'
import { useToast } from '../../components/ui/Toast'

export default function AnnouncementAnalyticsModal({ announcementId, onClose }) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // all, viewed, unread, ack, pending
  const [fetchError, setFetchError] = useState(null)

  useEffect(() => {
    let isMounted = true
    const fetchAnalytics = async () => {
      setLoading(true)
      setFetchError(null)
      try {
        const res = await announcementApi.getAnnouncementAnalytics(announcementId)
        if (isMounted) {
          setData(res.data)
        }
      } catch (err) {
        if (isMounted) {
          const msg = err.response?.data?.detail || 'Failed to load analytics'
          setFetchError(msg)
          showToast(msg, 'error')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }
    fetchAnalytics()
    return () => { isMounted = false }
  }, [announcementId])

  // Escape key closes this modal only
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown, true) // capture phase so we intercept before Detail
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [onClose])

  const exportCSV = () => {
    if (!data || !data.recipients) return
    const headers = ['User ID', 'Name', 'Email', 'Role', 'Department', 'Viewed', 'First Viewed At', 'Acknowledged', 'Acknowledged At']
    const rows = data.recipients.map((r) => [
      r.user_id,
      `"${r.name}"`,
      `"${r.email || ''}"`,
      `"${r.role}"`,
      `"${r.department || ''}"`,
      r.has_viewed ? 'Yes' : 'No',
      r.first_viewed_at ? new Date(r.first_viewed_at).toLocaleString() : '-',
      r.has_acknowledged ? 'Yes' : 'No',
      r.acknowledged_at ? new Date(r.acknowledged_at).toLocaleString() : '-',
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `announcement_${announcementId}_analytics.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredRecipients = (data?.recipients || []).filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.email && r.email.toLowerCase().includes(search.toLowerCase())) ||
      (r.department && r.department.toLowerCase().includes(search.toLowerCase()))

    if (!matchesSearch) return false

    if (filter === 'viewed') return r.has_viewed
    if (filter === 'unread') return !r.has_viewed
    if (filter === 'ack') return r.has_acknowledged
    if (filter === 'pending') return !r.has_acknowledged
    return true
  })

  return (
    /* Overlay — z-50 so it sits above the z-40 announcement detail overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Announcement Engagement Analytics"
    >
      {/* Modal card — flex column: header pinned, body scrolls */}
      <div className="bg-white rounded-2xl w-full max-w-4xl flex flex-col shadow-2xl border border-slate-200 max-h-[calc(100dvh-3rem)] overflow-hidden animate-in zoom-in-95 duration-150">

        {/* ── Pinned Header — never scrolls ── */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 bg-slate-50/60 flex items-start gap-3 shrink-0">
          {/* Title block */}
          <div className="flex-1 min-w-0">
            <h2 className="font-extrabold text-base sm:text-lg text-slate-900 leading-snug">
              Announcement Engagement Analytics
            </h2>
            <p className="text-xs text-slate-500 truncate mt-0.5 max-w-lg">
              {data?.title || 'Circular Metrics'}
            </p>
          </div>

          {/* Export + Close — always visible, flex-shrink-0 */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={exportCSV}
              disabled={loading || !data}
              className="hidden sm:flex px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-lg border border-slate-300 items-center gap-1.5 transition-colors disabled:opacity-50"
              aria-label="Export as CSV"
            >
              <span className="w-3.5 h-3.5"><DownloadIcon /></span>
              <span>Export CSV</span>
            </button>
            {/* Mobile export icon-only */}
            <button
              onClick={exportCSV}
              disabled={loading || !data}
              className="sm:hidden p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-300 flex items-center justify-center disabled:opacity-50 min-w-[36px] min-h-[36px]"
              aria-label="Export as CSV"
              title="Export CSV"
            >
              <span className="w-3.5 h-3.5"><DownloadIcon /></span>
            </button>
            {/* Close button — always visible, prominent */}
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors flex items-center justify-center min-w-[36px] min-h-[36px]"
              aria-label="Close analytics"
              title="Close analytics"
            >
              <span className="w-5 h-5"><CloseIcon /></span>
            </button>
          </div>
        </div>

        {/* ── Scrollable Body ── */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20">
            <Spinner size="lg" />
            <p className="text-xs text-slate-500 font-semibold">Aggregating delivery metrics...</p>
          </div>
        ) : !data ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
            <span className="text-3xl">⚠️</span>
            <p className="text-sm font-bold text-slate-800">Unable to load analytics data.</p>
            <p className="text-xs text-slate-500 max-w-md leading-relaxed">
              {fetchError || 'You may not have authorization to view analytics for this announcement, or the record is pending.'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            <div className="p-4 sm:p-6 space-y-5">

              {/* KPI Cards Grid — responsive: 2-col on mobile, up to 5 on desktop */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-3.5">
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Recipients</span>
                  <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{data?.total_recipients ?? 0}</p>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">Audience Total</p>
                </div>

                <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3 sm:p-3.5">
                  <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Viewed</span>
                  <p className="text-xl sm:text-2xl font-black text-emerald-900 mt-1">{data?.viewed_count ?? 0}</p>
                  <p className="text-[10px] sm:text-[11px] text-emerald-700 font-bold mt-0.5">{data?.view_rate_pct ?? 0}% read rate</p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-3.5">
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Unread</span>
                  <p className="text-xl sm:text-2xl font-black text-slate-700 mt-1">{data?.unread_count ?? 0}</p>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">Pending opens</p>
                </div>

                <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-3 sm:p-3.5">
                  <span className="text-[10px] sm:text-[11px] font-bold text-blue-700 uppercase tracking-wider block">Acknowledged</span>
                  <p className="text-xl sm:text-2xl font-black text-blue-900 mt-1">{data?.acknowledged_count ?? 0}</p>
                  <p className="text-[10px] sm:text-[11px] text-blue-700 font-bold mt-0.5">{data?.acknowledgement_rate_pct ?? 0}% compliance</p>
                </div>

                <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 sm:p-3.5 col-span-2 sm:col-span-1">
                  <span className="text-[10px] sm:text-[11px] font-bold text-amber-700 uppercase tracking-wider block">Pending Ack</span>
                  <p className="text-xl sm:text-2xl font-black text-amber-900 mt-1">{data?.pending_acknowledgement_count ?? 0}</p>
                  <p className="text-[10px] sm:text-[11px] text-amber-700 mt-0.5">Action required</p>
                </div>
              </div>

              {/* Recipient Breakdown — filters + search + table */}
              <div className="space-y-3">
                {/* Filter chips + search */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    {[
                      { key: 'all', label: `All (${data?.total_recipients ?? 0})` },
                      { key: 'viewed', label: `Viewed (${data?.viewed_count ?? 0})` },
                      { key: 'unread', label: `Unread (${data?.unread_count ?? 0})` },
                      ...(data?.requires_acknowledgement
                        ? [
                            { key: 'ack', label: `Acknowledged (${data?.acknowledged_count ?? 0})` },
                            { key: 'pending', label: `Pending (${data?.pending_acknowledgement_count ?? 0})` },
                          ]
                        : []),
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setFilter(tab.key)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                          filter === tab.key
                            ? 'bg-primary-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Search — always on its own line on mobile */}
                  <div className="relative w-full sm:w-auto sm:min-w-[220px] sm:ml-auto">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search faculty or dept..."
                      className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary-500 focus:bg-white"
                    />
                    <span className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <SearchIcon />
                    </span>
                  </div>
                </div>

                {/* Recipient Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  {/* Responsive: horizontal scroll on narrow viewports */}
                  <div className="overflow-x-auto overflow-y-auto max-h-[min(340px,40vh)]">
                    <table className="w-full text-left border-collapse text-xs min-w-[520px]">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px] tracking-wider z-10">
                        <tr>
                          <th className="py-2.5 px-4">Faculty Member</th>
                          <th className="py-2.5 px-3">Department</th>
                          <th className="py-2.5 px-3">View Status</th>
                          <th className="py-2.5 px-3">First Viewed</th>
                          {data.requires_acknowledgement && (
                            <th className="py-2.5 px-3">Acknowledgement</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredRecipients.length === 0 ? (
                          <tr>
                            <td
                              colSpan={data.requires_acknowledgement ? 5 : 4}
                              className="py-8 text-center text-slate-500 font-medium"
                            >
                              No faculty members match the filter criteria.
                            </td>
                          </tr>
                        ) : (
                          filteredRecipients.map((r) => (
                            <tr key={r.user_id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-2.5 px-4 font-bold text-slate-900 min-w-[160px]">
                                {r.name}
                                <span className="block text-[10px] font-normal text-slate-400 truncate max-w-[160px]">{r.email}</span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 min-w-[120px]">{r.department || 'General'}</td>
                              <td className="py-2.5 px-3 min-w-[90px]">
                                {r.has_viewed ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                    <span className="w-2.5 h-2.5"><CheckCircleIcon /></span>
                                    <span>Viewed</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                                    Unread
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 font-mono text-[10px] min-w-[100px]">
                                {r.first_viewed_at
                                  ? new Date(r.first_viewed_at).toLocaleString([], {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : '—'}
                              </td>
                              {data.requires_acknowledgement && (
                                <td className="py-2.5 px-3 min-w-[120px]">
                                  {r.has_acknowledged ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60 font-mono">
                                      <span>✓</span>
                                      <span>{new Date(r.acknowledged_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60">
                                      <span>⚠️</span>
                                      <span>Pending</span>
                                    </span>
                                  )}
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  )
}
