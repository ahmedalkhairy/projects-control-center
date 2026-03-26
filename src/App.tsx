import { useEffect, useRef } from 'react'
import { useStore } from './store'
import { requestDesktopPermission, sendDesktopNotification } from './utils'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import InboxView from './components/InboxView'
import TasksView from './components/TasksView'
import QuickActionsView from './components/QuickActionsView'
import IntegrationsView from './components/IntegrationsView'
import RepositoriesView from './components/RepositoriesView'
import SettingsView from './components/SettingsView'
import GlobalSearch from './components/GlobalSearch'
import TaskModal from './components/TaskModal'
import CreateProjectModal from './components/CreateProjectModal'
import FocusView from './components/FocusView'
import NotesView from './components/NotesView'
import TechDebtView from './components/TechDebtView'
import StandupView from './components/StandupView'
import MilestonesView from './components/MilestonesView'
import WeeklyDigestView from './components/WeeklyDigestView'
import AIAssistantView from './components/AIAssistantView'
import UpdateBanner from './components/UpdateBanner'

export default function App() {
  const {
    activeSection, searchOpen, taskModalOpen, createProjectOpen, setSearchOpen,
    integrations, syncJiraIntegration, syncJiraNotifications, jiraSyncInterval,
    syncGitLabIntegration, syncGitLabNotifications,
    tasks, projects, updateTask,
  } = useStore()

  useEffect(() => { requestDesktopPermission() }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setSearchOpen])

  // Keep refs so the reminder interval always reads latest state without restarting
  const tasksRef    = useRef(tasks)
  const projectsRef = useRef(projects)
  const updateTaskRef = useRef(updateTask)
  useEffect(() => { tasksRef.current = tasks },       [tasks])
  useEffect(() => { projectsRef.current = projects }, [projects])
  useEffect(() => { updateTaskRef.current = updateTask }, [updateTask])

  // Reminder scheduler — checks every 60 s
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const allTasks = Object.values(tasksRef.current).flat()
      for (const task of allTasks) {
        const r = task.reminder
        if (!r?.enabled || task.status === 'done') continue
        if (new Date(r.nextAt) > now) continue

        const project = projectsRef.current.find(p => p.id === task.projectId)
        sendDesktopNotification(
          `Reminder: ${task.title}`,
          project ? `Project: ${project.name}` : '',
          'info',
        )

        if (r.mode === 'once') {
          updateTaskRef.current(task.id, { reminder: { ...r, enabled: false } })
        } else {
          const nextAt = new Date(Date.now() + (r.intervalMinutes ?? 60) * 60_000).toISOString()
          updateTaskRef.current(task.id, { reminder: { ...r, nextAt } })
        }
      }
    }

    const timer = setInterval(tick, 60_000)
    return () => clearInterval(timer)
  }, []) // runs once — reads latest state via refs

  // Auto-sync all enabled Jira integrations on the configured interval
  useEffect(() => {
    if (jiraSyncInterval <= 0) return

    const allJiraIntegrations = Object.values(integrations)
      .flat()
      .filter(i => i.type === 'jira' && i.enabled)

    if (allJiraIntegrations.length === 0) return

    const timer = setInterval(() => {
      for (const integration of allJiraIntegrations) {
        syncJiraIntegration(integration.id)
        syncJiraNotifications(integration.id)
      }
    }, jiraSyncInterval * 1000)

    return () => clearInterval(timer)
  }, [jiraSyncInterval, integrations, syncJiraIntegration, syncJiraNotifications])

  // Auto-sync all enabled GitLab integrations (same interval as Jira)
  useEffect(() => {
    if (jiraSyncInterval <= 0) return

    const allGitLabIntegrations = Object.values(integrations)
      .flat()
      .filter(i => i.type === 'gitlab' && i.enabled)

    if (allGitLabIntegrations.length === 0) return

    const timer = setInterval(() => {
      for (const integration of allGitLabIntegrations) {
        syncGitLabIntegration(integration.id)
        syncGitLabNotifications(integration.id)
      }
    }, jiraSyncInterval * 1000)

    return () => clearInterval(timer)
  }, [jiraSyncInterval, integrations, syncGitLabIntegration, syncGitLabNotifications])

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100 min-w-[1200px]">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <UpdateBanner />
        <Header />
        <main className="flex-1 overflow-y-auto">
          {activeSection === 'focus'      && <FocusView />}
          {activeSection === 'notes'      && <NotesView />}
          {activeSection === 'debt'       && <TechDebtView />}
          {activeSection === 'standup'    && <StandupView />}
          {activeSection === 'milestones' && <MilestonesView />}
          {activeSection === 'digest'     && <WeeklyDigestView />}
          {activeSection === 'ai'    && <AIAssistantView />}
          {activeSection === 'inbox' && <InboxView />}
          {activeSection === 'tasks' && <TasksView />}
          {activeSection === 'quick-actions' && <QuickActionsView />}
          {activeSection === 'repositories' && <RepositoriesView />}
          {activeSection === 'integrations' && <IntegrationsView />}
          {activeSection === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Overlays */}
      {searchOpen && <GlobalSearch />}
      {taskModalOpen && <TaskModal />}
      {createProjectOpen && <CreateProjectModal />}
    </div>
  )
}
