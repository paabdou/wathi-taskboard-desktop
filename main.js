'use strict'

// WATHI TaskBoard, application de bureau : une fenêtre native autour du site,
// avec notifications système, pastille sur l'icône, icône de barre de menus,
// raccourci global et mise à jour automatique (voir updater.js).

const { app, BrowserWindow, Menu, Tray, nativeImage, shell, Notification, ipcMain, globalShortcut } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { setupUpdater, checkForUpdates } = require('./updater')

const APP_URL = (process.env.TASKBOARD_URL || 'https://wathi-taskboard.vercel.app').replace(/\/$/, '')
const APP_ORIGIN = new URL(APP_URL).origin
const SHOW_SHORTCUT = 'CommandOrControl+Shift+T'
const isMac = process.platform === 'darwin'
const isWin = process.platform === 'win32'

let mainWindow = null
let tray = null
let quitting = false

// Windows : identifiant requis pour les notifications et l'épinglage à la barre des tâches.
app.setAppUserModelId('org.wathi.taskboard')

// Une seule instance : relancer l'app ramène la fenêtre existante.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showWindow())
}

// ---------------------------------------------------------------------------
// Fenêtre principale
// ---------------------------------------------------------------------------

const stateFile = () => path.join(app.getPath('userData'), 'window-state.json')

function loadWindowState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), 'utf8'))
  } catch {
    return {}
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const bounds = mainWindow.getNormalBounds()
  try {
    fs.writeFileSync(stateFile(), JSON.stringify({ ...bounds, maximized: mainWindow.isMaximized() }))
  } catch {
    // disque indisponible : on garde les valeurs par défaut au prochain lancement
  }
}

function isAppUrl(url) {
  try {
    return new URL(url).origin === APP_ORIGIN
  } catch {
    return false
  }
}

function createWindow() {
  const state = loadWindowState()
  mainWindow = new BrowserWindow({
    width: state.width || 1280,
    height: state.height || 820,
    x: state.x,
    y: state.y,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'WATHI TaskBoard',
    backgroundColor: '#f6f7f9',
    autoHideMenuBar: !isMac,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  })

  if (state.maximized) mainWindow.maximize()
  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.loadURL(APP_URL)

  // L'app reste sur son domaine ; tout autre lien (Slack, documents…) s'ouvre dans le navigateur.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url) && !url.startsWith('file:')) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAppUrl(url)) return { action: 'allow' }
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Hors ligne ou site injoignable : page locale avec bouton « Réessayer ».
  mainWindow.webContents.on('did-fail-load', (_event, code, _description, url, isMainFrame) => {
    if (isMainFrame && code !== -3 && isAppUrl(url)) mainWindow.loadFile(path.join(__dirname, 'offline.html'))
  })

  // Fermer la fenêtre la masque (l'app reste dans le Dock ou la zone de notification).
  mainWindow.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    saveWindowState()
    mainWindow.hide()
  })
  let saveTimer = null
  const scheduleSave = () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(saveWindowState, 400)
  }
  mainWindow.on('resize', scheduleSave)
  mainWindow.on('move', scheduleSave)
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function sendToPage(channel) {
  showWindow()
  if (mainWindow) mainWindow.webContents.send(channel)
}

// ---------------------------------------------------------------------------
// Menu, barre de menus, raccourci global
// ---------------------------------------------------------------------------

function buildMenu() {
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'Tâches',
      submenu: [
        { label: 'Nouvelle tâche', accelerator: 'CmdOrCtrl+N', click: () => sendToPage('new-task') },
        { label: 'Ouvrir dans le navigateur', click: () => shell.openExternal(APP_URL) },
        { type: 'separator' },
        ...(isMac ? [{ role: 'close' }] : [{ role: 'quit', label: 'Quitter' }]),
      ],
    },
    { role: 'editMenu', label: 'Édition' },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload', label: 'Recharger' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Taille réelle' },
        { role: 'zoomIn', label: 'Agrandir' },
        { role: 'zoomOut', label: 'Réduire' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Plein écran' },
      ],
    },
    ...(isMac ? [{ role: 'windowMenu', label: 'Fenêtre' }] : []),
    {
      role: 'help',
      label: 'Aide',
      submenu: [
        { label: 'Rechercher une mise à jour…', click: () => checkForUpdates({ interactive: true }) },
        { label: `Version ${app.getVersion()}`, enabled: false },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createTray() {
  const file = isMac ? 'trayTemplate.png' : 'tray-win.png'
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', file))
  if (isMac) icon.setTemplateImage(true)
  tray = new Tray(icon)
  tray.setToolTip('WATHI TaskBoard')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Ouvrir WATHI TaskBoard', click: () => showWindow() },
      { label: 'Nouvelle tâche', click: () => sendToPage('new-task') },
      { type: 'separator' },
      { label: 'Rechercher une mise à jour…', click: () => checkForUpdates({ interactive: true }) },
      { type: 'separator' },
      {
        label: 'Quitter',
        click: () => {
          quitting = true
          app.quit()
        },
      },
    ])
  )
  if (!isMac) tray.on('click', () => showWindow())
}

// ---------------------------------------------------------------------------
// Pont avec la page (preload.js) : pastille, notifications, nouvelle tâche
// ---------------------------------------------------------------------------

const overlayIcon = () => nativeImage.createFromPath(path.join(__dirname, 'assets', 'overlay.png'))

ipcMain.on('badge', (_event, count) => {
  const n = Math.max(0, Math.floor(Number(count) || 0))
  if (isMac) app.setBadgeCount(n)
  else if (isWin && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setOverlayIcon(n > 0 ? overlayIcon() : null, n > 0 ? `${n} tâche${n > 1 ? 's' : ''} à traiter` : '')
  }
})

ipcMain.on('notify', (_event, payload) => {
  if (!Notification.isSupported()) return
  const notification = new Notification({
    title: String(payload?.title || 'WATHI TaskBoard').slice(0, 120),
    body: String(payload?.body || '').slice(0, 300),
  })
  notification.on('click', () => showWindow())
  notification.show()
})

ipcMain.on('retry', () => {
  if (mainWindow) mainWindow.loadURL(APP_URL)
})

ipcMain.handle('version', () => app.getVersion())

// ---------------------------------------------------------------------------
// Cycle de vie
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  buildMenu()
  createWindow()
  createTray()
  try {
    globalShortcut.register(SHOW_SHORTCUT, () => showWindow())
  } catch {
    // raccourci déjà pris par une autre application
  }
  setupUpdater({ appUrl: APP_URL, getWindow: () => mainWindow })
})

app.on('activate', () => showWindow())

app.on('before-quit', () => {
  quitting = true
  saveWindowState()
})

app.on('will-quit', () => globalShortcut.unregisterAll())

// Sur Windows et Linux, l'app vit dans la zone de notification : « Quitter » est explicite.
app.on('window-all-closed', () => {
  if (!isMac && quitting) app.quit()
})
