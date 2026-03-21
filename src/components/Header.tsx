import { useState } from 'react'
import { useStore, getTotalUnreadNotifications } from '../store'
import { Search, RefreshCw, Bell, User, ChevronRight } from 'lucide-react'
import NotificationsPanel from './NotificationsPanel'
import clsx from 'clsx'

const SECTION_LABELS: Record<string, string> = {
  inbox: 'Inbox',
  tasks: 'Tasks',
  'quick-actions': 'Quick Actions',
  integrations: 'Integrations',
  settings: 'Settings',
}

export default function Header() {
  const {
    projects,
    activeProjectId,
    activeSection,
    notifications,
    notificationsOpen,
    setSearchOpen,
    setNotificationsOpen,
  } = useStore()

  const [syncing, setSyncing] = useState(false)

  const activeProject = projects.find(p => p.id === activeProjectId)
  const unreadNotifications = getTotalUnreadNotifications(notifications)

  function handleSync() {
    setSyncing(true)
    setTimeout(() => setSyncing(false), 1500)
  }

  return (
    <header className="h-14 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-10 flex items-center px-4 gap-3 flex-shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {activeProject && (
          <>
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: activeProject.color }}
            />
            <span className="text-sm font-medium text-slate-300 truncate">
              {activeProject.name}
            </span>
            <ChevronRight size={14} className="text-slate-600 flex-shrink-0" />
            <span className="text-sm font-medium text-slate-100">
              {SECTION_LABELS[activeSection] ?? activeSection}
            </span>
          </>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Search */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-400 hover:text-slate-200 transition-colors duration-150"
          aria-label="Open global search (Cmd+K)"
        >
          <Search size={14} />
          <span className="text-xs">Search</span>
          <kbd className="text-xs bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded font-mono hidden sm:inline">
            ⌘K
          </kbd>
        </button>

        {/* Sync button */}
        <button
          onClick={handleSync}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          aria-label="Sync now"
        >
          <RefreshCw
            size={15}
            className={clsx('transition-transform', syncing && 'animate-spin')}
          />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className={clsx(
              'p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors relative',
              notificationsOpen && 'bg-slate-800 text-slate-200'
            )}
            aria-label={`Notifications ${unreadNotifications > 0 ? `(${unreadNotifications} unread)` : ''}`}
          >
            <Bell size={15} />
            {unreadNotifications > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </button>

          {notificationsOpen && <NotificationsPanel />}
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-slate-700" />

        {/* Profile avatar */}
        <button
          className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center hover:opacity-90 transition-opacity"
          aria-label="User profile"
        >
          <User size={13} className="text-white" />
        </button>
      </div>
    </header>
  )
}
