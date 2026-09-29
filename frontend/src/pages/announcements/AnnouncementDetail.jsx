import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CloseIcon, PrinterIcon, DownloadIcon, CheckCircleIcon,
  AlertTriangleIcon, PinIcon, LockIcon, UnlockIcon,
  TrashIcon, MoreVerticalIcon, LinkIcon, EyeIcon, MessageSquareIcon,
  PaperclipIcon, CheckIcon, UsersIcon
} from '../../components/icons'
import { Spinner } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { formatErrorMessage } from '../../utils/errorUtils'
import { announcementApi } from '../../api/announcements'
import ConversationThread from './ConversationThread'
import AnnouncementAnalyticsModal from './AnnouncementAnalyticsModal'

const ROLE_LABELS = {
  TEACHER: 'Teachers',
  STUDENT: 'Students',
  ADMIN: 'Administrators',
  SUPER_ADMIN: 'Super Admins',
  HOD: 'Department Heads (HODs)',
  STAFF: 'Staff',
  PRINCIPAL: 'Principals',
  GOVERNANCE: 'Governance Officers',
  ALL: 'All Members',
}

const DEPT_KNOWN_NAMES = {
  1: 'Computer Science',
  2: 'Mathematics',
  3: 'Physics',
  4: 'Chemistry',
}

