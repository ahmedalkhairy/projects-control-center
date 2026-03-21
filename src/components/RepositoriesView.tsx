import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Plus,
  GitBranch,
  GitCommit,
  GitMerge,
  GitPullRequest,
  ExternalLink,
  RefreshCw,
  Settings2,
  Trash2,
  CheckCircle,
  XCircle,
  Loader,
  Clock,
  Tag,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Star,
  Circle,
  Save,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import { useStore } from '../store'
import { timeAgo } from '../utils'
import type { GitRepo, GitEvent, GitEventStatus, GitProvider } from '../types'
import AddRepoModal from './AddRepoModal'

// ── Provider logo ─────────────────────────────────────────────────────────────

function GitHubLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

function GitLabLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
    </svg>
  )
}

function ProviderBadge({ provider, apiUrl }: { provider: GitProvider; apiUrl?: string }) {
  if (provider === 'github') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-700 rounded text-xs font-medium text-slate-200">
        <GitHubLogo size={12} />
        GitHub
      </span>
    )
  }
  const host = apiUrl ? new URL(apiUrl).hostname : 'GitLab'
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-orange-950/60 border border-orange-800/40 rounded text-xs font-medium text-orange-300">
      <GitLabLogo size={12} />
      {host}
    </span>
  )
}

// ── Pipeline / status badge ───────────────────────────────────────────────────

function PipelineBadge({ status }: { status?: GitEventStatus }) {
  if (!status) return null
  const map: Record<string, { label: string; className: string; Icon: LucideIcon }> = {
    success:   { label: 'Passing',   className: 'text-green-400 bg-green-400/10 border-green-500/20',  Icon: CheckCircle },
    failed:    { label: 'Failed',    className: 'text-red-400 bg-red-400/10 border-red-500/20',        Icon: XCircle },
    running:   { label: 'Running',   className: 'text-blue-400 bg-blue-400/10 border-blue-500/20',     Icon: Loader },
    pending:   { label: 'Pending',   className: 'text-amber-400 bg-amber-400/10 border-amber-500/20',  Icon: Clock },
    cancelled: { label: 'Cancelled', className: 'text-slate-400 bg-slate-400/10 border-slate-500/20', Icon: AlertCircle },
  }
  const cfg = map[status]
  if (!cfg) return null
  const { label, className, Icon } = cfg
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium', className)}>
      <Icon size={11} className={status === 'running' ? 'animate-spin' : ''} />
      {label}
    </span>
  )
}

function EventStatusBadge({ status }: { status?: GitEventStatus }) {
  if (!status) return null
  const map: Record<string, string> = {
    open:      'bg-blue-500/15 text-blue-400 border-blue-500/20',
    merged:    'bg-purple-500/15 text-purple-400 border-purple-500/20',
    closed:    'bg-slate-500/15 text-slate-400 border-slate-600',
    success:   'bg-green-500/15 text-green-400 border-green-500/20',
    failed:    'bg-red-500/15 text-red-400 border-red-500/20',
    running:   'bg-blue-500/15 text-blue-400 border-blue-500/20',
    pending:   'bg-amber-500/15 text-amber-400 border-amber-500/20',
    cancelled: 'bg-slate-500/15 text-slate-400 border-slate-600',
  }
  return (
    <span className={clsx('text-xs px-1.5 py-0.5 rounded border font-medium capitalize', map[status] ?? '')}>
      {status}
    </span>
  )
}

// ── Event icon ────────────────────────────────────────────────────────────────

function EventIcon({ event }: { event: GitEvent }) {
  switch (event.type) {
    case 'push':
      return <GitCommit size={13} className="text-slate-400 flex-shrink-0 mt-0.5" />
    case 'pull_request':
      return event.status === 'merged'
        ? <GitMerge size={13} className="text-purple-400 flex-shrink-0 mt-0.5" />
        : <GitPullRequest size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />
    case 'merge_request':
      return event.status === 'merged'
        ? <GitMerge size={13} className="text-purple-400 flex-shrink-0 mt-0.5" />
        : <GitMerge size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />
    case 'pipeline':
      if (event.status === 'success') return <CheckCircle size={13} className="text-green-400 flex-shrink-0 mt-0.5" />
      if (event.status === 'failed')  return <XCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
      if (event.status === 'running') return <Loader size={13} className="text-blue-400 flex-shrink-0 mt-0.5 animate-spin" />
      return <Clock size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
    case 'issue':
      return <Circle size={13} className={clsx('flex-shrink-0 mt-0.5', event.status === 'open' ? 'text-green-400' : 'text-slate-500')} />
    case 'release':
      return <Tag size={13} className="text-indigo-400 flex-shrink-0 mt-0.5" />
    default:
      return <GitBranch size={13} className="text-slate-400 flex-shrink-0 mt-0.5" />
  }
}

