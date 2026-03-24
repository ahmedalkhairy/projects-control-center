import { useState } from 'react'
import { useStore } from '../store'
import type { LucideIcon } from 'lucide-react'
import {
  Trello,
  Mail,
  MessageCircle,
  Check,
  X,
  RefreshCw,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronUp,
  Inbox,
  GitBranch,
} from 'lucide-react'
import clsx from 'clsx'
import { timeAgo } from '../utils'
import type { Integration, IntegrationType } from '../types'
import { HelpButton } from './HelpButton'

interface IntegrationDef {
  type: IntegrationType
  name: string
  description: string
  icon: LucideIcon
  iconColor: string
  iconBg: string
  configFields: ConfigField[]
}

interface ConfigField {
  key: string
  label: string
  placeholder: string
  type?: 'text' | 'password' | 'select'
  options?: string[]
}

const INTEGRATION_DEFS: IntegrationDef[] = [
  {
    type: 'jira',
    name: 'Jira',
    description: 'Sync Jira tickets, epics, and stories to your inbox.',
    icon: Trello,
    iconColor: '#3b82f6',
    iconBg: 'bg-blue-500/10',
    configFields: [
      { key: 'serverUrl', label: 'Server URL', placeholder: 'https://yourcompany.atlassian.net' },
      { key: 'projectKey', label: 'Project Key', placeholder: 'e.g. EC' },
      { key: 'username', label: 'Username / Email', placeholder: 'user@example.com' },
      { key: 'apiToken', label: 'API Token', placeholder: 'Enter Jira API token', type: 'password' },
    ],
  },
  {
    type: 'gitlab',
    name: 'GitLab',
    description: 'Sync GitLab issues as tasks and monitor pipeline status.',
    icon: GitBranch,
    iconColor: '#fc6d26',
    iconBg: 'bg-orange-500/10',
    configFields: [
      { key: 'instanceUrl', label: 'Instance URL', placeholder: 'https://gitlab.com' },
      { key: 'projectPath', label: 'Project Path', placeholder: 'group/project' },
      { key: 'token', label: 'Personal Access Token', placeholder: 'glpat-xxxxxxxxxxxx', type: 'password' },
    ],
  },
  {
    type: 'email',
    name: 'Email',
    description: 'Connect your email to receive messages in your inbox.',
    icon: Mail,
    iconColor: '#8b5cf6',
    iconBg: 'bg-purple-500/10',
    configFields: [
      {
        key: 'provider',
        label: 'Provider',
        placeholder: 'Select provider',
        type: 'select',
        options: ['gmail', 'outlook', 'imap'],
      },
      { key: 'emailAddress', label: 'Email Address', placeholder: 'project@example.com' },
      { key: 'filterLabel', label: 'Filter Label / Folder', placeholder: 'e.g. inbox, project-label' },
    ],
  },
  {
    type: 'whatsapp',
    name: 'WhatsApp',
    description: 'Monitor WhatsApp groups and forward messages to your inbox.',
    icon: MessageCircle,
    iconColor: '#10b981',
    iconBg: 'bg-green-500/10',
    configFields: [
      { key: 'apiToken', label: 'API Token', placeholder: 'WhatsApp Business API token', type: 'password' },
      { key: 'groupIds', label: 'Group IDs (comma-separated)', placeholder: 'group-id-1,group-id-2' },
      { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://yourserver.com/webhooks/whatsapp' },
    ],
  },
]

export default function IntegrationsView() {
  const {
    activeProjectId, integrations, updateIntegration,
    syncJiraIntegration, syncJiraNotifications, testJiraIntegration,
    syncGitLabIntegration, syncGitLabNotifications, testGitLabIntegration,
    syncingIntegrationIds,
  } = useStore()

  const projectIntegrations = integrations[activeProjectId] ?? []

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-lg font-semibold text-slate-100">Integrations</h1>
          <HelpButton
            title="Integrations"
            description="Connect external services to automatically sync tasks and messages into Control Center. Each project can have its own integration config."
            tips={[
              'Jira: syncs assigned issues as Tasks and unread comments as Inbox messages.',
              'GitLab: syncs assigned issues as Tasks and recent activity as Inbox messages.',
              '"Test Connection" verifies your credentials before enabling.',
              '"Sync Now" manually triggers a sync — useful for testing.',
              'Auto-sync interval is configured globally in Settings → Auto-Sync.',
              'Credentials are stored locally in your browser — never sent to our servers.',
            ]}
          />
        </div>
        <p className="text-sm text-slate-500">
          Connect external services to automatically populate your inbox.
        </p>
      </div>

      <div className="space-y-4">
        {INTEGRATION_DEFS.map(def => {
          const integration = projectIntegrations.find(i => i.type === def.type)
          if (!integration) return null
          return (
            <IntegrationCard
              key={def.type}
              def={def}
              integration={integration}
              onUpdate={(updates) => updateIntegration(integration.id, updates)}
              onTest={
                def.type === 'jira'   ? (cfg) => testJiraIntegration(integration.id, cfg) :
                def.type === 'gitlab' ? (cfg) => testGitLabIntegration(integration.id, cfg) :
                undefined
              }
              onSync={
                def.type === 'jira'   ? (cfg) => syncJiraIntegration(integration.id, cfg) :
                def.type === 'gitlab' ? (cfg) => syncGitLabIntegration(integration.id, cfg) :
                undefined
              }
              onSyncNotifications={
                def.type === 'jira'   ? (cfg) => syncJiraNotifications(integration.id, cfg) :
                def.type === 'gitlab' ? (cfg) => syncGitLabNotifications(integration.id, cfg) :
                undefined
              }
              isSyncing={syncingIntegrationIds.includes(integration.id)}
            />
          )
        })}
      </div>
    </div>
  )
}