function formatSingleAudienceToken(token, data = {}) {
  if (!token) return ''
  if (typeof token !== 'string') return String(token)
  const trimmed = token.trim().replace(/^["']|["']$/g, '')
  if (!trimmed) return ''

  if (trimmed.toUpperCase().startsWith('ROLE:')) {
    const roleKey = trimmed.slice(5).toUpperCase().trim()
    return ROLE_LABELS[roleKey] || (roleKey.charAt(0).toUpperCase() + roleKey.slice(1).toLowerCase() + 's')
  }

  if (trimmed.toUpperCase().startsWith('DEPT:')) {
    const deptId = trimmed.slice(5).trim()
    let deptName = null
    if (data.targets && Array.isArray(data.targets)) {
      const match = data.targets.find((t) => String(t.department_id) === String(deptId) && t.department_name)
      if (match) deptName = match.department_name
    }
    if (!deptName && data.department_name && (String(data.department_id) === String(deptId) || data.targets?.length === 1)) {
      deptName = data.department_name
    }
    if (!deptName && DEPT_KNOWN_NAMES[deptId]) {
      deptName = DEPT_KNOWN_NAMES[deptId]
    }
    return deptName ? `Department: ${deptName}` : `Department: ${deptId}`
  }

  if (trimmed.toUpperCase().startsWith('USER:')) {
    const userId = trimmed.slice(5).trim()
    let userName = null
    if (data.targets && Array.isArray(data.targets)) {
      const match = data.targets.find((t) => String(t.user_id) === String(userId) && t.user_name)
      if (match) userName = match.user_name
    }
    return userName ? `Faculty: ${userName}` : `User #${userId}`
  }

  if (ROLE_LABELS[trimmed.toUpperCase()]) {
    return ROLE_LABELS[trimmed.toUpperCase()]
  }

  return trimmed
}

/** Translates technical target data into human-readable audience descriptions */
export function formatAudience(data) {
  if (!data) return 'All Faculty'

  // If data has explicit targets array with human names populated
  if (data.targets && data.targets.length > 0) {
    const depts = data.targets
      .filter((t) => t.target_type === 'DEPARTMENT')
      .map((t) => t.department_name || (t.department_id ? (DEPT_KNOWN_NAMES[t.department_id] ? `Department: ${DEPT_KNOWN_NAMES[t.department_id]}` : `Department #${t.department_id}`) : null))
      .filter(Boolean)
    const users = data.targets
      .filter((t) => t.target_type === 'USER')
      .map((t) => t.user_name || (t.user_id ? `Faculty #${t.user_id}` : null))
      .filter(Boolean)

    if (depts.length > 0 && users.length === 0) {
      return depts.length === 1 ? (depts[0].startsWith('Department:') ? depts[0] : `${depts[0]} Department`) : `${depts.join(', ')} Departments`
    }
    if (users.length > 0 && depts.length === 0) {
      return users.length <= 2 ? `Faculty: ${users.join(', ')}` : `Selected Faculty (${users.length} members)`
    }
    if (depts.length > 0 && users.length > 0) {
      return `${depts.join(', ')} & ${users.length} Selected Faculty`
    }
  }

  const raw = data.target_summary || data.target_audience || data.target_type

  // Check if raw is a JSON string like '["ROLE:TEACHER", "DEPT:1"]'
  if (typeof raw === 'string' && (raw.startsWith('[') || raw.startsWith('{'))) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const formattedTokens = parsed.map((t) => formatSingleAudienceToken(t, data)).filter(Boolean)
        if (formattedTokens.length > 0) {
          return formattedTokens.join(', ')
        }
      } else if (typeof parsed === 'object' && parsed !== null) {
        const parts = []
        if (parsed.role) parts.push(ROLE_LABELS[parsed.role.toUpperCase()] || parsed.role)
        if (parsed.dept || parsed.dept_id) {
          const dId = parsed.dept || parsed.dept_id
          parts.push(`Department: ${DEPT_KNOWN_NAMES[dId] || dId}`)
        }
        if (parts.length > 0) return parts.join(', ')
      }
    } catch {
      // not valid JSON, proceed to token/string matching
    }
  }

  if (Array.isArray(raw)) {
    const formattedTokens = raw.map((t) => formatSingleAudienceToken(t, data)).filter(Boolean)
    if (formattedTokens.length > 0) {
      return formattedTokens.join(', ')
    }
  }

  if (typeof raw === 'string') {
    // If it's a comma-separated list of tokens like "ROLE:TEACHER, DEPT:1"
    if (raw.includes(',') || raw.includes(':')) {
      const tokens = raw.split(',').map((s) => s.trim()).filter(Boolean)
      const formattedTokens = tokens.map((t) => formatSingleAudienceToken(t, data)).filter(Boolean)
      if (formattedTokens.length > 0) {
        return formattedTokens.join(', ')
      }
    }

    if (raw === 'COLLEGE') return 'All College Faculty'
    if (raw === 'DEPARTMENT') {
      return data.department_name ? `${data.department_name} Department` : 'Department Faculty'
    }
    if (raw === 'USER') return 'Specific Faculty'

    const singleFormatted = formatSingleAudienceToken(raw, data)
    if (singleFormatted) return singleFormatted
  }

  return 'Institutional Recipients'
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
      showToast(formatErrorMessage(err) || 'Failed to load announcement details', 'error')
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
    if (!announcementId || acknowledging) return
    setAcknowledging(true)
    try {
      await announcementApi.acknowledgeAnnouncement(announcementId)
      setData((prev) => (prev ? {
        ...prev,
        is_acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        can_acknowledge: false,
      } : prev))
      showToast('Formal acknowledgement recorded successfully', 'success')
      await fetchDetail()
      if (onRefreshList) onRefreshList()
    } catch (err) {
      showToast(formatErrorMessage(err) || 'Acknowledgement failed', 'error')
    } finally {
      setAcknowledging(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      await announcementApi.deleteAnnouncement(announcementId)
      showToast(`Announcement "${data?.title || ''}" deleted successfully`, 'success')
      setShowDeleteModal(false)
      setDeleting(false)
      if (onRefreshList) onRefreshList(`Announcement "${data?.title || ''}" was deleted`)
      if (onClose) onClose()
      else navigate('/announcements')
    } catch (err) {
      const status = err.response?.status
      if (status === 404) {
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
      showToast('Internal link copied to clipboard', 'success')
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
        <Spinner size="md" />
        <p className="text-xs text-slate-500 font-medium">Loading circular...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="py-16 text-center text-slate-500 text-sm space-y-3 p-6">
        <AlertTriangleIcon className="w-8 h-8 text-slate-400 mx-auto" />
        <p className="font-semibold text-slate-800">Announcement not found or access restricted.</p>
        <button
          type="button"
          onClick={onClose ? onClose : () => navigate('/announcements')}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors"
        >
          Back to Feed
        </button>
      </div>
    )
  }

  const priorityBadgeClasses = {
    NORMAL: 'bg-slate-100 text-slate-700 border-slate-200',
    IMPORTANT: 'bg-blue-50 text-blue-700 border-blue-200 font-medium',
    HIGH: 'bg-amber-50 text-amber-800 border-amber-200 font-semibold',
    URGENT: 'bg-rose-50 text-rose-700 border-rose-200 font-bold',
  }[data.priority] || 'bg-slate-100 text-slate-700 border-slate-200'

  const audienceText = formatAudience(data)

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white sm:rounded-2xl text-slate-850">
      {/* ── Top Header Toolbar — Pinned ── */}
      <div className="px-4 sm:px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-3 print:hidden shrink-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onClose ? onClose : () => navigate('/announcements')}
            className="p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 text-xs font-semibold"
            title="Back to Announcements Feed"
          >
            <span className="text-base leading-none">←</span>
            <span className="hidden sm:inline">Back</span>
          </button>

          <span className="text-slate-300 hidden sm:inline">|</span>

          <span className="text-xs font-mono text-slate-500 font-medium shrink-0">
            #{data.id}
          </span>

          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
            {data.type}
          </span>

          {data.priority !== 'NORMAL' && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] border shrink-0 ${priorityBadgeClasses}`}>
              {data.priority}
            </span>
          )}

          {data.is_pinned && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200 shrink-0">
              <PinIcon className="w-3 h-3 text-amber-700" />
              <span>Pinned</span>
            </span>
          )}

          {data.version > 1 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
              Rev. {data.version}
            </span>
          )}
        </div>

        {/* Right Toolbar Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handlePrint}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors hidden sm:inline-flex"
            title="Print Official Directive"
          >
            <PrinterIcon className="w-4 h-4" />
          </button>

          {/* More Action Menu Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center justify-center"
              title="More Actions"
              aria-label="More actions"
            >
              <MoreVerticalIcon className="w-4 h-4" />
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-40 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 font-medium transition-colors"
                >
                  <LinkIcon className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Share Link</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false)
                    handlePrint()
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 font-medium transition-colors sm:hidden"
                >
                  <PrinterIcon className="w-3.5 h-3.5 text-slate-500" />
                  <span>Print Directive</span>
                </button>

                {data.can_view_analytics && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false)
                      setShowAnalytics(true)
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 font-medium text-primary-700 transition-colors"
                  >
                    <EyeIcon className="w-3.5 h-3.5 text-primary-600" />
                    <span>View Analytics</span>
                  </button>
                )}

                {data.can_moderate && (
                  <>
                    <div className="h-px bg-slate-100 my-1" />
                    <button
                      type="button"
                      disabled={togglingPin}
                      onClick={handleTogglePinAnnouncement}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 font-medium transition-colors"
                    >
                      <PinIcon className="w-3.5 h-3.5 text-slate-500" />
                      <span>{data.is_pinned ? 'Unpin Circular' : 'Pin to Top'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={togglingLock}
                      onClick={handleToggleLockConversation}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 font-medium transition-colors"
                    >
                      {data.is_locked ? (
                        <>
                          <UnlockIcon className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Unlock Conversation</span>
                        </>
                      ) : (
                        <>
                          <LockIcon className="w-3.5 h-3.5 text-slate-500" />
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
                      className="w-full text-left px-3.5 py-2 hover:bg-rose-50 text-rose-600 flex items-center gap-2.5 font-semibold transition-colors"
                    >
                      <TrashIcon className="w-3.5 h-3.5 text-rose-600" />
                      <span>Delete Circular</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Close button */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center justify-center"
              title="Close"
              aria-label="Close"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Scrollable Body ── */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-20 sm:pb-8 overscroll-contain">
        <div className="p-5 sm:p-8 space-y-6 max-w-3xl mx-auto">
          {/* Revision Banner if v > 1 */}
          {data.version > 1 && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-start gap-2.5">
              <span className="font-bold text-slate-900 shrink-0">Revision {data.version}:</span>
              <p className="text-slate-600">{data.revision_notes || 'Updated official directive version.'}</p>
            </div>
          )}

          {/* Official Document Memo Header */}
          <div className="border-b border-slate-200 pb-5 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-400">
                Official Institutional Directive
              </span>
              <span className="font-mono text-slate-400">Ref: FAFLOW-CIR-{data.id}</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
              {data.title}
            </h1>

            {/* Structured Meta Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-100">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">From</span>
                <p className="font-semibold text-slate-800 mt-0.5">
                  {data.author_name}
                  <span className="text-slate-500 font-normal ml-1">
                    ({data.author_role}{data.department_name ? ` • ${data.department_name}` : ''})
                  </span>
                </p>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Audience</span>
                <p className="font-semibold text-slate-800 mt-0.5">{audienceText}</p>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Date Published</span>
                <p className="font-semibold text-slate-800 mt-0.5">
                  {data.published_at
                    ? new Date(data.published_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
                    : 'Draft'}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Your Read Status</span>
                <p className="font-semibold mt-0.5">
                  {data.first_viewed_at ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Read on {new Date(data.first_viewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                  ) : (
                    <span className="text-primary-700">Unread</span>
                  )}
                </p>
              </div>
            </div>

            {/* Admin delivery summary bar */}
            {data.can_view_analytics && data.total_recipients !== null && data.total_recipients !== undefined && (
              <div className="pt-2 flex items-center justify-between gap-3 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-600">
                  Delivery progress: <strong className="text-slate-900">{data.viewed_count}</strong> of <strong className="text-slate-900">{data.total_recipients}</strong> viewed
                </span>
                <button
                  type="button"
                  onClick={() => setShowAnalytics(true)}
                  className="font-semibold text-primary-700 hover:text-primary-800 hover:underline"
                >
                  View Details →
                </button>
              </div>
            )}
          </div>

          {/* Directive Body Content */}
          <div className="py-2 text-slate-800 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-sans">
            {data.body}
          </div>

          {/* Formal Acknowledgement Box */}
          {data.requires_acknowledgement && (
            <div className="pt-2">
              {data.is_acknowledged ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-emerald-900">
                        Formal Acknowledgement Recorded
                      </h4>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        Receipt confirmed on{' '}
                        {data.acknowledged_at
                          ? new Date(data.acknowledged_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
                          : 'Recorded'}
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                    Compliant
                  </span>
                </div>
              ) : (
                <div className="p-4 sm:p-5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangleIcon className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-amber-900">
                        Institutional Acknowledgement Required
                      </h4>
                      <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                        Please confirm that you have read and understood the instructions in this directive. Your acknowledgement is logged for institutional compliance.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      disabled={acknowledging}
                      onClick={handleAcknowledge}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-amber-700 hover:bg-amber-800 active:bg-amber-900 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs disabled:opacity-50"
                    >
                      {acknowledging ? (
                        <>
                          <Spinner size="xs" className="border-white border-t-transparent" />
                          <span>Recording...</span>
                        </>
                      ) : (
                        <>
                          <CheckIcon className="w-3.5 h-3.5" />
                          <span>I Acknowledge This Directive</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Official Attachments */}
          {data.attachments && data.attachments.length > 0 && (
            <div className="pt-2">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <PaperclipIcon className="w-3.5 h-3.5 text-slate-500" />
                <span>Attached Documents ({data.attachments.length})</span>
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
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isImg ? (
                          <img
                            src={att.download_url}
                            alt={att.file_name}
                            className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0 bg-white cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setPreviewAttachment(att)}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                            <PaperclipIcon className="w-5 h-5 text-slate-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate" title={att.file_name}>
                            {att.file_name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {isPdf ? 'PDF' : isImg ? 'Image' : 'File'} • {sizeDisplay}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {(isImg || isPdf) && (
                          <button
                            type="button"
                            onClick={() => setPreviewAttachment(att)}
                            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors"
                          >
                            Preview
                          </button>
                        )}
                        <a
                          href={att.download_url}
                          download={att.file_name}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                          title="Download file"
                        >
                          <DownloadIcon className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Conversation Thread Section */}
          <div ref={conversationSectionRef} className="pt-4 border-t border-slate-200">
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
      </div>

      {/* ── Mobile Sticky Bottom Action Bar (< 640px) ── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-slate-200 shadow-lg flex items-center justify-between gap-2 z-50 print:hidden">
        {data.requires_acknowledgement && !data.is_acknowledged ? (
          <button
            type="button"
            disabled={acknowledging}
            onClick={handleAcknowledge}
            className="flex-1 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5"
          >
            {acknowledging && <Spinner size="xs" className="border-white border-t-transparent" />}
            <span>Acknowledge Directive</span>
          </button>
        ) : (
          data.allow_replies && !data.is_locked && (
            <button
              type="button"
              onClick={handleScrollToConversation}
              className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5"
            >
              <MessageSquareIcon className="w-4 h-4" />
              <span>Write a Reply</span>
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => setShowMoreMenu(true)}
          className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs shrink-0 flex items-center justify-center"
          title="More actions"
        >
          <MoreVerticalIcon className="w-4 h-4" />
        </button>
      </div>

      {/* ── Attachment Lightbox / Preview Modal ── */}
      {previewAttachment && (
        <div
          onClick={() => setPreviewAttachment(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl h-[85vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col relative"
          >
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <PaperclipIcon className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-xs font-semibold truncate">{previewAttachment.file_name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewAttachment.download_url}
                  download={previewAttachment.file_name}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <DownloadIcon className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 bg-slate-100 flex items-center justify-center overflow-auto p-4">
              {previewAttachment.file_type.includes('pdf') || previewAttachment.file_name.endsWith('.pdf') ? (
                <iframe
                  src={previewAttachment.download_url}
                  title={previewAttachment.file_name}
                  className="w-full h-full rounded-lg border border-slate-200 bg-white"
                />
              ) : (
                <img
                  src={previewAttachment.download_url}
                  alt={previewAttachment.file_name}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
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

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete &ldquo;<strong className="text-slate-900">{data.title}</strong>&rdquo;? All attached files, read receipts, and replies will be removed.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
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
      {showAnalytics && (
        <AnnouncementAnalyticsModal
          announcementId={announcementId}
          onClose={() => setShowAnalytics(false)}
        />
      )}
    </div>
  )
}
