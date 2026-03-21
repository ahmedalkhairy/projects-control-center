import { useState } from 'react'
import { useStore } from '../store'
import { Save, Trash2, AlertTriangle, Check, RefreshCw } from 'lucide-react'
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

const INTERVAL_PRESETS = [
  { label: '5s',   value: 5 },
  { label: '15s',  value: 15 },
  { label: '30s',  value: 30 },
  { label: '1m',   value: 60 },
  { label: '5m',   value: 300 },
  { label: 'Off',  value: 0 },
]

export default function SettingsView() {
  const { projects, activeProjectId, updateProject, deleteProject, setActiveProject, jiraSyncInterval, setJiraSyncInterval } = useStore()

  const project = projects.find(p => p.id === activeProjectId)

  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [color, setColor] = useState(project?.color ?? '#3b82f6')
  const [savedGeneral, setSavedGeneral] = useState(false)

  const [notifEmail, setNotifEmail] = useState(true)
  const [notifDesktop, setNotifDesktop] = useState(true)
  const [notifWhatsapp, setNotifWhatsapp] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')

  if (!project) return null

  function handleSaveGeneral() {
    if (!name.trim()) return
    updateProject(activeProjectId, { name: name.trim(), description: description.trim(), color })
    setSavedGeneral(true)
    setTimeout(() => setSavedGeneral(false), 2000)
  }

  function handleDelete() {
    if (deleteInput !== project?.name) return
    const remaining = projects.filter(p => p.id !== activeProjectId)
    deleteProject(activeProjectId)
    if (remaining.length > 0) {
      setActiveProject(remaining[0].id)
    }
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="mb-2">
        <h1 className="text-lg font-semibold text-slate-100">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Configure project preferences</p>
      </div>

      {/* General */}
      <section className="bg-slate-900 rounded-xl border border-slate-800 p-5">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">General</h2>

        <div className="space-y-4">
          <div>
            <label className="label">Project Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Project name"
              className="input"
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of this project..."
              rows={3}
              className="input resize-none"
            />
          </div>

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
                        : 'border-transparent hover:scale-105'
                    )}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                    aria-label={`${c.label} color`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                  title="Custom color"
                />
                <span className="text-xs text-slate-500 font-mono">{color}</span>
              </div>
            </div>

            {/* Preview */}
            <div className="mt-3 flex items-center gap-2.5 bg-slate-800 px-3 py-2 rounded-lg w-fit">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-sm text-slate-300 font-medium">{name || 'Project name'}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button
            onClick={handleSaveGeneral}
            className={clsx(
              'btn-primary flex items-center gap-1.5',
              savedGeneral && 'bg-green-600 hover:bg-green-600'
            )}
          >
            {savedGeneral ? <Check size={14} /> : <Save size={14} />}
            {savedGeneral ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </section>

      {/* Notifications */}
      <section className="bg-slate-900 rounded-xl border border-slate-800 p-5">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Notifications</h2>

        <div className="space-y-3">
          <ToggleRow
            label="Email notifications"
            description="Receive email digests for new messages and tasks"
            checked={notifEmail}
            onChange={setNotifEmail}
          />
          <ToggleRow
            label="Desktop notifications"
            description="Show browser push notifications for critical alerts"
            checked={notifDesktop}
            onChange={setNotifDesktop}
          />
          <ToggleRow
            label="WhatsApp alerts for critical items"
            description="Forward P1 incidents and critical tasks via WhatsApp"
            checked={notifWhatsapp}
            onChange={setNotifWhatsapp}
          />
        </div>
      </section>

      {/* Sync Settings */}
      <section className="bg-slate-900 rounded-xl border border-slate-800 p-5">
        <div className="flex items-center gap-2 mb-1">
          <RefreshCw size={14} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-200">Auto-Sync</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Automatically sync Jira tasks and notifications for all projects.
        </p>

        <div>
          <label className="label">Sync Interval</label>
          <div className="flex items-center gap-2 flex-wrap">
            {INTERVAL_PRESETS.map(preset => (
              <button
                key={preset.value}
                onClick={() => setJiraSyncInterval(preset.value)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 border',
                  jiraSyncInterval === preset.value
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-600 mt-2">
            {jiraSyncInterval === 0
              ? 'Auto-sync is disabled. Use the Sync buttons in Integrations manually.'
              : `Syncing every ${jiraSyncInterval >= 60 ? `${jiraSyncInterval / 60}m` : `${jiraSyncInterval}s`} for all enabled Jira integrations.`
            }
          </p>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="bg-red-950/20 rounded-xl border border-red-900/40 p-5">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={15} className="text-red-400" />
          <h2 className="text-sm font-semibold text-red-400">Danger Zone</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          These actions are irreversible. Please be certain.
        </p>

        {!deleteConfirm ? (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="flex items-center gap-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-red-600/20"
          >
            <Trash2 size={14} />
            Delete Project
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              Type <span className="font-mono text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">{project.name}</span> to confirm deletion:
            </p>
            <input
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              placeholder={`Type "${project.name}" to confirm`}
              className="input border-red-900/40 focus:ring-red-500 focus:border-red-500"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleDelete}
                disabled={deleteInput !== project.name}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border',
                  deleteInput === project.name
                    ? 'bg-red-600 hover:bg-red-500 text-white border-red-600'
                    : 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'
                )}
              >
                <Trash2 size={14} />
                Delete Project Permanently
              </button>
              <button
                onClick={() => { setDeleteConfirm(false); setDeleteInput('') }}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

interface ToggleRowProps {
  label: string
  description: string
  checked: boolean
  onChange: (val: boolean) => void
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-slate-800 last:border-0">
      <div>
        <div className="text-sm font-medium text-slate-200">{label}</div>
        <div className="text-xs text-slate-500 mt-0.5">{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative inline-flex w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0',
          checked ? 'bg-blue-600' : 'bg-slate-700'
        )}
        role="switch"
        aria-checked={checked}
        aria-label={label}
      >
        <span
          className={clsx(
            'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  )
}
