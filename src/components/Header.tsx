import { useState, useRef, useEffect } from 'react'
import { useStore, getTotalUnreadNotifications } from '../store'
import { Search, RefreshCw, Bell, User, ChevronRight, Zap, ExternalLink,
  Globe, Trello, Cloud, Activity, BarChart2, BarChart, Box, GitBranch,
  Package, Layers, MessageSquare, LifeBuoy, Users, TrendingUp, Triangle, Github,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import NotificationsPanel from './NotificationsPanel'
import clsx from 'clsx'

const ICON_MAP: Record<string, LucideIcon> = {
  Globe, Trello, Cloud, Activity, BarChart2, BarChart, Bell, Box,
  GitBranch, Package, Layers, MessageSquare, LifeBuoy, Users,
  TrendingUp, Triangle, Github, Zap,
}

function QAIcon({ name, size = 14 }: { name: string; size?: number }) {
  const Icon = ICON_MAP[name] ?? Globe
  return <Icon size={size} />
}

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
    quickActions,
    setSearchOpen,
    setNotificationsOpen,
  } = useStore()

  const [syncing, setSyncing] = useState(false)
  const [qaOpen, setQaOpen] = useState(false)
  const qaRef = useRef<HTMLDivElement>(null)

  const projectActions = quickActions[activeProjectId] ?? []

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (qaRef.current && !qaRef.current.contains(e.target as Node)) {
        setQaOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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

        {/* ⚡ Quick Actions dropdown */}
        <div className="relative" ref={qaRef}>
          <button
            onClick={() => setQaOpen(o => !o)}
            className={clsx(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors border',
              qaOpen
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400 border-slate-700'
            )}
            title="Quick Actions"
          >
            <Zap size={14} className={qaOpen ? 'text-amber-400' : ''} />
            {projectActions.length > 0 && (
              <span className={clsx(
                'text-xs font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1',
                qaOpen ? 'bg-amber-500/30 text-amber-300' : 'bg-slate-700 text-slate-400'
              )}>
                {projectActions.length}
              </span>
            )}
          </button>

          {qaOpen && (
            <div className="absolute right-0 top-10 z-50 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap size={13} className="text-amber-400" />
                  <span className="text-xs font-semibold text-slate-300">Quick Actions</span>
                </div>
                <span className="text-xs text-slate-600">{projectActions.length} actions</span>
              </div>

              {projectActions.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <Zap size={20} className="text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">No quick actions yet</p>
                  <p className="text-xs text-slate-600 mt-0.5">Add them from the Quick Actions section</p>
                </div>
              ) : (
                <>
                  {/* Group actions */}
                  {(() => {
                    const groups = [...new Set(projectActions.map(a => a.group))].sort()
                    return groups.map(group => (
                      <div key={group}>
                        <div className="px-4 py-1.5 bg-slate-950/40">
                          <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">{group}</span>
                        </div>
                        {projectActions
                          .filter(a => a.group === group)
                          .sort((a, b) => a.order - b.order)
                          .map(action => (
                            <a
                              key={action.id}
                              href={action.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setQaOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800 transition-colors group"
                            >
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: `${action.color}20`, border: `1px solid ${action.color}30`, color: action.color }}
                              >
                                <QAIcon name={action.icon} size={14} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-slate-200 truncate">{action.label}</div>
                                <div className="text-xs text-slate-600 truncate">{action.url}</div>
                              </div>
                              <ExternalLink size={12} className="text-slate-600 group-hover:text-amber-400 flex-shrink-0 transition-colors" />
                            </a>
                          ))}
                      </div>
                    ))
                  })()}
                </>
              )}

              {/* Footer hint */}
              <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/40">
                <p className="text-[10px] text-slate-600 flex items-center gap-1">
                  <kbd className="bg-slate-800 px-1 py-0.5 rounded font-mono text-slate-500 text-[10px]">⌘K</kbd>
                  search by name to launch instantly
                </p>
              </div>
            </div>
          )}
        </div>

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
