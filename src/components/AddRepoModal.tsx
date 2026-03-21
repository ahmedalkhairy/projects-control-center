import { useState } from 'react'
import { X, GitBranch, ExternalLink } from 'lucide-react'
import clsx from 'clsx'
import { useStore } from '../store'
import type { GitProvider } from '../types'

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

export default function AddRepoModal() {
  const { activeProjectId, projects, addRepo, setAddRepoModalOpen } = useStore()

  const activeProject = projects.find(p => p.id === activeProjectId)

  const [provider, setProvider] = useState<GitProvider>('github')
  const [repoName, setRepoName] = useState('')          // "owner/repo"
  const [displayName, setDisplayName] = useState('')
  const [token, setToken] = useState('')
  const [defaultBranch, setDefaultBranch] = useState('main')
  const [apiUrl, setApiUrl] = useState('')              // self-hosted GitLab base URL
  const [error, setError] = useState('')

  // Auto-fill display name from repo name
  function handleRepoNameChange(val: string) {
    setRepoName(val)
    if (!displayName || displayName === deriveDisplayName(repoName)) {
      setDisplayName(deriveDisplayName(val))
    }
    setError('')
  }

  function deriveDisplayName(name: string) {
    const parts = name.split('/')
    return parts[parts.length - 1]
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  function buildUrl() {
    if (provider === 'github') return `https://github.com/${repoName}`
    const base = apiUrl.replace(/\/$/, '') || 'https://gitlab.com'
    return `${base}/${repoName}`
  }

  function validate() {
    if (!repoName.trim()) return 'Repository path is required (e.g. owner/repo)'
    if (!repoName.includes('/')) return 'Path must include owner/group (e.g. owner/repo)'
    if (provider === 'gitlab' && apiUrl && !/^https?:\/\/.+/.test(apiUrl))
      return 'Instance URL must start with http:// or https://'
    return ''
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }

    addRepo({
      projectId: activeProjectId,
      provider,
      name: repoName.trim(),
      displayName: displayName.trim() || deriveDisplayName(repoName),
      url: buildUrl(),
      apiUrl: provider === 'gitlab' && apiUrl ? apiUrl.replace(/\/$/, '') : undefined,
      token: token || undefined,
      defaultBranch: defaultBranch.trim() || 'main',
    })
  }

  const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(2,6,23,0.85)' }}
    >
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
              <GitBranch size={16} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Add Repository</h2>
              {activeProject && (
                <p className="text-xs text-slate-500">to {activeProject.name}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setAddRepoModalOpen(false)}
            className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Provider picker */}
          <div>
            <label className={labelCls}>Provider</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'github', label: 'GitHub', desc: 'github.com', Logo: GitHubLogo, color: 'text-slate-200' },
                { id: 'gitlab', label: 'GitLab', desc: 'Self-hosted or gitlab.com', Logo: GitLabLogo, color: 'text-orange-300' },
              ] as const).map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id)}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                    provider === p.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  )}
                >
                  <span className={p.color}><p.Logo size={20} /></span>
                  <div>
                    <div className="text-sm font-medium text-slate-100">{p.label}</div>
                    <div className="text-xs text-slate-500">{p.desc}</div>
                  </div>
                  {provider === p.id && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-blue-500" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Self-hosted GitLab URL */}
          {provider === 'gitlab' && (
            <div>
              <label className={labelCls}>
                Instance URL
                <span className="text-slate-600 font-normal ml-1">(optional, defaults to gitlab.com)</span>
              </label>
              <input
                value={apiUrl}
                onChange={e => setApiUrl(e.target.value)}
                placeholder="https://gitlab.company.com"
                className={inputCls}
              />
            </div>
          )}

          {/* Repo path */}
          <div>
            <label className={labelCls}>
              Repository Path <span className="text-red-400">*</span>
            </label>
            <input
              value={repoName}
              onChange={e => handleRepoNameChange(e.target.value)}
              placeholder={provider === 'github' ? 'owner/repository' : 'group/subgroup/repository'}
              className={inputCls}
              autoFocus
            />
            {repoName && !error && (
              <a
                href={buildUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-blue-400 mt-1 transition-colors"
              >
                <ExternalLink size={10} />
                {buildUrl()}
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Display name */}
            <div>
              <label className={labelCls}>Display Name</label>
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="My Repo"
                className={inputCls}
              />
            </div>

            {/* Default branch */}
            <div>
              <label className={labelCls}>Default Branch</label>
              <input
                value={defaultBranch}
                onChange={e => setDefaultBranch(e.target.value)}
                placeholder="main"
                className={inputCls}
              />
            </div>
          </div>

          {/* Token */}
          <div>
            <label className={labelCls}>
              Personal Access Token
              <span className="text-slate-600 font-normal ml-1">(optional, for private repos)</span>
            </label>
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder={provider === 'github' ? 'ghp_xxxxxxxxxxxx' : 'glpat-xxxxxxxxxxxx'}
              className={inputCls}
            />
            <p className="text-xs text-slate-600 mt-1">
              {provider === 'github'
                ? 'Needs repo scope — Settings → Developer settings → Personal access tokens'
                : 'Needs read_api scope — User Settings → Access Tokens'}
            </p>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <GitBranch size={15} />
              Add Repository
            </button>
            <button
              type="button"
              onClick={() => setAddRepoModalOpen(false)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
