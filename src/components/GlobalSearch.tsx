import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { useStore } from '../store'
import type { LucideIcon } from 'lucide-react'
import {
  Search,
  X,
  CheckSquare,
  Inbox,
  Zap,
  Trello,
  Mail,
  MessageCircle,
  Clock,
  ExternalLink,
} from 'lucide-react'
import clsx from 'clsx'
import type { Task, Message, QuickAction, Project } from '../types'

type ResultType = 'task' | 'message' | 'action'

interface SearchResult {
  type: ResultType
  id: string
  title: string
  subtitle: string
  project: Project
  action: () => void
}

export default function GlobalSearch() {
  const {
    searchQuery,
    setSearchOpen,
    setSearchQuery,
    projects,
    messages,
    tasks,
    quickActions,
    setActiveProject,
    setActiveSection,
  } = useStore()

  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function buildResults(): SearchResult[] {
    const q = searchQuery.toLowerCase().trim()

    const results: SearchResult[] = []

    for (const project of projects) {
      // Tasks
      const projectTasks = tasks[project.id] ?? []
      for (const task of projectTasks) {
        if (!q || task.title.toLowerCase().includes(q) || task.description?.toLowerCase().includes(q)) {
          results.push({
            type: 'task',
            id: task.id,
            title: task.title,
            subtitle: `${task.status} · ${task.priority}`,
            project,
            action: () => {
              setActiveProject(project.id)
              setActiveSection('tasks')
              setSearchOpen(false)
            },
          })
        }
      }

      // Messages
      const projectMessages = messages[project.id] ?? []
      for (const msg of projectMessages) {
        if (!q || msg.title.toLowerCase().includes(q) || msg.body.toLowerCase().includes(q) || msg.from.toLowerCase().includes(q)) {
          results.push({
            type: 'message',
            id: msg.id,
            title: msg.title,
            subtitle: `${msg.source} · from ${msg.from}`,
            project,
            action: () => {
              setActiveProject(project.id)
              setActiveSection('inbox')
              setSearchOpen(false)
            },
          })
        }
      }

      // Quick actions — launch URL directly
      const projectActions = quickActions[project.id] ?? []
      for (const action of projectActions) {
        if (!q || action.label.toLowerCase().includes(q) || action.url.toLowerCase().includes(q) || action.group.toLowerCase().includes(q)) {
          results.push({
            type: 'action',
            id: action.id,
            title: action.label,
            subtitle: `${action.group} · ${action.url}`,
            project,
            action: () => {
              window.open(action.url, '_blank', 'noopener,noreferrer')
              setSearchOpen(false)
            },
          })
        }
      }
    }

    return results.slice(0, 20)
  }

  const results = buildResults()

  useEffect(() => {
    setSelected(0)
  }, [searchQuery])

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      results[selected]?.action()
    } else if (e.key === 'Escape') {
      setSearchOpen(false)
    }
  }

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selected}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const TYPE_ICONS: Record<ResultType, LucideIcon> = {
    task: CheckSquare,
    message: Inbox,
    action: Zap,
  }

  const SOURCE_ICONS = { jira: Trello, email: Mail, whatsapp: MessageCircle }

  // Group results by type for display
  const grouped: Record<ResultType, SearchResult[]> = { task: [], message: [], action: [] }
  results.forEach(r => grouped[r.type].push(r))

  const TYPE_LABELS: Record<ResultType, string> = {
    task: 'Tasks',
    message: 'Messages',
    action: 'Quick Actions',
  }

  let globalIdx = 0

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-start justify-center pt-24"
      onClick={e => { if (e.target === e.currentTarget) setSearchOpen(false) }}
    >
      <div className="w-full max-w-2xl mx-4">
        {/* Search box */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
            <Search size={16} className="text-slate-500 flex-shrink-0" />
            <input
              ref={inputRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search tasks, messages, quick actions..."
              className="flex-1 bg-transparent text-slate-100 placeholder-slate-600 focus:outline-none text-sm"
            />
            <div className="flex items-center gap-2">
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
              <kbd className="text-xs bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-mono">
                Esc
              </kbd>
            </div>
          </div>

          {/* Results */}
          <div
            ref={listRef}
            className="max-h-[480px] overflow-y-auto"
          >
            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                {searchQuery ? (
                  <>
                    <Search size={28} className="text-slate-700 mb-3" />
                    <p className="text-sm text-slate-500">No results for "{searchQuery}"</p>
                  </>
                ) : (
                  <>
                    <Clock size={28} className="text-slate-700 mb-3" />
                    <p className="text-sm text-slate-500">Start typing to search...</p>
                    <div className="mt-3 text-left space-y-1.5 bg-slate-800/50 rounded-lg px-4 py-3 mx-4">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">What you can do</p>
                      <p className="text-xs text-slate-500 flex items-center gap-2">
                        <CheckSquare size={11} className="text-blue-400 flex-shrink-0" />
                        Search tasks across all projects
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-2">
                        <Inbox size={11} className="text-green-400 flex-shrink-0" />
                        Find messages in your inbox
                      </p>
                      <p className="text-xs text-slate-400 flex items-center gap-2 font-medium">
                        <Zap size={11} className="text-amber-400 flex-shrink-0" />
                        Type a quick action name → press <kbd className="bg-slate-700 px-1 py-0.5 rounded text-slate-300 font-mono text-[10px]">↵</kbd> to launch it instantly
                      </p>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="py-2">
                {(Object.entries(grouped) as [ResultType, SearchResult[]][])
                  .filter(([, items]) => items.length > 0)
                  .map(([type, items]) => (
                    <div key={type}>
                      {/* Group header */}
                      <div className="px-4 py-1.5 flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          {TYPE_LABELS[type]}
                        </span>
                        <span className="text-xs text-slate-700">{items.length}</span>
                      </div>

                      {items.map(result => {
                        const idx = globalIdx++
                        const isSelected = selected === idx
                        const Icon = TYPE_ICONS[result.type]

                        return (
                          <button
                            key={result.id}
                            data-idx={idx}
                            onClick={result.action}
                            onMouseEnter={() => setSelected(idx)}
                            className={clsx(
                              'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                              isSelected ? 'bg-slate-800' : 'hover:bg-slate-800/50'
                            )}
                          >
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{
                                backgroundColor: `${result.project.color}15`,
                                border: `1px solid ${result.project.color}25`,
                              }}
                            >
                              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                              <Icon size={13} {...{ style: { color: result.project.color } } as any} />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-slate-200 truncate">{result.title}</div>
                              <div className="text-xs text-slate-500 truncate mt-0.5">{result.subtitle}</div>
                            </div>

                            {result.type === 'action' ? (
                              <div className="flex items-center gap-1 flex-shrink-0 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-medium">
                                <ExternalLink size={10} />
                                Launch
                              </div>
                            ) : (
                              <div
                                className="flex-shrink-0 text-xs px-2 py-0.5 rounded font-medium"
                                style={{
                                  backgroundColor: `${result.project.color}15`,
                                  color: result.project.color,
                                }}
                              >
                                {result.project.name}
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {results.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800 bg-slate-950/50">
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <span className="flex items-center gap-1">
                  <kbd className="bg-slate-800 px-1 py-0.5 rounded font-mono text-slate-500">↑↓</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-slate-800 px-1 py-0.5 rounded font-mono text-slate-500">↵</kbd>
                  {results[selected]?.type === 'action' ? (
                    <span className="text-amber-500">launch ↗</span>
                  ) : 'open'}
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-slate-800 px-1 py-0.5 rounded font-mono text-slate-500">Esc</kbd>
                  close
                </span>
              </div>
              <span className="text-xs text-slate-600">{results.length} results</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
