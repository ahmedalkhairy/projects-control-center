/**
 * Real Jira REST API client.
 *
 * In Electron: calls route through IPC → main process (Node.js, no CORS).
 * In browser dev mode: calls route through the Vite proxy (/api/jira-proxy).
 */

import type { Message, Priority, Task, TaskStatus } from '../types'

// ─── Electron detection ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const electronAPI = (): any | null =>
  typeof window !== 'undefined' && 'electronAPI' in window
    ? (window as any).electronAPI
    : null

// ─── Config ───────────────────────────────────────────────────────────────────

export interface JiraConfig {
  serverUrl:  string
  projectKey: string
  username:   string
  apiToken:   string
}

// ─── Raw Jira shapes ──────────────────────────────────────────────────────────

interface JiraUser {
  displayName: string
  emailAddress?: string
  accountId?: string
}

interface JiraStatus {
  name: string
}

interface JiraPriority {
  name: string
}

interface JiraIssueType {
  name: string
}

interface JiraIssueFields {
  summary:     string
  description: string | null | { content?: Array<{ content?: Array<{ text?: string }> }> }
  status:      JiraStatus
  priority:    JiraPriority | null
  issuetype:   JiraIssueType
  assignee:    JiraUser | null
  reporter:    JiraUser | null
  created:     string
  updated:     string
  labels?:     string[]
}

interface JiraIssue {
  id:     string
  key:    string
  self:   string
  fields: JiraIssueFields
}

