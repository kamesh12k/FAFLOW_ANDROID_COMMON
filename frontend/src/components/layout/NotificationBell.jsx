import { useEffect, useRef, useState } from 'react'
import { notificationsApi } from '../../api/services'
import {
  isPushSupported,
  getNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentSubscription
} from '../../utils/pushNotifications'
import { BellIcon, CheckCircleIcon, SwapIcon, CalIcon, XCircleIcon } from '../icons'

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
  const [isPushActive, setIsPushActive] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [pushMessage, setPushMessage] = useState('')
  const ref = useRef(null)

  const supported = isPushSupported()
  const permission = getNotificationPermission()

  const refreshCount = () => {
    notificationsApi.unreadCount().then(r => setUnread(r.data.count)).catch(() => {})
  }

  const checkPushStatus = async () => {
    if (!supported) return
    const sub = await getCurrentSubscription()
    setIsPushActive(!!sub && permission === 'granted')
  }

  useEffect(() => {
    refreshCount()
    checkPushStatus()
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
    checkPushStatus()
  }

  const handleMarkAll = async () => {
    await notificationsApi.markAllRead()
    setItems(items.map(i => ({ ...i, is_read: true })))
    setUnread(0)
  }

  const handleItemClick = async (item) => {
    if (!item.is_read) {
      await notificationsApi.markRead(item.id)
      setItems(items.map(i => i.id === item.id ? { ...i, is_read: true } : i))
      setUnread(u => Math.max(0, u - 1))
    }
  }

  const handleEnablePush = async () => {
    setPushLoading(true)
    setPushMessage('')
    try {
      await subscribeToPush()
      setIsPushActive(true)
      setPushMessage('Push notifications enabled!')
      setTimeout(() => setPushMessage(''), 4000)
    } catch (err) {
      setPushMessage(err.message || 'Failed to enable notifications')
      setTimeout(() => setPushMessage(''), 5000)
    } finally {
      setPushLoading(false)
    }
  }

  const handleDisablePush = async () => {
    setPushLoading(true)
    try {
      await unsubscribeFromPush()
      setIsPushActive(false)
      setPushMessage('Push disabled on this device.')
      setTimeout(() => setPushMessage(''), 4000)
    } catch (err) {
      setPushMessage(err.message || 'Error disabling push')
      setTimeout(() => setPushMessage(''), 4000)
    } finally {
      setPushLoading(false)
    }
  }

  const handleTestPush = async () => {
    setPushLoading(true)
    try {
      await notificationsApi.testPush()
      setPushMessage('Test push sent! Check your screen.')
      setTimeout(() => setPushMessage(''), 4000)
      refreshCount()
      notificationsApi.list().then(r => setItems(r.data))
    } catch (err) {
      setPushMessage('Could not send test push.')
      setTimeout(() => setPushMessage(''), 4000)
    } finally {
      setPushLoading(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={handleToggle} className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700">
        <BellIcon className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-88 max-w-[92vw] bg-white rounded-2xl border border-gray-100 shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <div>
              <p className="text-sm font-semibold text-gray-800">Notifications</p>
              {unread > 0 && <p className="text-[11px] text-gray-500">{unread} unread</p>}
            </div>
            {unread > 0 && (
              <button onClick={handleMarkAll} className="text-xs text-primary-600 hover:underline font-medium">
                Mark all read
              </button>
            )}
          </div>

          {/* Web Push Subscription Banner */}
          {supported && (
            <div className="px-4 py-2.5 bg-gradient-to-r from-primary-50/70 to-indigo-50/50 border-b border-gray-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${isPushActive ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-gray-400'}`} />
                <span className="text-gray-700 truncate">
                  {permission === 'denied'
                    ? 'Browser push blocked'
                    : isPushActive
                    ? 'Web push active'
                    : 'Get desktop alerts'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {isPushActive ? (
                  <>
                    <button
                      onClick={handleTestPush}
                      disabled={pushLoading}
                      className="px-2 py-1 bg-white border border-primary-200 text-primary-700 rounded-md font-medium text-[11px] hover:bg-primary-50 transition-colors"
                    >
                      Test
                    </button>
                    <button
                      onClick={handleDisablePush}
                      disabled={pushLoading}
                      className="px-2 py-1 text-gray-500 hover:text-gray-700 text-[11px]"
                    >
                      Turn off
                    </button>
                  </>
                ) : permission === 'denied' ? (
                  <span className="text-[11px] text-amber-600 font-medium">Unblock in site settings</span>
                ) : (
                  <button
                    onClick={handleEnablePush}
                    disabled={pushLoading}
                    className="px-2.5 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded-md font-medium text-[11px] shadow-sm transition-all"
                  >
                    {pushLoading ? 'Enabling...' : 'Enable'}
                  </button>
                )}
              </div>
            </div>
          )}

          {pushMessage && (
            <div className="px-4 py-1.5 bg-primary-100/70 text-primary-800 text-[11px] text-center border-b border-primary-200 font-medium animate-pulse">
              {pushMessage}
            </div>
          )}

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-sm text-gray-400 text-center">You're all caught up.</p>
            ) : items.map(item => {
              const Icon = EVENT_ICON[item.event_type] || BellIcon
              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 transition-colors ${!item.is_read ? 'bg-primary-50/30' : ''}`}
                >
                  <span className={`mt-0.5 w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${!item.is_read ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.body}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{timeAgo(item.created_at)}</p>
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

