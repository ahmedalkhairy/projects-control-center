import { app, BrowserWindow, ipcMain, shell, Menu } from 'electron'
import path from 'path'
import { testJiraConnectionNode, fetchJiraIssuesAsTasksNode, fetchJiraNotificationsNode, createJiraIssueNode } from './jira'

// ─── Dev / prod detection ─────────────────────────────────────────────────────

const isDev = !app.isPackaged

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow(): void {
  const win = new BrowserWindow({
    width:           1400,
    height:          900,
    minWidth:        960,
    minHeight:       620,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
    show:            false, // shown after ready-to-show to avoid flash
    backgroundColor: '#0f172a',
    titleBarStyle:   'default',
    autoHideMenuBar: true,
  })

  // ── Load app ────────────────────────────────────────────────────────────────
  if (isDev) {
    win.loadURL('http://localhost:3000')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  // ── Show when ready (prevents white flash) ──────────────────────────────────
  win.once('ready-to-show', () => win.show())

  // ── Open external links in default browser ──────────────────────────────────
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('jira:test', async (_event, cfg) => {
  return testJiraConnectionNode(cfg)
})

ipcMain.handle('jira:fetchIssues', async (_event, cfg, projectId) => {
  return fetchJiraIssuesAsTasksNode(cfg, projectId)
})

ipcMain.handle('jira:fetchNotifications', async (_event, cfg) => {
  return fetchJiraNotificationsNode(cfg)
})

ipcMain.handle('jira:createIssue', async (_event, cfg, summary, description, priority) => {
  return createJiraIssueNode(cfg, summary, description, priority)
})

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Remove default menu in production
  if (!isDev) Menu.setApplicationMenu(null)
  createWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
