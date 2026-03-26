export type NavSection = 'inbox' | 'tasks' | 'quick-actions' | 'repositories' | 'integrations' | 'settings' | 'focus' | 'notes' | 'debt' | 'standup' | 'milestones' | 'digest' | 'ai'
export type MessageSource = 'jira' | 'github' | 'gitlab' | 'email' | 'whatsapp' | 'gitlab-integration'
export type MessageStatus = 'unread' | 'read' | 'handled'
export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type TaskStatus = 'todo' | 'in-progress' | 'done'
export type TaskType = 'local' | 'jira' | 'gitlab'
export type IntegrationType = 'jira' | 'email' | 'whatsapp' | 'gitlab'

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

export interface TaskReminder {
  enabled: boolean
  mode: 'once' | 'repeat'
  nextAt: string             // ISO — when to fire next
  intervalMinutes?: number   // repeat mode only
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
  gitlabIid?: number
  gitlabLink?: string
  // Jira sprint & story metadata
  sprint?: string          // active sprint name, e.g. "Sprint 12"
  storyPoints?: number     // story points estimate
  epicName?: string        // parent epic name
  parentKey?: string       // parent issue key (story/epic this task belongs to)
  parentSummary?: string   // parent issue summary
  createdAt: string
  tags?: string[]
  fromMessageId?: string
  attachments?: string[]   // base64 data URLs
  reminder?: TaskReminder
  completedAt?: string     // ISO — set when status transitions to 'done'
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

// ─── Meeting Notes ────────────────────────────────────────────────────────────

export interface MeetingNote {
  id: string
  projectId: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
  extractedTaskIds: string[]
}

// ─── Milestones ───────────────────────────────────────────────────────────────

export type MilestoneStatus = 'on-track' | 'at-risk' | 'delayed' | 'completed'

export interface Milestone {
  id: string
  projectId: string
  title: string
  description?: string
  dueDate: string
  status: MilestoneStatus
  linkedTaskIds: string[]
  createdAt: string
  updatedAt: string
}

// ─── Tech Debt ────────────────────────────────────────────────────────────────

export type TechDebtCategory =
  | 'code-quality'
  | 'architecture'
  | 'testing'
  | 'security'
  | 'performance'
  | 'documentation'
  | 'dependencies'

export type TechDebtEffort = 'small' | 'medium' | 'large' | 'epic'

export interface TechDebtItem {
  id: string
  projectId: string
  title: string
  description?: string
  category: TechDebtCategory
  priority: Priority
  effort: TechDebtEffort
  status: 'open' | 'in-progress' | 'resolved'
  affectedArea?: string
  taskId?: string        // if converted to a task
  createdAt: string
  updatedAt: string
}

// ─── WIP Limits ───────────────────────────────────────────────────────────────

export interface WipLimit {
  min?: number   // warn yellow if count falls below this
  max?: number   // warn red if count exceeds this
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
