import { useState } from 'react'
import { useStore } from '../store'
import type { LucideIcon } from 'lucide-react'
import {
  Zap,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  Save,
  X,
  Trello,
  Globe,
  Cloud,
  Activity,
  BarChart2,
  BarChart,
  Bell,
  Box,
  GitBranch,
  Package,
  Layers,
  MessageSquare,
  LifeBuoy,
  Users,
  TrendingUp,
  Triangle,
  Github,
} from 'lucide-react'
import clsx from 'clsx'
import { generateId } from '../utils'
import type { QuickAction } from '../types'
import { HelpButton } from './HelpButton'

// icon registry
const ICON_MAP: Record<string, LucideIcon> = {
  Trello,
  Globe,
  Cloud,
  Activity,
  BarChart2,
  BarChart,
  Bell,
  Box,
  GitBranch,
  Package,
  Layers,
  MessageSquare,
  LifeBuoy,
  Users,
  TrendingUp,
  Triangle,
  Github,
  Zap,
}

const ICON_OPTIONS = Object.keys(ICON_MAP)

const COLOR_OPTIONS = [
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Green', value: '#10b981' },
  { label: 'Purple', value: '#8b5cf6' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Yellow', value: '#f59e0b' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Gray', value: '#6b7280' },
  { label: 'Slate', value: '#475569' },
]

function ActionIcon({ name, size = 20, style }: { name: string; size?: number; style?: React.CSSProperties }) {
  const Icon = ICON_MAP[name] ?? Globe
  return <Icon size={size} style={style} />
}

interface AddActionForm {
  label: string
  url: string
  icon: string
  group: string
  color: string
  newGroup: string
}

const EMPTY_FORM: AddActionForm = {
  label: '',
  url: '',
  icon: 'Globe',
  group: '',
  color: '#3b82f6',
  newGroup: '',
}

export default function QuickActionsView() {
  const {
    activeProjectId,
    quickActions,
    addQuickAction,
    updateQuickAction,
    deleteQuickAction,
  } = useStore()

  const [editMode, setEditMode] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<AddActionForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<AddActionForm>(EMPTY_FORM)

  const actions = quickActions[activeProjectId] ?? []

  // Group actions
  const groups = Array.from(new Set(actions.map(a => a.group)))

  function handleAdd() {
    if (!addForm.label.trim() || !addForm.url.trim()) return
    const groupName = addForm.newGroup.trim() || addForm.group
    if (!groupName) return
    addQuickAction({
      projectId: activeProjectId,
      label: addForm.label.trim(),
      url: addForm.url.trim(),
      icon: addForm.icon,
      group: groupName,
      color: addForm.color,
      order: actions.length,
    })
    setAddForm(EMPTY_FORM)
    setShowAddForm(false)
  }

  function startEdit(action: QuickAction) {
    setEditingId(action.id)
    setEditForm({
      label: action.label,
      url: action.url,
      icon: action.icon,
      group: action.group,
      color: action.color,
      newGroup: '',
    })
  }

  function saveEdit(id: string) {
    const groupName = editForm.newGroup.trim() || editForm.group
    updateQuickAction(id, {
      label: editForm.label,
      url: editForm.url,
      icon: editForm.icon,
      group: groupName,
      color: editForm.color,
    })
    setEditingId(null)
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-100">Quick Actions</h1>
          <HelpButton
            title="Quick Actions"
            description="A customizable launchpad of external links and shortcuts. Keep your most-used tools — dashboards, monitoring, docs, deploys — one click away."
            tips={[
              'Add links to Grafana, Sentry, Confluence, deployment pipelines, etc.',
              'Organize links into groups (e.g. Monitoring, Docs, DevOps).',
              'Drag-to-reorder lets you arrange links by priority.',
              'Each action opens in a new browser tab.',
              'One link pad per project — customize it per context.',
            ]}
          />
          <span className="text-xs text-slate-500">{actions.length} links</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowAddForm(true); setEditMode(false) }}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors border border-slate-800"
          >
            <Plus size={14} />
            Add Action
          </button>
          <button
            onClick={() => setEditMode(!editMode)}
            className={clsx(
              'flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors border',
              editMode
                ? 'bg-blue-600/20 text-blue-400 border-blue-600/40 hover:bg-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border-slate-800'
            )}
          >
            <Edit2 size={14} />
            {editMode ? 'Done Editing' : 'Edit Mode'}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="mb-6 bg-slate-900 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-200">New Quick Action</span>
            <button onClick={() => setShowAddForm(false)} className="text-slate-500 hover:text-slate-300">
              <X size={14} />
            </button>
          </div>
          <ActionForm
            form={addForm}
            onChange={setAddForm}
            groups={groups}
            onSave={handleAdd}
            onCancel={() => { setShowAddForm(false); setAddForm(EMPTY_FORM) }}
            saveLabel="Add Action"
          />
        </div>
      )}

      {/* Groups */}
      {actions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
            <Zap size={28} className="text-slate-600" />
          </div>
          <p className="text-slate-400 font-medium">No quick actions</p>
          <p className="text-slate-600 text-sm mt-1">Add your first link to get started</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(group => {
            const groupActions = actions.filter(a => a.group === group)
            return (
              <div key={group}>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {group}
                  </h2>
                  <div className="flex-1 h-px bg-slate-800" />
                  <span className="text-xs text-slate-600">{groupActions.length}</span>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {groupActions.map(action => (
                    <div key={action.id}>
                      {editingId === action.id ? (
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-3">
                          <ActionForm
                            form={editForm}
                            onChange={setEditForm}
                            groups={groups}
                            onSave={() => saveEdit(action.id)}
                            onCancel={() => setEditingId(null)}
                            saveLabel="Save"
                            compact
                          />
                        </div>
                      ) : (
                        <ActionButton
                          action={action}
                          editMode={editMode}
                          onEdit={() => startEdit(action)}
                          onDelete={() => deleteQuickAction(action.id)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Action Button ─────────────────────────────────────────────────────────────

interface ActionButtonProps {
  action: QuickAction
  editMode: boolean
  onEdit: () => void
  onDelete: () => void
}

function ActionButton({ action, editMode, onEdit, onDelete }: ActionButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Delete button in edit mode */}
      {editMode && (
        <div className="absolute -top-2 -right-2 z-10 flex gap-1">
          <button
            onClick={onEdit}
            className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-500 transition-colors"
            aria-label="Edit action"
          >
            <Edit2 size={10} className="text-white" />
          </button>
          <button
            onClick={onDelete}
            className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center shadow-lg hover:bg-red-500 transition-colors"
            aria-label="Delete action"
          >
            <X size={10} className="text-white" />
          </button>
        </div>
      )}

      <a
        href={editMode ? undefined : action.url}
        target={editMode ? undefined : '_blank'}
        rel="noopener noreferrer"
        onClick={editMode ? (e) => e.preventDefault() : undefined}
        className={clsx(
          'flex flex-col items-center gap-3 p-4 bg-slate-900 border border-slate-800 rounded-xl transition-all duration-150 group',
          editMode
            ? 'cursor-default opacity-80'
            : 'hover:border-slate-700 hover:bg-slate-800/50 cursor-pointer'
        )}
      >
        {/* Icon circle */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${action.color}20`, border: `1px solid ${action.color}30` }}
        >
          <ActionIcon name={action.icon} size={18} style={{ color: action.color }} />
        </div>

        {/* Label */}
        <span className="text-xs font-medium text-slate-300 text-center leading-tight group-hover:text-slate-100 transition-colors">
          {action.label}
        </span>

        {!editMode && (
          <ExternalLink size={10} className="text-slate-600 group-hover:text-slate-400 transition-colors absolute top-2.5 right-2.5" />
        )}
      </a>

      {/* URL tooltip */}
      {showTooltip && !editMode && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded whitespace-nowrap z-10 max-w-[200px] truncate pointer-events-none">
          {action.url}
        </div>
      )}
    </div>
  )
}

// ─── Action Form ──────────────────────────────────────────────────────────────

interface ActionFormProps {
  form: AddActionForm
  onChange: (form: AddActionForm) => void
  groups: string[]
  onSave: () => void
  onCancel: () => void
  saveLabel: string
  compact?: boolean
}

function ActionForm({ form, onChange, groups, onSave, onCancel, saveLabel, compact }: ActionFormProps) {
  return (
    <div className={clsx('space-y-3', compact && 'text-xs')}>
      <div className={clsx('grid gap-3', compact ? 'grid-cols-1' : 'grid-cols-2')}>
        <div>
          <label className="label">Label</label>
          <input
            value={form.label}
            onChange={e => onChange({ ...form, label: e.target.value })}
            placeholder="e.g. Jira Board"
            className="input text-xs"
          />
        </div>
        <div>
          <label className="label">URL</label>
          <input
            value={form.url}
            onChange={e => onChange({ ...form, url: e.target.value })}
            placeholder="https://..."
            className="input text-xs"
            type="url"
          />
        </div>
      </div>

      <div className={clsx('grid gap-3', compact ? 'grid-cols-1' : 'grid-cols-2')}>
        <div>
          <label className="label">Group</label>
          {groups.length > 0 ? (
            <div className="space-y-1.5">
              <select
                value={form.newGroup ? '__new__' : form.group}
                onChange={e => {
                  if (e.target.value === '__new__') {
                    onChange({ ...form, group: '', newGroup: '' })
                  } else {
                    onChange({ ...form, group: e.target.value, newGroup: '' })
                  }
                }}
                className="input text-xs"
              >
                <option value="">Select group...</option>
                {groups.map(g => <option key={g} value={g}>{g}</option>)}
                <option value="__new__">+ New group</option>
              </select>
              {(form.newGroup !== undefined && (form.group === '' || form.newGroup)) && (
                <input
                  value={form.newGroup}
                  onChange={e => onChange({ ...form, newGroup: e.target.value, group: '' })}
                  placeholder="New group name..."
                  className="input text-xs"
                />
              )}
            </div>
          ) : (
            <input
              value={form.newGroup || form.group}
              onChange={e => onChange({ ...form, group: e.target.value, newGroup: e.target.value })}
              placeholder="Group name..."
              className="input text-xs"
            />
          )}
        </div>

        <div>
          <label className="label">Icon</label>
          <select
            value={form.icon}
            onChange={e => onChange({ ...form, icon: e.target.value })}
            className="input text-xs"
          >
            {ICON_OPTIONS.map(icon => (
              <option key={icon} value={icon}>{icon}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Color</label>
        <div className="flex items-center gap-2 flex-wrap">
          {COLOR_OPTIONS.map(c => (
            <button
              key={c.value}
              onClick={() => onChange({ ...form, color: c.value })}
              className={clsx(
                'w-6 h-6 rounded-full border-2 transition-all',
                form.color === c.value ? 'border-white scale-110' : 'border-transparent'
              )}
              style={{ backgroundColor: c.value }}
              title={c.label}
              aria-label={c.label}
            />
          ))}
          <input
            type="color"
            value={form.color}
            onChange={e => onChange({ ...form, color: e.target.value })}
            className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
            title="Custom color"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button onClick={onSave} className="btn-primary flex items-center gap-1.5 text-xs py-1.5">
          <Save size={12} />
          {saveLabel}
        </button>
        <button onClick={onCancel} className="btn-secondary text-xs py-1.5">
          Cancel
        </button>
      </div>
    </div>
  )
}
