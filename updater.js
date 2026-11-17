'use strict'

// Mise à jour automatique via les Releases GitHub du dépôt public des installeurs
// (configuration « publish » d'electron-builder, embarquée dans app-update.yml).
//   - Windows : téléchargement silencieux, installation proposée puis appliquée à la fermeture.
//   - macOS   : sans signature Apple, l'installation automatique est impossible ; on propose
//               le téléchargement de la nouvelle version depuis la page de téléchargement.

const { app, dialog, shell } = require('electron')

const CHECK_INTERVAL_MS = 6 * 3600_000
const FIRST_CHECK_DELAY_MS = 20_000

let autoUpdater = null
let context = { appUrl: '', getWindow: () => null }
let interactive = false

function parent() {
  const window = context.getWindow()
  return window && !window.isDestroyed() ? window : undefined
}

function setupUpdater(options) {
  context = { ...context, ...options }
  if (!app.isPackaged) return

  try {
    autoUpdater = require('electron-updater').autoUpdater
  } catch (error) {
    console.error('Mise à jour indisponible :', error)
    return
  }

  autoUpdater.autoDownload = process.platform === 'win32'
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false

  autoUpdater.on('update-available', (info) => {
    if (process.platform === 'darwin') {
      dialog
        .showMessageBox(parent(), {
          type: 'info',
          title: 'Mise à jour disponible',
          message: `WATHI TaskBoard ${info.version} est disponible.`,
          detail: 'Téléchargez la nouvelle version, puis remplacez l’application dans le dossier Applications.',
          buttons: ['Télécharger', 'Plus tard'],
          defaultId: 0,
          cancelId: 1,
        })
        .then(({ response }) => {
          if (response === 0) shell.openExternal(`${context.appUrl}/desktop`)
        })
    } else if (interactive) {
      dialog.showMessageBox(parent(), {
        type: 'info',
        title: 'Mise à jour disponible',
        message: `WATHI TaskBoard ${info.version} est en cours de téléchargement.`,
        detail: 'Vous serez invité à redémarrer l’application une fois le téléchargement terminé.',
      })
    }
    interactive = false
  })

  autoUpdater.on('update-not-available', () => {
    if (interactive) {
      dialog.showMessageBox(parent(), {
        type: 'info',
        title: 'À jour',
        message: `Vous utilisez la dernière version (${app.getVersion()}).`,
      })
    }
    interactive = false
  })

  autoUpdater.on('update-downloaded', (info) => {
    dialog
      .showMessageBox(parent(), {
        type: 'info',
        title: 'Mise à jour prête',
        message: `WATHI TaskBoard ${info.version} est prête à être installée.`,
        detail: 'L’application va redémarrer pour appliquer la mise à jour.',
        buttons: ['Redémarrer maintenant', 'Plus tard'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall()
      })
  })

  autoUpdater.on('error', (error) => {
    console.error('Mise à jour :', error?.message ?? error)
    if (interactive) {
      dialog.showMessageBox(parent(), {
        type: 'warning',
        title: 'Vérification impossible',
        message: 'Impossible de vérifier les mises à jour pour le moment.',
        detail: String(error?.message ?? error),
      })
    }
    interactive = false
  })

  setTimeout(() => checkForUpdates(), FIRST_CHECK_DELAY_MS)
  setInterval(() => checkForUpdates(), CHECK_INTERVAL_MS)
}

function checkForUpdates({ interactive: wanted = false } = {}) {
  if (!autoUpdater) {
    if (wanted) {
      dialog.showMessageBox(parent(), {
        type: 'info',
        title: 'Mise à jour',
        message: app.isPackaged ? 'Mise à jour indisponible dans cette version.' : 'Pas de mise à jour en mode développement.',
      })
    }
    return
  }
  interactive = wanted
  autoUpdater.checkForUpdates().catch(() => {
    // l'événement « error » gère l'affichage
  })
}

module.exports = { setupUpdater, checkForUpdates }
