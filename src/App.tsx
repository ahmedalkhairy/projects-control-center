import { useEffect } from 'react'
import { useStore } from './store'
import { requestDesktopPermission } from './utils'
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

export default function App() {
  const {
    activeSection, searchOpen, taskModalOpen, createProjectOpen, setSearchOpen,
    integrations, syncJiraIntegration, syncJiraNotifications, jiraSyncInterval,
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

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100 min-w-[1200px]">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto">
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
