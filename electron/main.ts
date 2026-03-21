import { app, BrowserWindow, ipcMain, shell, Menu, Tray, nativeImage } from 'electron'
import path from 'path'
import { testJiraConnectionNode, fetchJiraIssuesAsTasksNode, fetchJiraNotificationsNode, createJiraIssueNode } from './jira'

// ─── Dev / prod detection ─────────────────────────────────────────────────────

const isDev = !app.isPackaged

// ─── Tray ─────────────────────────────────────────────────────────────────────

let tray: Tray | null = null

function createTray(win: BrowserWindow): void {
  const iconPath = isDev
    ? path.join(__dirname, 'assets/tray-icon.png')
    : path.join(process.resourcesPath, 'assets/tray-icon.png')

  let icon = nativeImage.createFromPath(iconPath)
  if (icon.isEmpty()) {
    // Fallback: 16x16 blank image so tray still shows
    icon = nativeImage.createEmpty()
  }
  icon = icon.resize({ width: 16, height: 16 })

  tray = new Tray(icon)
  tray.setToolTip('Control Center')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show',
      click: () => {
        win.show()
        win.focus()
      },
    },
    {
      label: 'Hide',
      click: () => win.hide(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  // Double-click tray icon → toggle window
  tray.on('double-click', () => {
    if (win.isVisible()) {
      win.hide()
    } else {
      win.show()
      win.focus()
    }
  })
}

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

  // ── Minimize to tray instead of closing ─────────────────────────────────────
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      win.hide()
    }
  })

  // ── Open external links in default browser ──────────────────────────────────
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  createTray(win)
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

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Electron {
    interface App { isQuitting?: boolean }
  }
}

app.whenReady().then(() => {
  // Remove default menu in production
  if (!isDev) Menu.setApplicationMenu(null)
  createWindow()
})

app.on('before-quit', () => {
  app.isQuitting = true
})

app.on('window-all-closed', () => {
  // Don't quit on window close — tray keeps app alive
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
