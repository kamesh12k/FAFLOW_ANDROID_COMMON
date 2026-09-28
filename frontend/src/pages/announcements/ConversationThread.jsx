import { useState, useEffect, useRef, useMemo } from 'react'
import { PinIcon, MessageSquareIcon, CloseIcon, InfoIcon } from '../../components/icons'
import { announcementApi } from '../../api/announcements'
import { useToast } from '../../components/ui/Toast'

const EMOJI_LIST = ['👍', '❤️', '✅', '❓', '👏']

function formatRelativeTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diffSec = Math.floor((now - d) / 1000)
  if (diffSec < 60) return 'Just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Format @mentions in message body to highlighted tags */
function renderMessageContent(text) {
  if (!text) return null
  const parts = text.split(/(@[A-Za-z0-9_.\s]+?)(?=\s|$|[.,!?])/g)
  return parts.map((part, idx) => {
    if (part.startsWith('@') && part.length > 1) {
      return (
        <span
          key={idx}
          className="inline-flex items-center px-1.5 py-0.2 rounded bg-slate-100 text-primary-700 font-semibold text-xs border border-slate-200 mr-0.5"
        >
          {part}
        </span>
      )
    }
    return part
  })
}

/** Recursively collect all messages where current user is mentioned */
function findUserMentions(msgList, currentUserId, currentUserName) {
  const matches = []
  const traverse = (item) => {
    if (!item) return
    const isIdMention = item.mentions?.some(
      (m) => m.mentioned_user_id === currentUserId
    )
    const isNameMention =
      currentUserName &&
      item.content &&
      item.content.toLowerCase().includes(`@${currentUserName.toLowerCase()}`)
    if (isIdMention || isNameMention) {
      matches.push(item)
    }
    if (item.replies && Array.isArray(item.replies)) {
      item.replies.forEach(traverse)
    }
  }
  if (Array.isArray(msgList)) {
    msgList.forEach(traverse)
  }
  return matches
}

