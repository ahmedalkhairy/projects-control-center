import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  NavSection,
  Project,
  Message,
  Task,
  TaskStatus,
  QuickAction,
  Integration,
  AppNotification,
  GitRepo,
  MeetingNote,
  TechDebtItem,
  Milestone,
} from './types'
import { testJiraConnection, fetchJiraIssuesAsTasks, fetchJiraNotifications } from './services/jira'
import { testGitLabConnection, fetchGitLabIssuesAsTasks, fetchGitLabNotifications } from './services/gitlab'
import { syncRepo as syncRepoApi } from './services/git'
import {
  mockProjects,
  mockMessages,
  mockTasks,
  mockQuickActions,
  mockIntegrations,
  mockNotifications,
  mockRepos,
} from './mockData'
import { generateId, sendDesktopNotification } from './utils'
import { defaultEnabledModules } from './modules'

// ─── computed helpers ────────────────────────────────────────────────────────

export function getUnreadCount(messages: Record<string, Message[]>, projectId: string): number {
  return (messages[projectId] ?? []).filter(m => m.status === 'unread').length
}

export function getTaskCount(tasks: Record<string, Task[]>, projectId: string): number {
  return (tasks[projectId] ?? []).filter(t => t.status !== 'done').length
}

export function getTotalUnreadNotifications(notifications: AppNotification[]): number {
  return notifications.filter(n => !n.read).length
}

export function getRepoCount(repos: Record<string, GitRepo[]>, projectId: string): number {
  return (repos[projectId] ?? []).length
}

// ─── state shape ─────────────────────────────────────────────────────────────

interface AppState {
  // persisted
  projects: Project[]
  activeProjectId: string
  messages: Record<string, Message[]>
  tasks: Record<string, Task[]>
  quickActions: Record<string, QuickAction[]>
  integrations: Record<string, Integration[]>
  notifications: AppNotification[]
  repos: Record<string, GitRepo[]>

  // ui (not persisted)
  activeSection: NavSection
  taskModalOpen: boolean
  taskModalTask: Task | null
  searchOpen: boolean
  searchQuery: string
  notificationsOpen: boolean
  createProjectOpen: boolean
  addRepoModalOpen: boolean
  editRepoId: string | null
  syncingRepoIds: string[]

  // actions
  setActiveProject: (id: string) => void
  setActiveSection: (section: NavSection) => void
  addProject: (project: Omit<Project, 'id' | 'createdAt'>) => void
  updateProject: (id: string, updates: Partial<Project>) => void
  deleteProject: (id: string) => void

  markMessageRead: (id: string) => void
  markMessageUnread: (id: string) => void
  markMessageHandled: (id: string) => void
  deleteMessage: (id: string) => void
  convertToTask: (messageId: string) => void

  addTask: (taskData: Omit<Task, 'id' | 'createdAt'>) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  moveTaskToProject: (taskId: string, targetProjectId: string) => void

  addQuickAction: (actionData: Omit<QuickAction, 'id'>) => void
  updateQuickAction: (id: string, updates: Partial<QuickAction>) => void
  deleteQuickAction: (id: string) => void
  reorderQuickActions: (projectId: string, fromIndex: number, toIndex: number) => void

  updateIntegration: (id: string, updates: Partial<Integration>) => void
  syncJiraIntegration: (integrationId: string, config?: Record<string, string>) => Promise<{ ok: boolean; count?: number; error?: string }>
  syncJiraNotifications: (integrationId: string, config?: Record<string, string>) => Promise<{ ok: boolean; count?: number; error?: string }>
  testJiraIntegration: (integrationId: string, config?: Record<string, string>) => Promise<{ ok: boolean; displayName?: string; error?: string }>

  syncGitLabIntegration: (integrationId: string, config?: Record<string, string>) => Promise<{ ok: boolean; count?: number; error?: string }>
  syncGitLabNotifications: (integrationId: string, config?: Record<string, string>) => Promise<{ ok: boolean; count?: number; error?: string }>
  testGitLabIntegration: (integrationId: string, config?: Record<string, string>) => Promise<{ ok: boolean; displayName?: string; error?: string }>

  // ids of integrations currently syncing
  syncingIntegrationIds: string[]

  openTaskModal: (task?: Task) => void
  closeTaskModal: () => void

  setSearchOpen: (open: boolean) => void
  setSearchQuery: (query: string) => void

  setNotificationsOpen: (open: boolean) => void
  pushNotifications: (items: AppNotification[]) => void
  dismissNotification: (id: string) => void
  markNotificationRead: (id: string) => void

  setCreateProjectOpen: (open: boolean) => void

  // repo actions
  addRepo: (repo: Omit<GitRepo, 'id' | 'events' | 'openPRs' | 'openIssues'>) => void
  updateRepo: (id: string, updates: Partial<GitRepo>) => void
  removeRepo: (id: string) => void
  syncRepo: (id: string) => Promise<void>
  setAddRepoModalOpen: (open: boolean) => void
  setEditRepoId: (id: string | null) => void

