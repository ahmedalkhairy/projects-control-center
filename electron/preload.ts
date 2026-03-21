import { contextBridge, ipcRenderer, shell } from 'electron'

// ─── Type-safe IPC bridge exposed to the renderer ────────────────────────────
// Only explicitly listed channels can be used — no arbitrary IPC from renderer.

contextBridge.exposeInMainWorld('electronAPI', {
  // Jira API calls (run in main process — no CORS)
  jira: {
    test: (cfg: unknown) =>
      ipcRenderer.invoke('jira:test', cfg),

    fetchIssues: (cfg: unknown, projectId: string) =>
      ipcRenderer.invoke('jira:fetchIssues', cfg, projectId),

    fetchNotifications: (cfg: unknown) =>
      ipcRenderer.invoke('jira:fetchNotifications', cfg),

    createIssue: (cfg: unknown, summary: string, description: string, priority: string) =>
      ipcRenderer.invoke('jira:createIssue', cfg, summary, description, priority),
  },

  // Open URLs in the system default browser
  openExternal: (url: string) => shell.openExternal(url),

  // App info
  platform: process.platform,
})
