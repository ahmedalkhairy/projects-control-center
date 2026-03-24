import { useState } from 'react'
import { useStore } from '../store'
import { Save, Trash2, AlertTriangle, Check, RefreshCw, Sparkles, Eye, EyeOff, LayoutGrid } from 'lucide-react'
import clsx from 'clsx'
import { HelpButton } from './HelpButton'
import { MODULE_DEFS } from '../modules'

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
  const { projects, activeProjectId, updateProject, deleteProject, setActiveProject, jiraSyncInterval, setJiraSyncInterval, geminiApiKey, setGeminiApiKey, enabledModules, setModuleEnabled } = useStore()

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

  const [apiKeyInput, setApiKeyInput] = useState(geminiApiKey)
  const [showApiKey, setShowApiKey] = useState(false)
  const [savedApiKey, setSavedApiKey] = useState(false)

  if (!project) return null

  function handleSaveGeneral() {
    if (!name.trim()) return
    updateProject(activeProjectId, { name: name.trim(), description: description.trim(), color })
    setSavedGeneral(true)
    setTimeout(() => setSavedGeneral(false), 2000)
  }

  function handleSaveApiKey() {
    setGeminiApiKey(apiKeyInput.trim())
    setSavedApiKey(true)
    setTimeout(() => setSavedApiKey(false), 2000)
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
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-lg font-semibold text-slate-100">Settings</h1>
          <HelpButton
            title="Settings"
            description="Configure project-level preferences including name, color, notification options, sync intervals, AI key, and danger-zone actions."
            tips={[
              'Project color appears in the sidebar and is used for visual identification.',
              'Auto-Sync interval controls how often Jira/GitLab integrations refresh automatically.',
              'Set your Google Gemini API key here to unlock AI features across all sections.',
              'Deleting a project removes all its tasks, notes, and messages — this cannot be undone.',
            ]}
          />
        </div>
        <p className="text-sm text-slate-500">Configure project preferences</p>
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

      {/* AI Integration */}
      <section className="bg-slate-900 rounded-xl border border-slate-800 p-5">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={14} className="text-violet-400" />
          <h2 className="text-sm font-semibold text-slate-200">AI Assistant</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Connect to Gemini to enable AI-powered standup drafts, weekly summaries, and the project chat assistant.
        </p>

        <div className="space-y-3">
          <div>
            <label className="label">Google Gemini API Key</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy…"
                  className="input pr-10 font-mono text-xs"
                />
                <button
                  onClick={() => setShowApiKey(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  aria-label={showApiKey ? 'Hide key' : 'Show key'}
                >
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                onClick={handleSaveApiKey}
                disabled={!apiKeyInput.trim()}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors flex-shrink-0',
                  savedApiKey
                    ? 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30'
                    : apiKeyInput.trim()
                    ? 'bg-violet-600/20 text-violet-400 border-violet-600/30 hover:bg-violet-600/30'
                    : 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'
                )}
              >
                {savedApiKey ? <Check size={13} /> : <Save size={13} />}
                {savedApiKey ? 'Saved!' : 'Save'}
              </button>
            </div>
            <p className="text-xs text-slate-600 mt-1.5">
              Your key is stored locally and never sent to any server other than Google's API.
              Get a free key at{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-violet-500 hover:text-violet-400 underline"
              >
                aistudio.google.com
              </a>
            </p>
          </div>

          {geminiApiKey && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              <Check size={12} />
              Gemini API key configured — AI features are enabled
            </div>
          )}
        </div>
      </section>

      {/* Modules */}
      <section className="bg-slate-900 rounded-xl border border-slate-800 p-5">
        <div className="flex items-center gap-2 mb-1">
          <LayoutGrid size={14} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-200">Modules</h2>
        </div>
        <p className="text-xs text-slate-500 mb-5">
          Enable or disable sections of the app. Disabled modules are hidden from the sidebar.
          Core modules cannot be turned off.
        </p>

        {(['Workspace', 'Reports', 'Project'] as const).map(group => {
          const items = MODULE_DEFS.filter(m => m.group === group)
          return (
            <div key={group} className="mb-5 last:mb-0">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                {group}
              </div>
              <div className="grid grid-cols-1 gap-2">
                {items.map(mod => {
                  const Icon = mod.icon
                  const enabled = mod.core || enabledModules[mod.key] !== false
                  return (
                    <div
                      key={mod.key}
                      className={clsx(
                        'flex items-center gap-3 px-3 py-3 rounded-lg border transition-all duration-150',
                        enabled
                          ? 'bg-slate-800/60 border-slate-700/60'
                          : 'bg-slate-900 border-slate-800 opacity-60'
                      )}
                    >
                      {/* Icon swatch */}
                      <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', mod.swatchBg)}>
                        <Icon size={15} className={mod.iconColor} />
                      </div>

                      {/* Label + description */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-200">{mod.label}</span>
                          {mod.core && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 font-medium">
                              Core
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed truncate">{mod.description}</p>
                      </div>

                      {/* Toggle */}
                      {mod.core ? (
                        <span className="text-xs text-slate-600 flex-shrink-0">Always on</span>
                      ) : (
                        <button
                          onClick={() => setModuleEnabled(mod.key, !enabled)}
                          className={clsx(
                            'relative inline-flex w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0',
                            enabled ? 'bg-blue-600' : 'bg-slate-700'
                          )}
                          role="switch"
                          aria-checked={enabled}
                          aria-label={`Toggle ${mod.label}`}
                        >
                          <span
                            className={clsx(
                              'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200',
                              enabled ? 'translate-x-5' : 'translate-x-0'
                            )}
                          />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
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