// ─── Integration Card ─────────────────────────────────────────────────────────

interface IntegrationCardProps {
  def: IntegrationDef
  integration: Integration
  onUpdate: (updates: Partial<Integration>) => void
  onTest?: (config: Record<string, string>) => Promise<{ ok: boolean; displayName?: string; error?: string }>
  onSync?: (config: Record<string, string>) => Promise<{ ok: boolean; count?: number; error?: string }>
  onSyncNotifications?: (config: Record<string, string>) => Promise<{ ok: boolean; count?: number; error?: string }>
  isSyncing?: boolean
}

function IntegrationCard({ def, integration, onUpdate, onTest, onSync, onSyncNotifications, isSyncing = false }: IntegrationCardProps) {
  const [expanded, setExpanded] = useState(integration.enabled)
  const [config, setConfig] = useState({ ...integration.config })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [syncResult, setSyncResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [notifResult, setNotifResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [saved, setSaved] = useState(false)

  const Icon = def.icon
  const syncing = isSyncing

  function handleToggle() {
    const newEnabled = !integration.enabled
    onUpdate({ enabled: newEnabled })
    if (newEnabled) setExpanded(true)
  }

  function handleSave() {
    onUpdate({ config })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleTest() {
    if (!onTest) return
    setTesting(true)
    setTestResult(null)
    const result = await onTest(config)
    setTesting(false)
    if (result.ok) {
      setTestResult({ ok: true, message: result.displayName ? `Connected as ${result.displayName}` : 'Connection successful' })
    } else {
      setTestResult({ ok: false, message: result.error ?? 'Connection failed' })
    }
    setTimeout(() => setTestResult(null), 6000)
  }

  async function handleSync() {
    if (!onSync) return
    setSyncResult(null)
    const result = await onSync(config)
    if (result.ok) {
      setSyncResult({ ok: true, message: `Synced ${result.count ?? 0} issues` })
    } else {
      setSyncResult({ ok: false, message: result.error ?? 'Sync failed' })
    }
    setTimeout(() => setSyncResult(null), 6000)
  }

  async function handleSyncNotifications() {
    if (!onSyncNotifications) return
    setNotifResult(null)
    const result = await onSyncNotifications(config)
    if (result.ok) {
      setNotifResult({ ok: true, message: `Fetched ${result.count ?? 0} notifications — check your Inbox` })
    } else {
      setNotifResult({ ok: false, message: result.error ?? 'Sync failed' })
    }
    setTimeout(() => setNotifResult(null), 6000)
  }

  const isConfigured = Object.values(integration.config).some(v => v.trim().length > 0)

  let statusLabel = 'Not configured'
  let statusColor = 'text-slate-500'
  if (integration.enabled && isConfigured) {
    statusLabel = 'Connected'
    statusColor = 'text-green-400'
  } else if (integration.enabled && !isConfigured) {
    statusLabel = 'Needs configuration'
    statusColor = 'text-yellow-400'
  }

  return (
    <div
      className={clsx(
        'bg-slate-900 rounded-xl border transition-colors duration-150',
        integration.enabled ? 'border-slate-700' : 'border-slate-800'
      )}
    >
      {/* Card header */}
      <div className="flex items-center gap-4 p-5">
        {/* Icon */}
        <div
          className={clsx('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', def.iconBg)}
          style={{ border: `1px solid ${def.iconColor}30` }}
        >
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Icon size={20} {...{ style: { color: def.iconColor } } as any} />
        </div>

        {/* Name + status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-100">{def.name}</span>
            <div className="flex items-center gap-1">
              {integration.enabled ? (
                <Wifi size={12} className="text-green-500" />
              ) : (
                <WifiOff size={12} className="text-slate-600" />
              )}
              <span className={clsx('text-xs', statusColor)}>{statusLabel}</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{def.description}</p>
          {integration.enabled && integration.lastSync && (
            <p className="text-xs text-slate-600 mt-0.5">
              Last sync: {timeAgo(integration.lastSync)}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {integration.enabled && onSync && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
              aria-label="Sync now"
              title="Sync now"
            >
              <RefreshCw size={14} className={clsx(syncing && 'animate-spin')} />
            </button>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {/* Toggle */}
          <button
            onClick={handleToggle}
            className={clsx(
              'relative inline-flex w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0',
              integration.enabled ? 'bg-blue-600' : 'bg-slate-700'
            )}
            role="switch"
            aria-checked={integration.enabled}
            aria-label={`${integration.enabled ? 'Disable' : 'Enable'} ${def.name} integration`}
          >
            <span
              className={clsx(
                'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200',
                integration.enabled ? 'translate-x-5' : 'translate-x-0'
              )}
            />
          </button>
        </div>
      </div>

      {/* Config fields */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-800 pt-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            {def.configFields.map(field => (
              <div key={field.key}>
                <label className="label">{field.label}</label>
                {field.type === 'select' ? (
                  <select
                    value={config[field.key] ?? ''}
                    onChange={e => setConfig({ ...config, [field.key]: e.target.value })}
                    className="input text-sm"
                  >
                    <option value="">Select...</option>
                    {field.options?.map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type ?? 'text'}
                    value={config[field.key] ?? ''}
                    onChange={e => setConfig({ ...config, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="input text-sm"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className={clsx(
                'btn-primary flex items-center gap-1.5 text-sm',
                saved && 'bg-green-600 hover:bg-green-600'
              )}
            >
              {saved ? <Check size={13} /> : null}
              {saved ? 'Saved!' : 'Save Configuration'}
            </button>

            {onTest && (
              <button
                onClick={handleTest}
                disabled={testing}
                className="btn-secondary flex items-center gap-1.5 text-sm"
              >
                {testing ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Wifi size={13} />
                    Test Connection
                  </>
                )}
              </button>
            )}

            {integration.enabled && onSync && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="btn-secondary flex items-center gap-1.5 text-sm"
              >
                {syncing ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw size={13} />
                    Sync Tasks
                  </>
                )}
              </button>
            )}

            {integration.enabled && onSyncNotifications && (
              <button
                onClick={handleSyncNotifications}
                disabled={syncing}
                className="btn-secondary flex items-center gap-1.5 text-sm"
              >
                {syncing ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Inbox size={13} />
                    Sync Notifications
                  </>
                )}
              </button>
            )}
          </div>

          {/* Test result */}
          {testResult && (
            <div
              className={clsx(
                'mt-3 flex items-center gap-2 text-sm px-3 py-2 rounded-lg',
                testResult.ok
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              )}
            >
              {testResult.ok
                ? <><Check size={14} /> {testResult.message}</>
                : <><X size={14} /> {testResult.message}</>
              }
            </div>
          )}

          {/* Sync result */}
          {syncResult && (
            <div
              className={clsx(
                'mt-2 flex items-center gap-2 text-sm px-3 py-2 rounded-lg',
                syncResult.ok
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              )}
            >
              {syncResult.ok
                ? <><Check size={14} /> {syncResult.message} — check your Tasks</>
                : <><X size={14} /> {syncResult.message}</>
              }
            </div>
          )}

          {/* Notifications result */}
          {notifResult && (
            <div
              className={clsx(
                'mt-2 flex items-center gap-2 text-sm px-3 py-2 rounded-lg',
                notifResult.ok
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              )}
            >
              {notifResult.ok
                ? <><Check size={14} /> {notifResult.message}</>
                : <><X size={14} /> {notifResult.message}</>
              }
            </div>
          )}
        </div>
      )}
    </div>
  )
}
