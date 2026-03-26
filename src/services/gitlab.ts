/**
 * GitLab REST API v4 client.
 *
 * In Electron: direct fetch — no CORS restrictions.
 * In browser dev mode: calls route through the Vite proxy (/api/gitlab-proxy).
 */

import type { Message, Priority, Task, TaskStatus } from '../types'

// ─── Electron detection ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const electronAPI = (): any | null =>
  typeof window !== 'undefined' && 'electronAPI' in window
    ? (window as any).electronAPI
    : null

// ─── Config ───────────────────────────────────────────────────────────────────

export interface GitLabConfig {
  /** https://gitlab.com or https://gitlab.yourcompany.com */
  instanceUrl: string
  /** group/project  or  group/subgroup/project */
  projectPath: string
  /** Personal Access Token with `api` scope */
  token: string
}

// ─── Raw GitLab shapes ────────────────────────────────────────────────────────

interface GLUser {
  id: number
  username: string
  name: string
}

interface GLLabel {
  name: string
  color: string
}

interface GLIssue {
  id: number
  iid: number
  title: string
  description: string | null
  state: 'opened' | 'closed'
  web_url: string
  created_at: string
  updated_at: string
  labels: string[]
  assignees: GLUser[]
  author: GLUser
  milestone: { title: string } | null
  severity?: string
}