function MessageItem({
  message,
  announcementId,
  canReply,
  canModerate,
  currentUserId,
  onRefresh,
  activeReplyId,
  setActiveReplyId,
  replyText,
  setReplyText,
  onSubmitReply,
  isSubmitting,
  initialCandidates = [],
  highlightedMessageId = null,
}) {
  const { showToast } = useToast()
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [showReplyMention, setShowReplyMention] = useState(false)
  const [replyMentionQuery, setReplyMentionQuery] = useState('')
  const [replyActiveIndex, setReplyActiveIndex] = useState(0)

  const filteredReplyCandidates = useMemo(() => {
    const trimmed = replyMentionQuery.trim().toLowerCase()
    if (!trimmed) return initialCandidates || []
    return (initialCandidates || []).filter(
      (f) =>
        f.name.toLowerCase().includes(trimmed) ||
        (f.department_name && f.department_name.toLowerCase().includes(trimmed)) ||
        (f.email && f.email.toLowerCase().includes(trimmed))
    )
  }, [initialCandidates, replyMentionQuery])

  const handleReplyChange = (e) => {
    const val = e.target.value
    setReplyText(val)

    const cursor = e.target.selectionEnd ?? val.length
    const textBeforeCursor = val.slice(0, cursor)
    const lastAtIdx = textBeforeCursor.lastIndexOf('@')

    if (lastAtIdx !== -1) {
      const queryPart = textBeforeCursor.slice(lastAtIdx + 1)
      if (!/\s{2,}|\n/.test(queryPart) && queryPart.length <= 40) {
        setReplyMentionQuery(queryPart)
        setShowReplyMention(true)
        setReplyActiveIndex(0)
        return
      }
    }
    setShowReplyMention(false)
  }

  const handleSelectReplyMention = (faculty) => {
    const lastAtIdx = replyText.lastIndexOf('@')
    if (lastAtIdx !== -1) {
      const prefix = replyText.slice(0, lastAtIdx)
      setReplyText(`${prefix}@${faculty.name} `)
    } else {
      setReplyText((prev) => `${prev}@${faculty.name} `)
    }
    setShowReplyMention(false)
  }

  const handleTriggerReplyMention = () => {
    setReplyText((prev) => (prev.endsWith(' ') || prev === '' ? `${prev}@` : `${prev} @`))
    setShowReplyMention(true)
    setReplyMentionQuery('')
  }

  const handleReplyKeyDown = (e) => {
    if (!showReplyMention || filteredReplyCandidates.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setReplyActiveIndex((prev) => (prev + 1) % filteredReplyCandidates.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setReplyActiveIndex(
        (prev) => (prev - 1 + filteredReplyCandidates.length) % filteredReplyCandidates.length
      )
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const selected =
        filteredReplyCandidates[replyActiveIndex] || filteredReplyCandidates[0]
      if (selected) {
        handleSelectReplyMention(selected)
      }
    } else if (e.key === 'Escape') {
      setShowReplyMention(false)
    }
  }

  const handleToggleReaction = async (emoji) => {
    try {
      await announcementApi.toggleReaction(message.id, emoji)
      setShowEmojiPicker(false)
      onRefresh()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to update reaction', 'error')
    }
  }

  const handleTogglePin = async () => {
    try {
      await announcementApi.togglePinMessage(message.id)
      showToast(message.is_pinned ? 'Clarification unpinned' : 'Clarification pinned', 'success')
      onRefresh()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to update pin', 'error')
    }
  }

  const handleDelete = async () => {
    try {
      await announcementApi.deleteMessage(message.id)
      showToast('Message removed', 'success')
      setConfirmingDelete(false)
      onRefresh()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to remove message', 'error')
    }
  }

  const initials = (message.author_name || 'U')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const isAuthor = message.author_id === currentUserId
  const isHighlighted = highlightedMessageId === message.id

  return (
    <div
      id={`msg-${message.id}`}
      className={`group relative transition-all rounded-xl ${
        isHighlighted
          ? 'ring-2 ring-primary-500 bg-primary-50/30 p-1.5'
          : ''
      }`}
    >
      <div
        className={`p-3.5 sm:p-4 rounded-xl border transition-colors ${
          message.is_pinned
            ? 'bg-amber-50/50 border-amber-200'
            : 'bg-white border-slate-200 hover:border-slate-300'
        }`}
      >
        {/* Pinned Clarification Tag */}
        {message.is_pinned && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 mb-2">
            <PinIcon className="w-3.5 h-3.5 text-amber-700" />
            <span>Pinned Clarification</span>
          </div>
        )}

        {/* Message Header */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-xs sm:text-sm text-slate-900 truncate">
                  {message.author_name}
                </span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                  {message.author_role}
                </span>
                {message.author_department && (
                  <span className="text-[11px] text-slate-400 hidden sm:inline truncate">
                    • {message.author_department}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-normal">
                {formatRelativeTime(message.created_at)}
                {message.is_edited && ' (edited)'}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1">
            {/* Reaction Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="px-1.5 py-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded text-xs flex items-center gap-1"
                title="Add reaction"
                aria-label="Add reaction"
              >
                <span>+ React</span>
              </button>
              {showEmojiPicker && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 flex items-center gap-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                  {EMOJI_LIST.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleToggleReaction(emoji)}
                      className="p-1.5 hover:bg-slate-100 rounded text-base transition-transform hover:scale-110"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Reply trigger */}
            {canReply && (
              <button
                type="button"
                onClick={() => {
                  if (activeReplyId === message.id) {
                    setActiveReplyId(null)
                  } else {
                    setActiveReplyId(message.id)
                    setReplyText(`@${message.author_name} `)
                  }
                }}
                className="px-2 py-1 text-xs font-medium text-slate-500 hover:text-primary-700 hover:bg-slate-50 rounded transition-colors flex items-center gap-1"
                aria-label={`Reply to ${message.author_name}`}
              >
                <MessageSquareIcon className="w-3.5 h-3.5" />
                <span>Reply</span>
              </button>
            )}

            {/* Moderator pin */}
            {canModerate && (
              <button
                type="button"
                onClick={handleTogglePin}
                className={`p-1.5 rounded transition-colors ${
                  message.is_pinned
                    ? 'text-amber-700 hover:bg-amber-100'
                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
                title={message.is_pinned ? 'Unpin clarification' : 'Pin clarification'}
                aria-label={message.is_pinned ? 'Unpin clarification' : 'Pin clarification'}
              >
                <PinIcon className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Delete button (Author or Moderator) */}
            {(isAuthor || canModerate) && !message.is_deleted && (
              confirmingDelete ? (
                <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-xs">
                  <span className="text-[10px] text-rose-700">Delete?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="font-semibold text-rose-700 hover:underline text-[10px]"
                  >
                    Yes
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="text-slate-500 hover:text-slate-700 text-[10px]"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                  title="Delete message"
                  aria-label="Delete message"
                >
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              )
            )}
          </div>
        </div>

        {/* Message Body with Highlighted Mentions */}
        <div className="mt-2 text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
          {renderMessageContent(message.content)}
        </div>

        {/* Reactions List */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
            {message.reactions.map((rx) => (
              <button
                key={rx.reaction}
                type="button"
                onClick={() => handleToggleReaction(rx.reaction)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs transition-colors border ${
                  rx.has_reacted
                    ? 'bg-primary-50 text-primary-800 border-primary-200 font-semibold'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                }`}
                title={rx.user_names?.join(', ') || ''}
              >
                <span>{rx.reaction}</span>
                <span className="text-[11px] font-medium">{rx.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Inline Nested Reply Box with Touch-Friendly Mentions */}
      {activeReplyId === message.id && (
        <div className="mt-2.5 ml-3 sm:ml-6 pl-3 border-l-2 border-slate-200">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 relative space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600">
                Replying to <strong className="text-slate-900">{message.author_name}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveReplyId(null)
                  setShowReplyMention(false)
                }}
                className="text-slate-400 hover:text-slate-600 p-0.5"
                aria-label="Cancel reply"
              >
                <CloseIcon className="w-3.5 h-3.5" />
              </button>
            </div>
            <textarea
              rows={2}
              value={replyText}
              onChange={handleReplyChange}
              onKeyDown={handleReplyKeyDown}
              placeholder="Type your reply... (@name to mention)"
              className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:ring-2 focus:ring-primary-500 text-slate-900"
            />

            {/* Mention Selector */}
            {showReplyMention && (
              <div className="absolute left-0 right-0 bottom-full mb-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-52">
                <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Mention Faculty ({filteredReplyCandidates.length})
                </div>
                <div className="overflow-y-auto divide-y divide-slate-100 flex-1 min-h-0">
                  {filteredReplyCandidates.length > 0 ? (
                    filteredReplyCandidates.map((f, idx) => (
                      <button
                        key={f.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleSelectReplyMention(f)
                        }}
                        className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-2 text-xs transition-colors ${
                          idx === replyActiveIndex ? 'bg-primary-50 text-primary-900' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="font-medium truncate">{f.name}</span>
                        {f.department_name && (
                          <span className="text-[10px] text-slate-400 truncate">{f.department_name}</span>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-center text-xs text-slate-400">
                      No faculty found matching &ldquo;@{replyMentionQuery}&rdquo;
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleTriggerReplyMention}
                className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-md transition-colors"
              >
                @ Mention
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveReplyId(null)
                    setShowReplyMention(false)
                  }}
                  className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting || !replyText.trim()}
                  onClick={() => onSubmitReply(message.id)}
                  className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs rounded-md disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? 'Posting...' : 'Post Reply'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nested Replies Stream */}
      {message.replies && message.replies.length > 0 && (
        <div className="mt-2.5 ml-3 sm:ml-6 pl-3 border-l-2 border-slate-200 space-y-2.5">
          {message.replies.map((reply) => (
            <MessageItem
              key={reply.id}
              message={reply}
              announcementId={announcementId}
              canReply={canReply}
              canModerate={canModerate}
              currentUserId={currentUserId}
              onRefresh={onRefresh}
              activeReplyId={activeReplyId}
              setActiveReplyId={setActiveReplyId}
              replyText={replyText}
              setReplyText={setReplyText}
              onSubmitReply={onSubmitReply}
              isSubmitting={isSubmitting}
              initialCandidates={initialCandidates}
              highlightedMessageId={highlightedMessageId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function ConversationThread({
  announcementId,
  messages = [],
  allowReplies = true,
  isLocked = false,
  canModerate = false,
  currentUserId,
  currentUserName,
  onRefresh,
}) {
  const { showToast } = useToast()
  const [rootText, setRootText] = useState('')
  const [activeReplyId, setActiveReplyId] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [highlightedMessageId, setHighlightedMessageId] = useState(null)

  // Mentions State
  const [initialCandidates, setInitialCandidates] = useState([])
  const [mentionCandidates, setMentionCandidates] = useState([])
  const [mentionLoading, setMentionLoading] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false)
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0)
  const [rootMentionedUserIds, setRootMentionedUserIds] = useState(new Set())

  // Mention notifications banner detection
  const myMentionMessages = useMemo(() => {
    return findUserMentions(messages, currentUserId, currentUserName)
  }, [messages, currentUserId, currentUserName])

  const jumpToMessage = (msgId) => {
    const el = document.getElementById(`msg-${msgId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightedMessageId(msgId)
      setTimeout(() => {
        setHighlightedMessageId((prev) => (prev === msgId ? null : prev))
      }, 3500)
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const match = window.location.hash.match(/^#msg-(\d+)$/)
      if (match) {
        const id = parseInt(match[1], 10)
        setTimeout(() => jumpToMessage(id), 400)
      }
    }
  }, [messages])

  useEffect(() => {
    let isMounted = true
    announcementApi
      .getMentionCandidates(announcementId, { limit: 100 })
      .then((res) => {
        if (isMounted) {
          const list = res.data || []
          setInitialCandidates(list)
          setMentionCandidates(list)
        }
      })
      .catch(() => {})
    return () => {
      isMounted = false
    }
  }, [announcementId])

  useEffect(() => {
    if (!showMentionSuggestions) return

    const trimmed = mentionQuery.trim().toLowerCase()
    if (!trimmed) {
      setMentionCandidates(initialCandidates)
      setMentionActiveIndex(0)
      return
    }

    const localFiltered = initialCandidates.filter(
      (f) =>
        f.name.toLowerCase().includes(trimmed) ||
        (f.department_name && f.department_name.toLowerCase().includes(trimmed)) ||
        (f.email && f.email.toLowerCase().includes(trimmed))
    )
    setMentionCandidates(localFiltered)
    setMentionActiveIndex(0)

    setMentionLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await announcementApi.getMentionCandidates(announcementId, {
          q: trimmed,
          limit: 50,
        })
        if (res.data) {
          setMentionCandidates(res.data)
          setMentionActiveIndex(0)
        }
      } catch (err) {
        // Retain local results
      } finally {
        setMentionLoading(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [mentionQuery, showMentionSuggestions, announcementId, initialCandidates])

  const handlePostRootMessage = async (e) => {
    if (e) e.preventDefault()
    if (!rootText.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await announcementApi.postMessage(announcementId, {
        content: rootText.trim(),
        mentioned_user_ids: Array.from(rootMentionedUserIds),
      })
      setRootText('')
      setRootMentionedUserIds(new Set())
      showToast('Comment posted', 'success')
      onRefresh()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to post comment', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitReply = async (parentId) => {
    if (!replyText.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await announcementApi.postMessage(announcementId, {
        content: replyText.trim(),
        parent_message_id: parentId,
      })
      setReplyText('')
      setActiveReplyId(null)
      showToast('Reply posted', 'success')
      onRefresh()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to post reply', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRootTextChange = (e) => {
    const val = e.target.value
    setRootText(val)

    const cursor = e.target.selectionEnd ?? val.length
    const textBeforeCursor = val.slice(0, cursor)
    const lastAtIdx = textBeforeCursor.lastIndexOf('@')

    if (lastAtIdx !== -1) {
      const queryPart = textBeforeCursor.slice(lastAtIdx + 1)
      if (!/\s{2,}|\n/.test(queryPart) && queryPart.length <= 40) {
        setMentionQuery(queryPart)
        setShowMentionSuggestions(true)
        return
      }
    }
    setShowMentionSuggestions(false)
  }

  const handleSelectMention = (faculty) => {
    const lastAtIdx = rootText.lastIndexOf('@')
    if (lastAtIdx !== -1) {
      const prefix = rootText.slice(0, lastAtIdx)
      setRootText(`${prefix}@${faculty.name} `)
    } else {
      setRootText((prev) => `${prev}@${faculty.name} `)
    }
    setRootMentionedUserIds((prev) => new Set([...prev, faculty.id]))
    setShowMentionSuggestions(false)
  }

  const handleTriggerMention = () => {
    setRootText((prev) => (prev.endsWith(' ') || prev === '' ? `${prev}@` : `${prev} @`))
    setShowMentionSuggestions(true)
    setMentionQuery('')
  }

  const handleKeyDown = (e) => {
    if (!showMentionSuggestions || mentionCandidates.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setMentionActiveIndex((prev) => (prev + 1) % mentionCandidates.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setMentionActiveIndex((prev) => (prev - 1 + mentionCandidates.length) % mentionCandidates.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const selected = mentionCandidates[mentionActiveIndex] || mentionCandidates[0]
      if (selected) {
        handleSelectMention(selected)
      }
    } else if (e.key === 'Escape') {
      setShowMentionSuggestions(false)
    }
  }

  return (
    <div className="mt-8 space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquareIcon className="w-4 h-4 text-slate-500" />
          <h3 className="font-bold text-sm sm:text-base text-slate-900">
            Discussion & Clarifications
          </h3>
          <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
            {messages.length}
          </span>
        </div>
        {isLocked && (
          <span className="text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-md">
            Discussion Closed
          </span>
        )}
      </div>

      {/* Mentioned-You Notification Banner */}
      {myMentionMessages.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-800 font-medium min-w-0">
            <InfoIcon className="w-4 h-4 text-primary-600 shrink-0" />
            <span className="truncate">
              {myMentionMessages.length === 1
                ? 'You were mentioned in this conversation'
                : `You were mentioned ${myMentionMessages.length} times in this conversation`}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {myMentionMessages.map((msg, idx) => (
              <button
                key={msg.id}
                type="button"
                onClick={() => jumpToMessage(msg.id)}
                className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-xs font-medium transition-colors"
                title={`Jump to comment by ${msg.author_name}`}
              >
                {myMentionMessages.length === 1 ? 'Jump' : `#${idx + 1}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Root Composer Box */}
      {allowReplies && !isLocked ? (
        <form
          onSubmit={handlePostRootMessage}
          className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-3.5 space-y-2.5 relative"
        >
          <textarea
            rows={3}
            value={rootText}
            onChange={handleRootTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Write a clarification or question regarding this circular... (@ to mention)"
            className="w-full text-xs sm:text-sm bg-white border border-slate-200 rounded-lg p-3 focus:outline-hidden focus:ring-2 focus:ring-primary-500 text-slate-900 placeholder:text-slate-400"
          />

          {/* Mention Suggestions Popover */}
          {showMentionSuggestions && (
            <div className="absolute left-3 right-3 bottom-full mb-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-56">
              <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Mention Faculty {mentionCandidates.length > 0 && `(${mentionCandidates.length})`}
              </div>
              <div className="overflow-y-auto divide-y divide-slate-100 flex-1 min-h-0">
                {mentionCandidates.length > 0 ? (
                  mentionCandidates.map((f, idx) => (
                    <button
                      key={f.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        handleSelectMention(f)
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 text-xs transition-colors ${
                        idx === mentionActiveIndex ? 'bg-primary-50 text-primary-900' : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <span className="font-medium truncate">{f.name}</span>
                      {f.department_name && (
                        <span className="text-[10px] text-slate-400 truncate">{f.department_name}</span>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-xs text-slate-400">
                    No faculty found matching &ldquo;@{mentionQuery}&rdquo;
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleTriggerMention}
              className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-md transition-colors"
            >
              @ Mention
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !rootText.trim()}
              className="px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs rounded-lg disabled:opacity-50 transition-colors shadow-xs"
            >
              {isSubmitting ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
        </form>
      ) : (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-center">
          {isLocked
            ? 'Discussion is closed for this circular.'
            : 'Replies have been disabled for this announcement.'}
        </div>
      )}

      {/* Message Tree */}
      {messages.length === 0 ? (
        <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 p-4">
          <MessageSquareIcon className="w-5 h-5 text-slate-300 mx-auto mb-1" />
          <h4 className="text-xs font-semibold text-slate-700">No discussions yet</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Post a message if you need clarification on this directive.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <MessageItem
              key={msg.id}
              message={msg}
              announcementId={announcementId}
              canReply={allowReplies && !isLocked}
              canModerate={canModerate}
              currentUserId={currentUserId}
              onRefresh={onRefresh}
              activeReplyId={activeReplyId}
              setActiveReplyId={setActiveReplyId}
              replyText={replyText}
              setReplyText={setReplyText}
              onSubmitReply={handleSubmitReply}
              isSubmitting={isSubmitting}
              initialCandidates={initialCandidates}
              highlightedMessageId={highlightedMessageId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
