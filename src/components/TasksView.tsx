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
} from 'lucide-react'
import clsx from 'clsx'
import {
  priorityDot,
  priorityBg,
  statusBg,
  isOverdue,
  formatDate,
  generateId,
} from '../utils'
import type { Task, TaskStatus, Priority } from '../types'

type ViewMode = 'list' | 'kanban'
type TabFilter = 'all' | TaskStatus

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
  } = useStore()

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [tabFilter, setTabFilter] = useState<TabFilter>('all')
  const [quickCreate, setQuickCreate] = useState('')
  const quickCreateRef = useRef<HTMLInputElement>(null)

  const projectTasks = tasks[activeProjectId] ?? []

  const filtered = projectTasks.filter(t => {
    if (tabFilter === 'all') return true
    return t.status === tabFilter
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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-100">Tasks</h1>
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

      {viewMode === 'list' ? (
        <ListView
          tasks={projectTasks}
          filtered={filtered}
          tabFilter={tabFilter}
          setTabFilter={setTabFilter}
          TAB_ITEMS={TAB_ITEMS}
          quickCreate={quickCreate}
          setQuickCreate={setQuickCreate}
          handleQuickCreate={handleQuickCreate}
          quickCreateRef={quickCreateRef}
          projects={projects}
          onEdit={openTaskModal}
          onDelete={deleteTask}
          onStatusChange={(id, status) => updateTask(id, { status })}
          onMove={moveTaskToProject}
        />
      ) : (
        <KanbanView
          tasks={projectTasks}
          projects={projects}
          activeProjectId={activeProjectId}
          onEdit={openTaskModal}
          onDelete={deleteTask}
          onStatusChange={(id, status) => updateTask(id, { status })}
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
  TAB_ITEMS: { key: TabFilter; label: string }[]
  quickCreate: string
  setQuickCreate: (v: string) => void
  handleQuickCreate: (e: KeyboardEvent<HTMLInputElement>) => void
  quickCreateRef: React.RefObject<HTMLInputElement>
  projects: import('../types').Project[]
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: TaskStatus) => void
  onMove: (taskId: string, targetProjectId: string) => void
}

function ListView({
  tasks,
  filtered,
  tabFilter,
  setTabFilter,
  TAB_ITEMS,
  quickCreate,
  setQuickCreate,
  handleQuickCreate,
  quickCreateRef,
  projects,
  onEdit,
  onDelete,
  onStatusChange,
  onMove,
}: ListViewProps) {
  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4">
        {TAB_ITEMS.map(tab => {
          const count =
            tab.key === 'all'
              ? tasks.length
              : tasks.filter(t => t.status === tab.key).length
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
              <span className="text-xs bg-slate-700/80 text-slate-400 px-1.5 py-0.5 rounded">
                {count}
              </span>
            </button>
          )
        })}
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
              onEdit={() => onEdit(task)}
              onDelete={() => onDelete(task.id)}
              onStatusChange={status => onStatusChange(task.id, status)}
              onMove={targetId => onMove(task.id, targetId)}
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
  onEdit: () => void
  onDelete: () => void
  onStatusChange: (status: TaskStatus) => void
  onMove: (targetProjectId: string) => void
}

function TaskRow({ task, isLast, projects, onEdit, onDelete, onStatusChange, onMove }: TaskRowProps) {
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
        task.type === 'jira'
          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
          : 'bg-slate-700/60 text-slate-500 border-slate-700'
      )}>
        {task.type === 'jira' ? 'Jira' : 'Local'}
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
  onAdd: () => void
}

function KanbanView({ tasks, projects, activeProjectId, onEdit, onDelete, onStatusChange, onAdd }: KanbanViewProps) {
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

        return (
          <div
            key={col.status}
            onDragOver={e => handleDragOver(e, col.status)}
            onDrop={e => handleDrop(e, col.status)}
            onDragLeave={() => setDragOverStatus(null)}
            className={clsx(
              'bg-slate-900 rounded-xl border transition-all duration-150 flex flex-col',
              isDragOver ? 'border-blue-500/50 bg-blue-500/5' : 'border-slate-800'
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
              </div>
              <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                {colTasks.length}
              </span>
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
}

function KanbanCard({ task, isDragging, onDragStart, onDragEnd, onEdit, onDelete }: KanbanCardProps) {
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
