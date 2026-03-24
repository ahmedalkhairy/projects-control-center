import { useState } from 'react'
import { useStore } from '../store'
import {
  Plus, Trash2, ArrowRight, AlertTriangle, CheckCircle2,
  Circle, Clock, ChevronDown, X, Wrench,
} from 'lucide-react'
import clsx from 'clsx'
import type { TechDebtItem, TechDebtCategory, TechDebtEffort, Priority } from '../types'
import { format } from 'date-fns'
import { HelpButton } from './HelpButton'

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORIES: { value: TechDebtCategory; label: string; color: string; bg: string }[] = [
  { value: 'code-quality',   label: 'Code Quality',   color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/20' },
  { value: 'architecture',   label: 'Architecture',   color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/20' },
  { value: 'testing',        label: 'Testing',        color: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/20' },
  { value: 'security',       label: 'Security',       color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
  { value: 'performance',    label: 'Performance',    color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
  { value: 'documentation',  label: 'Documentation',  color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20' },
  { value: 'dependencies',   label: 'Dependencies',   color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20' },
]

const EFFORTS: { value: TechDebtEffort; label: string; detail: string }[] = [
  { value: 'small',  label: 'Small',  detail: '< 1 day' },
  { value: 'medium', label: 'Medium', detail: '1–3 days' },
  { value: 'large',  label: 'Large',  detail: '~ 1 week' },
  { value: 'epic',   label: 'Epic',   detail: '> 1 week' },
]

const PRIORITIES: Priority[] = ['critical', 'high', 'medium', 'low']

function categoryDef(cat: TechDebtCategory) {
  return CATEGORIES.find(c => c.value === cat) ?? CATEGORIES[0]
}

function priorityColor(p: Priority) {
  switch (p) {
    case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/20'
    case 'high':     return 'text-orange-400 bg-orange-500/10 border-orange-500/20'
    case 'medium':   return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
    case 'low':      return 'text-slate-400 bg-slate-500/10 border-slate-600/20'
  }
}

function effortColor(e: TechDebtEffort) {
  switch (e) {
    case 'small':  return 'text-emerald-400 bg-emerald-500/10'
    case 'medium': return 'text-blue-400 bg-blue-500/10'
    case 'large':  return 'text-orange-400 bg-orange-500/10'
    case 'epic':   return 'text-red-400 bg-red-500/10'
  }
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function TechDebtView() {
  const { activeProjectId, techDebt, addDebtItem, updateDebtItem, deleteDebtItem, convertDebtToTask } = useStore()

  const [showForm, setShowForm]       = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<TechDebtCategory | 'all'>('all')
  const [statusFilter, setStatusFilter]     = useState<TechDebtItem['status'] | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all')

  const projectDebt = techDebt.filter(d => d.projectId === activeProjectId)

  const filtered = projectDebt
    .filter(d => categoryFilter === 'all' || d.category === categoryFilter)
    .filter(d => statusFilter === 'all' || d.status === statusFilter)
    .filter(d => priorityFilter === 'all' || d.priority === priorityFilter)
    .sort((a, b) => {
      const statusOrder = { 'open': 0, 'in-progress': 1, 'resolved': 2 }
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      if (statusOrder[a.status] !== statusOrder[b.status])
        return statusOrder[a.status] - statusOrder[b.status]
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })

  // Stats
  const openCount     = projectDebt.filter(d => d.status === 'open').length
  const inProgCount   = projectDebt.filter(d => d.status === 'in-progress').length
  const resolvedCount = projectDebt.filter(d => d.status === 'resolved').length
  const criticalCount = projectDebt.filter(d => d.priority === 'critical' && d.status !== 'resolved').length

  return (
    <div className="p-6 max-w-5xl">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-lg font-semibold text-slate-100">Tech Debt Board</h1>
            <HelpButton
              title="Tech Debt Board"
              description="Track technical debt items that slow down development. Categorize and prioritize them so they don't get lost — and convert them to real tasks when you're ready to fix them."
              tips={[
                'Categories: code-quality, architecture, testing, security, performance, documentation, dependencies.',
                '"→ To Task" promotes a debt item to a trackable task in the project.',
                'Effort levels (Small/Medium/Large/Epic) help estimate the investment required.',
                'Filter by category to focus on a specific area during cleanup sprints.',
                'Resolved items are kept for history — they don\'t disappear.',
              ]}
            />
          </div>
          <p className="text-sm text-slate-500">Track and prioritize technical debt across the project.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus size={14} />
          Add Debt Item
        </button>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Open',        value: openCount,     color: 'text-rose-400',    icon: <Circle size={14} /> },
          { label: 'In Progress', value: inProgCount,   color: 'text-amber-400',   icon: <Clock size={14} /> },
          { label: 'Resolved',    value: resolvedCount, color: 'text-emerald-400', icon: <CheckCircle2 size={14} /> },
          { label: 'Critical',    value: criticalCount, color: 'text-red-400',     icon: <AlertTriangle size={14} /> },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className={clsx('flex items-center gap-1.5 text-xs mb-1', s.color)}>
              {s.icon}
              {s.label}
            </div>
            <p className="text-2xl font-bold text-slate-100">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2 mb-5">
        {/* Category filter */}
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
          <button
            onClick={() => setCategoryFilter('all')}
            className={clsx('px-2.5 py-1 rounded-md text-xs font-medium transition-colors', categoryFilter === 'all' ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300')}
          >
            All
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setCategoryFilter(c.value)}
              className={clsx('px-2.5 py-1 rounded-md text-xs font-medium transition-colors', categoryFilter === c.value ? `bg-slate-700 ${c.color}` : 'text-slate-500 hover:text-slate-300')}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
          className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-slate-600"
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="in-progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>

        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value as typeof priorityFilter)}
          className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-slate-600"
        >
          <option value="all">All Priorities</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>
      </div>

      {/* ── Add Form ── */}
      {showForm && (
        <AddDebtForm
          projectId={activeProjectId}
          onAdd={(item) => { addDebtItem(item); setShowForm(false) }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* ── Debt list ── */}
      {filtered.length === 0 ? (
        <EmptyState onAdd={() => setShowForm(true)} hasFilter={categoryFilter !== 'all' || statusFilter !== 'all' || priorityFilter !== 'all'} />
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <DebtCard
              key={item.id}
              item={item}
              onUpdate={(updates) => updateDebtItem(item.id, updates)}
              onDelete={() => deleteDebtItem(item.id)}
              onConvert={() => convertDebtToTask(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd, hasFilter }: { onAdd: () => void; hasFilter: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mb-4">
        <Wrench size={28} className="text-slate-600" />
      </div>
      <p className="text-sm font-medium text-slate-400 mb-1">
        {hasFilter ? 'No items match your filters' : 'No tech debt items yet'}
      </p>
      <p className="text-xs text-slate-600 mb-5 max-w-xs">
        {hasFilter ? 'Try adjusting your filters.' : 'Start tracking technical debt to keep your codebase healthy.'}
      </p>
      {!hasFilter && (
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={14} />
          Add First Item
        </button>
      )}
    </div>
  )
}

// ─── Debt Card ────────────────────────────────────────────────────────────────

interface DebtCardProps {
  item: TechDebtItem
  onUpdate: (updates: Partial<TechDebtItem>) => void
  onDelete: () => void
  onConvert: () => void
}

function DebtCard({ item, onUpdate, onDelete, onConvert }: DebtCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [converted, setConverted] = useState(!!item.taskId)
  const cat = categoryDef(item.category)

  function cycleStatus() {
    const next: Record<TechDebtItem['status'], TechDebtItem['status']> = {
      'open': 'in-progress',
      'in-progress': 'resolved',
      'resolved': 'open',
    }
    onUpdate({ status: next[item.status] })
  }

  function handleConvert() {
    onConvert()
    setConverted(true)
  }

  const statusIcon = {
    'open':        <Circle size={14} className="text-slate-500" />,
    'in-progress': <Clock size={14} className="text-amber-400" />,
    'resolved':    <CheckCircle2 size={14} className="text-emerald-400" />,
  }

  return (
    <div className={clsx(
      'bg-slate-900 border rounded-xl overflow-hidden transition-all',
      item.status === 'resolved' ? 'border-slate-800 opacity-60' : 'border-slate-800 hover:border-slate-700'
    )}>
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Status toggle */}
        <button
          onClick={cycleStatus}
          className="flex-shrink-0 hover:scale-110 transition-transform"
          title={`Status: ${item.status} — click to advance`}
        >
          {statusIcon[item.status]}
        </button>

        {/* Title + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={clsx('text-sm font-medium', item.status === 'resolved' ? 'line-through text-slate-500' : 'text-slate-100')}>
              {item.title}
            </span>

            {/* Category */}
            <span className={clsx('text-xs px-2 py-0.5 rounded-full border font-medium', cat.bg, cat.color)}>
              {cat.label}
            </span>

            {/* Priority */}
            <span className={clsx('text-xs px-2 py-0.5 rounded-full border font-medium capitalize', priorityColor(item.priority))}>
              {item.priority}
            </span>

            {/* Effort */}
            <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', effortColor(item.effort))}>
              {EFFORTS.find(e => e.value === item.effort)?.label} ({EFFORTS.find(e => e.value === item.effort)?.detail})
            </span>

            {/* Affected area */}
            {item.affectedArea && (
              <span className="text-xs text-slate-500 font-mono">
                📁 {item.affectedArea}
              </span>
            )}
          </div>

          {/* Description preview */}
          {!expanded && item.description && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{item.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Convert to Task */}
          {item.status !== 'resolved' && (
            <button
              onClick={handleConvert}
              disabled={converted}
              title={converted ? 'Already converted to task' : 'Convert to Task'}
              className={clsx(
                'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-colors',
                converted
                  ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5 cursor-default'
                  : 'text-violet-400 border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10'
              )}
            >
              {converted ? <CheckCircle2 size={11} /> : <ArrowRight size={11} />}
              {converted ? 'Tasked' : 'To Task'}
            </button>
          )}

          {/* Expand/collapse */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-slate-600 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ChevronDown size={13} className={clsx('transition-transform', expanded && 'rotate-180')} />
          </button>

          {/* Delete */}
          <button
            onClick={onDelete}
            className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-800 mt-1">
          <div className="pt-3 space-y-3">
            {item.description && (
              <p className="text-sm text-slate-400 leading-relaxed">{item.description}</p>
            )}

            {/* Inline edit fields */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-600 mb-1 block">Category</label>
                <select
                  value={item.category}
                  onChange={e => onUpdate({ category: e.target.value as TechDebtCategory })}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                >
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-1 block">Priority</label>
                <select
                  value={item.priority}
                  onChange={e => onUpdate({ priority: e.target.value as Priority })}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                >
                  {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-1 block">Effort</label>
                <select
                  value={item.effort}
                  onChange={e => onUpdate({ effort: e.target.value as TechDebtEffort })}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                >
                  {EFFORTS.map(ef => <option key={ef.value} value={ef.value}>{ef.label} ({ef.detail})</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-600 mb-1 block">Affected Area</label>
              <input
                type="text"
                value={item.affectedArea ?? ''}
                onChange={e => onUpdate({ affectedArea: e.target.value || undefined })}
                placeholder="e.g. auth module, payment service…"
                className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 placeholder-slate-600 focus:outline-none focus:border-slate-600"
              />
            </div>

            <div>
              <label className="text-xs text-slate-600 mb-1 block">Description</label>
              <textarea
                value={item.description ?? ''}
                onChange={e => onUpdate({ description: e.target.value || undefined })}
                placeholder="Describe the issue, impact, and suggested fix…"
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 placeholder-slate-600 focus:outline-none focus:border-slate-600 resize-none leading-relaxed"
              />
            </div>

            <p className="text-xs text-slate-600">
              Added {format(new Date(item.createdAt), 'MMM d, yyyy')}
              {item.updatedAt !== item.createdAt && ` · Updated ${format(new Date(item.updatedAt), 'MMM d')}`}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Add Debt Form ────────────────────────────────────────────────────────────

interface AddDebtFormProps {
  projectId: string
  onAdd: (item: Omit<TechDebtItem, 'id' | 'createdAt' | 'updatedAt'>) => void
  onCancel: () => void
}

function AddDebtForm({ projectId, onAdd, onCancel }: AddDebtFormProps) {
  const [title, setTitle]           = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory]     = useState<TechDebtCategory>('code-quality')
  const [priority, setPriority]     = useState<Priority>('medium')
  const [effort, setEffort]         = useState<TechDebtEffort>('medium')
  const [affectedArea, setAffectedArea] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({
      projectId,
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      priority,
      effort,
      status: 'open',
      affectedArea: affectedArea.trim() || undefined,
    })
  }

  return (
    <div className="bg-slate-900 border border-rose-500/30 rounded-xl p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-100">New Tech Debt Item</h3>
        <button onClick={onCancel} className="p-1 text-slate-500 hover:text-slate-300">
          <X size={14} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Describe the tech debt issue…"
          autoFocus
          className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-rose-500/50"
        />

        {/* Grid: category / priority / effort */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as TechDebtCategory)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
            >
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Priority</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as Priority)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
            >
              {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Effort</label>
            <select
              value={effort}
              onChange={e => setEffort(e.target.value as TechDebtEffort)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
            >
              {EFFORTS.map(ef => <option key={ef.value} value={ef.value}>{ef.label} ({ef.detail})</option>)}
            </select>
          </div>
        </div>

        {/* Affected area */}
        <input
          type="text"
          value={affectedArea}
          onChange={e => setAffectedArea(e.target.value)}
          placeholder="Affected area (optional) — e.g. auth module, payment gateway…"
          className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-slate-600"
        />

        {/* Description */}
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Description — impact, root cause, suggested fix… (optional)"
          rows={3}
          className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-slate-600 resize-none leading-relaxed"
        />

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={!title.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={13} />
            Add Item
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
