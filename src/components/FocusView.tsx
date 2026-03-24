import { useState } from 'react'
import { useStore, cycleTaskStatus } from '../store'
import {
  Target, X, Plus, CheckSquare, Calendar, Tag,
  ChevronDown, ChevronUp, Search,
} from 'lucide-react'
import { HelpButton } from './HelpButton'
import clsx from 'clsx'
import { format } from 'date-fns'
import { priorityDot, priorityBg, statusBg, isOverdue, formatDate } from '../utils'
import type { Task, TaskStatus, Priority } from '../types'

const MAX_FOCUS = 5

export default function FocusView() {
  const {
    projects,
    tasks,
    focusTaskIds,
    addToFocus,
    removeFromFocus,
    clearFocus,
    updateTask,
  } = useStore()

  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')

  // Resolve focus tasks (cross-project)
  const allTasks = Object.values(tasks).flat()
  const focusTasks = focusTaskIds
    .map(id => allTasks.find(t => t.id === id))
    .filter((t): t is Task => !!t)

  const doneTasks = focusTasks.filter(t => t.status === 'done')
  const activeTasks = focusTasks.filter(t => t.status !== 'done')

  // Picker: all non-done tasks not already in focus, filtered by search
  const pickerTasks = allTasks.filter(t =>
    t.status !== 'done' &&
    !focusTaskIds.includes(t.id) &&
    (search === '' || t.title.toLowerCase().includes(search.toLowerCase()))
  )

  const today = format(new Date(), 'EEEE, MMM d')

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Target size={18} className="text-amber-400" />
            <h1 className="text-lg font-semibold text-slate-100">Today's Focus</h1>
            <span className="text-xs text-slate-500 font-normal">{today}</span>
            <HelpButton
              title="Today's Focus"
              description="Your personal daily priority board. Pin the tasks you need to finish today so they stay front and center — across all projects."
              tips={[
                'Add up to 5 tasks from any project to your focus list.',
                'Tick off tasks directly here without switching to the Tasks view.',
                'Focus resets each session — re-pin what matters most each morning.',
                'Use this as your morning ritual: review, pick 3-5 tasks, execute.',
              ]}
            />
          </div>
          <p className="text-xs text-slate-500 ml-[26px]">
            {focusTasks.length === 0
              ? 'Pick up to 5 tasks to focus on today'
              : `${doneTasks.length} of ${focusTasks.length} done`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {focusTasks.length > 0 && (
            <button
              onClick={clearFocus}
              className="text-xs text-slate-500 hover:text-slate-300 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Clear all
            </button>
          )}
          <button
            onClick={() => setPickerOpen(true)}
            disabled={focusTaskIds.length >= MAX_FOCUS}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              focusTaskIds.length >= MAX_FOCUS
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                : 'bg-amber-500 hover:bg-amber-400 text-white',
            )}
          >
            <Plus size={14} />
            Add Task
            {focusTaskIds.length > 0 && (
              <span className="text-xs opacity-70">{focusTaskIds.length}/{MAX_FOCUS}</span>
            )}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {focusTasks.length > 0 && (
        <div className="mb-5 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-500"
            style={{ width: `${(doneTasks.length / focusTasks.length) * 100}%` }}
          />
        </div>
      )}

      {/* Empty state */}
      {focusTasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
            <Target size={28} className="text-slate-600" />
          </div>
          <p className="text-slate-400 font-medium mb-1">No focus tasks yet</p>
          <p className="text-slate-600 text-sm mb-5">
            Add up to {MAX_FOCUS} tasks from any project to focus on today
          </p>
          <button
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={14} />
            Pick tasks
          </button>
        </div>
      )}

      {/* Active tasks */}
      {activeTasks.length > 0 && (
        <div className="space-y-2 mb-4">
          {activeTasks.map(task => (
            <FocusTaskCard
              key={task.id}
              task={task}
              projects={projects}
              onStatusChange={status => updateTask(task.id, { status })}
              onRemove={() => removeFromFocus(task.id)}
            />
          ))}
        </div>
      )}

      {/* Done tasks */}
      {doneTasks.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-slate-600 font-medium uppercase tracking-wider mb-2 px-1">
            Completed today
          </p>
          <div className="space-y-2">
            {doneTasks.map(task => (
              <FocusTaskCard
                key={task.id}
                task={task}
                projects={projects}
                onStatusChange={status => updateTask(task.id, { status })}
                onRemove={() => removeFromFocus(task.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Task Picker Modal */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setPickerOpen(false) }}
        >
          <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl flex flex-col max-h-[70vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Target size={15} className="text-amber-400" />
                <h2 className="text-sm font-semibold text-slate-200">Add to Focus</h2>
                <span className="text-xs text-slate-500">{focusTaskIds.length}/{MAX_FOCUS} selected</span>
              </div>
              <button
                onClick={() => setPickerOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2">
                <Search size={13} className="text-slate-500 flex-shrink-0" />
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search tasks…"
                  className="flex-1 bg-transparent text-sm text-slate-300 placeholder-slate-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Task list */}
            <div className="overflow-y-auto flex-1 p-2">
              {pickerTasks.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-600">
                  {search ? 'No tasks match your search' : 'All tasks are already in focus or done'}
                </div>
              ) : (
                Object.entries(
                  pickerTasks.reduce<Record<string, Task[]>>((acc, t) => {
                    const proj = projects.find(p => p.id === t.projectId)
                    const key = proj?.name ?? 'Unknown'
                    acc[key] = [...(acc[key] ?? []), t]
                    return acc
                  }, {})
                ).map(([projectName, ptasks]) => {
                  const proj = projects.find(p => p.name === projectName)
                  return (
                    <div key={projectName} className="mb-3">
                      <div className="flex items-center gap-1.5 px-2 py-1 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: proj?.color ?? '#64748b' }} />
                        <span className="text-xs font-medium text-slate-500">{projectName}</span>
                      </div>
                      {ptasks.map(t => (
                        <button
                          key={t.id}
                          onClick={() => {
                            if (focusTaskIds.length < MAX_FOCUS) {
                              addToFocus(t.id)
                            }
                          }}
                          disabled={focusTaskIds.length >= MAX_FOCUS}
                          className={clsx(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors mb-0.5',
                            focusTaskIds.length >= MAX_FOCUS
                              ? 'opacity-40 cursor-not-allowed'
                              : 'hover:bg-slate-800',
                          )}
                        >
                          <div className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', priorityDot(t.priority as Priority))} />
                          <span className="flex-1 text-sm text-slate-300 truncate">{t.title}</span>
                          <span className={clsx('text-xs px-1.5 py-0.5 rounded border flex-shrink-0', statusBg(t.status))}>
                            {t.status}
                          </span>
                        </button>
                      ))}
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-800 flex-shrink-0">
              <button
                onClick={() => setPickerOpen(false)}
                className="w-full btn-primary text-sm py-2"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Focus Task Card ──────────────────────────────────────────────────────────

interface FocusTaskCardProps {
  task: Task
  projects: import('../types').Project[]
  onStatusChange: (status: TaskStatus) => void
  onRemove: () => void
}

function FocusTaskCard({ task, projects, onStatusChange, onRemove }: FocusTaskCardProps) {
  const project = projects.find(p => p.id === task.projectId)
  const isDone = task.status === 'done'
  const overdue = task.dueDate && !isDone && isOverdue(task.dueDate)

  return (
    <div className={clsx(
      'flex items-center gap-3 px-4 py-3.5 bg-slate-900 border rounded-xl transition-all group',
      isDone ? 'border-slate-800 opacity-60' : 'border-slate-700 hover:border-slate-600',
    )}>
      {/* Status checkbox */}
      <button
        onClick={() => onStatusChange(cycleTaskStatus(task.status))}
        className={clsx(
          'w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all',
          isDone
            ? 'bg-amber-500 border-amber-500'
            : task.status === 'in-progress'
            ? 'border-blue-500 bg-blue-500/20'
            : 'border-slate-600 hover:border-amber-400',
        )}
        title={`Status: ${task.status}`}
      >
        {isDone && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {task.status === 'in-progress' && <div className="w-2 h-2 rounded-full bg-blue-400" />}
      </button>

      {/* Priority dot */}
      <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', priorityDot(task.priority as Priority))} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={clsx(
          'text-sm font-medium truncate',
          isDone ? 'line-through text-slate-500' : 'text-slate-200',
        )}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {project && (
            <span className="flex items-center gap-1 text-xs text-slate-600">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: project.color }} />
              {project.name}
            </span>
          )}
          {task.dueDate && (
            <span className={clsx('flex items-center gap-0.5 text-xs', overdue ? 'text-red-400' : 'text-slate-600')}>
              <Calendar size={10} />
              {formatDate(task.dueDate)}
            </span>
          )}
        </div>
      </div>

      {/* Priority + status badges */}
      <span className={clsx('badge text-xs border flex-shrink-0', priorityBg(task.priority as Priority))}>
        {task.priority}
      </span>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="p-1 text-slate-600 hover:text-slate-300 hover:bg-slate-800 rounded opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
        title="Remove from focus"
      >
        <X size={13} />
      </button>
    </div>
  )
}
