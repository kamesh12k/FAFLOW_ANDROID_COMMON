import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationsApi } from '../../api/services'
import { BellIcon, CheckCircleIcon, SwapIcon, CalIcon, XCircleIcon, MegaphoneIcon } from '../icons'

const EVENT_ICON = {
  leave_approved: CheckCircleIcon,
  leave_rejected: XCircleIcon,
  leave_submitted: CalIcon,
  timetable_submitted: CalIcon,
  timetable_approved: CheckCircleIcon,
  timetable_rejected: XCircleIcon,
  staff_leave_submitted: CalIcon,
  staff_leave_approved: CheckCircleIcon,
  staff_leave_rejected: XCircleIcon,
  substitute_assigned: SwapIcon,
  holiday_reminder: CalIcon,
  system_test: BellIcon,
  new_announcement: MegaphoneIcon,
  mention: MegaphoneIcon,
  reply: MegaphoneIcon,
  reply_to_my_message: MegaphoneIcon,
  acknowledgement_required: MegaphoneIcon,
  announcement_updated: MegaphoneIcon,
}

function timeAgo(iso) {
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
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleToggle = () => {
    setOpen(o => !o)
    if (!loaded) {
      notificationsApi.list().then(r => { setItems(r.data); setLoaded(true) })
    }
  }

  const handleMarkAll = async () => {
    await notificationsApi.markAllRead()
    setItems(items.map(i => ({ ...i, is_read: true })))
    setUnread(0)
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
      await notificationsApi.markRead(item.id)
      setItems(items.map(i => i.id === item.id ? { ...i, is_read: true } : i))
      setUnread(u => Math.max(0, u - 1))
    }
    if (item.event_type && (item.event_type.startsWith('announcement') || ['new_announcement', 'mention', 'reply', 'reply_to_my_message', 'acknowledgement_required', 'announcement_updated'].includes(item.event_type))) {
      setOpen(false)
      navigate('/announcements')
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleToggle}
        className="h-9 w-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 hover:bg-slate-100/70 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors relative shadow-2xs"
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
        title={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
      >
        <BellIcon className="w-4.5 h-4.5" />
        {unread > 0 && (
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-88 max-w-[92vw] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850">
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Notifications</p>
              {unread > 0 && <p className="text-[11px] text-slate-500 dark:text-slate-400">{unread} unread</p>}
            </div>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={handleMarkAll} className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium">
                  Mark all read
                </button>
              )}
              {items.length > 0 && (
                <button onClick={handleClearAll} className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold">
                  Clear All
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <BellIcon className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500 dark:text-slate-400">You're all caught up.</p>
              </div>
            ) : items.map(item => {
              const Icon = EVENT_ICON[item.event_type] || BellIcon
              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${!item.is_read ? 'bg-primary-50/30 dark:bg-primary-950/20' : ''}`}
                >
                  <span className={`mt-0.5 w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${!item.is_read ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{item.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{item.body}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{timeAgo(item.created_at)}</p>
                  </span>
                  {!item.is_read && <span className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
