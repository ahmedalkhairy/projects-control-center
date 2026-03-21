import { useState, useEffect, useRef, KeyboardEvent, useCallback } from 'react'
import { useStore } from '../store'
import {
  X, Trash2, Save, Tag, ExternalLink,
  Paperclip, ImagePlus, Loader2, ChevronDown,
} from 'lucide-react'
import clsx from 'clsx'
import type { Task, TaskStatus, Priority, TaskType } from '../types'
import { createJiraIssue } from '../services/jira'

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo',        label: 'Todo' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'done',        label: 'Done' },
]

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'low',      label: 'Low',      color: 'text-slate-400' },
  { value: 'medium',   label: 'Medium',   color: 'text-yellow-400' },
  { value: 'high',     label: 'High',     color: 'text-orange-400' },
  { value: 'critical', label: 'Critical', color: 'text-red-400' },
]

const TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'local', label: 'Local' },
  { value: 'jira',  label: 'Jira' },
]

export default function TaskModal() {
  const {
    taskModalTask,
    projects,
    activeProjectId,
    integrations,
    addTask,
    updateTask,
    deleteTask,
    closeTaskModal,
  } = useStore()

  const activeProjectIntegrations = integrations[activeProjectId] ?? []
  const hasJira = activeProjectIntegrations.some(i => i.type === 'jira' && i.enabled)
  const isEdit  = !!(taskModalTask?.id)

  // ── Basic fields ─────────────────────────────────────────────────────────────
  const [title,       setTitle]       = useState(taskModalTask?.title ?? '')
  const [description, setDescription] = useState(taskModalTask?.description ?? '')
  const [status,      setStatus]      = useState<TaskStatus>(taskModalTask?.status ?? 'todo')
  const [priority,    setPriority]    = useState<Priority>(taskModalTask?.priority ?? 'medium')

  // ── Advanced fields ──────────────────────────────────────────────────────────
  const [type,      setType]      = useState<TaskType>(taskModalTask?.type ?? (hasJira ? 'jira' : 'local'))
  const [jiraKey,   setJiraKey]   = useState(taskModalTask?.jiraKey ?? '')
  const [jiraLink,  setJiraLink]  = useState(taskModalTask?.jiraLink ?? '')
  const [dueDate,   setDueDate]   = useState(taskModalTask?.dueDate ? taskModalTask.dueDate.substring(0, 10) : '')
  const [tagsInput, setTagsInput] = useState(taskModalTask?.tags?.join(', ') ?? '')
  const [projectId, setProjectId] = useState(taskModalTask?.projectId ?? activeProjectId)
  const [attachments, setAttachments] = useState<string[]>(taskModalTask?.attachments ?? [])

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [showAdvanced,  setShowAdvanced]  = useState(isEdit) // expand by default when editing
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [jiraError,     setJiraError]     = useState<string | null>(null)
  const [lightbox,      setLightbox]      = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Count filled advanced fields for badge
  const advancedCount = [
    type !== 'local',
    !!dueDate,
    !!tagsInput.trim(),
    projectId !== activeProjectId,
    attachments.length > 0,
  ].filter(Boolean).length

  // ── Images ───────────────────────────────────────────────────────────────────
  const addImages = useCallback((files: File[]) => {
    files.filter(f => f.type.startsWith('image/')).forEach(file => {
      const reader = new FileReader()
      reader.onload = e => {
        const result = e.target?.result as string
        if (result) setAttachments(prev => [...prev, result])
      }
      reader.readAsDataURL(file)
    })
  }, [])

  useEffect(() => {
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        if (lightbox) { setLightbox(null); return }
        closeTaskModal()
      }
    }
    function handlePaste(e: ClipboardEvent) {
      if (!showAdvanced) return // only paste when advanced section is open
      const items = Array.from(e.clipboardData?.items ?? [])
      const imageItems = items.filter(i => i.type.startsWith('image/'))
      if (imageItems.length === 0) return
      e.preventDefault()
      addImages(imageItems.map(i => i.getAsFile()!).filter(Boolean))
    }
    window.addEventListener('keydown', handleKey)
    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('paste', handlePaste)
    }
  }, [closeTaskModal, lightbox, showAdvanced, addImages])

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!title.trim() || saving) return
    setJiraError(null)

    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)

    let resolvedJiraKey  = type === 'jira' ? jiraKey.trim()  || undefined : undefined
    let resolvedJiraLink = type === 'jira' ? jiraLink.trim() || undefined : undefined

    if (type === 'jira' && !isEdit && !resolvedJiraKey) {
      const jiraIntegration = (integrations[projectId] ?? []).find(i => i.type === 'jira' && i.enabled)
      if (jiraIntegration) {
        setSaving(true)
        try {
          const cfg = {
            serverUrl:  jiraIntegration.config.serverUrl  ?? '',
            projectKey: jiraIntegration.config.projectKey ?? '',
            username:   jiraIntegration.config.username   ?? '',
            apiToken:   jiraIntegration.config.apiToken   ?? '',
          }
          const result = await createJiraIssue(cfg, title.trim(), description.trim(), priority)
          if (!result.ok) {
            setJiraError(result.error ?? 'Failed to create Jira issue')
            return
          }
          resolvedJiraKey  = result.key
          resolvedJiraLink = result.link
        } catch (e) {
          setJiraError((e as Error).message ?? 'Unexpected error')
          return
        } finally {
          setSaving(false)
        }
      }
    }

    const taskData: Omit<Task, 'id' | 'createdAt'> = {
      projectId,
      title:       title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      type,
      jiraKey:     resolvedJiraKey,
      jiraLink:    resolvedJiraLink,
      dueDate:     dueDate ? new Date(dueDate).toISOString() : undefined,
      tags:        tags.length > 0 ? tags : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    }

    if (isEdit && taskModalTask?.id) updateTask(taskModalTask.id, taskData)
    else addTask(taskData)

    closeTaskModal()
  }

  function handleDelete() {
    if (isEdit && taskModalTask?.id) deleteTask(taskModalTask.id)
    closeTaskModal()
  }

  const parsedTags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) closeTaskModal() }}
    >
      <div className="w-full max-w-lg bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-200">
            {isEdit ? 'Edit Task' : 'New Task'}
          </h2>
          <button
            onClick={closeTaskModal}
            className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">

          {/* ── BASIC ─────────────────────────────────────────────────────── */}

          {/* Title */}
          <div>
            <label className="label">Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Task title..."
              className="input text-sm font-medium"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="label">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add more details..."
              rows={3}
              className="input text-sm resize-none"
            />
          </div>

          {/* Status + Priority inline */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Status</label>
              <div className="flex flex-col gap-1.5">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setStatus(opt.value)}
                    className={clsx(
                      'py-1.5 px-3 rounded-lg text-xs font-medium transition-all border text-left',
                      status === opt.value
                        ? opt.value === 'todo'
                          ? 'bg-slate-700 border-slate-600 text-slate-200'
                          : opt.value === 'in-progress'
                          ? 'bg-blue-600/20 border-blue-600/50 text-blue-400'
                          : 'bg-green-600/20 border-green-600/50 text-green-400'
                        : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Priority</label>
              <div className="flex flex-col gap-1.5">
                {PRIORITY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setPriority(opt.value)}
                    className={clsx(
                      'py-1.5 px-3 rounded-lg text-xs font-medium transition-all border text-left',
                      priority === opt.value
                        ? 'bg-slate-700 border-slate-600'
                        : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
                    )}
                  >
                    <span className={priority === opt.value ? opt.color : ''}>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── ADVANCED TOGGLE ──────────────────────────────────────────── */}
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="w-full flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors py-1"
          >
            <div className="flex-1 h-px bg-slate-800" />
            <span className="flex items-center gap-1.5 px-1 shrink-0">
              {advancedCount > 0 && (
                <span className="bg-blue-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                  {advancedCount}
                </span>
              )}
              Advanced
              <ChevronDown
                size={13}
                className={clsx('transition-transform duration-200', showAdvanced && 'rotate-180')}
              />
            </span>
            <div className="flex-1 h-px bg-slate-800" />
          </button>

          {/* ── ADVANCED FIELDS ──────────────────────────────────────────── */}
          {showAdvanced && (
            <div className="space-y-4">

              {/* Type */}
              <div>
                <label className="label">Type</label>
                <div className="flex gap-2">
                  {TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setType(opt.value)}
                      className={clsx(
                        'flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all border',
                        type === opt.value
                          ? 'bg-blue-600/20 border-blue-600/50 text-blue-400'
                          : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Jira fields */}
              {type === 'jira' && (
                <div className="space-y-3 bg-blue-500/5 border border-blue-500/10 rounded-xl p-3">
                  <div>
                    <label className="label">Jira Key</label>
                    <input
                      value={jiraKey}
                      onChange={e => setJiraKey(e.target.value)}
                      placeholder="e.g. EC-1042  (leave empty to auto-create)"
                      className="input text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="label">Jira Link</label>
                    <div className="flex items-center gap-2">
                      <input
                        value={jiraLink}
                        onChange={e => setJiraLink(e.target.value)}
                        placeholder="https://jira.example.com/browse/EC-1042"
                        className="input text-sm flex-1"
                        type="url"
                      />
                      {jiraLink && (
                        <a
                          href={jiraLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Due Date */}
              <div>
                <label className="label">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="input text-sm"
                  style={{ colorScheme: 'dark' }}
                />
              </div>

              {/* Tags */}
              <div>
                <label className="label">Tags (comma-separated)</label>
                <input
                  value={tagsInput}
                  onChange={e => setTagsInput(e.target.value)}
                  onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') e.preventDefault() }}
                  placeholder="bug, frontend, urgent..."
                  className="input text-sm"
                />
                {parsedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {parsedTags.map(tag => (
                      <span key={tag} className="flex items-center gap-1 text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                        <Tag size={10} />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Project */}
              <div>
                <label className="label">Project</label>
                <select
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                  className="input text-sm"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Attachments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0 flex items-center gap-1.5">
                    <Paperclip size={12} />
                    Attachments
                    {attachments.length > 0 && (
                      <span className="text-xs text-slate-500">({attachments.length})</span>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700"
                  >
                    <ImagePlus size={12} />
                    Add images
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => { addImages(Array.from(e.target.files ?? [])); e.target.value = '' }}
                />

                {attachments.length === 0 ? (
                  <div className="flex items-center justify-center border-2 border-dashed border-slate-700 rounded-xl py-5 text-xs text-slate-600">
                    Paste (Ctrl+V) or click "Add images"
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {attachments.map((src, i) => (
                      <div key={i} className="relative group aspect-square">
                        <img
                          src={src}
                          alt={`Attachment ${i + 1}`}
                          className="w-full h-full object-cover rounded-lg border border-slate-700 cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setLightbox(src)}
                        />
                        <button
                          type="button"
                          onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-1 right-1 p-0.5 bg-slate-900/80 rounded-full text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                          aria-label="Remove image"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-800 bg-slate-950/30">
          <div>
            {isEdit && (
              !deleteConfirm ? (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400">Confirm?</span>
                  <button
                    onClick={handleDelete}
                    className="text-xs bg-red-600 hover:bg-red-500 text-white px-2.5 py-1 rounded-lg transition-colors"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    className="text-xs text-slate-500 hover:text-slate-300 px-2.5 py-1 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )
            )}
          </div>

          <div className="flex items-center gap-2">
            {jiraError && (
              <p className="text-xs text-red-400 max-w-[160px] text-right">{jiraError}</p>
            )}
            <button onClick={closeTaskModal} className="btn-secondary text-sm py-2">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim() || saving}
              className={clsx(
                'btn-primary flex items-center gap-1.5 text-sm py-2',
                (!title.trim() || saving) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {saving ? 'Creating in Jira...' : isEdit ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Full size"
            className="max-w-full max-h-full rounded-xl object-contain"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
