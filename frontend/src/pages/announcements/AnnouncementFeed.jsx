import { useState, useEffect, useRef, useMemo } from 'react'
import {
  SearchIcon, FilterIcon, PlusIcon, PinIcon, MessageSquareIcon,
  DownloadIcon, CheckCircleIcon, AlertTriangleIcon, CloseIcon, TrashIcon,
  PaperclipIcon, EyeIcon, UsersIcon, CheckIcon
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
    { id: 'important', label: 'High Priority' },
    { id: 'mentioned', label: '@Mentioned' },
    { id: 'ack_pending', label: 'Action Required' },
  ]

  const typeOptions = [
    { id: 'ALL', label: 'All Categories' },
    { id: 'CIRCULAR', label: 'Official Circular' },
    { id: 'NOTICE', label: 'General Notice' },
    { id: 'ACADEMIC', label: 'Academic Directive' },
    { id: 'ADMINISTRATIVE', label: 'Administrative Order' },
    { id: 'URGENT', label: 'Urgent Alert' },
    { id: 'EVENT', label: 'Campus Event' },
  ]

  const priorityBadgeStyles = {
    NORMAL: 'bg-slate-100 text-slate-700 border-slate-200',
    IMPORTANT: 'bg-blue-50 text-blue-700 border-blue-200 font-medium',
    HIGH: 'bg-amber-50 text-amber-800 border-amber-200 font-semibold',
    URGENT: 'bg-rose-50 text-rose-700 border-rose-200 font-bold',
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 text-slate-850">
      {/* ── Page Header: Mature, Institutional, Executive ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              Institutional Communications
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Announcements & Circulars
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Official directives, administrative notices, and faculty circulars.
          </p>
        </div>

        {canPublish && (
          <button
            type="button"
            onClick={() => setShowComposer(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-colors self-start sm:self-auto shrink-0 focus:outline-hidden focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            <PlusIcon className="w-4 h-4" />
            <span>New Announcement</span>
          </button>
        )}
      </div>

      {/* ── Top Feedback Banner (Auto-dismissing) ── */}
      {confirmationBanner && (
        <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs sm:text-sm text-emerald-900 font-medium animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5">
            <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{confirmationBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setConfirmationBanner(null)}
            className="p-1 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors shrink-0"
            title="Dismiss notification"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Filter Tabs & Search Controls ── */}
      <div className="space-y-3">
        {/* Navigation Tabs (Underline / Segmented style) */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 pb-px scrollbar-none">
          {tabs.map((t) => {
            const isActive = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap border-b-2 -mb-px flex items-center gap-1.5 ${
                  isActive
                    ? 'border-primary-600 text-primary-700 font-bold'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <span>{t.label}</span>
                {t.id === 'ack_pending' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                )}
              </button>
            )
          })}
        </div>

        {/* Search & Filter Controls Bar */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Input Box */}
            <div className="relative flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search circulars by title, topic, or author..."
                className="w-full text-xs sm:text-sm pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white transition-all text-slate-800 placeholder:text-slate-400"
              />
              <span className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <SearchIcon />
              </span>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
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
                className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100 transition-colors focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                title="Filter by category"
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
                className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100 transition-colors focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                title="Filter by priority"
              >
                <option value="ALL">All Priorities</option>
                <option value="URGENT">Urgent Priority</option>
                <option value="HIGH">High Priority</option>
                <option value="IMPORTANT">Important</option>
                <option value="NORMAL">Normal</option>
              </select>
            </div>
          </div>

          {/* Quick Filter Toggles & Status Summary Bar */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 flex-wrap text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
                Filter:
              </span>
              <button
                type="button"
                onClick={() => setHasAttachmentsOnly(!hasAttachmentsOnly)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                  hasAttachmentsOnly
                    ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <PaperclipIcon className="w-3 h-3" />
                <span>With Files</span>
                {hasAttachmentsOnly && <CheckIcon className="w-3 h-3 ml-0.5" />}
              </button>

              <button
                type="button"
                onClick={() => setPinnedOnly(!pinnedOnly)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                  pinnedOnly
                    ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <PinIcon className="w-3 h-3" />
                <span>Pinned Only</span>
                {pinnedOnly && <CheckIcon className="w-3 h-3 ml-0.5" />}
              </button>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors ml-1"
                >
                  Clear Filters
                </button>
              )}
            </div>

            <div className="text-[11px] font-medium text-slate-500">
              {loading ? (
                <span>Loading notices...</span>
              ) : (
                <span>
                  Showing <strong className="text-slate-800">{displayedAnnouncements.length}</strong> {displayedAnnouncements.length === 1 ? 'notice' : 'notices'}
                  {search && <span> matching &ldquo;<strong>{search}</strong>&rdquo;</span>}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Feed Stream ── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-20 h-5 bg-slate-200 rounded-md" />
                  <div className="w-14 h-5 bg-slate-150 rounded-md" />
                </div>
                <div className="w-24 h-4 bg-slate-200 rounded-md" />
              </div>
              <div className="w-3/4 h-5 bg-slate-250 rounded-md" />
              <div className="space-y-1.5">
                <div className="w-full h-3.5 bg-slate-150 rounded" />
                <div className="w-5/6 h-3.5 bg-slate-150 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="py-12 text-center bg-white rounded-xl border border-rose-200 p-6 space-y-3">
          <AlertTriangleIcon className="w-8 h-8 text-rose-500 mx-auto" />
          <h3 className="font-bold text-sm text-slate-900">Unable to load announcements</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {error}. Please check your connection and try again.
          </p>
          <button
            type="button"
            onClick={fetchFeed}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      ) : displayedAnnouncements.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-xl border border-dashed border-slate-200 p-8 space-y-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <SearchIcon className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-slate-900">
            {hasActiveFilters ? 'No Matching Notices' : 'No Announcements Posted'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {hasActiveFilters
              ? 'No announcements match your search query or selected filter criteria. Try adjusting keywords or clearing active filters.'
              : 'You are completely caught up. When institutional circulars or departmental directives are issued, they will appear here.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {displayedAnnouncements.map((item) => {
            const isUnread = !item.is_read
            return (
              <article
                key={item.id}
                className={`bg-white rounded-xl border transition-all duration-150 hover:border-slate-300 hover:shadow-xs p-5 sm:p-6 ${
                  isUnread
                    ? 'border-l-4 border-l-primary-600 border-t-slate-200 border-r-slate-200 border-b-slate-200'
                    : 'border-slate-200'
                }`}
              >
                {/* Card Top Metadata */}
                <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.is_pinned && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                        <PinIcon className="w-3 h-3 text-amber-700" />
                        <span>Pinned</span>
                      </span>
                    )}

                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      {item.type}
                    </span>

                    {item.priority !== 'NORMAL' && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] border ${priorityBadgeStyles[item.priority] || priorityBadgeStyles.NORMAL}`}>
                        {item.priority}
                      </span>
                    )}

                    {item.version > 1 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Rev. {item.version}
                      </span>
                    )}

                    {isUnread && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary-50 text-primary-700 border border-primary-200">
                        Unread
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-800">{item.author_name}</span>
                    <span>•</span>
                    <span>
                      {item.published_at
                        ? new Date(item.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'Draft'}
                    </span>
                  </div>
                </div>

                {/* Title & Body Snippet */}
                <div
                  onClick={() => setSelectedAnnouncementId(item.id)}
                  className="cursor-pointer group mt-1"
                >
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-primary-700 transition-colors leading-snug">
                    {item.title}
                  </h2>
                  <p className="mt-1.5 text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
                    {item.body_snippet}
                  </p>
                </div>

                {/* Attachments Pills */}
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
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors"
                        >
                          <PaperclipIcon className="w-3 h-3 text-slate-400" />
                          <span className="truncate max-w-[180px]">{att.file_name}</span>
                        </a>
                      )
                    })}
                  </div>
                )}

                {/* Card Footer Bar */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap text-xs">
                  <div className="flex items-center gap-3 flex-wrap text-slate-500">
                    {/* Acknowledgement Status */}
                    {item.requires_acknowledgement && (
                      item.is_acknowledged ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                          <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Acknowledged</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <span>Action Required</span>
                        </span>
                      )
                    )}

                    {/* Replies count */}
                    <button
                      type="button"
                      onClick={() => setSelectedAnnouncementId(item.id)}
                      className="inline-flex items-center gap-1 font-medium hover:text-slate-900 transition-colors"
                    >
                      <MessageSquareIcon className="w-3.5 h-3.5" />
                      <span>{item.reply_count} {item.reply_count === 1 ? 'reply' : 'replies'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {canPublish && (
                      <button
                        type="button"
                        onClick={() => setAnalyticsAnnouncementId(item.id)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        Analytics
                      </button>
                    )}

                    {item.can_delete && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete announcement"
                      >
                        Delete
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedAnnouncementId(item.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-primary-700 font-semibold text-xs rounded-lg border border-slate-200 transition-colors"
                    >
                      <span>Read Directive</span>
                      <span className="text-slate-400">→</span>
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* ── Composer Modal ── */}
      {showComposer && (
        <AnnouncementComposerModal
          user={user}
          onClose={() => setShowComposer(false)}
          onCreated={(newId) => {
            fetchFeed()
            setShowComposer(false)
            showBanner('Notice published and broadcasted successfully.')
          }}
        />
      )}

      {/* ── Announcement Detail Modal ── */}
      {selectedAnnouncementId && (
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedAnnouncementId(null)
          }}
        >
          <div className="w-full max-w-4xl bg-white sm:rounded-2xl shadow-2xl flex flex-col h-[100dvh] sm:h-[calc(100dvh-2rem)] overflow-hidden">
            <AnnouncementDetail
              announcementId={selectedAnnouncementId}
              onClose={() => setSelectedAnnouncementId(null)}
              onRefreshList={(msg) => {
                fetchFeed()
                if (msg) showBanner(msg)
              }}
            />
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <TrashIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Announcement</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confirm permanent removal of this circular.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Target Notice</span>
              <p className="font-bold text-slate-900 text-sm line-clamp-2">{deleteTarget.title}</p>
              <div className="flex items-center gap-2 text-slate-500 pt-0.5 text-[11px]">
                <span>Category: <strong className="text-slate-700">{deleteTarget.type}</strong></span>
                <span>•</span>
                <span>Priority: <strong className="text-slate-700">{deleteTarget.priority}</strong></span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              This action cannot be undone. Attached files, read receipts, and threaded discussions will be permanently deleted.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteFeed}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-60 shadow-xs"
              >
                {deleting ? (
                  <>
                    <Spinner size="xs" className="border-white border-t-transparent" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Circular</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Analytics Modal ── */}
      {analyticsAnnouncementId && (
        <AnnouncementAnalyticsModal
          announcementId={analyticsAnnouncementId}
          onClose={() => setAnalyticsAnnouncementId(null)}
        />
      )}
    </div>
  )
}
