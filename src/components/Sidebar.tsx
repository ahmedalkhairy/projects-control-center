import { useStore, getUnreadCount, getTaskCount, getRepoCount } from '../store'
import type { LucideIcon } from 'lucide-react'
import {
  Zap,
  Inbox,
  CheckSquare,
  Bolt,
  Link2,
  Settings,
  Plus,
  ChevronRight,
  User,
  Moon,
  Activity,
  GitBranch,
} from 'lucide-react'
import clsx from 'clsx'
import type { NavSection } from '../types'

const NAV_ITEMS: { section: NavSection; label: string; icon: LucideIcon }[] = [
  { section: 'inbox', label: 'Inbox', icon: Inbox },
  { section: 'tasks', label: 'Tasks', icon: CheckSquare },
  { section: 'quick-actions', label: 'Quick Actions', icon: Bolt },
  { section: 'repositories', label: 'Repositories', icon: GitBranch },
  { section: 'integrations', label: 'Integrations', icon: Link2 },
  { section: 'settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const {
    projects,
    activeProjectId,
    activeSection,
    messages,
    tasks,
    repos,
    setActiveProject,
    setActiveSection,
    setCreateProjectOpen,
  } = useStore()

  return (
    <aside className="w-72 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-slate-800 flex items-center gap-3 flex-shrink-0">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Zap size={16} className="text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-100 leading-tight">Control Center</div>
          <div className="text-xs text-slate-500 leading-tight">Operations Dashboard</div>
        </div>
      </div>

      {/* Scrollable middle section */}
      <div className="flex-1 overflow-y-auto py-3">
        {/* Projects section */}
        <div className="mb-4">
          <div className="flex items-center justify-between px-3 mb-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Projects
            </span>
            <button
              onClick={() => setCreateProjectOpen(true)}
              className="p-0.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
              aria-label="Create new project"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="space-y-0.5 px-2">
            {projects.map(project => {
              const unread = getUnreadCount(messages, project.id)
              const isActive = project.id === activeProjectId

              return (
                <button
                  key={project.id}
                  onClick={() => setActiveProject(project.id)}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all duration-150 group relative',
                    isActive
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  )}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <div
                      className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                  )}

                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0 ml-1"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="flex-1 text-sm font-medium truncate">{project.name}</span>
                  {unread > 0 && (
                    <span className="flex-shrink-0 min-w-[20px] h-5 bg-blue-600 rounded-full text-white text-xs font-semibold flex items-center justify-center px-1.5">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                  {!isActive && (
                    <ChevronRight
                      size={14}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity"
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="mx-3 border-t border-slate-800 my-3" />

        {/* Workspace nav */}
        <div>
          <div className="px-3 mb-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Workspace
            </span>
          </div>

          <div className="space-y-0.5 px-2">
            {NAV_ITEMS.map(item => {
              const isActive = activeSection === item.section
              const Icon = item.icon

              let badge: number | null = null
              if (item.section === 'inbox') {
                badge = getUnreadCount(messages, activeProjectId)
              } else if (item.section === 'tasks') {
                badge = getTaskCount(tasks, activeProjectId)
              } else if (item.section === 'repositories') {
                badge = getRepoCount(repos, activeProjectId)
              }

              return (
                <button
                  key={item.section}
                  onClick={() => setActiveSection(item.section)}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all duration-150 group relative',
                    isActive
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  )}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-blue-500 rounded-full" />
                  )}

                  <Icon
                    size={15}
                    className={clsx(
                      'flex-shrink-0 ml-1',
                      isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'
                    )}
                  />
                  <span className="flex-1 text-sm font-medium">{item.label}</span>
                  {badge !== null && badge > 0 && (
                    <span
                      className={clsx(
                        'flex-shrink-0 min-w-[20px] h-5 rounded-full text-xs font-semibold flex items-center justify-center px-1.5',
                        item.section === 'inbox'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-300'
                      )}
                    >
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Bottom user section */}
      <div className="border-t border-slate-800 p-3 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
            <User size={14} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-slate-200 truncate">Admin User</div>
            <div className="text-xs text-slate-500 truncate">admin@ops.dev</div>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
              aria-label="Settings"
            >
              <Settings size={13} />
            </button>
            <button
              className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
              aria-label="Toggle dark mode"
            >
              <Moon size={13} />
            </button>
            <button
              className="p-1.5 rounded text-slate-500 hover:text-green-400 hover:bg-slate-800 transition-colors"
              aria-label="System status"
            >
              <Activity size={13} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
