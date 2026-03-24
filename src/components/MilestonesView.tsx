import { useState } from 'react'
import { useStore } from '../store'
import {
  Flag, Plus, Trash2, X, Check, ChevronDown,
  AlertTriangle, CheckCircle2, Circle, Clock,
  Link2, Unlink,
} from 'lucide-react'
import clsx from 'clsx'
import type { Milestone, MilestoneStatus, Task } from '../types'
import { format, differenceInDays, isPast, parseISO } from 'date-fns'
import { HelpButton } from './HelpButton'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeStatus(milestone: Milestone, tasks: Task[]): MilestoneStatus {
  const linked = tasks.filter(t => milestone.linkedTaskIds.includes(t.id))
  if (linked.length === 0) return milestone.status

  const done  = linked.filter(t => t.status === 'done').length
  const total = linked.length
  const progress = total > 0 ? done / total : 0

  if (progress >= 1)           return 'completed'
  if (isPast(parseISO(milestone.dueDate))) return 'delayed'

  const daysLeft = differenceInDays(parseISO(milestone.dueDate), new Date())
  if (daysLeft <= 7 && progress < 0.5)  return 'at-risk'
  return 'on-track'
}

function statusConfig(s: MilestoneStatus) {
  switch (s) {
    case 'on-track':  return { label: 'On Track',   icon: <Circle size={12} />,         color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' }
    case 'at-risk':   return { label: 'At Risk',    icon: <AlertTriangle size={12} />,  color: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/30' }
    case 'delayed':   return { label: 'Delayed',    icon: <AlertTriangle size={12} />,  color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30' }
    case 'completed': return { label: 'Completed',  icon: <CheckCircle2 size={12} />,   color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/30' }
  }
}

function progressColor(status: MilestoneStatus) {
  switch (status) {
    case 'completed': return 'bg-blue-500'
    case 'on-track':  return 'bg-emerald-500'
    case 'at-risk':   return 'bg-yellow-500'
    case 'delayed':   return 'bg-red-500'
  }
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function MilestonesView() {
  const {
    activeProjectId, milestones, tasks,
    addMilestone, updateMilestone, deleteMilestone,
    linkTaskToMilestone, unlinkTaskFromMilestone,
  } = useStore()

  const [showForm, setShowForm] = useState(false)
  const [statusFilter, setStatusFilter] = useState<MilestoneStatus | 'all'>('all')

  const projectMilestones = milestones
    .filter(m => m.projectId === activeProjectId)
    .filter(m => statusFilter === 'all' || computeStatus(m, tasks[activeProjectId] ?? []) === statusFilter)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

  const allProjectTasks = tasks[activeProjectId] ?? []

  // Stats
  const allMs = milestones.filter(m => m.projectId === activeProjectId)
  const stats = {
    total:     allMs.length,
    onTrack:   allMs.filter(m => computeStatus(m, allProjectTasks) === 'on-track').length,
    atRisk:    allMs.filter(m => computeStatus(m, allProjectTasks) === 'at-risk').length,
    delayed:   allMs.filter(m => computeStatus(m, allProjectTasks) === 'delayed').length,
    completed: allMs.filter(m => computeStatus(m, allProjectTasks) === 'completed').length,
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-lg font-semibold text-slate-100">Milestone Tracker</h1>
            <HelpButton
              title="Milestone Tracker"
              description="Track project milestones and see how much progress has been made based on linked tasks. Milestones help you communicate delivery targets to stakeholders."
              tips={[
                'Create a milestone with a title and due date.',
                'Link tasks to a milestone — progress is calculated from their completion rate.',
                'Status (On Track / At Risk / Delayed) is computed automatically from task progress and due date proximity.',
                'A milestone within 7 days of its due date with <50% completion shows as At Risk.',
                'Completed milestones move to the Completed category and stay for history.',
              ]}
            />
          </div>
          <p className="text-sm text-slate-500">Track key deliverables and deadlines.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus size={14} />
          Add Milestone
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total',     value: stats.total,     color: 'text-slate-300' },
          { label: 'On Track',  value: stats.onTrack,   color: 'text-emerald-400' },
          { label: 'At Risk',   value: stats.atRisk,    color: 'text-yellow-400' },
          { label: 'Delayed',   value: stats.delayed,   color: 'text-red-400' },
          { label: 'Completed', value: stats.completed, color: 'text-blue-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
            <p className={clsx('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-slate-600 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 mb-5 w-fit">
        {(['all', 'on-track', 'at-risk', 'delayed', 'completed'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={clsx(
              'px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize',
              statusFilter === s ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'
            )}
          >
            {s === 'all' ? 'All' : statusConfig(s as MilestoneStatus).label}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <AddMilestoneForm
          projectId={activeProjectId}
          onAdd={(m) => { addMilestone(m); setShowForm(false) }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Milestones list */}
      {projectMilestones.length === 0 ? (
        <EmptyState hasFilter={statusFilter !== 'all'} onAdd={() => setShowForm(true)} />
      ) : (
        <div className="space-y-3">
          {projectMilestones.map(m => (
            <MilestoneCard
              key={m.id}
              milestone={m}
              allTasks={allProjectTasks}
              onUpdate={(u) => updateMilestone(m.id, u)}
              onDelete={() => deleteMilestone(m.id)}
              onLinkTask={(tid) => linkTaskToMilestone(m.id, tid)}
              onUnlinkTask={(tid) => unlinkTaskFromMilestone(m.id, tid)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ hasFilter, onAdd }: { hasFilter: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mb-4">
        <Flag size={28} className="text-slate-600" />
      </div>
      <p className="text-sm font-medium text-slate-400 mb-1">
        {hasFilter ? 'No milestones match the filter' : 'No milestones yet'}
      </p>
      <p className="text-xs text-slate-600 mb-5">
        {hasFilter ? 'Try a different status filter.' : 'Add milestones to track key deliverables and deadlines.'}
      </p>
      {!hasFilter && (
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={14} />
          Add First Milestone
        </button>
      )}
    </div>
  )
}

// ─── Milestone Card ───────────────────────────────────────────────────────────

interface MilestoneCardProps {
  milestone: Milestone
  allTasks: Task[]
  onUpdate: (u: Partial<Milestone>) => void
  onDelete: () => void
  onLinkTask: (taskId: string) => void
  onUnlinkTask: (taskId: string) => void
}

function MilestoneCard({ milestone, allTasks, onUpdate, onDelete, onLinkTask, onUnlinkTask }: MilestoneCardProps) {
  const [expanded, setExpanded]   = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')

  const linkedTasks = allTasks.filter(t => milestone.linkedTaskIds.includes(t.id))
  const doneTasks   = linkedTasks.filter(t => t.status === 'done')
  const progress    = linkedTasks.length > 0 ? Math.round((doneTasks.length / linkedTasks.length) * 100) : 0
  const status      = computeStatus(milestone, allTasks)
  const cfg         = statusConfig(status)

  const daysLeft    = differenceInDays(parseISO(milestone.dueDate), new Date())
  const isOverdue   = isPast(parseISO(milestone.dueDate)) && status !== 'completed'

  const unlinkedTasks = allTasks
    .filter(t => !milestone.linkedTaskIds.includes(t.id))
    .filter(t => !pickerSearch || t.title.toLowerCase().includes(pickerSearch.toLowerCase()))
    .slice(0, 10)

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors">
      {/* Main row */}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Status badge */}
        <div className={clsx('flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium flex-shrink-0', cfg.bg, cfg.color)}>
          {cfg.icon}
          {cfg.label}
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <p className={clsx('text-sm font-semibold', status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-100')}>
            {milestone.title}
          </p>
          {milestone.description && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{milestone.description}</p>
          )}
        </div>

        {/* Progress */}
        <div className="w-36 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">{doneTasks.length}/{linkedTasks.length} tasks</span>
            <span className={clsx('text-xs font-semibold', cfg.color)}>{progress}%</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={clsx('h-full rounded-full transition-all', progressColor(status))}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Due date */}
        <div className="flex-shrink-0 text-right">
          <p className={clsx('text-xs font-medium', isOverdue ? 'text-red-400' : 'text-slate-400')}>
            {format(parseISO(milestone.dueDate), 'MMM d, yyyy')}
          </p>
          <p className={clsx('text-xs mt-0.5', isOverdue ? 'text-red-500' : daysLeft <= 7 ? 'text-yellow-500' : 'text-slate-600')}>
            {status === 'completed' ? '✓ Done' : isOverdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
          </p>
        </div>

        {/* Expand */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 text-slate-600 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
        >
          <ChevronDown size={14} className={clsx('transition-transform', expanded && 'rotate-180')} />
        </button>

        {/* Delete */}
        <button onClick={onDelete} className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0">
          <Trash2 size={13} />
        </button>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-slate-800 px-5 py-4 space-y-4">
          {/* Edit fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Title</label>
              <input
                type="text"
                value={milestone.title}
                onChange={e => onUpdate({ title: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Due Date</label>
              <input
                type="date"
                value={milestone.dueDate.slice(0, 10)}
                onChange={e => onUpdate({ dueDate: new Date(e.target.value).toISOString() })}
                className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1 block">Description</label>
            <textarea
              value={milestone.description ?? ''}
              onChange={e => onUpdate({ description: e.target.value || undefined })}
              rows={2}
              placeholder="Optional description…"
              className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 placeholder-slate-600 focus:outline-none resize-none"
            />
          </div>

          {/* Linked tasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-500">Linked Tasks ({linkedTasks.length})</label>
              <button
                onClick={() => setShowPicker(!showPicker)}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                <Link2 size={11} />
                Link Task
              </button>
            </div>

            {linkedTasks.length > 0 ? (
              <div className="space-y-1">
                {linkedTasks.map(t => (
                  <div key={t.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-800/50 rounded-lg">
                    <div className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0',
                      t.status === 'done' ? 'bg-emerald-500' :
                      t.status === 'in-progress' ? 'bg-blue-500' : 'bg-slate-600'
                    )} />
                    <span className={clsx('flex-1 text-xs truncate', t.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-300')}>
                      {t.title.replace(/^\[.*?\]\s*/, '')}
                    </span>
                    <span className="text-xs text-slate-600 capitalize">{t.status}</span>
                    <button onClick={() => onUnlinkTask(t.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                      <Unlink size={11} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600 italic">No tasks linked yet.</p>
            )}

            {/* Task picker */}
            {showPicker && (
              <div className="mt-2 bg-slate-800 border border-slate-700 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={pickerSearch}
                    onChange={e => setPickerSearch(e.target.value)}
                    placeholder="Search tasks…"
                    autoFocus
                    className="flex-1 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 placeholder-slate-600 focus:outline-none"
                  />
                  <button onClick={() => setShowPicker(false)} className="text-slate-500 hover:text-slate-300">
                    <X size={13} />
                  </button>
                </div>
                {unlinkedTasks.length === 0 ? (
                  <p className="text-xs text-slate-600 py-2 text-center">No more tasks to link.</p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {unlinkedTasks.map(t => (
                      <button
                        key={t.id}
                        onClick={() => { onLinkTask(t.id); setPickerSearch('') }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-700 rounded-lg text-left transition-colors"
                      >
                        <div className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0',
                          t.status === 'done' ? 'bg-emerald-500' :
                          t.status === 'in-progress' ? 'bg-blue-500' : 'bg-slate-600'
                        )} />
                        <span className="flex-1 text-xs text-slate-300 truncate">{t.title.replace(/^\[.*?\]\s*/, '')}</span>
                        <span className="text-xs text-slate-600 capitalize">{t.priority}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Add Milestone Form ───────────────────────────────────────────────────────

interface AddMilestoneFormProps {
  projectId: string
  onAdd: (m: Omit<Milestone, 'id' | 'createdAt' | 'updatedAt'>) => void
  onCancel: () => void
}

function AddMilestoneForm({ projectId, onAdd, onCancel }: AddMilestoneFormProps) {
  const [title, setTitle]   = useState('')
  const [desc, setDesc]     = useState('')
  const [dueDate, setDueDate] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !dueDate) return
    onAdd({
      projectId,
      title: title.trim(),
      description: desc.trim() || undefined,
      dueDate: new Date(dueDate).toISOString(),
      status: 'on-track',
      linkedTaskIds: [],
    })
  }

  return (
    <div className="bg-slate-900 border border-blue-500/30 rounded-xl p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-100">New Milestone</h3>
        <button onClick={onCancel} className="p-1 text-slate-500 hover:text-slate-300"><X size={14} /></button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Milestone title…"
          autoFocus
          className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Due Date *</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Description</label>
            <input
              type="text"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Optional…"
              className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 placeholder-slate-600 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={!title.trim() || !dueDate}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Check size={13} />
            Add Milestone
          </button>
          <button type="button" onClick={onCancel} className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm rounded-lg transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