// ── Inline settings panel ─────────────────────────────────────────────────────

function RepoSettingsPanel({ repo, onClose }: { repo: GitRepo; onClose: () => void }) {
  const { updateRepo } = useStore()
  const [displayName, setDisplayName] = useState(repo.displayName)
  const [token, setToken] = useState(repo.token ?? '')
  const [defaultBranch, setDefaultBranch] = useState(repo.defaultBranch)
  const [apiUrl, setApiUrl] = useState(repo.apiUrl ?? '')

  function handleSave() {
    updateRepo(repo.id, {
      displayName,
      token: token || undefined,
      defaultBranch,
      apiUrl: apiUrl || undefined,
    })
    onClose()
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-700/60 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Display Name</label>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Default Branch</label>
          <input
            value={defaultBranch}
            onChange={e => setDefaultBranch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
          />
        </div>
      </div>

      {repo.provider === 'gitlab' && (
        <div>
          <label className="block text-xs text-slate-400 mb-1">GitLab Instance URL</label>
          <input
            value={apiUrl}
            onChange={e => setApiUrl(e.target.value)}
            placeholder="https://gitlab.company.com"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
          />
        </div>
      )}

      <div>
        <label className="block text-xs text-slate-400 mb-1">Personal Access Token</label>
        <input
          type="password"
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="ghp_… or glpat-…"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
        />
        <p className="text-xs text-slate-500 mt-1">
          Needs <code className="text-slate-400">repo</code> (GitHub) or <code className="text-slate-400">read_api</code> (GitLab) scope.
        </p>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors"
        >
          <Save size={12} />
          Save
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-medium transition-colors"
        >
          <X size={12} />
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Repo card ─────────────────────────────────────────────────────────────────

function RepoCard({ repo }: { repo: GitRepo }) {
  const { syncRepo, removeRepo, syncingRepoIds } = useStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [eventsExpanded, setEventsExpanded] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isSyncing = syncingRepoIds.includes(repo.id)
  const visibleEvents = eventsExpanded ? repo.events : repo.events.slice(0, 3)

  const prLabel = repo.provider === 'gitlab' ? 'MRs' : 'PRs'

  function handleRemove() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    removeRepo(repo.id)
  }

  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 transition-colors">
      {/* ── Header ── */}
      <div className="flex items-start gap-3 mb-4">
        <div className={clsx(
          'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
          repo.provider === 'github' ? 'bg-slate-700 text-slate-200' : 'bg-orange-950 text-orange-300'
        )}>
          {repo.provider === 'github' ? <GitHubLogo size={18} /> : <GitLabLogo size={18} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={repo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-slate-100 hover:text-blue-400 transition-colors flex items-center gap-1 group"
            >
              {repo.name}
              <ExternalLink size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" />
            </a>
            <ProviderBadge provider={repo.provider} apiUrl={repo.apiUrl} />
            {repo.stars !== undefined && (
              <span className="text-xs text-slate-500 flex items-center gap-0.5">
                <Star size={10} />
                {repo.stars}
              </span>
            )}
          </div>
          {repo.description && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{repo.description}</p>
          )}
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <PipelineBadge status={repo.pipelineStatus} />

        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
          <GitPullRequest size={12} />
          <span className={clsx('font-medium', repo.openPRs > 0 ? 'text-blue-400' : 'text-slate-400')}>
            {repo.openPRs}
          </span>
          {' open '}{prLabel}
        </span>

        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
          <AlertCircle size={12} />
          <span className={clsx('font-medium', repo.openIssues > 0 ? 'text-amber-400' : 'text-slate-400')}>
            {repo.openIssues}
          </span>
          {' issues'}
        </span>

        <span className="inline-flex items-center gap-1 text-xs text-slate-500 ml-auto">
          <GitBranch size={11} />
          {repo.defaultBranch}
        </span>
      </div>

      {/* ── Events ── */}
      {repo.events.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setEventsExpanded(v => !v)}
            className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-200 mb-2 transition-colors"
          >
            {eventsExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Recent Activity
            <span className="ml-1 text-slate-600">({repo.events.length})</span>
          </button>

          <div className="space-y-1.5">
            {visibleEvents.map(event => (
              <a
                key={event.id}
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-800/70 transition-colors group"
              >
                <EventIcon event={event} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-200 truncate max-w-[280px] leading-snug">
                      {event.number ? (
                        <span className="text-slate-500 mr-1">#{event.number}</span>
                      ) : event.sha ? (
                        <code className="text-slate-500 mr-1 font-mono">{event.sha}</code>
                      ) : null}
                      {event.title}
                    </span>
                    {event.status && <EventStatusBadge status={event.status} />}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500">{event.author}</span>
                    {event.branch && event.type === 'push' && (
                      <span className="text-xs text-slate-600 flex items-center gap-0.5">
                        <GitBranch size={9} />{event.branch}
                      </span>
                    )}
                    <span className="text-xs text-slate-600 ml-auto">{timeAgo(event.timestamp)}</span>
                  </div>
                </div>
                <ExternalLink size={11} className="text-slate-600 opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5 transition-opacity" />
              </a>
            ))}

            {!eventsExpanded && repo.events.length > 3 && (
              <button
                onClick={() => setEventsExpanded(true)}
                className="text-xs text-slate-500 hover:text-slate-300 pl-2 transition-colors"
              >
                +{repo.events.length - 3} more events
              </button>
            )}
          </div>
        </div>
      )}

      {repo.events.length === 0 && (
        <div className="mb-4 py-4 text-center text-xs text-slate-600 border border-dashed border-slate-800 rounded-lg">
          No events yet — click Sync to fetch latest activity
        </div>
      )}

      {/* ── Footer ── */}
      <div className="flex items-center gap-2 pt-3 border-t border-slate-800/70">
        <span className="text-xs text-slate-600 flex items-center gap-1 flex-1">
          <RefreshCw size={10} />
          {repo.lastSync ? `Synced ${timeAgo(repo.lastSync)}` : 'Never synced'}
        </span>

        <button
          onClick={() => syncRepo(repo.id)}
          disabled={isSyncing}
          className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          aria-label="Sync repository"
        >
          <RefreshCw size={11} className={isSyncing ? 'animate-spin' : ''} />
          {isSyncing ? 'Syncing…' : 'Sync'}
        </button>

        <button
          onClick={() => { setSettingsOpen(v => !v); setConfirmDelete(false) }}
          className={clsx(
            'p-1.5 rounded-lg text-xs transition-colors',
            settingsOpen
              ? 'bg-slate-700 text-slate-200'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200'
          )}
          aria-label="Repository settings"
        >
          <Settings2 size={13} />
        </button>

        <button
          onClick={handleRemove}
          className={clsx(
            'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
            confirmDelete
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400'
          )}
          aria-label="Remove repository"
        >
          <Trash2 size={11} />
          {confirmDelete ? 'Confirm' : ''}
        </button>
      </div>

      {/* ── Inline settings ── */}
      {settingsOpen && (
        <RepoSettingsPanel repo={repo} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
        <GitBranch size={28} className="text-slate-600" />
      </div>
      <h3 className="text-base font-semibold text-slate-300 mb-1">No repositories linked</h3>
      <p className="text-sm text-slate-500 max-w-sm mb-6">
        Connect GitHub or GitLab repositories to track commits, pull requests, pipelines, and issues in one place.
      </p>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
      >
        <Plus size={15} />
        Add First Repository
      </button>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function RepositoriesView() {
  const { activeProjectId, repos, addRepoModalOpen, setAddRepoModalOpen } = useStore()
  const projectRepos = repos[activeProjectId] ?? []

  const totalOpenPRs    = projectRepos.reduce((n, r) => n + r.openPRs, 0)
  const totalOpenIssues = projectRepos.reduce((n, r) => n + r.openIssues, 0)
  const failedPipelines = projectRepos.filter(r => r.pipelineStatus === 'failed').length

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Repositories</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {projectRepos.length === 0
              ? 'No repositories linked'
              : `${projectRepos.length} ${projectRepos.length === 1 ? 'repository' : 'repositories'} linked`}
          </p>
        </div>
        {projectRepos.length > 0 && (
          <button
            onClick={() => setAddRepoModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={15} />
            Add Repository
          </button>
        )}
      </div>

      {/* Summary stats (only when repos exist) */}
      {projectRepos.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <GitPullRequest size={14} className="text-blue-400" />
              <span className="text-xs text-slate-400">Open PRs / MRs</span>
            </div>
            <div className="text-2xl font-bold text-slate-100">{totalOpenPRs}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle size={14} className="text-amber-400" />
              <span className="text-xs text-slate-400">Open Issues</span>
            </div>
            <div className="text-2xl font-bold text-slate-100">{totalOpenIssues}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle size={14} className="text-red-400" />
              <span className="text-xs text-slate-400">Failed Pipelines</span>
            </div>
            <div className={clsx('text-2xl font-bold', failedPipelines > 0 ? 'text-red-400' : 'text-slate-100')}>
              {failedPipelines}
            </div>
          </div>
        </div>
      )}

      {/* Repo list or empty state */}
      {projectRepos.length === 0 ? (
        <EmptyState onAdd={() => setAddRepoModalOpen(true)} />
      ) : (
        <div className="space-y-4">
          {projectRepos.map(repo => (
            <RepoCard key={repo.id} repo={repo} />
          ))}
        </div>
      )}

      {/* Add Repo Modal */}
      {addRepoModalOpen && <AddRepoModal />}
    </div>
  )
}
