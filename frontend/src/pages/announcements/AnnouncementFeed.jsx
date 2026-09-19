import { useState, useEffect, useRef, useMemo } from 'react'
import {
  SearchIcon, FilterIcon, PlusIcon, PinIcon, MessageSquareIcon,
  DownloadIcon, CheckCircleIcon, AlertTriangleIcon, CloseIcon, TrashIcon
} from '../../components/icons'
import { Spinner } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { announcementApi } from '../../api/announcements'
import AnnouncementComposerModal from './AnnouncementComposerModal'
import AnnouncementDetail from './AnnouncementDetail'
import AnnouncementAnalyticsModal from './AnnouncementAnalyticsModal'

export default function AnnouncementFeed() {
  const { user, isPrincipal, isAdmin, isSystemAdmin } = useAuth()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [announcements, setAnnouncements] = useState([])
  const [tab, setTab] = useState('all') // all, unread, important, mentioned, ack_pending
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [priorityFilter, setPriorityFilter] = useState('ALL')
  const [hasAttachmentsOnly, setHasAttachmentsOnly] = useState(false)
  const [pinnedOnly, setPinnedOnly] = useState(false)

  // Modals & Confirmation States
  const [showComposer, setShowComposer] = useState(false)
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState(null)
  const [analyticsAnnouncementId, setAnalyticsAnnouncementId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmationBanner, setConfirmationBanner] = useState(null)
  const bannerTimerRef = useRef(null)

  /** Show a confirmation banner that auto-dismisses after 5 seconds */
  const showBanner = (text, type = 'success') => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
    setConfirmationBanner({ type, text })
    bannerTimerRef.current = setTimeout(() => setConfirmationBanner(null), 5000)
  }

  // Clear banner timer on unmount
  useEffect(() => () => { if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current) }, [])

  const canPublish = isPrincipal || isAdmin || isSystemAdmin

  const fetchFeed = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {
        tab,
        search: search.trim() || undefined,
        type: typeFilter !== 'ALL' ? typeFilter : undefined,
        priority: priorityFilter !== 'ALL' ? priorityFilter : undefined,
        page: 1,
        limit: 50,
      }
      const res = await announcementApi.listAnnouncements(params)
      setAnnouncements(res.data)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to load announcements feed'
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFeed()
  }, [tab, typeFilter, priorityFilter])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFeed()
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Body scroll lock when announcement detail modal is open
  useEffect(() => {
    if (selectedAnnouncementId) {
      document.body.classList.add('modal-open')
    } else {
      document.body.classList.remove('modal-open')
    }
    return () => {
      document.body.classList.remove('modal-open')
    }
  }, [selectedAnnouncementId])

  const handleConfirmDeleteFeed = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await announcementApi.deleteAnnouncement(deleteTarget.id)
      showToast(`Announcement "${deleteTarget.title}" was permanently deleted.`, 'success')
      showBanner(`Announcement "${deleteTarget.title}" was successfully deleted.`)
      // Immediate optimistic update so it disappears immediately from feed
      setAnnouncements(prev => prev.filter(a => a.id !== deleteTarget.id))
      setDeleteTarget(null)
      fetchFeed()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to delete announcement', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const tabs = [
    { id: 'all', label: 'All Notices' },
    { id: 'unread', label: 'Unread' },
    { id: 'important', label: 'Important & Urgent' },
    { id: 'mentioned', label: '@Mentioned' },
    { id: 'ack_pending', label: '⚠️ Action Required' },
  ]

  const typeOptions = [
    { id: 'ALL', label: 'All Types' },
    { id: 'CIRCULAR', label: 'Circular' },
    { id: 'NOTICE', label: 'Notice' },
    { id: 'ACADEMIC', label: 'Academic' },
    { id: 'ADMINISTRATIVE', label: 'Admin' },
    { id: 'URGENT', label: 'Urgent' },
    { id: 'EVENT', label: 'Event' },
  ]

  const priorityStyles = {
    NORMAL: 'bg-slate-100 text-slate-700 border-slate-200',
    IMPORTANT: 'bg-amber-100 text-amber-900 border-amber-300',
    HIGH: 'bg-orange-100 text-orange-900 border-orange-300',
    URGENT: 'bg-rose-100 text-rose-900 border-rose-300 font-extrabold',
  }

  // Client-side quick filter for file attachments and pinned
  const displayedAnnouncements = useMemo(() => {
    return announcements.filter(item => {
      if (hasAttachmentsOnly && (!item.attachments || item.attachments.length === 0)) return false
      if (pinnedOnly && !item.is_pinned) return false
      return true
    })
  }, [announcements, hasAttachmentsOnly, pinnedOnly])

  const hasActiveFilters = Boolean(
    search.trim() ||
    typeFilter !== 'ALL' ||
    priorityFilter !== 'ALL' ||
    hasAttachmentsOnly ||
    pinnedOnly ||
    tab !== 'all'
  )

  const resetAllFilters = () => {
    setTab('all')
    setSearch('')
    setTypeFilter('ALL')
    setPriorityFilter('ALL')
    setHasAttachmentsOnly(false)
    setPinnedOnly(false)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-primary-900 via-indigo-900 to-slate-900 p-6 rounded-2xl text-white shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">📢</span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Announcements & Circulars
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-primary-100/70 font-medium">
            Official institutional notices, circular directives, and academic team communication.
          </p>
        </div>

        {canPublish && (
          <button
            type="button"
            onClick={() => setShowComposer(true)}
            className="px-5 py-2.5 bg-primary-600 hover:bg-primary-500 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 shrink-0 self-start sm:self-auto"
          >
            <span className="w-4 h-4"><PlusIcon /></span>
            <span>New Announcement</span>
          </button>
        )}
      </div>
      {/* Top Confirmation Banner */}
      {confirmationBanner && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs sm:text-sm text-emerald-900 font-bold animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5">
            <span className="w-5 h-5 text-emerald-600 shrink-0"><CheckCircleIcon /></span>
            <span>{confirmationBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setConfirmationBanner(null)}
            className="p-1 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors shrink-0"
            title="Dismiss"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Tabs & Search Controls */}
      <div className="space-y-4">
        {/* Main Feed Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                tab === t.id
                  ? 'bg-primary-600 text-white shadow-sm ring-2 ring-primary-300/30'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search & Filter Dropdowns Bar */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Input Box */}
            <div className="relative flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search circulars by title, topic, sender, or keywords..."
                className="w-full text-xs sm:text-sm pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
              />
              <span className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <SearchIcon />
              </span>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors"
                  title="Clear search"
                >
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 hover:bg-slate-100 transition-colors focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                title="Filter by announcement category"
              >
                {typeOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 hover:bg-slate-100 transition-colors focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                title="Filter by priority level"
              >
                <option value="ALL">All Priorities</option>
                <option value="URGENT">Urgent Priority</option>
                <option value="HIGH">High Priority</option>
                <option value="IMPORTANT">Important</option>
                <option value="NORMAL">Normal Priority</option>
              </select>
            </div>
          </div>

          {/* Quick Filter Toggles & Status Summary Bar */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 flex-wrap text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Quick:</span>
              <button
                type="button"
                onClick={() => setHasAttachmentsOnly(!hasAttachmentsOnly)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
                  hasAttachmentsOnly
                    ? 'bg-primary-50 text-primary-800 border-primary-300 font-bold shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                📎 Has Files {hasAttachmentsOnly && '✓'}
              </button>

              <button
                type="button"
                onClick={() => setPinnedOnly(!pinnedOnly)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
                  pinnedOnly
                    ? 'bg-amber-50 text-amber-900 border-amber-300 font-bold shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                📌 Pinned {pinnedOnly && '✓'}
              </button>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                >
                  Reset Filters ↺
                </button>
              )}
            </div>

            <div className="text-[11px] font-semibold text-slate-500">
              {loading ? (
                <span>Loading notices...</span>
              ) : (
                <span>
                  Showing <strong>{displayedAnnouncements.length}</strong> {displayedAnnouncements.length === 1 ? 'notice' : 'notices'}
                  {search && <span> for &ldquo;<strong>{search}</strong>&rdquo;</span>}
                </span>
              )}
            </div>
          </div>

          {/* Active Filter Chips */}
          {hasActiveFilters && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Active:</span>
              {tab !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-primary-50 text-primary-800 border border-primary-200">
                  <span>Tab: {tabs.find(t => t.id === tab)?.label || tab}</span>
                  <button type="button" onClick={() => setTab('all')} className="hover:text-primary-950 font-black ml-0.5">×</button>
                </span>
              )}
              {search && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                  <span>Search: &ldquo;{search}&rdquo;</span>
                  <button type="button" onClick={() => setSearch('')} className="hover:text-slate-950 font-black ml-0.5">×</button>
                </span>
              )}
              {typeFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                  <span>Category: {typeFilter}</span>
                  <button type="button" onClick={() => setTypeFilter('ALL')} className="hover:text-slate-950 font-black ml-0.5">×</button>
                </span>
              )}
              {priorityFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                  <span>Priority: {priorityFilter}</span>
                  <button type="button" onClick={() => setPriorityFilter('ALL')} className="hover:text-slate-950 font-black ml-0.5">×</button>
                </span>
              )}
              {hasAttachmentsOnly && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                  <span>📎 Files Only</span>
                  <button type="button" onClick={() => setHasAttachmentsOnly(false)} className="hover:text-slate-950 font-black ml-0.5">×</button>
                </span>
              )}
              {pinnedOnly && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                  <span>📌 Pinned Only</span>
                  <button type="button" onClick={() => setPinnedOnly(false)} className="hover:text-slate-950 font-black ml-0.5">×</button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Feed Stream */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white rounded-2xl border border-slate-200/70 p-4 sm:p-6 animate-pulse space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-5 bg-slate-200 rounded-full" />
                  <div className="w-14 h-5 bg-slate-150 rounded-full" />
                </div>
                <div className="w-24 h-4 bg-slate-200 rounded-md" />
              </div>
              <div className="w-3/4 h-5 bg-slate-250 rounded-lg" />
              <div className="space-y-1.5">
                <div className="w-full h-3.5 bg-slate-150 rounded" />
                <div className="w-5/6 h-3.5 bg-slate-150 rounded" />
              </div>
              <div className="pt-2 flex items-center justify-between">
                <div className="w-20 h-4 bg-slate-200 rounded" />
                <div className="w-24 h-6 bg-slate-200 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="py-12 text-center bg-white rounded-2xl border border-rose-200 p-6 sm:p-8 space-y-3">
          <span className="text-3xl">⚠️</span>
          <h3 className="font-extrabold text-base text-slate-900">Couldn't load announcements</h3>
          <p className="text-xs text-slate-600 max-w-sm mx-auto">
            {error}. Check your internet connection and try again.
          </p>
          <button
            type="button"
            onClick={fetchFeed}
            className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95"
          >
            Retry
          </button>
        </div>
      ) : displayedAnnouncements.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-8 space-y-3">
          <span className="text-4xl">🔍</span>
          <h3 className="font-extrabold text-base text-slate-900">
            {hasActiveFilters ? 'No Matching Announcements Found' : 'No Announcements Yet'}
          </h3>
          <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
            {hasActiveFilters
              ? 'No announcements match your search keywords or active filter criteria. Try clearing search or resetting your filters.'
              : "You're all caught up! There are no active announcements addressed to you."}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="px-4 py-2 bg-primary-50 hover:bg-primary-100 text-primary-700 font-bold text-xs rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-2xs"
            >
              <span>Reset All Filters</span>
              <span>↺</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {displayedAnnouncements.map((item) => (
            <div
              key={item.id}
              className={`bg-white rounded-2xl border p-5 sm:p-6 transition-all duration-200 hover:shadow-md ${
                !item.is_read
                  ? 'border-primary-300 ring-2 ring-primary-50'
                  : 'border-slate-200/80'
              }`}
            >
              {/* Card Top Metadata */}
              <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  {item.is_pinned && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                      <span className="w-3 h-3"><PinIcon /></span>
                      <span>PINNED</span>
                    </span>
                  )}
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${priorityStyles[item.priority] || 'bg-slate-100 text-slate-700'}`}>
                    {item.priority}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600">
                    {item.type}
                  </span>
                  {item.version > 1 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      v{item.version} Updated
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="font-semibold text-slate-900">{item.author_name}</span>
                  <span>•</span>
                  <span>{item.published_at ? new Date(item.published_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Draft'}</span>
                </div>
              </div>

              {/* Title & Body Snippet */}
              <div
                onClick={() => setSelectedAnnouncementId(item.id)}
                className="cursor-pointer group"
              >
                <h2 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-primary-600 transition-colors leading-snug">
                  {item.title}
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 line-clamp-3 leading-relaxed">
                  {item.body_snippet}
                </p>
              </div>

              {/* Attachments Chips */}
              {item.attachments && item.attachments.length > 0 && (
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {item.attachments.map((att) => {
                    const isImg = att.file_type?.includes('image') || /\.(jpg|jpeg|png|webp)$/i.test(att.file_name)
                    return (
                      <a
                        key={att.id}
                        href={att.download_url}
                        download={att.file_name}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors shadow-2xs"
                      >
                        {isImg ? (
                          <img src={att.download_url} alt="" className="w-4 h-4 rounded object-cover border border-slate-200" />
                        ) : (
                          <span>{att.file_type?.includes('pdf') || att.file_name.endsWith('.pdf') ? '📄' : '📎'}</span>
                        )}
                        <span className="truncate max-w-[160px]">{att.file_name}</span>
                      </a>
                    )
                  })}
                </div>
              )}

              {/* Card Footer Bar */}
              <div className="mt-4 pt-3.5 border-t border-slate-150 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Read Receipt Tag */}
                  {item.is_read ? (
                    <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                      <span>✓</span> Read
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-primary-100 text-primary-800">
                      NEW UNREAD
                    </span>
                  )}

                  {/* Acknowledgement Tag */}
                  {item.requires_acknowledgement && (
                    item.is_acknowledged ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                        <span className="w-3.5 h-3.5"><CheckCircleIcon /></span>
                        <span>Acknowledged</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                        <span>⚠️</span>
                        <span>Ack Required</span>
                      </span>
                    )
                  )}

                  {/* Comments Count */}
                  <button
                    type="button"
                    onClick={() => setSelectedAnnouncementId(item.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-primary-600 transition-colors"
                  >
                    <span className="w-3.5 h-3.5"><MessageSquareIcon /></span>
                    <span>{item.reply_count} {item.reply_count === 1 ? 'reply' : 'replies'}</span>
                  </button>

                  {/* Reactions Summary */}
                  {item.reactions_summary && item.reactions_summary.length > 0 && (
                    <div className="flex items-center gap-1">
                      {item.reactions_summary.map((rx) => (
                        <span
                          key={rx.reaction}
                          className="inline-flex items-center gap-0.5 text-xs bg-slate-100 px-1.5 py-0.5 rounded-md text-slate-700"
                        >
                          <span>{rx.reaction}</span>
                          <span className="text-[10px] font-bold">{rx.count}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {canPublish && (
                    <button
                      type="button"
                      onClick={() => setAnalyticsAnnouncementId(item.id)}
                      className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Analytics
                    </button>
                  )}

                  {item.can_delete && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 active:scale-95 rounded-xl border border-rose-200 transition-all flex items-center gap-1.5 shadow-2xs hover:shadow-xs"
                      title="Permanently delete announcement"
                    >
                      <TrashIcon className="w-3.5 h-3.5 text-rose-600" />
                      <span>Delete</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedAnnouncementId(item.id)}
                    className="px-3 py-1 bg-primary-50 hover:bg-primary-100 text-primary-700 font-bold text-xs rounded-lg transition-colors"
                  >
                    View Circular →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Composer Modal */}
      {showComposer && (
        <AnnouncementComposerModal
          user={user}
          onClose={() => setShowComposer(false)}
          onCreated={(newId) => {
            fetchFeed()
            setShowComposer(false)
            showBanner('✓ Announcement broadcasted and published successfully!')
          }}
        />
      )}

      {/* Full Detail Modal / Full-screen on Mobile */}
      {selectedAnnouncementId && (
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 sm:backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            // Close only if clicking the backdrop directly
            if (e.target === e.currentTarget) setSelectedAnnouncementId(null)
          }}
        >
          {/*
            Card sizing strategy:
            - Mobile: h-[100dvh] — fills full dynamic viewport height (accounts for browser chrome)
            - Desktop (sm+): explicit h-[calc(100dvh-2rem)] — gives a CONCRETE height
              so that flex-1 children can calculate their sizes deterministically.
              max-h alone (h-auto + max-h) is insufficient because a child with
              flex-1 in an auto-height parent has no reference size and expands to
              full content height — preventing the body scroll container from working.
          */}
          <div className="w-full max-w-4xl bg-white sm:rounded-2xl shadow-2xl flex flex-col h-[100dvh] sm:h-[calc(100dvh-2rem)] overflow-hidden">
            <AnnouncementDetail
              announcementId={selectedAnnouncementId}
              onClose={() => setSelectedAnnouncementId(null)}
              onRefreshList={(msg) => {
                fetchFeed()
                if (msg) {
                  showBanner(msg)
                }
              }}
            />
          </div>
        </div>
      )}


      {/* Feed Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-xs">
                <AlertTriangleIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug">Delete Announcement Circular?</h3>
                <p className="text-xs text-slate-500 font-medium">Confirm permanent deletion</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Circular</span>
              <p className="font-extrabold text-slate-900 text-sm line-clamp-2">{deleteTarget.title}</p>
              <div className="flex items-center gap-2 text-slate-500 pt-0.5">
                <span>Category: <strong className="text-slate-700 font-semibold">{deleteTarget.type}</strong></span>
                <span>•</span>
                <span>Priority: <strong className="text-slate-700 font-semibold">{deleteTarget.priority}</strong></span>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200/80 text-xs text-rose-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-rose-900">
                <span>⚠️</span> Permanent & Irreversible Action
              </p>
              <p className="leading-relaxed text-[11px]">
                Deleting this circular will permanently remove it from all faculty feeds. All attached files, read receipts, and replies will be completely purged from the system.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel, Keep Circular
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteFeed}
                disabled={deleting}
                className="px-5 py-2.5 text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-60"
              >
                {deleting ? (
                  <>
                    <Spinner size="xs" className="border-white border-t-transparent" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Yes, Delete Announcement</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      {analyticsAnnouncementId && (
        <AnnouncementAnalyticsModal
          announcementId={analyticsAnnouncementId}
          onClose={() => setAnalyticsAnnouncementId(null)}
        />
      )}
    </div>
  )
}
