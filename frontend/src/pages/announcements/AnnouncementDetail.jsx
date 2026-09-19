import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CloseIcon, PrinterIcon, DownloadIcon, CheckCircleIcon,
  AlertTriangleIcon, PinIcon, LockIcon, UnlockIcon, SettingsIcon,
  TrashIcon, MoreVerticalIcon, LinkIcon, EyeIcon, MessageSquareIcon
} from '../../components/icons'
import { Spinner } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { announcementApi } from '../../api/announcements'
import ConversationThread from './ConversationThread'
import AnnouncementAnalyticsModal from './AnnouncementAnalyticsModal'

/** Translates technical target data into human-readable audience descriptions */
function formatAudience(data) {
  if (!data) return 'All Faculty'
  if (data.target_summary === 'COLLEGE') {
    return 'All College Faculty'
  }
  if (data.targets && data.targets.length > 0) {
    const depts = data.targets
      .filter((t) => t.target_type === 'DEPARTMENT')
      .map((t) => t.department_name)
      .filter(Boolean)
    const users = data.targets
      .filter((t) => t.target_type === 'USER')
      .map((t) => t.user_name)
      .filter(Boolean)

    if (depts.length > 0 && users.length === 0) {
      return depts.length === 1 ? `${depts[0]} Department` : `${depts.join(', ')} Departments`
    }
    if (users.length > 0 && depts.length === 0) {
      return users.length <= 2 ? `Faculty: ${users.join(', ')}` : `Selected Faculty (${users.length} members)`
    }
    if (depts.length > 0 && users.length > 0) {
      return `${depts.join(', ')} & ${users.length} Selected Faculty`
    }
  }
  if (data.target_summary === 'DEPARTMENT') return 'Department Faculty'
  if (data.target_summary === 'USER') return 'Specific Faculty'
  return data.target_summary || 'Institutional Recipients'
}

