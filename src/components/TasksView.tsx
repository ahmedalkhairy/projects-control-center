import { useState, useRef, KeyboardEvent, DragEvent } from 'react'
import { useStore, cycleTaskStatus } from '../store'
import {
  CheckSquare,
  Plus,
  LayoutList,
  LayoutGrid,
  MoreHorizontal,
  Trash2,
  Edit,
  MoveRight,
  ExternalLink,
  Calendar,
  Tag,
  Bell,
  X,
  Target,
  SlidersHorizontal,
} from 'lucide-react'
import { HelpButton } from './HelpButton'
import clsx from 'clsx'
import { format } from 'date-fns'
import {
  priorityDot,
  priorityBg,
  statusBg,
  isOverdue,
  formatDate,
  generateId,
} from '../utils'
import type { Task, TaskStatus, Priority, TaskReminder, WipLimit } from '../types'

// ─── Reminder helpers ─────────────────────────────────────────────────────────

function minutesToCustom(minutes: number): [number, 'minutes' | 'hours' | 'days'] {
  if (minutes >= 1440 && minutes % 1440 === 0) return [minutes / 1440, 'days']
  if (minutes >= 60 && minutes % 60 === 0) return [minutes / 60, 'hours']
  return [minutes, 'minutes']
}

function fmtInterval(minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) return `${minutes / 1440}d`
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60}h`
  return `${minutes} min`
}

type ViewMode = 'list' | 'kanban'
type TabFilter = 'all' | TaskStatus
type TypeFilter = 'all' | 'local' | 'jira' | 'gitlab'

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'todo', label: 'Todo', color: 'text-slate-400' },
  { status: 'in-progress', label: 'In Progress', color: 'text-blue-400' },
  { status: 'done', label: 'Done', color: 'text-green-400' },
]

export default function TasksView() {
  const {
    activeProjectId,
    projects,
    tasks,
    addTask,
    updateTask,
    deleteTask,
    moveTaskToProject,
    openTaskModal,
    focusTaskIds,
    addToFocus,
    removeFromFocus,
    wipLimits,
    setWipLimit,
  } = useStore()

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [tabFilter, setTabFilter] = useState<TabFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [quickCreate, setQuickCreate] = useState('')
  const quickCreateRef = useRef<HTMLInputElement>(null)
  const [reminderTaskId, setReminderTaskId] = useState<string | null>(null)
  const [wipConfigOpen, setWipConfigOpen] = useState(false)

  const projectWipLimits = wipLimits[activeProjectId] ?? {}

  const projectTasks = tasks[activeProjectId] ?? []

  const filtered = projectTasks
    .filter(t => {
      if (tabFilter !== 'all' && t.status !== tabFilter) return false
      if (typeFilter !== 'all' && t.type !== typeFilter) return false
      return true
    })
    .sort((a, b) => {
      const aDone = a.status === 'done' ? 1 : 0
      const bDone = b.status === 'done' ? 1 : 0
      return aDone - bDone
    })

  const totalActive = projectTasks.filter(t => t.status !== 'done').length
  const doneCount = projectTasks.filter(t => t.status === 'done').length

  function handleQuickCreate(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && quickCreate.trim()) {
      addTask({
        projectId: activeProjectId,
        title: quickCreate.trim(),
        status: 'todo',
        priority: 'medium',
        type: 'local',
        tags: [],
      })
      setQuickCreate('')
    }
  }

  const TAB_ITEMS: { key: TabFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'todo', label: 'Todo' },
    { key: 'in-progress', label: 'In Progress' },
    { key: 'done', label: 'Done' },
  ]

  const reminderTask = reminderTaskId ? (tasks[activeProjectId] ?? []).find(t => t.id === reminderTaskId) ?? null : null

  return (
    <div className="p-6">
      {/* Reminder modal */}
      {reminderTask && (
        <ReminderModal
          task={reminderTask}
          onClose={() => setReminderTaskId(null)}
          onSave={reminder => {
            updateTask(reminderTask.id, { reminder })
            setReminderTaskId(null)
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-100">Tasks</h1>
          <HelpButton
            title="Tasks"
            description="The main task management board for this project. Create, prioritize, and track tasks in list or Kanban grid view."
            tips={[
              'Click the status circle to cycle: To Do → In Progress → Done.',
              '"Done" tasks automatically sink to the bottom of the list.',
              'Drag tasks in grid view to reorder within their status column.',
              'Set reminders on tasks to get desktop notifications at the right time.',
              'Pin important tasks to Focus mode for daily tracking.',
              'Convert tasks from inbox messages using the → To Task button.',
            ]}
          />
          <div className="flex items-center gap-2">
            <span className="text-xs bg-blue-600/20 text-blue-400 border border-blue-600/30 px-2 py-0.5 rounded-full font-medium">
              {totalActive} active
            </span>
            <span className="text-xs bg-green-600/20 text-green-400 border border-green-600/30 px-2 py-0.5 rounded-full font-medium">
              {doneCount} done
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            <button
              onClick={() => setViewMode('list')}
              className={clsx(
                'p-1.5 rounded transition-colors',
                viewMode === 'list'
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-500 hover:text-slate-300'
              )}
              aria-label="List view"
            >
              <LayoutList size={15} />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={clsx(
                'p-1.5 rounded transition-colors',
                viewMode === 'kanban'
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-500 hover:text-slate-300'
              )}
              aria-label="Kanban view"
            >
              <LayoutGrid size={15} />
            </button>
          </div>

          <button
            onClick={() => setWipConfigOpen(true)}
            title="Configure WIP Limits"
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-slate-700"
          >
            <SlidersHorizontal size={14} />
            WIP Limits
          </button>

          <button
            onClick={() =>
              openTaskModal({
                id: '',
                projectId: activeProjectId,
                title: '',
                status: 'todo',
                priority: 'medium',
                type: 'local',
                createdAt: new Date().toISOString(),
              })
            }
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={14} />
            New Task
          </button>
        </div>
      </div>

      {/* WIP Limits Config Modal */}
      {wipConfigOpen && (
        <WipConfigModal
          wipLimits={projectWipLimits}
          onSave={(status, limit) => setWipLimit(activeProjectId, status, limit)}
          onClose={() => setWipConfigOpen(false)}
        />
      )}

      {viewMode === 'list' ? (
        <ListView
          tasks={projectTasks}
          filtered={filtered}
          tabFilter={tabFilter}
          setTabFilter={setTabFilter}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          TAB_ITEMS={TAB_ITEMS}
          quickCreate={quickCreate}
          setQuickCreate={setQuickCreate}
          handleQuickCreate={handleQuickCreate}
          quickCreateRef={quickCreateRef}
          projects={projects}
          focusTaskIds={focusTaskIds}
          addToFocus={addToFocus}
          removeFromFocus={removeFromFocus}
          onEdit={openTaskModal}
          onDelete={deleteTask}
          onStatusChange={(id, status) => updateTask(id, { status })}
          onMove={moveTaskToProject}
          onReminderOpen={setReminderTaskId}
          wipLimits={projectWipLimits}
        />
      ) : (
        <KanbanView
          tasks={projectTasks}
          projects={projects}
          activeProjectId={activeProjectId}
          onEdit={openTaskModal}
          onDelete={deleteTask}
          onStatusChange={(id, status) => updateTask(id, { status })}
          onReminderOpen={setReminderTaskId}
          wipLimits={projectWipLimits}
          onAdd={() =>
            openTaskModal({
              id: '',
              projectId: activeProjectId,
              title: '',
              status: 'todo',
              priority: 'medium',
              type: 'local',
              createdAt: new Date().toISOString(),
            })
          }
        />
      )}
    </div>
  )
}

// ─── List View ────────────────────────────────────────────────────────────────

interface ListViewProps {
  tasks: Task[]
  filtered: Task[]
  tabFilter: TabFilter
  setTabFilter: (f: TabFilter) => void
  typeFilter: TypeFilter
  setTypeFilter: (f: TypeFilter) => void
  TAB_ITEMS: { key: TabFilter; label: string }[]
  quickCreate: string
  setQuickCreate: (v: string) => void
  handleQuickCreate: (e: KeyboardEvent<HTMLInputElement>) => void
  quickCreateRef: React.RefObject<HTMLInputElement>
  projects: import('../types').Project[]
  focusTaskIds: string[]
  addToFocus: (id: string) => void
  removeFromFocus: (id: string) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: TaskStatus) => void
  onMove: (taskId: string, targetProjectId: string) => void
  onReminderOpen: (taskId: string) => void
  wipLimits: Record<string, WipLimit>
}

function ListView({
  tasks,
  filtered,
  tabFilter,
  setTabFilter,
  typeFilter,
  setTypeFilter,
  TAB_ITEMS,
  quickCreate,
  setQuickCreate,
  handleQuickCreate,
  quickCreateRef,
  projects,
  focusTaskIds,
  addToFocus,
  removeFromFocus,
  onEdit,
  onDelete,
  onStatusChange,
  onMove,
  onReminderOpen,
  wipLimits,
}: ListViewProps) {
  const TYPE_ITEMS: { key: TypeFilter; label: string; activeClass: string }[] = [
    { key: 'all',    label: 'All',    activeClass: 'bg-slate-800 text-slate-100 border-slate-700' },
    { key: 'local',  label: 'Local',  activeClass: 'bg-slate-700/60 text-slate-300 border-slate-600' },
    { key: 'jira',   label: 'Jira',   activeClass: 'bg-blue-600/20 text-blue-400 border-blue-600/40' },
    { key: 'gitlab', label: 'GitLab', activeClass: 'bg-orange-600/20 text-orange-400 border-orange-600/40' },
  ]

  return (
    <div>
      {/* Tabs row: status on left, type on right */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-1">
          {TAB_ITEMS.map(tab => {
            const count =
              tab.key === 'all'
                ? tasks.filter(t => typeFilter === 'all' || t.type === typeFilter).length
                : tasks.filter(t => t.status === tab.key && (typeFilter === 'all' || t.type === typeFilter)).length
            const limit = tab.key !== 'all' ? wipLimits[tab.key] : undefined
            const isOver  = limit?.max !== undefined && count > limit.max
            const isUnder = limit?.min !== undefined && count < limit.min
            const hasLimits = !!limit?.max || !!limit?.min
            return (
              <button
                key={tab.key}
                onClick={() => setTabFilter(tab.key)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-1.5',
                  tabFilter === tab.key
                    ? 'bg-slate-800 text-slate-100 border border-slate-700'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                )}
              >
                {tab.label}
                <span className={clsx(
                  'text-xs px-1.5 py-0.5 rounded font-mono',
                  isOver  ? 'bg-red-600/20 text-red-400 border border-red-600/30' :
                  isUnder ? 'bg-yellow-600/20 text-yellow-500 border border-yellow-600/30' :
                  hasLimits ? 'bg-green-600/20 text-green-400 border border-green-600/30' :
                  'bg-slate-700/80 text-slate-400'
                )}>
                  {count}
                  {isOver  && ' ▲'}
                  {isUnder && ' ▼'}
                </span>
              </button>
            )
          })}
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
          {TYPE_ITEMS.map(item => {
            const count =
              item.key === 'all'
                ? tasks.filter(t => tabFilter === 'all' || t.status === tabFilter).length
                : tasks.filter(t => t.type === item.key && (tabFilter === 'all' || t.status === tabFilter)).length
            return (
              <button
                key={item.key}
                onClick={() => setTypeFilter(item.key)}
                className={clsx(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all border',
                  typeFilter === item.key
                    ? item.activeClass
                    : 'text-slate-500 hover:text-slate-300 border-transparent',
                )}
              >
                {item.label}
                <span className={clsx(
                  'text-[10px] px-1 py-0.5 rounded font-mono',
                  typeFilter === item.key ? 'bg-slate-900/50' : 'bg-slate-800 text-slate-500',
                )}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Quick create */}
      <div className="flex items-center gap-3 mb-4 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5">
        <Plus size={14} className="text-slate-600 flex-shrink-0" />
        <input
          ref={quickCreateRef}
          value={quickCreate}
          onChange={e => setQuickCreate(e.target.value)}
          onKeyDown={handleQuickCreate}
          placeholder="Quick add task… (press Enter to create)"
          className="flex-1 bg-transparent text-sm text-slate-300 placeholder-slate-600 focus:outline-none"
        />
        {quickCreate && (
          <kbd className="text-xs bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded font-mono">
            ↵
          </kbd>
        )}
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mb-3">
            <CheckSquare size={24} className="text-slate-600" />
          </div>
          <p className="text-slate-400 font-medium">No tasks</p>
          <p className="text-slate-600 text-sm mt-1">Add a task to get started</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          {filtered.map((task, idx) => (
            <TaskRow
              key={task.id}
              task={task}
              isLast={idx === filtered.length - 1}
              projects={projects}
              isFocused={focusTaskIds.includes(task.id)}
              onEdit={() => onEdit(task)}
              onDelete={() => onDelete(task.id)}
              onStatusChange={status => onStatusChange(task.id, status)}
              onMove={targetId => onMove(task.id, targetId)}
              onReminderOpen={() => onReminderOpen(task.id)}
              onFocusToggle={() => focusTaskIds.includes(task.id) ? removeFromFocus(task.id) : addToFocus(task.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: Task
  isLast: boolean
  projects: import('../types').Project[]
  isFocused: boolean
  onEdit: () => void
  onDelete: () => void
  onStatusChange: (status: TaskStatus) => void
  onMove: (targetProjectId: string) => void
  onReminderOpen: () => void
  onFocusToggle: () => void
}

function TaskRow({ task, isLast, projects, isFocused, onEdit, onDelete, onStatusChange, onMove, onReminderOpen, onFocusToggle }: TaskRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const isDone = task.status === 'done'
  const overdue = task.dueDate && !isDone && isOverdue(task.dueDate)

  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 transition-colors group relative',
        !isLast && 'border-b border-slate-800'
      )}
    >
      {/* Status checkbox */}
      <button
        onClick={() => onStatusChange(cycleTaskStatus(task.status))}
        className={clsx(
          'w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all',
          isDone
            ? 'bg-green-600 border-green-600'
            : task.status === 'in-progress'
            ? 'border-blue-500 bg-blue-500/20'
            : 'border-slate-600 hover:border-slate-400'
        )}
        title={`Status: ${task.status} (click to advance)`}
        aria-label={`Task status: ${task.status}`}
      >
        {isDone && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {task.status === 'in-progress' && (
          <div className="w-2 h-2 rounded-full bg-blue-400" />
        )}
      </button>

      {/* Priority dot */}
      <div
        className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', priorityDot(task.priority as Priority))}
      />

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <button
          onClick={onEdit}
          className={clsx(
            'text-sm text-left hover:text-blue-400 transition-colors',
            isDone ? 'line-through text-slate-500' : 'text-slate-200'
          )}
        >
          {task.title}
        </button>
        <div className="flex items-center gap-2 mt-0.5">
          {task.tags?.slice(0, 3).map(tag => (
            <span key={tag} className="text-xs text-slate-600 flex items-center gap-0.5">
              <Tag size={10} />
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Type badge */}
      <span className={clsx(
        'text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0',
        task.type === 'jira'   ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
        task.type === 'gitlab' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
        'bg-slate-700/60 text-slate-500 border-slate-700'
      )}>
        {task.type === 'jira' ? 'Jira' : task.type === 'gitlab' ? 'GitLab' : 'Local'}
      </span>

      {/* Jira key */}
      {task.jiraKey && (
        <a
          href={task.jiraLink ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded hover:bg-blue-500/20 transition-colors flex-shrink-0"
          title="Open in Jira"
        >
          {task.jiraKey}
          <ExternalLink size={10} />
        </a>
      )}

      {/* GitLab IID */}
      {task.gitlabIid !== undefined && (
        <a
          href={task.gitlabLink ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded hover:bg-orange-500/20 transition-colors flex-shrink-0"
          title="Open in GitLab"
        >
          GL-{task.gitlabIid}
          <ExternalLink size={10} />
        </a>
      )}

      {/* Sprint */}
      {task.sprint && (
        <span className="flex items-center gap-1 text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded flex-shrink-0" title="Sprint">
          🏃 {task.sprint}
        </span>
      )}

      {/* Parent story */}
      {task.parentKey && (
        <span className="flex items-center gap-1 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded flex-shrink-0 max-w-[160px] truncate" title={task.parentSummary ?? task.parentKey}>
          📖 {task.parentKey}
          {task.parentSummary && <span className="truncate text-amber-500/70"> · {task.parentSummary}</span>}
        </span>
      )}

      {/* Epic */}
      {task.epicName && !task.parentKey && (
        <span className="flex items-center gap-1 text-xs bg-pink-500/10 text-pink-400 border border-pink-500/20 px-2 py-0.5 rounded flex-shrink-0 max-w-[140px] truncate" title={task.epicName}>
          ⚡ {task.epicName}
        </span>
      )}

      {/* Story points */}
      {task.storyPoints !== undefined && (
        <span className="text-xs bg-slate-700/60 text-slate-300 border border-slate-600/50 px-1.5 py-0.5 rounded font-mono flex-shrink-0" title="Story points">
          {task.storyPoints} SP
        </span>
      )}

      {/* Due date */}
      {task.dueDate && (
        <span
          className={clsx(
            'flex items-center gap-1 text-xs flex-shrink-0',
            overdue ? 'text-red-400' : 'text-slate-500'
          )}
        >
          <Calendar size={11} />
          {formatDate(task.dueDate)}
          {overdue && ' (overdue)'}
        </span>
      )}

      {/* Priority badge */}
      <span className={clsx('badge text-xs border flex-shrink-0', priorityBg(task.priority as Priority))}>
        {task.priority}
      </span>

      {/* Status badge */}
      <span className={clsx('badge text-xs flex-shrink-0', statusBg(task.status))}>
        {task.status}
      </span>

      {/* Focus toggle */}
      <button
        onClick={onFocusToggle}
        className={clsx(
          'p-1.5 rounded transition-all flex-shrink-0',
          isFocused
            ? 'text-amber-400 opacity-100'
            : 'text-slate-600 hover:text-amber-400 hover:bg-slate-700 opacity-0 group-hover:opacity-100',
        )}
        aria-label={isFocused ? 'Remove from focus' : 'Add to focus'}
        title={isFocused ? 'Remove from today\'s focus' : 'Add to today\'s focus'}
      >
        <Target size={14} />
      </button>

      {/* Reminder bell */}
      <button
        onClick={onReminderOpen}
        className={clsx(
          'p-1.5 rounded transition-all flex-shrink-0',
          task.reminder?.enabled
            ? 'text-violet-400 opacity-100'
            : 'text-slate-600 hover:text-violet-400 hover:bg-slate-700 opacity-0 group-hover:opacity-100',
        )}
        aria-label="Set reminder"
        title={task.reminder?.enabled
          ? `Reminder: ${task.reminder.mode === 'once' ? format(new Date(task.reminder.nextAt), 'MMM d, HH:mm') : `Every ${fmtInterval(task.reminder.intervalMinutes ?? 60)}`}`
          : 'Add reminder'}
      >
        <Bell size={14} />
      </button>

      {/* Menu */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => { setMenuOpen(!menuOpen); setShowMoveMenu(false) }}
          className="p-1.5 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-all"
          aria-label="Task options"
        >
          <MoreHorizontal size={14} />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => { setMenuOpen(false); setShowMoveMenu(false) }} />
            <div className="absolute right-0 top-7 z-20 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 w-44 text-sm">
              <button
                onClick={() => { onEdit(); setMenuOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <Edit size={13} className="text-slate-500" />
                Edit task
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowMoveMenu(!showMoveMenu)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <MoveRight size={13} className="text-slate-500" />
                  Move to project
                </button>
                {showMoveMenu && (
                  <div className="absolute left-full top-0 ml-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 w-48">
                    {projects
                      .filter(p => p.id !== task.projectId)
                      .map(p => (
                        <button
                          key={p.id}
                          onClick={() => { onMove(p.id); setMenuOpen(false); setShowMoveMenu(false) }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-slate-300 hover:bg-slate-700 transition-colors"
                        >
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                          <span className="truncate text-sm">{p.name}</span>
                        </button>
                      ))}
                    {projects.filter(p => p.id !== task.projectId).length === 0 && (
                      <div className="px-3 py-2 text-xs text-slate-500">No other projects</div>
                    )}
                  </div>
                )}
              </div>
              <div className="my-1 border-t border-slate-700" />
              <button
                onClick={() => { onDelete(); setMenuOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-slate-700 transition-colors"
              >
                <Trash2 size={13} />
                Delete task
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Kanban View ──────────────────────────────────────────────────────────────

interface KanbanViewProps {
  tasks: Task[]
  projects: import('../types').Project[]
  activeProjectId: string
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: TaskStatus) => void
  onReminderOpen: (taskId: string) => void
  onAdd: () => void
  wipLimits: Record<string, WipLimit>
}

function KanbanView({ tasks, projects, activeProjectId, onEdit, onDelete, onStatusChange, onReminderOpen, onAdd, wipLimits }: KanbanViewProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null)

  function handleDragStart(e: DragEvent, taskId: string) {
    setDraggedId(taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: DragEvent, status: TaskStatus) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverStatus(status)
  }

  function handleDrop(e: DragEvent, status: TaskStatus) {
    e.preventDefault()
    if (draggedId) {
      onStatusChange(draggedId, status)
    }
    setDraggedId(null)
    setDragOverStatus(null)
  }

  function handleDragEnd() {
    setDraggedId(null)
    setDragOverStatus(null)
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.status)
        const isDragOver = dragOverStatus === col.status
        const limit = wipLimits[col.status]
        const isOver  = limit?.max !== undefined && colTasks.length > limit.max
        const isUnder = limit?.min !== undefined && colTasks.length < limit.min
        const hasLimits = !!limit?.max || !!limit?.min

        return (
          <div
            key={col.status}
            onDragOver={e => handleDragOver(e, col.status)}
            onDrop={e => handleDrop(e, col.status)}
            onDragLeave={() => setDragOverStatus(null)}
            className={clsx(
              'rounded-xl border transition-all duration-150 flex flex-col',
              isDragOver ? 'border-blue-500/50 bg-blue-500/5' :
              isOver     ? 'border-red-600/40 bg-red-600/5' :
              isUnder    ? 'border-yellow-600/40 bg-yellow-600/5' :
              'border-slate-800 bg-slate-900'
            )}
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div
                  className={clsx(
                    'w-2 h-2 rounded-full',
                    col.status === 'todo' && 'bg-slate-500',
                    col.status === 'in-progress' && 'bg-blue-500',
                    col.status === 'done' && 'bg-green-500'
                  )}
                />
                <span className={clsx('text-sm font-medium', col.color)}>{col.label}</span>
                {limit && (
                  <span className="text-[10px] text-slate-600 font-mono">
                    {limit.min !== undefined && `min ${limit.min}`}
                    {limit.min !== undefined && limit.max !== undefined && ' · '}
                    {limit.max !== undefined && `max ${limit.max}`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className={clsx(
                  'text-xs px-2 py-0.5 rounded-full font-mono',
                  isOver  ? 'bg-red-600/20 text-red-400' :
                  isUnder ? 'bg-yellow-600/20 text-yellow-500' :
                  hasLimits ? 'bg-green-600/20 text-green-400' :
                  'bg-slate-800 text-slate-400'
                )}>
                  {colTasks.length}
                  {isOver  && ' ▲'}
                  {isUnder && ' ▼'}
                </span>
              </div>
            </div>

            {/* Cards */}
            <div className="flex-1 p-3 space-y-2 min-h-[200px]">
              {colTasks.map(task => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  isDragging={draggedId === task.id}
                  onDragStart={e => handleDragStart(e, task.id)}
                  onDragEnd={handleDragEnd}
                  onEdit={() => onEdit(task)}
                  onDelete={() => onDelete(task.id)}
                  onReminderOpen={() => onReminderOpen(task.id)}
                />
              ))}
              {colTasks.length === 0 && !isDragOver && (
                <div className="flex items-center justify-center h-20 text-xs text-slate-700 border border-dashed border-slate-800 rounded-lg">
                  Drop here
                </div>
              )}
            </div>

            {/* Add task */}
            <div className="p-3 pt-0">
              <button
                onClick={onAdd}
                className="w-full flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-slate-300 hover:bg-slate-800 rounded-lg text-sm transition-colors"
              >
                <Plus size={13} />
                Add task
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface KanbanCardProps {
  task: Task
  isDragging: boolean
  onDragStart: (e: DragEvent<HTMLDivElement>) => void
  onDragEnd: () => void
  onEdit: () => void
  onDelete: () => void
  onReminderOpen: () => void
}

function KanbanCard({ task, isDragging, onDragStart, onDragEnd, onEdit, onDelete, onReminderOpen }: KanbanCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const overdue = task.dueDate && task.status !== 'done' && isOverdue(task.dueDate)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={clsx(
        'bg-slate-800 border rounded-lg p-3 cursor-grab active:cursor-grabbing transition-all group relative',
        isDragging ? 'opacity-40 border-blue-500' : 'border-slate-700 hover:border-slate-600'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <div className={clsx('w-1.5 h-1.5 rounded-full mt-0.5 flex-shrink-0', priorityDot(task.priority as Priority))} />
          <button
            onClick={onEdit}
            className={clsx(
              'text-sm font-medium text-left hover:text-blue-400 transition-colors leading-snug',
              task.status === 'done' ? 'line-through text-slate-500' : 'text-slate-200'
            )}
          >
            {task.title}
          </button>
        </div>
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-0.5 rounded text-slate-600 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-all"
          >
            <MoreHorizontal size={13} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-5 z-20 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 w-36 text-sm">
                <button
                  onClick={() => { onEdit(); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-300 hover:bg-slate-700"
                >
                  <Edit size={12} className="text-slate-500" />
                  Edit
                </button>
                <button
                  onClick={() => { onReminderOpen(); setMenuOpen(false) }}
                  className={clsx(
                    'w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700',
                    task.reminder?.enabled ? 'text-violet-400' : 'text-slate-300',
                  )}
                >
                  <Bell size={12} className={task.reminder?.enabled ? 'text-violet-400' : 'text-slate-500'} />
                  Reminder
                </button>
                <button
                  onClick={() => { onDelete(); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-red-400 hover:bg-slate-700"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className={clsx('badge text-xs border', priorityBg(task.priority as Priority))}>
            {task.priority}
          </span>
          <span className={clsx(
            'text-[10px] font-semibold px-1.5 py-0.5 rounded border',
            task.type === 'jira'
              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
              : 'bg-slate-700/60 text-slate-500 border-slate-700'
          )}>
            {task.type === 'jira' ? 'Jira' : 'Local'}
          </span>
        </div>
        {task.dueDate && (
          <span className={clsx('text-xs flex items-center gap-0.5', overdue ? 'text-red-400' : 'text-slate-600')}>
            <Calendar size={10} />
            {formatDate(task.dueDate)}
          </span>
        )}
        {task.jiraKey && (
          <span className="text-xs text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded bg-blue-500/10">
            {task.jiraKey}
          </span>
        )}
        {task.gitlabIid !== undefined && (
          <span className="text-xs text-orange-400 border border-orange-500/20 px-1.5 py-0.5 rounded bg-orange-500/10">
            GL-{task.gitlabIid}
          </span>
        )}
        {task.sprint && (
          <span className="text-xs text-violet-400 border border-violet-500/20 px-1.5 py-0.5 rounded bg-violet-500/10" title="Sprint">
            🏃 {task.sprint}
          </span>
        )}
        {task.parentKey && (
          <span className="text-xs text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded bg-amber-500/10 max-w-[100px] truncate" title={task.parentSummary ?? task.parentKey}>
            📖 {task.parentKey}
          </span>
        )}
        {task.storyPoints !== undefined && (
          <span className="text-xs text-slate-300 border border-slate-600/50 px-1.5 py-0.5 rounded bg-slate-700/60 font-mono" title="Story points">
            {task.storyPoints} SP
          </span>
        )}
      </div>

      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {task.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-xs text-slate-600 bg-slate-900 px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── WIP Config Modal ─────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'done': 'Done',
}

interface WipConfigModalProps {
  wipLimits: Record<string, WipLimit>
  onSave: (status: TaskStatus, limit: WipLimit) => void
  onClose: () => void
}

function WipConfigModal({ wipLimits, onSave, onClose }: WipConfigModalProps) {
  const [draft, setDraft] = useState<Record<string, { min: string; max: string }>>(() => {
    const init: Record<string, { min: string; max: string }> = {}
    for (const s of ['todo', 'in-progress', 'done'] as TaskStatus[]) {
      init[s] = {
        min: wipLimits[s]?.min?.toString() ?? '',
        max: wipLimits[s]?.max?.toString() ?? '',
      }
    }
    return init
  })

  function handleSave() {
    for (const s of ['todo', 'in-progress', 'done'] as TaskStatus[]) {
      const min = draft[s].min ? parseInt(draft[s].min) : undefined
      const max = draft[s].max ? parseInt(draft[s].max) : undefined
      onSave(s, { min, max })
    }
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
            <div>
              <h2 className="text-slate-100 font-semibold text-base">WIP Limits</h2>
              <p className="text-slate-500 text-xs mt-0.5">Set min/max tasks per column. Leave blank to disable.</p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* legend */}
            <div className="flex items-center gap-4 text-xs text-slate-500 pb-1">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60 inline-block" /> Below min → yellow warning</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500/60 inline-block" /> Above max → red alert</span>
            </div>

            {(['todo', 'in-progress', 'done'] as TaskStatus[]).map(s => (
              <div key={s} className="bg-slate-800/50 border border-slate-800 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className={clsx('w-2 h-2 rounded-full',
                    s === 'todo' && 'bg-slate-500',
                    s === 'in-progress' && 'bg-blue-500',
                    s === 'done' && 'bg-green-500'
                  )} />
                  <span className="text-sm font-medium text-slate-200">{STATUS_LABELS[s]}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Min tasks</label>
                    <input
                      type="number"
                      min={0}
                      value={draft[s].min}
                      onChange={e => setDraft(d => ({ ...d, [s]: { ...d[s], min: e.target.value } }))}
                      placeholder="No minimum"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Max tasks</label>
                    <input
                      type="number"
                      min={0}
                      value={draft[s].max}
                      onChange={e => setDraft(d => ({ ...d, [s]: { ...d[s], max: e.target.value } }))}
                      placeholder="No maximum"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Save Limits
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Reminder Modal ───────────────────────────────────────────────────────────

interface ReminderModalProps {
  task: Task
  onClose: () => void
  onSave: (reminder: TaskReminder | undefined) => void
}

function ReminderModal({ task, onClose, onSave }: ReminderModalProps) {
  const existing = task.reminder
  const initMins = existing?.intervalMinutes ?? 60
  const [initCv, initCu] = minutesToCustom(initMins)

  const [mode,          setMode]          = useState<'once' | 'repeat'>(existing?.mode ?? 'once')
  const [nextAt,        setNextAt]        = useState(existing?.nextAt ?? new Date(Date.now() + 60 * 60_000).toISOString())
  const [intervalMins,  setIntervalMins]  = useState(initMins)
  const [customValue,   setCustomValue]   = useState(initCv)
  const [customUnit,    setCustomUnit]    = useState<'minutes' | 'hours' | 'days'>(initCu)

  function applyMinutes(mins: number) {
    setNextAt(new Date(Date.now() + mins * 60_000).toISOString())
    setIntervalMins(mins)
    const [v, u] = minutesToCustom(mins)
    setCustomValue(v)
    setCustomUnit(u)
  }

  const ONCE_PRESETS    = [{ label: '30 min', minutes: 30 }, { label: '1 hour', minutes: 60 }, { label: '2 hours', minutes: 120 }, { label: 'Tomorrow', minutes: 1440 }]
  const REPEAT_PRESETS  = [{ label: '30 min', minutes: 30 }, { label: '1 hour', minutes: 60 }, { label: '4 hours', minutes: 240 }, { label: 'Daily', minutes: 1440 }]

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Bell size={15} className="text-violet-400" />
            <h2 className="text-sm font-semibold text-slate-200">Set Reminder</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Task title */}
        <div className="px-5 pt-4 pb-1">
          <p className="text-xs text-slate-500 truncate">{task.title}</p>
        </div>

        {/* Body */}
        <div className="px-5 pb-5 space-y-3">

          {/* Mode tabs */}
          <div className="flex gap-1.5">
            {(['once', 'repeat'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={clsx(
                  'flex-1 py-2 text-xs font-medium rounded-lg border transition-all',
                  mode === m
                    ? 'bg-violet-600/20 border-violet-600/50 text-violet-400'
                    : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50',
                )}
              >
                {m === 'once' ? 'One-time' : 'Repeat'}
              </button>
            ))}
          </div>

          {/* Presets */}
          <div className="flex flex-wrap gap-1.5">
            {(mode === 'once' ? ONCE_PRESETS : REPEAT_PRESETS).map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyMinutes(p.minutes)}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 shrink-0">
              {mode === 'once' ? 'In' : 'Every'}
            </span>
            <input
              type="number"
              min={1}
              value={customValue}
              onChange={e => {
                const v = Math.max(1, parseInt(e.target.value) || 1)
                const mins = v * (customUnit === 'minutes' ? 1 : customUnit === 'hours' ? 60 : 1440)
                setCustomValue(v)
                setNextAt(new Date(Date.now() + mins * 60_000).toISOString())
                setIntervalMins(mins)
              }}
              className="input text-sm w-16"
            />
            <select
              value={customUnit}
              onChange={e => {
                const u = e.target.value as 'minutes' | 'hours' | 'days'
                const mins = customValue * (u === 'minutes' ? 1 : u === 'hours' ? 60 : 1440)
                setCustomUnit(u)
                setNextAt(new Date(Date.now() + mins * 60_000).toISOString())
                setIntervalMins(mins)
              }}
              className="input text-sm flex-1"
            >
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
              <option value="days">days</option>
            </select>
          </div>

          {/* Preview */}
          <p className="text-[11px] text-violet-400/80 bg-violet-500/5 border border-violet-500/10 rounded-lg px-3 py-2">
            {mode === 'once'
              ? `Fires at: ${format(new Date(nextAt), 'MMM d, yyyy — HH:mm')}`
              : `Every ${fmtInterval(intervalMins)} — first at ${format(new Date(nextAt), 'MMM d, HH:mm')}`
            }
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-800 bg-slate-950/30">
          {existing?.enabled ? (
            <button
              onClick={() => onSave(undefined)}
              className="text-xs text-red-500 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
            >
              Remove reminder
            </button>
          ) : <div />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-secondary text-sm py-2">Cancel</button>
            <button
              onClick={() => onSave({
                enabled: true,
                mode,
                nextAt,
                intervalMinutes: mode === 'repeat' ? intervalMins : undefined,
              })}
              className="btn-primary flex items-center gap-1.5 text-sm py-2"
            >
              <Bell size={13} />
              Save Reminder
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