interface JiraSearchResult {
  issues:     JiraIssue[]
  total:      number
  maxResults: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PROXY = '/api/jira-proxy'

function proxyHeaders(cfg: JiraConfig): HeadersInit {
  return {
    'x-jira-url':      cfg.serverUrl,
    'x-jira-username': cfg.username,
    'x-jira-token':    cfg.apiToken,
    'Content-Type':    'application/json',
  }
}

/**
 * Jira Cloud (*.atlassian.net) requires API v3 with updated endpoints.
 * Self-hosted Jira Server / Data Center still uses API v2.
 */
function isCloud(serverUrl: string): boolean {
  return /atlassian\.net/i.test(serverUrl)
}

function apiBase(cfg: JiraConfig): string {
  return isCloud(cfg.serverUrl) ? '/rest/api/3' : '/rest/api/2'
}

/** Extract plain text from Jira description (supports both plain string and Atlassian Document Format). */
function extractDescription(desc: JiraIssueFields['description']): string {
  if (!desc) return ''
  if (typeof desc === 'string') return desc

  // Atlassian Document Format (ADF) — Cloud
  const lines: string[] = []
  for (const block of desc.content ?? []) {
    for (const inline of block.content ?? []) {
      if (inline.text) lines.push(inline.text)
    }
  }
  return lines.join(' ')
}

function mapPriority(jiraPriority: JiraPriority | null): Priority {
  const name = (jiraPriority?.name ?? 'medium').toLowerCase()
  if (name.includes('critical') || name.includes('blocker')) return 'critical'
  if (name.includes('high') || name.includes('major'))       return 'high'
  if (name.includes('low') || name.includes('minor') || name.includes('trivial')) return 'low'
  return 'medium'
}

function mapStatus(jiraStatus: JiraStatus): TaskStatus {
  const name = jiraStatus.name.toLowerCase()
  if (name.includes('done') || name.includes('closed') || name.includes('resolved') || name.includes('complete')) return 'done'
  if (name.includes('progress') || name.includes('review') || name.includes('testing') || name.includes('qa')) return 'in-progress'
  return 'todo'
}

function issueToTask(issue: JiraIssue, projectId: string, serverUrl: string): Omit<Task, 'createdAt'> {
  const fields   = issue.fields
  const browseUrl = `${serverUrl.replace(/\/$/, '')}/browse/${issue.key}`

  return {
    id:          `jira-${issue.id}`,
    projectId,
    title:       `[${issue.key}] ${fields.summary}`,
    description: extractDescription(fields.description) || undefined,
    status:      mapStatus(fields.status),
    priority:    mapPriority(fields.priority),
    type:        'jira',
    jiraKey:     issue.key,
    jiraLink:    browseUrl,
    tags:        [fields.issuetype.name, ...(fields.labels ?? [])],
  }
}

function issueToMessage(issue: JiraIssue, projectId: string, serverUrl: string): Message {
  const fields = issue.fields
  const reporter = fields.reporter?.displayName ?? fields.reporter?.emailAddress ?? 'Jira'
  const browseUrl = `${serverUrl.replace(/\/$/, '')}/browse/${issue.key}`

  return {
    id:           `jira-${issue.id}`,
    projectId,
    source:       'jira',
    title:        `[${issue.key}] ${fields.summary}`,
    body:         extractDescription(fields.description) || `${fields.issuetype.name} — ${fields.status.name}`,
    from:         reporter,
    timestamp:    fields.updated,
    status:       'unread',
    priority:     mapPriority(fields.priority),
    labels:       [fields.issuetype.name, fields.status.name, ...(fields.labels ?? [])],
    externalLink: browseUrl,
  }
}

function issueToNotification(issue: JiraIssue, projectId: string, serverUrl: string): Message {
  const fields    = issue.fields
  const assignee  = fields.assignee?.displayName
  const reporter  = fields.reporter?.displayName ?? fields.reporter?.emailAddress ?? 'Jira'
  const browseUrl = `${serverUrl.replace(/\/$/, '')}/browse/${issue.key}`

  const parts = [fields.status.name, fields.issuetype.name]
  if (assignee) parts.push(`Assigned to ${assignee}`)

  return {
    id:           `jira-notif-${issue.id}`,
    projectId,
    source:       'jira',
    title:        `[${issue.key}] ${fields.summary}`,
    body:         parts.join(' · '),
    from:         reporter,
    timestamp:    fields.updated,
    status:       'unread',
    priority:     mapPriority(fields.priority),
    labels:       [fields.issuetype.name, fields.status.name],
    externalLink: browseUrl,
  }
}

function mapPriorityToJira(priority: string): string {
  switch (priority) {
    case 'critical': return 'Critical'
    case 'high':     return 'High'
    case 'low':      return 'Low'
    default:         return 'Medium'
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface TestResult {
  ok:           boolean
  displayName?: string
  error?:       string
}

export interface CreateIssueResult {
  ok:     boolean
  key?:   string
  id?:    string
  link?:  string
  error?: string
}

/**
 * Create a new Jira issue (Task type) in the given project.
 */
export async function createJiraIssue(
  cfg:         JiraConfig,
  summary:     string,
  description: string,
  priority:    string,
): Promise<CreateIssueResult> {
  const jiraPriority = mapPriorityToJira(priority)

  // ── Electron: use IPC ──
  const api = electronAPI()
  if (api) {
    const result = await api.jira.createIssue(cfg, summary, description, jiraPriority)
    if (!result.ok) return result
    const link = `${cfg.serverUrl.replace(/\/$/, '')}/browse/${result.key}`
    return { ok: true, key: result.key, id: result.id, link }
  }

  // ── Browser dev: use Vite proxy ──
  const base  = apiBase(cfg)
  const cloud = isCloud(cfg.serverUrl)

  const body: Record<string, unknown> = {
    fields: {
      project:   { key: cfg.projectKey },
      summary,
      issuetype: { name: 'Task' },
      priority:  { name: jiraPriority },
      ...(description
        ? cloud
          ? { description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }] } }
          : { description }
        : {}),
    },
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  let res: Response
  try {
    res = await fetch(`${PROXY}${base}/issue`, {
      method:  'POST',
      headers: proxyHeaders(cfg),
      body:    JSON.stringify(body),
      signal:  controller.signal,
    })
  } catch (e) {
    clearTimeout(timeout)
    const msg = (e as Error).name === 'AbortError' ? 'Request timed out (15s)' : (e as Error).message
    return { ok: false, error: msg }
  }
  clearTimeout(timeout)

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const data = await res.json()
      message = data.errors ? Object.values(data.errors).join(', ') : data.errorMessages?.[0] ?? data.message ?? message
    } catch { /* ignore */ }
    return { ok: false, error: message }
  }

  const data = await res.json()
  const link = `${cfg.serverUrl.replace(/\/$/, '')}/browse/${data.key}`
  return { ok: true, key: data.key, id: data.id, link }
}

/**
 * Verify credentials by calling GET /rest/api/2/myself.
 * Returns the authenticated user's display name on success.
 */