interface GLPipeline {
  id: number
  iid?: number
  status: string
  ref: string
  web_url: string
  updated_at: string
  created_at: string
  user?: { username: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PROXY = '/api/gitlab-proxy'

function proxyHeaders(cfg: GitLabConfig): HeadersInit {
  return {
    'x-gitlab-url':   cfg.instanceUrl,
    'x-gitlab-token': cfg.token,
    'Content-Type':   'application/json',
  }
}

function base(cfg: GitLabConfig): string {
  return (cfg.instanceUrl ?? 'https://gitlab.com').replace(/\/$/, '')
}

function encodedPath(cfg: GitLabConfig): string {
  return encodeURIComponent((cfg.projectPath ?? '').replace(/^\//, ''))
}

/** True when running inside the packaged Electron app (not browser dev mode). */
function isElectron(): boolean {
  return typeof window !== 'undefined' && Boolean(electronAPI()?.gitlab)
}

/** Browser-dev-mode only: route through the Vite GitLab proxy. */
async function proxyFetch(cfg: GitLabConfig, path: string): Promise<unknown> {
  const res = await fetch(`${PROXY}${path}`, { headers: proxyHeaders(cfg) })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try { const body = await res.json(); msg = body.message ?? body.error ?? msg } catch { /* ignore */ }
    throw new Error(`GitLab API error: ${msg}`)
  }
  return res.json()
}

/** Browser-dev-mode only: PUT request through the Vite GitLab proxy. */
async function proxyPut(cfg: GitLabConfig, path: string, body: object): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${PROXY}${path}`, {
    method:  'PUT',
    headers: proxyHeaders(cfg),
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try { const data = await res.json(); msg = data.message ?? data.error ?? msg } catch { /* ignore */ }
    return { ok: false, error: msg }
  }
  return { ok: true }
}

function mapPriority(labels: string[], severity?: string): Priority {
  const allLabels = [...labels, severity ?? ''].map(l => l.toLowerCase())
  for (const l of allLabels) {
    if (l.includes('critical') || l.includes('blocker')) return 'critical'
    if (l.includes('high') || l.includes('major'))       return 'high'
    if (l.includes('low') || l.includes('minor'))        return 'low'
  }
  return 'medium'
}

function mapStatus(state: GLIssue['state']): TaskStatus {
  return state === 'closed' ? 'done' : 'todo'
}

function issueToTask(issue: GLIssue, projectId: string, cfg: GitLabConfig): Omit<Task, 'createdAt'> {
  return {
    id:          `gitlab-${issue.id}`,
    projectId,
    title:       `[GL-${issue.iid}] ${issue.title}`,
    description: issue.description ?? undefined,
    status:      mapStatus(issue.state),
    priority:    mapPriority(issue.labels, issue.severity),
    type:        'gitlab',
    gitlabIid:   issue.iid,
    gitlabLink:  issue.web_url,
    tags:        issue.labels.slice(0, 5),
    assignee:    issue.assignees?.[0]?.name ?? issue.assignees?.[0]?.username ?? undefined,
    gitlabStatus: issue.state,
  }
}

function issueToMessage(issue: GLIssue, projectId: string): Message {
  return {
    id:           `gitlab-${issue.id}`,
    projectId,
    source:       'gitlab',
    title:        `[GL-${issue.iid}] ${issue.title}`,
    body:         issue.description?.slice(0, 300) || `${issue.state} issue`,
    from:         issue.author?.username ?? 'gitlab',
    timestamp:    issue.updated_at,
    status:       'unread',
    priority:     mapPriority(issue.labels, issue.severity),
    labels:       issue.labels.slice(0, 4),
    externalLink: issue.web_url,
  }
}

function issueToNotification(issue: GLIssue, projectId: string): Message {
  return {
    id:           `gitlab-notif-${issue.id}`,
    projectId,
    source:       'gitlab',
    title:        `[GL-${issue.iid}] ${issue.title}`,
    body:         `${issue.state} · ${issue.labels.join(', ') || 'No labels'}`,
    from:         issue.author?.username ?? 'gitlab',
    timestamp:    issue.updated_at,
    status:       'unread',
    priority:     mapPriority(issue.labels, issue.severity),
    labels:       issue.labels.slice(0, 4),
    externalLink: issue.web_url,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface TestResult {
  ok:           boolean
  displayName?: string
  error?:       string
}

/**
 * Test connection by calling GET /api/v4/user.
 * Returns the authenticated user's name on success.
 */
export async function testGitLabConnection(cfg: GitLabConfig): Promise<TestResult> {
  try {
    if (isElectron()) {
      return await electronAPI().gitlab.test(cfg) as TestResult
    }
    const user = await proxyFetch(cfg, '/api/v4/user') as GLUser
    return { ok: true, displayName: user.name ?? user.username }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/**
 * Fetch open issues assigned to the current user from the configured project.
 * Returns Task objects ready to be upserted into the store.
 */
export async function fetchGitLabIssuesAsTasks(
  cfg: GitLabConfig,
  projectId: string,
  maxResults = 100,
): Promise<Array<Omit<Task, 'createdAt'>>> {
  if (isElectron()) {
    const res = await electronAPI().gitlab.fetchIssues(cfg, maxResults) as { ok: boolean; issues?: GLIssue[]; error?: string }
    if (!res.ok) throw new Error(res.error ?? 'GitLab fetch failed')
    return (res.issues ?? []).map(i => issueToTask(i, projectId, cfg))
  }
  const ep = encodedPath(cfg)
  const params = new URLSearchParams({
    state:          'opened',
    assigned_to_me: 'true',
    per_page:       String(maxResults),
    order_by:       'updated_at',
    sort:           'desc',
  })
  const issues = await proxyFetch(cfg, `/api/v4/projects/${ep}/issues?${params}`) as GLIssue[]
  return (issues ?? []).map(i => issueToTask(i, projectId, cfg))
}

/**
 * Fetch recently updated issues (last 7 days) from the configured project.
 * Returns Message objects to be merged into the inbox.
 */
export async function fetchGitLabNotifications(
  cfg: GitLabConfig,
  projectId: string,
  maxResults = 50,
): Promise<Message[]> {
  if (isElectron()) {
    const res = await electronAPI().gitlab.fetchNotifications(cfg, maxResults) as { ok: boolean; issues?: GLIssue[]; error?: string }
    if (!res.ok) throw new Error(res.error ?? 'GitLab fetch failed')
    return (res.issues ?? []).map(i => issueToNotification(i, projectId))
  }
  const ep    = encodedPath(cfg)
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const params = new URLSearchParams({
    state:         'opened',
    updated_after: since,
    per_page:      String(maxResults),
    order_by:      'updated_at',
    sort:          'desc',
  })
  const issues = await proxyFetch(cfg, `/api/v4/projects/${ep}/issues?${params}`) as GLIssue[]
  return (issues ?? []).map(i => issueToNotification(i, projectId))
}

/**
 * Fetch the latest pipelines for the configured project.
 * Returns up to 10 recent pipeline objects.
 */
export async function fetchGitLabPipelines(
  cfg: GitLabConfig,
  perPage = 10,
): Promise<GLPipeline[]> {
  const ep     = encodedPath(cfg)
  const params = new URLSearchParams({ per_page: String(perPage), order_by: 'updated_at', sort: 'desc' })
  // Pipelines not yet in IPC — use proxy in dev, skip silently in Electron
  if (isElectron()) return []
  const pipelines = await proxyFetch(cfg, `/api/v4/projects/${ep}/pipelines?${params}`) as GLPipeline[]
  return pipelines ?? []
}

/**
 * Push a local status change to GitLab by opening or closing the issue.
 * 'done' → close the issue | 'todo' / 'in-progress' → reopen the issue.
 */
export async function updateGitLabIssueStatus(
  cfg: GitLabConfig,
  iid: number,
  appStatus: TaskStatus,
): Promise<{ ok: boolean; error?: string }> {
  const stateEvent = appStatus === 'done' ? 'close' : 'reopen'

  // ── Electron: use IPC ──
  if (isElectron()) {
    return electronAPI().gitlab.updateStatus(cfg, iid, stateEvent)
  }

  // ── Browser dev: use Vite proxy ──
  const ep = encodedPath(cfg)
  return proxyPut(cfg, `/api/v4/projects/${ep}/issues/${iid}`, { state_event: stateEvent })
}
