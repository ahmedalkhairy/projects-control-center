import { useState, useEffect } from 'react'
import { useStore } from '../store'
import { X, Plus, FolderOpen } from 'lucide-react'
import clsx from 'clsx'

const PRESET_COLORS = [
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Green', value: '#10b981' },
  { label: 'Purple', value: '#8b5cf6' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Teal', value: '#14b8a6' },
  { label: 'Yellow', value: '#eab308' },
  { label: 'Pink', value: '#ec4899' },
]

export default function CreateProjectModal() {
  const { addProject, setCreateProjectOpen } = useStore()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#3b82f6')

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setCreateProjectOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [setCreateProjectOpen])

  function handleCreate() {
    if (!name.trim()) return
    addProject({
      name: name.trim(),
      description: description.trim(),
      color,
      icon: 'FolderOpen',
    })
    // store.addProject closes modal automatically
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleCreate()
  }

  const canCreate = name.trim().length > 0

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) setCreateProjectOpen(false) }}
    >
      <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-200">Create Project</h2>
          <button
            onClick={() => setCreateProjectOpen(false)}
            className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="label">Project Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Mobile App, Marketing Site..."
              className="input"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="label">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this project about?"
              rows={2}
              className="input resize-none text-sm"
            />
          </div>

          {/* Color */}
          <div>
            <label className="label">Project Color</label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setColor(c.value)}
                    className={clsx(
                      'w-7 h-7 rounded-full border-2 transition-all duration-150',
                      color === c.value
                        ? 'border-white scale-110 shadow-lg'
                        : 'border-transparent hover:scale-105 hover:border-slate-600'
                    )}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                    aria-label={`${c.label} color`}
                  />
                ))}
              </div>
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                title="Custom color"
              />
            </div>
          </div>

          {/* Preview */}
          <div>
            <label className="label">Preview</label>
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-sm font-medium text-slate-200">
                  {name || 'Project Name'}
                </span>
                <span className="ml-auto text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                  0
                </span>
              </div>
              <div className="text-xs text-slate-500 pl-4 line-clamp-2">
                {description || 'No description yet'}
              </div>
              <div className="mt-3 pl-4 space-y-1">
                {['Inbox', 'Tasks', 'Quick Actions'].map(item => (
                  <div key={item} className="flex items-center gap-2 text-xs text-slate-600">
                    <div className="w-1 h-1 rounded-full bg-slate-700" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-800 bg-slate-950/30">
          <button
            onClick={() => setCreateProjectOpen(false)}
            className="btn-secondary text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className={clsx(
              'btn-primary flex items-center gap-1.5 text-sm',
              !canCreate && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Plus size={14} />
            Create Project
          </button>
        </div>
      </div>
    </div>
  )
}
