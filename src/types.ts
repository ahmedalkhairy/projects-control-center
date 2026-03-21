export type NavSection = 'inbox' | 'tasks' | 'quick-actions' | 'repositories' | 'integrations' | 'settings'
export type MessageSource = 'jira' | 'email' | 'whatsapp'
export type MessageStatus = 'unread' | 'read' | 'handled'
export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type TaskStatus = 'todo' | 'in-progress' | 'done'
export type TaskType = 'local' | 'jira'
export type IntegrationType = 'jira' | 'email' | 'whatsapp'

export interface Project {
  id: string
  name: string
  color: string
  icon: string
  description: string
  createdAt: string
}

export interface Message {
  id: string
  projectId: string
  source: MessageSource
  title: string
  body: string
  from: string
  timestamp: string
  status: MessageStatus
  priority: Priority
  labels?: string[]
  externalLink?: string
}

export interface Task {
  id: string
  projectId: string
  title: string
  description?: string
  status: TaskStatus
  priority: Priority
  dueDate?: string
  type: TaskType
  jiraKey?: string
  jiraLink?: string
  createdAt: string
  tags?: string[]
  fromMessageId?: string
  attachments?: string[]   // base64 data URLs
}

export interface QuickAction {
  id: string
  projectId: string
  label: string
  url: string
  icon: string
  group: string
  color: string
  order: number
}

export interface Integration {
  id: string
  projectId: string
  type: IntegrationType
  enabled: boolean
  config: Record<string, string>
  lastSync?: string
}

// ─── Git / Repository types ───────────────────────────────────────────────────

export type GitProvider = 'github' | 'gitlab'

export type GitEventType =
  | 'push'
  | 'pull_request'
  | 'merge_request'
  | 'pipeline'
  | 'issue'
  | 'release'

export type GitEventStatus =
  | 'open'
  | 'closed'
  | 'merged'
  | 'success'
  | 'failed'
  | 'running'
  | 'pending'
  | 'cancelled'

export interface GitEvent {
  id: string
  repoId: string
  type: GitEventType
  title: string
  author: string
  timestamp: string
  url: string
  status?: GitEventStatus
  branch?: string
  number?: number  // PR / MR / Issue number
  sha?: string     // short commit SHA
}

export interface GitRepo {
  id: string
  projectId: string
  provider: GitProvider
  /** "owner/repo" or "group/subgroup/repo" */
  name: string
  displayName: string
  /** Web URL of the repository */
  url: string
  /** Base URL for self-hosted GitLab, e.g. https://gitlab.company.com */
  apiUrl?: string
  /** Personal access token (stored locally, never sent to our servers) */
  token?: string
  defaultBranch: string
  description?: string
  lastSync?: string
  events: GitEvent[]
  openPRs: number
  openIssues: number
  pipelineStatus?: GitEventStatus
  stars?: number
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string
  projectId: string
  projectName: string
  title: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
  timestamp: string
  read: boolean
  url?: string
}
