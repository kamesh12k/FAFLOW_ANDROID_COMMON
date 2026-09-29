import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationsApi } from '../../api/services'
import {
  BellIcon,
  CheckCircleIcon,
  SwapIcon,
  CalIcon,
  XCircleIcon,
  MegaphoneIcon,
  CheckIcon,
  TrashIcon,
  ClockIcon,
} from '../icons'

function getEventCategory(eventType = '') {
  if (eventType.includes('leave')) {
    if (eventType.includes('reject')) {
      return {
        label: 'Leave Rejected',
        icon: XCircleIcon,
        colorCls: 'bg-rose-50 text-rose-700 border-rose-200/70',
        badgeCls: 'bg-rose-50 text-rose-700 border-rose-200',
      }
    }
    if (eventType.includes('approv')) {
      return {
        label: 'Leave Approved',
        icon: CheckCircleIcon,
        colorCls: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
        badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      }
    }
    return {
      label: 'Leave Request',
      icon: CalIcon,
      colorCls: 'bg-amber-50 text-amber-700 border-amber-200/70',
      badgeCls: 'bg-amber-50 text-amber-700 border-amber-200',
    }
  }

  if (eventType.includes('timetable')) {
    if (eventType.includes('reject')) {
      return {
        label: 'Timetable Rejected',
        icon: XCircleIcon,
        colorCls: 'bg-rose-50 text-rose-700 border-rose-200/70',
        badgeCls: 'bg-rose-50 text-rose-700 border-rose-200',
      }
    }
    if (eventType.includes('approv')) {
      return {
        label: 'Timetable Approved',
        icon: CheckCircleIcon,
        colorCls: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
        badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      }
    }
    return {
      label: 'Timetable Request',
      icon: CalIcon,
      colorCls: 'bg-blue-50 text-blue-700 border-blue-200/70',
      badgeCls: 'bg-blue-50 text-blue-700 border-blue-200',
    }
  }

  if (eventType.includes('substitute')) {
    return {
      label: 'Substitution',
      icon: SwapIcon,
      colorCls: 'bg-indigo-50 text-indigo-700 border-indigo-200/70',
      badgeCls: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    }
  }

  if (
    eventType.includes('announcement') ||
    ['mention', 'reply', 'reply_to_my_message', 'acknowledgement_required', 'new_announcement', 'announcement_updated'].includes(eventType)
  ) {
    return {
      label: 'Announcement',
      icon: MegaphoneIcon,
      colorCls: 'bg-purple-50 text-purple-700 border-purple-200/70',
      badgeCls: 'bg-purple-50 text-purple-700 border-purple-200',
    }
  }

  return {
    label: 'Notification',
    icon: BellIcon,
    colorCls: 'bg-slate-100 text-slate-700 border-slate-200/70',
    badgeCls: 'bg-slate-100 text-slate-700 border-slate-200',
  }
}

