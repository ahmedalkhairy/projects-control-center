import { useEffect, useRef } from 'react'
import { useStore, getTotalUnreadNotifications } from '../store'
import {
  Bell,
  X,
  CheckCheck,
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  ExternalLink,
} from 'lucide-react'
import clsx from 'clsx'
import { timeAgo } from '../utils'
import type { AppNotification } from '../types'

export default function NotificationsPanel() {
  const {
    notifications,
    setNotificationsOpen,
    dismissNotification,
    markNotificationRead,
    setActiveProject,
  } = useStore()

  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [setNotificationsOpen])

  const unread = notifications.filter(n => !n.read)
  const read = notifications.filter(n => n.read)
  const totalUnread = getTotalUnreadNotifications(notifications)

  function markAllRead() {
    notifications.forEach(n => markNotificationRead(n.id))
  }

  function handleNotificationClick(n: AppNotification) {
    markNotificationRead(n.id)
    if (n.url) {
      window.open(n.url, '_blank', 'noopener,noreferrer')
    } else {
      setActiveProject(n.projectId)
      setNotificationsOpen(false)
    }
  }

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-10 w-96 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-200">Notifications</span>
          {totalUnread > 0 && (
            <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-semibold">
              {totalUnread}
            </span>
          )}
        </div>
        {totalUnread > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
          >
            <CheckCheck size={12} />
            Mark all read
          </button>
        )}
      </div>

      {/* Content */}
      <div className="max-h-[480px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bell size={24} className="text-slate-700 mb-3" />
            <p className="text-sm text-slate-500">No notifications</p>
          </div>
        ) : (
          <>
            {/* Unread */}
            {unread.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-slate-950/50 border-b border-slate-800">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Unread
                  </span>
                </div>
                {unread.map(n => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onDismiss={() => dismissNotification(n.id)}
                    onClick={() => handleNotificationClick(n)}
                  />
                ))}
              </div>
            )}

            {/* Read */}
            {read.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-slate-950/50 border-b border-slate-800 border-t">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Read
                  </span>
                </div>
                {read.map(n => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onDismiss={() => dismissNotification(n.id)}
                    onClick={() => handleNotificationClick(n)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Notification Item ────────────────────────────────────────────────────────

interface NotificationItemProps {
  notification: AppNotification
  onDismiss: () => void
  onClick: () => void
}

const TYPE_ICONS = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle,
}

const TYPE_COLORS = {
  info: 'text-blue-400',
  warning: 'text-amber-400',
  error: 'text-red-400',
  success: 'text-green-400',
}

const TYPE_BG = {
  info: 'bg-blue-500/10',
  warning: 'bg-amber-500/10',
  error: 'bg-red-500/10',
  success: 'bg-green-500/10',
}

function NotificationItem({ notification, onDismiss, onClick }: NotificationItemProps) {
  const Icon = TYPE_ICONS[notification.type]

  return (
    <div
      className={clsx(
        'flex items-start gap-3 px-4 py-3 border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors group cursor-pointer',
        !notification.read && 'bg-slate-800/20'
      )}
      onClick={onClick}
    >
      {/* Type icon */}
      <div className={clsx('p-1.5 rounded-lg flex-shrink-0 mt-0.5', TYPE_BG[notification.type])}>
        <Icon size={13} className={TYPE_COLORS[notification.type]} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Project badge */}
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
            {notification.projectName}
          </span>
          {!notification.read && (
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
          )}
        </div>

        <p className={clsx(
          'text-xs font-medium leading-tight',
          notification.read ? 'text-slate-400' : 'text-slate-200'
        )}>
          {notification.title}
        </p>
        <p className="text-xs text-slate-500 mt-0.5 leading-snug line-clamp-2">
          {notification.message}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-slate-600">{timeAgo(notification.timestamp)}</p>
          {notification.url && (
            <span className="text-xs text-slate-600 flex items-center gap-0.5">
              <ExternalLink size={10} />
              <span>open</span>
            </span>
          )}
        </div>
      </div>

      {/* Dismiss */}
      <button
        onClick={e => { e.stopPropagation(); onDismiss() }}
        className="p-1 text-slate-700 hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-all rounded flex-shrink-0"
        aria-label="Dismiss notification"
      >
        <X size={12} />
      </button>
    </div>
  )
}