export async function testJiraConnection(cfg: JiraConfig): Promise<TestResult> {
  // ── Electron: use IPC (main process, no CORS) ──
  const api = electronAPI()
  if (api) return api.jira.test(cfg)

  // ── Browser dev: use Vite proxy ──
  try {
    const res = await fetch(`${PROXY}${apiBase(cfg)}/myself`, {
      headers: proxyHeaders(cfg),
    })

    if (!res.ok) {
      let message = `HTTP ${res.status}`
      try {
        const body = await res.json()
        message = body.errorMessages?.[0] ?? body.message ?? message
      } catch { /* ignore */ }
      return { ok: false, error: message }
    }

    const body = await res.json()
    return { ok: true, displayName: body.displayName ?? body.name }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/**
 * Fetch issues from a Jira project.
 * JQL: project = KEY AND assignee = currentUser() ORDER BY updated DESC
 * Returns an array of Message objects ready to be merged into the inbox.
 */
export async function fetchJiraIssues(
  cfg: JiraConfig,
  projectId: string,
  maxResults = 50,
): Promise<Message[]> {
  const jql = `project = "${cfg.projectKey}" AND assignee = currentUser() ORDER BY updated DESC`
  const fields = ['summary', 'description', 'status', 'priority', 'issuetype', 'assignee', 'reporter', 'created', 'updated', 'labels']
  const base = apiBase(cfg)

  let res: Response

  if (isCloud(cfg.serverUrl)) {
    // API v3: POST /rest/api/3/search/jql
    res = await fetch(`${PROXY}${base}/search/jql`, {
      method: 'POST',
      headers: proxyHeaders(cfg),
      body: JSON.stringify({ jql, maxResults, fields }),
    })
  } else {
    // API v2: GET /rest/api/2/search (self-hosted)
    const params = new URLSearchParams({
      jql,
      maxResults: String(maxResults),
      fields: fields.join(','),
    })
    res = await fetch(`${PROXY}${base}/search?${params}`, { headers: proxyHeaders(cfg) })
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = await res.json()
      message = body.errorMessages?.[0] ?? body.message ?? message
    } catch { /* ignore */ }
    throw new Error(`Jira sync failed: ${message}`)
  }

  const data: JiraSearchResult = await res.json()
  return (data.issues ?? []).map(issue => issueToMessage(issue, projectId, cfg.serverUrl))
}

/**
 * Fetch Jira issues assigned to currentUser and return them as Task objects.
 * Status is mapped from Jira status → todo / in-progress / done.
 */
export async function fetchJiraIssuesAsTasks(
  cfg: JiraConfig,
  projectId: string,
  maxResults = 100,
): Promise<Array<Omit<Task, 'createdAt'>>> {
  // ── Electron: use IPC ──
  const api = electronAPI()
  if (api) {
    const result = await api.jira.fetchIssues(cfg, projectId)
    if (!result.ok) throw new Error(result.error ?? 'Jira sync failed')
    return (result.tasks ?? []).map((issue: any) => issueToTask(issue, projectId, cfg.serverUrl))
  }

  // ── Browser dev: use Vite proxy ──
  const jql    = `project = "${cfg.projectKey}" AND assignee = currentUser() ORDER BY updated DESC`
  const fields = ['summary', 'description', 'status', 'priority', 'issuetype', 'labels', 'created', 'updated']
  const base   = apiBase(cfg)

  let res: Response

  if (isCloud(cfg.serverUrl)) {
    res = await fetch(`${PROXY}${base}/search/jql`, {
      method:  'POST',
      headers: proxyHeaders(cfg),
      body:    JSON.stringify({ jql, maxResults, fields }),
    })
  } else {
    const params = new URLSearchParams({ jql, maxResults: String(maxResults), fields: fields.join(',') })
    res = await fetch(`${PROXY}${base}/search?${params}`, { headers: proxyHeaders(cfg) })
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = await res.json()
      message = body.errorMessages?.[0] ?? body.message ?? message
    } catch { /* ignore */ }
    throw new Error(`Jira sync failed: ${message}`)
  }

  const data: JiraSearchResult = await res.json()
  return (data.issues ?? []).map(issue => issueToTask(issue, projectId, cfg.serverUrl))
}

/**
 * Fetch recently updated Jira issues (last 7 days) as Inbox notifications.
 * Each issue appears as a message with a direct link to open it in Jira.
 */
export async function fetchJiraNotifications(
  cfg: JiraConfig,
  projectId: string,
  maxResults = 50,
): Promise<Message[]> {
  // ── Electron: use IPC ──
  const api = electronAPI()
  if (api) {
    const result = await api.jira.fetchNotifications(cfg)
    if (!result.ok) throw new Error(result.error ?? 'Jira notifications sync failed')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (result.issues ?? []).map((issue: any) => issueToNotification(issue, projectId, cfg.serverUrl))
  }

  // ── Browser dev: use Vite proxy ──
  const jql    = `project = "${cfg.projectKey}" AND updated >= -7d ORDER BY updated DESC`
  const fields = ['summary', 'status', 'priority', 'issuetype', 'assignee', 'reporter', 'updated', 'labels']
  const base   = apiBase(cfg)

  let res: Response

  if (isCloud(cfg.serverUrl)) {
    res = await fetch(`${PROXY}${base}/search/jql`, {
      method:  'POST',
      headers: proxyHeaders(cfg),
      body:    JSON.stringify({ jql, maxResults, fields }),
    })
  } else {
    const params = new URLSearchParams({ jql, maxResults: String(maxResults), fields: fields.join(',') })
    res = await fetch(`${PROXY}${base}/search?${params}`, { headers: proxyHeaders(cfg) })
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = await res.json()
      message = body.errorMessages?.[0] ?? body.message ?? message
    } catch { /* ignore */ }
    throw new Error(`Jira notifications sync failed: ${message}`)
  }

  const data: JiraSearchResult = await res.json()
  return (data.issues ?? []).map(issue => issueToNotification(issue, projectId, cfg.serverUrl))
}