  // global sync settings (persisted)
  jiraSyncInterval: number  // seconds; 0 = disabled
  setJiraSyncInterval: (seconds: number) => void

  // AI / Gemini settings (persisted)
  geminiApiKey: string
  setGeminiApiKey: (key: string) => void

  // Module visibility (persisted)
  enabledModules: Record<string, boolean>
  setModuleEnabled: (key: string, enabled: boolean) => void

  // focus mode (persisted)
  focusTaskIds: string[]
  addToFocus: (taskId: string) => void
  removeFromFocus: (taskId: string) => void
  clearFocus: () => void

  // milestones (persisted)
  milestones: Milestone[]
  addMilestone: (m: Omit<Milestone, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateMilestone: (id: string, updates: Partial<Milestone>) => void
  deleteMilestone: (id: string) => void
  linkTaskToMilestone: (milestoneId: string, taskId: string) => void
  unlinkTaskFromMilestone: (milestoneId: string, taskId: string) => void

  // tech debt (persisted)
  techDebt: TechDebtItem[]
  addDebtItem: (item: Omit<TechDebtItem, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateDebtItem: (id: string, updates: Partial<TechDebtItem>) => void
  deleteDebtItem: (id: string) => void
  convertDebtToTask: (debtId: string) => void

  // meeting notes (persisted)
  notes: MeetingNote[]
  activeNoteId: string | null
  addNote: (projectId: string) => string
  updateNote: (id: string, updates: Partial<Pick<MeetingNote, 'title' | 'content' | 'projectId'>>) => void
  deleteNote: (id: string) => void
  setActiveNoteId: (id: string | null) => void
  extractNoteTask: (noteId: string, line: string, projectId: string) => void
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function updateInRecord<T extends { id: string }>(
  record: Record<string, T[]>,
  id: string,
  updater: (item: T) => T
): Record<string, T[]> {
  const next: Record<string, T[]> = {}
  for (const [key, arr] of Object.entries(record)) {
    next[key] = arr.map(item => (item.id === id ? updater(item) : item))
  }
  return next
}

function deleteFromRecord<T extends { id: string }>(
  record: Record<string, T[]>,
  id: string
): Record<string, T[]> {
  const next: Record<string, T[]> = {}
  for (const [key, arr] of Object.entries(record)) {
    next[key] = arr.filter(item => item.id !== id)
  }
  return next
}

function findInRecord<T extends { id: string }>(
  record: Record<string, T[]>,
  id: string
): T | undefined {
  for (const arr of Object.values(record)) {
    const found = arr.find(item => item.id === id)
    if (found) return found
  }
  return undefined
}

// ─── store ───────────────────────────────────────────────────────────────────

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // initial state
      projects: mockProjects,
      activeProjectId: mockProjects[0].id,
      messages: mockMessages,
      tasks: mockTasks,
      quickActions: mockQuickActions,
      integrations: mockIntegrations,
      notifications: mockNotifications,
      repos: mockRepos,

      syncingIntegrationIds: [],

      jiraSyncInterval: 5,
      geminiApiKey: '',
      enabledModules: defaultEnabledModules(),
      focusTaskIds: [],
      milestones: [],
      techDebt: [],
      notes: [],
      activeNoteId: null,

      // ui state
      activeSection: 'inbox',
      taskModalOpen: false,
      taskModalTask: null,
      searchOpen: false,
      searchQuery: '',
      notificationsOpen: false,
      createProjectOpen: false,
      addRepoModalOpen: false,
      editRepoId: null,
      syncingRepoIds: [],

      // ── project actions ──────────────────────────────────────────────────

      setActiveProject: (id) =>
        set({ activeProjectId: id, activeSection: 'inbox', notificationsOpen: false }),

      setActiveSection: (section) =>
        set({ activeSection: section }),

      addProject: (projectData) => {
        const id = generateId()
        const project: Project = {
          ...projectData,
          id,
          createdAt: new Date().toISOString(),
        }
        const defaultIntegrations: Integration[] = [
          {
            id: generateId(),
            projectId: id,
            type: 'jira',
            enabled: false,
            config: { serverUrl: '', projectKey: '', apiToken: '', username: '' },
          },
          {
            id: generateId(),
            projectId: id,
            type: 'gitlab',
            enabled: false,
            config: { instanceUrl: '', projectPath: '', token: '' },
          },
          {
            id: generateId(),
            projectId: id,
            type: 'email',
            enabled: false,
            config: { provider: 'gmail', emailAddress: '', filterLabel: '' },
          },
          {
            id: generateId(),
            projectId: id,
            type: 'whatsapp',
            enabled: false,
            config: { apiToken: '', groupIds: '', webhookUrl: '' },
          },
        ]
        set(state => ({
          projects: [...state.projects, project],
          messages: { ...state.messages, [id]: [] },
          tasks: { ...state.tasks, [id]: [] },
          quickActions: { ...state.quickActions, [id]: [] },
          integrations: {
            ...state.integrations,
            [id]: defaultIntegrations,
          },
          activeProjectId: id,
          activeSection: 'inbox',
          createProjectOpen: false,
        }))
      },

      updateProject: (id, updates) =>
        set(state => ({
          projects: state.projects.map(p => (p.id === id ? { ...p, ...updates } : p)),
        })),

      deleteProject: (id) =>
        set(state => {
          const remaining = state.projects.filter(p => p.id !== id)
          const newActiveId = remaining[0]?.id ?? ''
          return {
            projects: remaining,
            activeProjectId: newActiveId,
            activeSection: 'inbox',
          }
        }),

      // ── message actions ──────────────────────────────────────────────────

      markMessageRead: (id) =>
        set(state => ({
          messages: updateInRecord(state.messages, id, m => ({ ...m, status: 'read' })),
        })),

      markMessageUnread: (id) =>
        set(state => ({
          messages: updateInRecord(state.messages, id, m => ({ ...m, status: 'unread' })),
        })),

      markMessageHandled: (id) =>
        set(state => ({
          messages: updateInRecord(state.messages, id, m => ({ ...m, status: 'handled' })),
        })),

      deleteMessage: (id) =>
        set(state => ({
          messages: deleteFromRecord(state.messages, id),
        })),

      convertToTask: (messageId) => {
        const { messages, activeProjectId } = get()
        const message = findInRecord(messages, messageId)
        if (!message) return

        const task: Omit<Task, 'id' | 'createdAt'> = {
          projectId: message.projectId || activeProjectId,
          title: message.title,
          description: message.body,
          status: 'todo',
          priority: message.priority,
          type: message.source === 'jira' ? 'jira' : 'local',
          tags: message.labels,
          fromMessageId: messageId,
        }

        const newTask: Task = {
          ...task,
          id: generateId(),
          createdAt: new Date().toISOString(),
        }

        set(state => ({
          messages: updateInRecord(state.messages, messageId, m => ({ ...m, status: 'handled' })),
          tasks: {
            ...state.tasks,
            [newTask.projectId]: [...(state.tasks[newTask.projectId] ?? []), newTask],
          },
          activeProjectId: newTask.projectId,
          activeSection: 'tasks',
          taskModalOpen: true,
          taskModalTask: newTask,
        }))
      },

      // ── task actions ─────────────────────────────────────────────────────

      addTask: (taskData) => {
        const task: Task = {
          ...taskData,
          id: generateId(),
          createdAt: new Date().toISOString(),
        }
        set(state => ({
          tasks: {
            ...state.tasks,
            [task.projectId]: [...(state.tasks[task.projectId] ?? []), task],
          },
          // Navigate to the project+tasks view where the task was just added
          activeProjectId: task.projectId,
          activeSection: 'tasks',
        }))
      },

      updateTask: (id, updates) =>
        set(state => ({
          tasks: updateInRecord(state.tasks, id, t => ({
            ...t,
            ...updates,
            // Stamp completedAt when task transitions to done
            completedAt: updates.status === 'done' && t.status !== 'done'
              ? new Date().toISOString()
              : updates.status && updates.status !== 'done'
              ? undefined   // clear if moved out of done
              : t.completedAt,
          })),
        })),

      deleteTask: (id) =>
        set(state => ({
          tasks: deleteFromRecord(state.tasks, id),
        })),

      moveTaskToProject: (taskId, targetProjectId) =>
        set(state => {
          const task = findInRecord(state.tasks, taskId)
          if (!task) return state
          const sourceId = task.projectId
          return {
            tasks: {
              ...state.tasks,
              [sourceId]: (state.tasks[sourceId] ?? []).filter(t => t.id !== taskId),
              [targetProjectId]: [
                ...(state.tasks[targetProjectId] ?? []),
                { ...task, projectId: targetProjectId },
              ],
            },
          }
        }),

      // ── quick action actions ──────────────────────────────────────────────

      addQuickAction: (actionData) => {
        const action: QuickAction = { ...actionData, id: generateId() }
        set(state => ({
          quickActions: {
            ...state.quickActions,
            [action.projectId]: [...(state.quickActions[action.projectId] ?? []), action],
          },
        }))
      },

      updateQuickAction: (id, updates) =>
        set(state => ({
          quickActions: updateInRecord(state.quickActions, id, a => ({ ...a, ...updates })),
        })),

      deleteQuickAction: (id) =>
        set(state => ({
          quickActions: deleteFromRecord(state.quickActions, id),
        })),

      reorderQuickActions: (projectId, fromIndex, toIndex) =>
        set(state => {
          const actions = [...(state.quickActions[projectId] ?? [])]
          const [moved] = actions.splice(fromIndex, 1)
          actions.splice(toIndex, 0, moved)
          return {
            quickActions: { ...state.quickActions, [projectId]: actions },
          }
        }),

      // ── integration actions ──────────────────────────────────────────────

      updateIntegration: (id, updates) =>
        set(state => ({
          integrations: updateInRecord(state.integrations, id, i => ({ ...i, ...updates })),
        })),

      testJiraIntegration: async (integrationId, overrideConfig) => {
        const integration = findInRecord(get().integrations, integrationId)
        if (!integration) return { ok: false, error: 'Integration not found' }

        const merged = { ...integration.config, ...overrideConfig }
        const cfg = {
          serverUrl:  merged.serverUrl  ?? '',
          projectKey: merged.projectKey ?? '',
          username:   merged.username   ?? '',
          apiToken:   merged.apiToken   ?? '',
        }
        return testJiraConnection(cfg)
      },

      syncJiraIntegration: async (integrationId, overrideConfig) => {
        const { integrations } = get()
        const integration = findInRecord(integrations, integrationId)
        if (!integration) return { ok: false, error: 'Integration not found' }

        const isManual = !!overrideConfig
        if (isManual) set(state => ({ syncingIntegrationIds: [...state.syncingIntegrationIds, integrationId] }))

        try {
          const mergedCfg = { ...integration.config, ...overrideConfig }
          const cfg = {
            serverUrl:  mergedCfg.serverUrl  ?? '',
            projectKey: mergedCfg.projectKey ?? '',
            username:   mergedCfg.username   ?? '',
            apiToken:   mergedCfg.apiToken   ?? '',
          }

          const fetchedTasks = await fetchJiraIssuesAsTasks(cfg, integration.projectId)

          set(state => {
            const existing = state.tasks[integration.projectId] ?? []

            // Preserve user-modified local status — only overwrite if status came from Jira
            const existingById = new Map(existing.map(t => [t.id, t]))

            const upserted: Task[] = fetchedTasks.map(fetched => {
              const prev = existingById.get(fetched.id)
              return {
                ...fetched,
                // keep local status if user manually changed it; otherwise use Jira status
                status:    prev ? prev.status : fetched.status,
                createdAt: prev?.createdAt ?? new Date().toISOString(),
              }
            })

            const fetchedIds = new Set(fetchedTasks.map(t => t.id))
            // keep local (non-jira) tasks + upserted jira tasks
            const locals = existing.filter(t => t.type !== 'jira' || !fetchedIds.has(t.id))

            return {
              tasks: { ...state.tasks, [integration.projectId]: [...locals, ...upserted] },
              integrations: updateInRecord(state.integrations, integrationId, i => ({
                ...i,
                lastSync: new Date().toISOString(),
              })),
              ...(isManual ? { syncingIntegrationIds: state.syncingIntegrationIds.filter(id => id !== integrationId) } : {}),
            }
          })

          return { ok: true, count: fetchedTasks.length }
        } catch (e) {
          if (isManual) set(state => ({
            syncingIntegrationIds: state.syncingIntegrationIds.filter(id => id !== integrationId),
          }))
          return { ok: false, error: (e as Error).message }
        }
      },

      syncJiraNotifications: async (integrationId, overrideConfig) => {
        const { integrations } = get()
        const integration = findInRecord(integrations, integrationId)
        if (!integration) return { ok: false, error: 'Integration not found' }

        // Only show spinner when called manually (overrideConfig present), not on auto-sync
        const isManual = !!overrideConfig
        if (isManual) set(state => ({ syncingIntegrationIds: [...state.syncingIntegrationIds, integrationId] }))

        try {
          const mergedCfg = { ...integration.config, ...overrideConfig }
          const cfg = {
            serverUrl:  mergedCfg.serverUrl  ?? '',
            projectKey: mergedCfg.projectKey ?? '',
            username:   mergedCfg.username   ?? '',
            apiToken:   mergedCfg.apiToken   ?? '',
          }

          const notifications = await fetchJiraNotifications(cfg, integration.projectId)

          set(state => {
            const existing = state.messages[integration.projectId] ?? []
            const existingIds = new Set(existing.map(m => m.id))

            // Only prepend brand-new notifications — never touch existing ones
            const brandNew = notifications.filter(n => !existingIds.has(n.id))

            return {
              messages: {
                ...state.messages,
                [integration.projectId]: [...brandNew, ...existing],
              },
              ...(isManual ? { syncingIntegrationIds: state.syncingIntegrationIds.filter(id => id !== integrationId) } : {}),
            }
          })

          // Push AppNotifications for critical/high priority items (deduped by id)
          const { projects } = get()
          const project = projects.find(p => p.id === integration.projectId)
          const highPriority = notifications.filter(n => n.priority === 'critical' || n.priority === 'high')
          if (highPriority.length > 0) {
            get().pushNotifications(highPriority.map(n => ({
              id:          `jira-${n.id}`,
              projectId:   integration.projectId,
              projectName: project?.name ?? 'Project',
              title:       n.title,
              message:     n.body,
              type:        n.priority === 'critical' ? 'error' : 'warning' as const,
              timestamp:   new Date().toISOString(),
              read:        false,
              url:         n.externalLink,
            })))
          }

          return { ok: true, count: notifications.length }
        } catch (e) {
          if (isManual) set(state => ({
            syncingIntegrationIds: state.syncingIntegrationIds.filter(id => id !== integrationId),
          }))
          return { ok: false, error: (e as Error).message }
        }
      },

      // ── GitLab integration actions ───────────────────────────────────────

      testGitLabIntegration: async (integrationId, overrideConfig) => {
        const integration = findInRecord(get().integrations, integrationId)
        if (!integration) return { ok: false, error: 'Integration not found' }
        const merged = { ...integration.config, ...overrideConfig }
        return testGitLabConnection({
          instanceUrl: merged.instanceUrl ?? '',
          projectPath: merged.projectPath ?? '',
          token:       merged.token       ?? '',
        })
      },

      syncGitLabIntegration: async (integrationId, overrideConfig) => {
        const { integrations } = get()
        const integration = findInRecord(integrations, integrationId)
        if (!integration) return { ok: false, error: 'Integration not found' }

        const isManual = !!overrideConfig
        if (isManual) set(state => ({ syncingIntegrationIds: [...state.syncingIntegrationIds, integrationId] }))

        try {
          const merged = { ...integration.config, ...overrideConfig }
          const cfg = {
            instanceUrl: merged.instanceUrl ?? '',
            projectPath: merged.projectPath ?? '',
            token:       merged.token       ?? '',
          }

          const fetchedTasks = await fetchGitLabIssuesAsTasks(cfg, integration.projectId)

          set(state => {
            const existing    = state.tasks[integration.projectId] ?? []
            const existingById = new Map(existing.map(t => [t.id, t]))

            const upserted: Task[] = fetchedTasks.map(fetched => {
              const prev = existingById.get(fetched.id)
              return {
                ...fetched,
                status:    prev ? prev.status : fetched.status,
                createdAt: prev?.createdAt ?? new Date().toISOString(),
              }
            })

            const fetchedIds = new Set(fetchedTasks.map(t => t.id))
            const locals = existing.filter(t => t.type !== 'gitlab' || !fetchedIds.has(t.id))

            return {
              tasks: { ...state.tasks, [integration.projectId]: [...locals, ...upserted] },
              integrations: updateInRecord(state.integrations, integrationId, i => ({
                ...i,
                lastSync: new Date().toISOString(),
              })),
              ...(isManual ? { syncingIntegrationIds: state.syncingIntegrationIds.filter(id => id !== integrationId) } : {}),
            }
          })

          return { ok: true, count: fetchedTasks.length }
        } catch (e) {
          if (isManual) set(state => ({
            syncingIntegrationIds: state.syncingIntegrationIds.filter(id => id !== integrationId),
          }))
          return { ok: false, error: (e as Error).message }
        }
      },

      syncGitLabNotifications: async (integrationId, overrideConfig) => {
        const { integrations } = get()
        const integration = findInRecord(integrations, integrationId)
        if (!integration) return { ok: false, error: 'Integration not found' }

        const isManual = !!overrideConfig
        if (isManual) set(state => ({ syncingIntegrationIds: [...state.syncingIntegrationIds, integrationId] }))

        try {
          const merged = { ...integration.config, ...overrideConfig }
          const cfg = {
            instanceUrl: merged.instanceUrl ?? '',
            projectPath: merged.projectPath ?? '',
            token:       merged.token       ?? '',
          }

          const notifications = await fetchGitLabNotifications(cfg, integration.projectId)

          set(state => {
            const existing    = state.messages[integration.projectId] ?? []
            const existingIds = new Set(existing.map(m => m.id))
            const brandNew    = notifications.filter(n => !existingIds.has(n.id))

            return {
              messages: {
                ...state.messages,
                [integration.projectId]: [...brandNew, ...existing],
              },
              ...(isManual ? { syncingIntegrationIds: state.syncingIntegrationIds.filter(id => id !== integrationId) } : {}),
            }
          })

          // Push AppNotifications for high/critical items
          const { projects } = get()
          const project = projects.find(p => p.id === integration.projectId)
          const urgent = notifications.filter(n => n.priority === 'critical' || n.priority === 'high')
          if (urgent.length > 0) {
            get().pushNotifications(urgent.map(n => ({
              id:          `gitlab-notif-${n.id}`,
              projectId:   integration.projectId,
              projectName: project?.name ?? 'Project',
              title:       n.title,
              message:     n.body,
              type:        n.priority === 'critical' ? 'error' : 'warning' as const,
              timestamp:   new Date().toISOString(),
              read:        false,
              url:         n.externalLink,
            })))
          }

          return { ok: true, count: notifications.length }
        } catch (e) {
          if (isManual) set(state => ({
            syncingIntegrationIds: state.syncingIntegrationIds.filter(id => id !== integrationId),
          }))
          return { ok: false, error: (e as Error).message }
        }
      },

      // ── modal / overlay actions ──────────────────────────────────────────

      openTaskModal: (task) => set({ taskModalOpen: true, taskModalTask: task ?? null }),

      closeTaskModal: () => set({ taskModalOpen: false, taskModalTask: null }),

      setSearchOpen: (open) =>
        set({ searchOpen: open, searchQuery: open ? get().searchQuery : '' }),

      setSearchQuery: (query) => set({ searchQuery: query }),

      setNotificationsOpen: (open) => set({ notificationsOpen: open }),

      pushNotifications: (items) => {
        const existingIds = new Set(get().notifications.map(n => n.id))
        const brandNew = items.filter(n => !existingIds.has(n.id))
        if (brandNew.length === 0) return

        // Fire desktop push notifications
        for (const n of brandNew) {
          sendDesktopNotification(n.title, n.message, n.type, n.url)
        }

        set(state => {
          const merged = [...brandNew, ...state.notifications]
          const trimmed = merged.length > 50
            ? [...merged.filter(n => !n.read).slice(0, 50), ...merged.filter(n => n.read)].slice(0, 50)
            : merged
          return { notifications: trimmed }
        })
      },

      dismissNotification: (id) =>
        set(state => ({
          notifications: state.notifications.filter(n => n.id !== id),
        })),

      markNotificationRead: (id) =>
        set(state => ({
          notifications: state.notifications.map(n =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),

      setCreateProjectOpen: (open) => set({ createProjectOpen: open }),

      // ── repo actions ─────────────────────────────────────────────────────

      addRepo: (repoData) => {
        const repo: GitRepo = {
          ...repoData,
          id: generateId(),
          events: [],
          openPRs: 0,
          openIssues: 0,
        }
        set(state => ({
          repos: {
            ...state.repos,
            [repo.projectId]: [...(state.repos[repo.projectId] ?? []), repo],
          },
          addRepoModalOpen: false,
        }))
      },

      updateRepo: (id, updates) =>
        set(state => ({
          repos: updateInRecord(state.repos, id, r => ({ ...r, ...updates })),
          editRepoId: null,
        })),

      removeRepo: (id) =>
        set(state => ({
          repos: deleteFromRecord(state.repos, id),
        })),

      syncRepo: async (id) => {
        const repo = findInRecord(get().repos, id)
        if (!repo) return

        set(state => ({ syncingRepoIds: [...state.syncingRepoIds, id] }))

        const result = await syncRepoApi(repo)

        set(state => ({
          syncingRepoIds: state.syncingRepoIds.filter(rid => rid !== id),
          repos: updateInRecord(state.repos, id, r => ({
            ...r,
            lastSync:       new Date().toISOString(),
            ...(result.ok ? {
              openPRs:        result.openPRs        ?? r.openPRs,
              openIssues:     result.openIssues     ?? r.openIssues,
              pipelineStatus: result.pipelineStatus ?? r.pipelineStatus,
              events:         result.events         ?? r.events,
              stars:          result.stars          ?? r.stars,
              description:    result.description    ?? r.description,
            } : {}),
          })),
        }))

        if (result.ok && result.events) {
          const { projects } = get()
          const project = projects.find(p => p.id === repo.projectId)
          const projectName = project?.name ?? repo.displayName
          const appNotifs: AppNotification[] = []
          const source = repo.provider === 'github' ? 'github' as const : 'gitlab' as const

          // ── Pipeline notifications (success + failure) ──────────────────────
          const pipelineEvent = result.events.find(e => e.type === 'pipeline')
          if (pipelineEvent) {
            const isFailed  = pipelineEvent.status === 'failed'
            const isSuccess = pipelineEvent.status === 'success'

            if (isFailed || isSuccess) {
              const notifId = `pipeline-${pipelineEvent.id}`

              appNotifs.push({
                id:          notifId,
                projectId:   repo.projectId,
                projectName,
                title:       isFailed
                  ? `Pipeline failed — ${repo.displayName}`
                  : `Pipeline passed — ${repo.displayName}`,
                message:     `${pipelineEvent.title} · Branch: ${pipelineEvent.branch ?? ''} · by ${pipelineEvent.author}`,
                type:        isFailed ? 'error' : 'success',
                timestamp:   pipelineEvent.timestamp,
                read:        false,
                url:         pipelineEvent.url,
              })

              // Add to inbox as well
              set(state => {
                const existing = state.messages[repo.projectId] ?? []
                if (existing.some(m => m.id === notifId)) return {}
                const msg: Message = {
                  id:           notifId,
                  projectId:    repo.projectId,
                  source,
                  title:        isFailed
                    ? `❌ Pipeline failed — ${pipelineEvent.branch ?? 'main'}`
                    : `✅ Pipeline passed — ${pipelineEvent.branch ?? 'main'}`,
                  body:         `${pipelineEvent.title} · by ${pipelineEvent.author} on ${repo.displayName}`,
                  from:         pipelineEvent.author,
                  timestamp:    pipelineEvent.timestamp,
                  status:       'unread',
                  priority:     isFailed ? 'high' : 'low',
                  labels:       ['pipeline', isFailed ? 'failed' : 'success', pipelineEvent.branch ?? 'main'],
                  externalLink: pipelineEvent.url,
                }
                return {
                  messages: {
                    ...state.messages,
                    [repo.projectId]: [msg, ...existing],
                  },
                }
              })
            }
          }

          // ── Release notifications → inbox ───────────────────────────────────
          const releaseEvents = result.events.filter(e => e.type === 'release')
          for (const rel of releaseEvents.slice(0, 2)) {
            const relId = `release-${rel.id}`
            set(state => {
              const existing = state.messages[repo.projectId] ?? []
              if (existing.some(m => m.id === relId)) return {}
              const msg: Message = {
                id:           relId,
                projectId:    repo.projectId,
                source,
                title:        `🚀 Release — ${rel.title}`,
                body:         `New release published on ${repo.displayName} · by ${rel.author}`,
                from:         rel.author,
                timestamp:    rel.timestamp,
                status:       'unread',
                priority:     'medium',
                labels:       ['release', repo.displayName],
                externalLink: rel.url,
              }
              return {
                messages: {
                  ...state.messages,
                  [repo.projectId]: [msg, ...(state.messages[repo.projectId] ?? [])],
                },
              }
            })
          }

          // ── Open PRs / MRs → app notifications ─────────────────────────────
          const prEvents = result.events.filter(
            e => (e.type === 'pull_request' || e.type === 'merge_request') &&
                 e.status === 'open' && e.number != null
          )
          for (const pr of prEvents.slice(0, 3)) {
            appNotifs.push({
              id:          `pr-open-${repo.id}-${pr.number}`,
              projectId:   repo.projectId,
              projectName,
              title:       `Open PR #${pr.number} — ${repo.displayName}`,
              message:     `${pr.title} · by ${pr.author}`,
              type:        'info',
              timestamp:   new Date().toISOString(),
              read:        false,
              url:         pr.url,
            })
          }

          if (appNotifs.length > 0) get().pushNotifications(appNotifs)
        }
      },

      setAddRepoModalOpen: (open) => set({ addRepoModalOpen: open }),
      setEditRepoId: (id) => set({ editRepoId: id }),

      setJiraSyncInterval: (seconds) => set({ jiraSyncInterval: seconds }),

      setGeminiApiKey: (key) => set({ geminiApiKey: key }),

      setModuleEnabled: (key, enabled) =>
        set(state => ({
          enabledModules: { ...state.enabledModules, [key]: enabled },
        })),

      addToFocus: (taskId) =>
        set(state => ({
          focusTaskIds: state.focusTaskIds.includes(taskId)
            ? state.focusTaskIds
            : [...state.focusTaskIds, taskId],
        })),

      removeFromFocus: (taskId) =>
        set(state => ({ focusTaskIds: state.focusTaskIds.filter(id => id !== taskId) })),

      clearFocus: () => set({ focusTaskIds: [] }),

      // ── milestone actions ─────────────────────────────────────────────────

      addMilestone: (m) => {
        const now = new Date().toISOString()
        const milestone: Milestone = { ...m, id: generateId(), createdAt: now, updatedAt: now }
        set(state => ({ milestones: [milestone, ...state.milestones] }))
      },

      updateMilestone: (id, updates) =>
        set(state => ({
          milestones: state.milestones.map(m =>
            m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m
          ),
        })),

      deleteMilestone: (id) =>
        set(state => ({ milestones: state.milestones.filter(m => m.id !== id) })),

      linkTaskToMilestone: (milestoneId, taskId) =>
        set(state => ({
          milestones: state.milestones.map(m =>
            m.id === milestoneId && !m.linkedTaskIds.includes(taskId)
              ? { ...m, linkedTaskIds: [...m.linkedTaskIds, taskId], updatedAt: new Date().toISOString() }
              : m
          ),
        })),

      unlinkTaskFromMilestone: (milestoneId, taskId) =>
        set(state => ({
          milestones: state.milestones.map(m =>
            m.id === milestoneId
              ? { ...m, linkedTaskIds: m.linkedTaskIds.filter(id => id !== taskId), updatedAt: new Date().toISOString() }
              : m
          ),
        })),

      // ── tech debt actions ─────────────────────────────────────────────────

      addDebtItem: (item) => {
        const now = new Date().toISOString()
        const debt: TechDebtItem = { ...item, id: generateId(), createdAt: now, updatedAt: now }
        set(state => ({ techDebt: [debt, ...state.techDebt] }))
      },

      updateDebtItem: (id, updates) =>
        set(state => ({
          techDebt: state.techDebt.map(d =>
            d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
          ),
        })),

      deleteDebtItem: (id) =>
        set(state => ({ techDebt: state.techDebt.filter(d => d.id !== id) })),

      convertDebtToTask: (debtId) => {
        const { techDebt, tasks } = get()
        const debt = techDebt.find(d => d.id === debtId)
        if (!debt) return
        const task: Task = {
          id: generateId(),
          projectId: debt.projectId,
          title: `[Tech Debt] ${debt.title}`,
          description: debt.description,
          status: 'todo',
          priority: debt.priority,
          type: 'local',
          tags: [debt.category, `effort:${debt.effort}`],
          createdAt: new Date().toISOString(),
        }
        set(state => ({
          tasks: {
            ...state.tasks,
            [debt.projectId]: [...(state.tasks[debt.projectId] ?? []), task],
          },
          techDebt: state.techDebt.map(d =>
            d.id === debtId
              ? { ...d, taskId: task.id, status: 'in-progress', updatedAt: new Date().toISOString() }
              : d
          ),
        }))
      },

      // ── meeting notes actions ─────────────────────────────────────────────

      addNote: (projectId) => {
        const id = generateId()
        const note: MeetingNote = {
          id,
          projectId,
          title: '',
          content: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          extractedTaskIds: [],
        }
        set(state => ({ notes: [note, ...state.notes], activeNoteId: id }))
        return id
      },

      updateNote: (id, updates) =>
        set(state => ({
          notes: state.notes.map(n =>
            n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
          ),
        })),

      deleteNote: (id) =>
        set(state => ({
          notes: state.notes.filter(n => n.id !== id),
          activeNoteId: state.activeNoteId === id
            ? (state.notes.find(n => n.id !== id)?.id ?? null)
            : state.activeNoteId,
        })),

      setActiveNoteId: (id) => set({ activeNoteId: id }),

      extractNoteTask: (noteId, line, projectId) => {
        const task: Task = {
          id: generateId(),
          projectId,
          title: line.trim(),
          status: 'todo',
          priority: 'medium',
          type: 'local',
          createdAt: new Date().toISOString(),
        }
        set(state => ({
          tasks: {
            ...state.tasks,
            [projectId]: [...(state.tasks[projectId] ?? []), task],
          },
          notes: state.notes.map(n =>
            n.id === noteId
              ? { ...n, extractedTaskIds: [...n.extractedTaskIds, task.id] }
              : n
          ),
        }))
      },

      // helper to cycle task status
    }),
    {
      name: 'control-center-v1',
      version: 4,
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          persistedState.notifications = []
        }
        if (version < 2) {
          // Inject GitLab integration for any project that doesn't have one yet
          const integrations: Record<string, any[]> = persistedState.integrations ?? {}
          const projects: any[] = persistedState.projects ?? []
          for (const project of projects) {
            const list: any[] = integrations[project.id] ?? []
            if (!list.some((i: any) => i.type === 'gitlab')) {
              list.push({
                id:        `gl-${project.id}`,
                projectId: project.id,
                type:      'gitlab',
                enabled:   false,
                config:    { instanceUrl: '', projectPath: '', token: '' },
              })
              integrations[project.id] = list
            }
          }
          persistedState.integrations = integrations
        }
        if (version < 3) {
          // Replace anthropicApiKey with geminiApiKey
          persistedState.geminiApiKey = ''
          delete persistedState.anthropicApiKey
        }
        if (version < 4) {
          // Add enabledModules with all modules enabled by default
          persistedState.enabledModules = defaultEnabledModules()
        }
        return persistedState
      },
      partialize: (state) => ({
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        messages: state.messages,
        tasks: state.tasks,
        quickActions: state.quickActions,
        integrations: state.integrations,
        notifications: state.notifications,
        repos: state.repos,
        jiraSyncInterval: state.jiraSyncInterval,
        geminiApiKey: state.geminiApiKey,
        enabledModules: state.enabledModules,
        focusTaskIds: state.focusTaskIds,
        notes: state.notes,
        techDebt: state.techDebt,
        milestones: state.milestones,
      }),
    }
  )
)

// convenience: cycle task status
export function cycleTaskStatus(current: TaskStatus): TaskStatus {
  if (current === 'todo') return 'in-progress'
  if (current === 'in-progress') return 'done'
  return 'todo'
}