function timeAgo(iso) {
  if (!iso) return 'recently'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'unread'
  const ref = useRef(null)
  const navigate = useNavigate()

  const refreshCount = () => {
    notificationsApi.unreadCount().then(r => setUnread(r.data.count)).catch(() => {})
  }

  useEffect(() => {
    refreshCount()
    const interval = setInterval(refreshCount, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleToggle = () => {
    const next = !open
    setOpen(next)
    if (next && !loaded) {
      notificationsApi.list().then(r => {
        setItems(r.data || [])
        setLoaded(true)
      }).catch(() => {})
    }
  }

  const handleMarkAll = async () => {
    try {
      await notificationsApi.markAllRead()
      setItems(items.map(i => ({ ...i, is_read: true })))
      setUnread(0)
    } catch (_) {}
  }

  const handleClearAll = async () => {
    try {
      await notificationsApi.markAllRead()
      setItems([])
      setUnread(0)
    } catch (_) {}
  }

  const handleItemClick = async (item) => {
    if (!item.is_read) {
      try {
        await notificationsApi.markRead(item.id)
        setItems(items.map(i => i.id === item.id ? { ...i, is_read: true } : i))
        setUnread(u => Math.max(0, u - 1))
      } catch (_) {}
    }
    if (
      item.event_type &&
      (item.event_type.startsWith('announcement') ||
        ['new_announcement', 'mention', 'reply', 'reply_to_my_message', 'acknowledgement_required', 'announcement_updated'].includes(item.event_type))
    ) {
      setOpen(false)
      navigate('/announcements')
    }
  }

  const filteredItems = useMemo(() => {
    if (activeTab === 'unread') {
      return items.filter(i => !i.is_read)
    }
    return items
  }, [items, activeTab])

  return (
    <div className="relative" ref={ref}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        className={`h-9 w-9 flex items-center justify-center rounded-lg border transition-all relative outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${
          open
            ? 'bg-primary-50 border-primary-300 text-primary-700 shadow-sm'
            : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-600 hover:text-slate-900 shadow-2xs'
        }`}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
        title={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
        aria-expanded={open}
      >
        <BellIcon className="w-4.5 h-4.5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-600 text-white text-[10px] font-bold shadow-xs">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Spacious Formatted Notification Popover / Drawer */}
      {open && (
        <div className="absolute right-0 mt-2.5 w-[440px] sm:w-[480px] max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl border border-slate-200/90 shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150 ring-1 ring-black/5">
          {/* Header */}
          <div className="px-5 pt-4 pb-3 border-b border-slate-100 bg-slate-50/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Notifications</h3>
                {unread > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary-100 text-primary-800 border border-primary-200/80">
                    {unread} unread
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                    All caught up
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAll}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800 transition-colors"
                  >
                    <CheckIcon className="w-3.5 h-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                    <span>Clear all</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/90'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                }`}
              >
                All ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('unread')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'unread'
                    ? 'bg-white text-primary-800 shadow-2xs border border-primary-200/80'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                }`}
              >
                Unread ({unread})
              </button>
            </div>
          </div>

          {/* Notification Items List */}
          <div className="max-h-[460px] overflow-y-auto divide-y divide-slate-100 sidebar-scrollbar">
            {filteredItems.length === 0 ? (
              <div className="px-6 py-12 text-center flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3 text-slate-400">
                  <BellIcon className="w-7 h-7" />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {activeTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-[280px]">
                  {activeTab === 'unread'
                    ? 'You have reviewed all your alerts and requests.'
                    : 'Timetable requests, leave submissions, and announcements will appear here.'}
                </p>
              </div>
            ) : (
              filteredItems.map(item => {
                const category = getEventCategory(item.event_type)
                const IconComponent = category.icon

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleItemClick(item)}
                    className={`w-full text-left p-4 sm:p-4.5 flex items-start gap-3.5 hover:bg-slate-50 transition-colors relative group ${
                      !item.is_read
                        ? 'bg-primary-50/20 border-l-[3.5px] border-l-primary-600'
                        : 'border-l-[3.5px] border-l-transparent'
                    }`}
                  >
                    {/* Category Icon Badge */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${category.colorCls} shadow-2xs mt-0.5`}
                    >
                      <IconComponent className="w-5 h-5 shrink-0" />
                    </div>

                    {/* Content Details */}
                    <div className="flex-1 min-w-0">
                      {/* Top Meta: Category Tag & Timestamp */}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${category.badgeCls}`}
                        >
                          {category.label}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500 shrink-0">
                          <ClockIcon className="w-3 h-3 text-slate-400" />
                          {timeAgo(item.created_at)}
                        </span>
                      </div>

                      {/* Title */}
                      <h4
                        className={`text-sm leading-snug line-clamp-2 ${
                          !item.is_read ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'
                        }`}
                      >
                        {item.title}
                      </h4>

                      {/* Body Description */}
                      {item.body && (
                        <p className="text-xs text-slate-600 leading-relaxed mt-1 line-clamp-2">
                          {item.body}
                        </p>
                      )}
                    </div>

                    {/* Unread Accent Indicator */}
                    {!item.is_read && (
                      <span
                        className="w-2.5 h-2.5 rounded-full bg-primary-600 shrink-0 mt-2 ring-4 ring-primary-100"
                        title="Unread"
                      />
                    )}
                  </button>
                )
              })
            )}
          </div>

          {/* Footer Shortcut */}
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs">
            <span className="text-slate-500">Stay updated on your schedule and approvals</span>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                navigate('/announcements')
              }}
              className="font-bold text-primary-700 hover:text-primary-800 hover:underline"
            >
              Announcements →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