export default function AnnouncementDetail({ announcementId: propId, onClose, onRefreshList }) {
  const { id: routeId } = useParams()
  const announcementId = propId || routeId
  const navigate = useNavigate()
  const { user, isPrincipal, isAdmin, isSystemAdmin } = useAuth()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [messages, setMessages] = useState([])
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [acknowledging, setAcknowledging] = useState(false)
  const [previewAttachment, setPreviewAttachment] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [togglingPin, setTogglingPin] = useState(false)
  const [togglingLock, setTogglingLock] = useState(false)

  const menuRef = useRef(null)
  const conversationSectionRef = useRef(null)

  const fetchDetail = async () => {
    try {
      const res = await announcementApi.getAnnouncementDetail(announcementId)
      setData(res.data)
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to load announcement details', 'error')
    }
  }

  const fetchMessages = async () => {
    try {
      const res = await announcementApi.getConversationMessages(announcementId)
      setMessages(res.data)
    } catch (err) {
      console.warn('Could not load conversation messages', err)
    }
  }

  useEffect(() => {
    if (!announcementId) return
    setLoading(true)
    Promise.all([fetchDetail(), fetchMessages()]).finally(() => setLoading(false))
  }, [announcementId])

  // Close more menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMoreMenu(false)
      }
    }
    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMoreMenu])

  // Escape key: close modals in stack order — analytics first, then detail
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return
      if (previewAttachment) {
        setPreviewAttachment(null)
      } else if (showDeleteModal) {
        setShowDeleteModal(false)
      } else if (showAnalytics) {
        setShowAnalytics(false)
      } else if (showMoreMenu) {
        setShowMoreMenu(false)
      } else if (onClose) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [previewAttachment, showDeleteModal, showAnalytics, showMoreMenu, onClose])

  const handleAcknowledge = async () => {
    setAcknowledging(true)
    try {
      await announcementApi.acknowledgeAnnouncement(announcementId)
      showToast('Formal acknowledgement recorded successfully', 'success')
      fetchDetail()
      if (onRefreshList) onRefreshList()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Acknowledgement failed', 'error')
    } finally {
      setAcknowledging(false)
    }
  }

  const handleConfirmDelete = async () => {
    // Guard against double-click
    if (deleting) return
    setDeleting(true)
    try {
      await announcementApi.deleteAnnouncement(announcementId)
      showToast(`Announcement "${data?.title || ''}" deleted successfully`, 'success')
      // Close the delete modal, then the detail panel
      setShowDeleteModal(false)
      setDeleting(false) // reset before unmount so no stale-state warning
      if (onRefreshList) onRefreshList(`Announcement "${data?.title || ''}" was deleted`)
      if (onClose) onClose()
      else navigate('/announcements')
    } catch (err) {
      const status = err.response?.status
      if (status === 404) {
        // Already deleted (e.g. from a double-click race) — treat as success
        showToast('Announcement deleted successfully', 'success')
        setShowDeleteModal(false)
        setDeleting(false)
        if (onRefreshList) onRefreshList(`Announcement was deleted`)
        if (onClose) onClose()
        else navigate('/announcements')
      } else {
        showToast(err.response?.data?.detail || 'Failed to delete announcement', 'error')
        setDeleting(false)
      }
    }
  }


  const handleTogglePinAnnouncement = async () => {
    if (!data) return
    setTogglingPin(true)
    setShowMoreMenu(false)
    try {
      const updated = !data.is_pinned
      await announcementApi.updateAnnouncement(announcementId, { is_pinned: updated })
      showToast(updated ? 'Announcement pinned to top of feed' : 'Announcement unpinned', 'success')
      setData((prev) => ({ ...prev, is_pinned: updated }))
      if (onRefreshList) onRefreshList()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to update pin status', 'error')
    } finally {
      setTogglingPin(false)
    }
  }

  const handleToggleLockConversation = async () => {
    if (!data) return
    setTogglingLock(true)
    setShowMoreMenu(false)
    try {
      const updated = !data.is_locked
      await announcementApi.updateAnnouncement(announcementId, { is_locked: updated })
      showToast(updated ? 'Conversation locked: discussion closed' : 'Conversation unlocked: replies enabled', 'success')
      setData((prev) => ({ ...prev, is_locked: updated }))
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to update lock status', 'error')
    } finally {
      setTogglingLock(false)
    }
  }

  const handleCopyLink = async () => {
    try {
      const shareUrl = `${window.location.origin}/announcements?id=${announcementId}`
      await navigator.clipboard.writeText(shareUrl)
      showToast('✓ Internal link copied to clipboard', 'success')
      setShowMoreMenu(false)
    } catch (err) {
      showToast('Could not copy link to clipboard', 'error')
    }
  }

  const handleScrollToConversation = () => {
    if (conversationSectionRef.current) {
      conversationSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      const textarea = conversationSectionRef.current.querySelector('textarea')
      if (textarea) {
        setTimeout(() => textarea.focus(), 400)
      }
    }
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-xs text-slate-600 font-semibold">Loading official circular...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="py-16 text-center text-slate-600 text-sm space-y-3">
        <span className="text-3xl">⚠️</span>
        <p className="font-bold text-slate-800">Announcement not found or access restricted.</p>
        <button
          type="button"
          onClick={onClose ? onClose : () => navigate('/announcements')}
          className="px-4 py-2 bg-primary-600 text-white text-xs font-bold rounded-xl"
        >
          Back to Feed
        </button>
      </div>
    )
  }

  const priorityBadgeClasses = {
    NORMAL: 'bg-slate-100 text-slate-700 border-slate-200',
    IMPORTANT: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
    HIGH: 'bg-orange-100 text-orange-900 border-orange-300 font-bold',
    URGENT: 'bg-rose-100 text-rose-900 border-rose-300 font-extrabold shadow-2xs',
  }[data.priority] || 'bg-slate-100 text-slate-700'

  const priorityDot = {
    URGENT: '🔴',
    HIGH: '🟠',
    IMPORTANT: '🟡',
    NORMAL: '⚪',
  }[data.priority] || '⚪'

  const audienceText = formatAudience(data)

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white sm:rounded-2xl">
      {/* ── Top Responsive Header Toolbar — pinned, never scrolls ── */}
      <div className="px-3.5 sm:px-6 py-3 bg-slate-50/95 border-b border-slate-200 flex items-center justify-between gap-2 print:hidden shrink-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onClose ? onClose : () => navigate('/announcements')}
            className="p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors shrink-0 flex items-center gap-1 active:scale-95"
            title="Back to Announcements Feed"
          >
            <span className="text-lg font-black leading-none">←</span>
            <span className="text-xs font-bold hidden sm:inline">Announcements</span>
          </button>

          {data.is_pinned && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
              <span className="w-3 h-3"><PinIcon /></span>
              <span>Pinned</span>
            </span>
          )}

          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shrink-0 ${priorityBadgeClasses}`}>
            <span>{priorityDot}</span>
            <span>{data.priority}</span>
          </span>

          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-200 text-slate-800 shrink-0">
            {data.type}
          </span>

          {data.version > 1 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
              v{data.version}
            </span>
          )}
        </div>

        {/* Right Toolbar Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handlePrint}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors hidden sm:inline-flex"
            title="Print Official Circular"
          >
            <span className="w-4 h-4"><PrinterIcon /></span>
          </button>

          {/* More Action Menu Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors flex items-center justify-center active:scale-95"
              title="More Actions"
              aria-label="More actions"
            >
              <MoreVerticalIcon className="w-4 h-4" />
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-40 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 font-semibold transition-colors"
                >
                  <LinkIcon className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Internal Share Link</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false)
                    handlePrint()
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 font-semibold transition-colors sm:hidden"
                >
                  <PrinterIcon className="w-3.5 h-3.5 text-slate-500" />
                  <span>Print Circular</span>
                </button>

                {data.can_view_analytics && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false)
                      setShowAnalytics(true)
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 font-semibold text-indigo-700 transition-colors"
                  >
                    <span>📊</span>
                    <span>View Delivery Analytics</span>
                  </button>
                )}

                {data.can_moderate && (
                  <>
                    <div className="h-px bg-slate-100 my-1" />
                    <button
                      type="button"
                      disabled={togglingPin}
                      onClick={handleTogglePinAnnouncement}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 font-semibold transition-colors"
                    >
                      <PinIcon className="w-3.5 h-3.5 text-amber-600" />
                      <span>{data.is_pinned ? 'Unpin Circular' : 'Pin Circular to Top'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={togglingLock}
                      onClick={handleToggleLockConversation}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 font-semibold transition-colors"
                    >
                      {data.is_locked ? (
                        <>
                          <UnlockIcon className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Unlock Conversation</span>
                        </>
                      ) : (
                        <>
                          <LockIcon className="w-3.5 h-3.5 text-slate-600" />
                          <span>Lock Conversation</span>
                        </>
                      )}
                    </button>
                  </>
                )}

                {data.can_delete && (
                  <>
                    <div className="h-px bg-slate-100 my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false)
                        setShowDeleteModal(true)
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-rose-50 text-rose-600 flex items-center gap-2.5 font-bold transition-colors"
                    >
                      <TrashIcon className="w-3.5 h-3.5 text-rose-600" />
                      <span>Delete Announcement</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* X Close button — always visible on all screen sizes */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors flex items-center justify-center min-w-[36px] min-h-[36px]"
              title="Close announcement"
              aria-label="Close announcement"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Scrollable Body: all announcement content lives here ── */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-20 sm:pb-8 overscroll-contain">
      {/* ── Main Official Content Container ── */}
      <div className="p-4 sm:p-8 space-y-6 max-w-3xl mx-auto">
        {/* Revision Banner if v > 1 */}
        {data.version > 1 && (
          <div className="p-3.5 bg-indigo-50/90 border border-indigo-200 rounded-2xl text-xs text-indigo-950 flex items-start gap-2.5">
            <span className="text-base leading-none">ℹ️</span>
            <div>
              <p className="font-black text-indigo-900">
                Official Circular Revision (Version {data.version})
              </p>
              {data.revision_notes && (
                <p className="text-indigo-800/90 mt-0.5 font-medium leading-relaxed">{data.revision_notes}</p>
              )}
            </div>
          </div>
        )}

        {/* Circular Official Header Card */}
        <div className="border-b border-slate-200 pb-5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-primary-700">
              Institutional Communication • Circular #{data.id}
            </p>

            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{data.status}</span>
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-950 tracking-tight leading-snug">
            {data.title}
          </h1>

          {/* Publisher, Date, Audience Metadata Grid */}
          <div className="pt-1 flex items-center gap-y-2 gap-x-4 text-xs text-slate-600 flex-wrap">
            {/* Author */}
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-600 to-indigo-700 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                {data.author_name?.[0] || 'A'}
              </span>
              <div>
                <span className="font-extrabold text-slate-900 block">{data.author_name}</span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {data.author_role} {data.department_name ? `• ${data.department_name}` : ''}
                </span>
              </div>
            </div>

            <span className="text-slate-300 hidden sm:inline">•</span>

            {/* Published & Updated Times */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Published</span>
              <span className="font-semibold text-slate-700">
                {data.published_at ? new Date(data.published_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Draft'}
              </span>
            </div>

            <span className="text-slate-300 hidden sm:inline">•</span>

            {/* Human-readable Audience */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Audience</span>
              <span className="font-bold text-primary-800 bg-primary-50 px-2 py-0.5 rounded-md border border-primary-200/60 inline-block">
                👥 {audienceText}
              </span>
            </div>
          </div>

          {/* Read Receipt & Publisher Aggregate Views */}
          <div className="pt-2 flex items-center justify-between gap-3 text-xs flex-wrap border-t border-slate-100">
            {data.first_viewed_at ? (
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Read by you: {new Date(data.first_viewed_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
              </span>
            ) : (
              <span className="text-[11px] font-bold text-primary-700">New circular • Unread</span>
            )}

            {data.can_view_analytics && data.total_recipients !== null && data.total_recipients !== undefined && (
              <button
                type="button"
                onClick={() => setShowAnalytics(true)}
                className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-1.5"
              >
                <EyeIcon className="w-3.5 h-3.5 text-indigo-600" />
                <span>Delivery: {data.viewed_count} / {data.total_recipients} viewed ({Math.max(0, data.total_recipients - (data.viewed_count || 0))} unread)</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Official Announcement Content Card ── */}
        <div className="bg-slate-50/50 p-5 sm:p-6 rounded-2xl border border-slate-200/80 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
              Official Directive Content
            </span>
          </div>
          <div className="text-sm sm:text-base text-slate-850 leading-relaxed whitespace-pre-wrap font-sans space-y-4">
            {data.body}
          </div>
        </div>

        {/* ── Mandatory Formal Acknowledgement Section ── */}
        {data.requires_acknowledgement && (
          <div className="pt-2">
            {data.is_acknowledged ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CheckCircleIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-emerald-950">Circular Formally Acknowledged</h4>
                    <p className="text-xs text-emerald-800">
                      Confirmed receipt and compliance on{' '}
                      <span className="font-bold">
                        {data.acknowledged_at ? new Date(data.acknowledged_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Recorded'}
                      </span>
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0">
                  COMPLIANT
                </span>
              </div>
            ) : (
              <div className="p-5 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl space-y-3 shadow-xs">
                <div className="flex items-start gap-3">
                  <span className="text-2xl leading-none shrink-0">⚠️</span>
                  <div>
                    <h4 className="font-black text-sm text-amber-950 uppercase tracking-wide">
                      Formal Institutional Acknowledgement Required
                    </h4>
                    <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                      By acknowledging this directive, you formally record and certify that you have read, understood, and agreed to comply with the instructions detailed above.
                    </p>
                  </div>
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    disabled={acknowledging}
                    onClick={handleAcknowledge}
                    className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-black text-xs rounded-xl shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {acknowledging && <Spinner size="sm" className="border-white border-t-transparent" />}
                    <span>✓ I ACKNOWLEDGE THIS CIRCULAR</span>
                  </button>
                </div>
              </div>
            )}

            {/* Publisher Acknowledgement Progress Indicator */}
            {data.can_view_analytics && data.total_recipients !== null && data.total_recipients !== undefined && (
              <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-slate-700">
                  Acknowledgement Progress: <strong>{data.acknowledged_count || 0}</strong> of <strong>{data.total_recipients}</strong> acknowledged ({Math.max(0, data.total_recipients - (data.acknowledged_count || 0))} pending)
                </span>
                <button
                  type="button"
                  onClick={() => setShowAnalytics(true)}
                  className="font-bold text-primary-700 hover:text-primary-800 hover:underline shrink-0"
                >
                  View Roster →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Official Attachments List ── */}
        {data.attachments && data.attachments.length > 0 && (
          <div className="pt-2">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span>📎</span>
              <span>Official Documents & Attachments ({data.attachments.length})</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.attachments.map((att) => {
                const isPdf = att.file_type.includes('pdf') || att.file_name.endsWith('.pdf')
                const isImg = att.file_type.includes('image') || /\.(jpg|jpeg|jfif|png|webp|gif|bmp)$/i.test(att.file_name)
                const sizeMb = (att.file_size / (1024 * 1024)).toFixed(2)
                const sizeKb = Math.round(att.file_size / 1024)
                const sizeDisplay = att.file_size > 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`

                return (
                  <div
                    key={att.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 hover:border-primary-300 transition-colors shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isImg ? (
                        <img
                          src={att.download_url}
                          alt={att.file_name}
                          className="w-11 h-11 object-cover rounded-xl border border-slate-200 shrink-0 bg-white cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setPreviewAttachment(att)}
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xl shrink-0">
                          {isPdf ? '📄' : '📎'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate" title={att.file_name}>
                          {att.file_name}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {isPdf ? 'PDF Document' : isImg ? 'Image' : 'Attachment'} • {sizeDisplay}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {(isImg || isPdf) && (
                        <button
                          type="button"
                          onClick={() => setPreviewAttachment(att)}
                          className="px-2.5 py-1.5 text-xs font-bold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors shadow-2xs"
                        >
                          Preview
                        </button>
                      )}
                      <a
                        href={att.download_url}
                        download={att.file_name}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 text-xs font-bold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-xl flex items-center gap-1 transition-colors"
                        title="Download file"
                      >
                        <DownloadIcon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Save</span>
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Conversation Thread Section ── */}
        <div ref={conversationSectionRef} className="pt-4">
          <ConversationThread
            announcementId={announcementId}
            messages={messages}
            allowReplies={data.allow_replies}
            isLocked={data.is_locked}
            canModerate={data.can_moderate}
            currentUserId={user?.id}
            currentUserName={user?.name}
            onRefresh={fetchMessages}
          />
        </div>
      </div>

      {/* ── End of Scrollable Body region ── */}
      </div>

      {/* ── Mobile Sticky Bottom Action Bar (< 640px) ── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-2.5 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-xl flex items-center justify-between gap-2 z-50 print:hidden">
        {data.requires_acknowledgement && !data.is_acknowledged ? (
          <button
            type="button"
            disabled={acknowledging}
            onClick={handleAcknowledge}
            className="flex-1 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 active:scale-95 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5"
          >
            {acknowledging && <Spinner size="xs" className="border-white border-t-transparent" />}
            <span>✓ ACKNOWLEDGE</span>
          </button>
        ) : (
          data.allow_replies && !data.is_locked && (
            <button
              type="button"
              onClick={handleScrollToConversation}
              className="flex-1 py-2.5 bg-primary-600 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5"
            >
              <MessageSquareIcon className="w-4 h-4" />
              <span>Write Reply / Clarification</span>
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => setShowMoreMenu(true)}
          className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs shrink-0 flex items-center justify-center"
          title="More actions"
        >
          <MoreVerticalIcon className="w-4 h-4" />
        </button>
      </div>

      {/* ── Attachment Preview Modal (Lightbox for Images & PDF Viewer) ── */}
      {previewAttachment && (
        <div
          onClick={() => setPreviewAttachment(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl h-[88vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col relative animate-in zoom-in-95 duration-150"
          >
            <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg">
                  {previewAttachment.file_type.includes('pdf') || previewAttachment.file_name.endsWith('.pdf') ? '📄' : '🖼️'}
                </span>
                <span className="font-extrabold text-xs sm:text-sm truncate">{previewAttachment.file_name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewAttachment.download_url}
                  download={previewAttachment.file_name}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-500 rounded-xl flex items-center gap-1 transition-colors"
                >
                  <DownloadIcon className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl transition-colors"
                  title="Close preview"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-auto p-2">
              {previewAttachment.file_type.includes('pdf') || previewAttachment.file_name.endsWith('.pdf') ? (
                <iframe
                  src={previewAttachment.download_url}
                  title={previewAttachment.file_name}
                  className="w-full h-full rounded-2xl border-0 shadow-inner bg-white"
                />
              ) : (
                <img
                  src={previewAttachment.download_url}
                  alt={previewAttachment.file_name}
                  className="max-w-full max-h-full object-contain mx-auto rounded-2xl shadow-md"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-xs">
                <AlertTriangleIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug">Delete Announcement Circular?</h3>
                <p className="text-xs text-slate-500 font-medium">Permanent directive purge</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Circular</span>
              <p className="font-extrabold text-slate-900 text-sm line-clamp-2">{data.title}</p>
              <div className="flex items-center gap-2 text-slate-500 pt-0.5">
                <span>Category: <strong className="text-slate-700 font-semibold">{data.type}</strong></span>
                <span>•</span>
                <span>Priority: <strong className="text-slate-700 font-semibold">{data.priority}</strong></span>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200/80 text-xs text-rose-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-rose-900">
                <span>⚠️</span> Permanent & Irreversible Action
              </p>
              <p className="leading-relaxed text-[11px]">
                Deleting this circular will permanently remove it from all faculty dashboards and feeds. All uploaded files, receipts, and replies will be purged.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel, Keep Circular
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
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

      {/* ── Analytics Modal ── */}
      {showAnalytics && (
        <AnnouncementAnalyticsModal
          announcementId={announcementId}
          onClose={() => setShowAnalytics(false)}
        />
      )}
    </div>
  )
}
