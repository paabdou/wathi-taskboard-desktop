'use strict'

// Pont minimal exposé à la page sous window.taskboardDesktop (isolation de contexte activée).
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('taskboardDesktop', {
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke('version'),
  /** Nombre affiché sur l'icône du Dock (macOS) ou pastille sur la barre des tâches (Windows). */
  setBadge: (count) => ipcRenderer.send('badge', count),
  /** Notification système ; un clic ramène la fenêtre. */
  notify: (title, body) => ipcRenderer.send('notify', { title, body }),
  /** Appelé quand l'utilisateur choisit « Nouvelle tâche » dans le menu ou la barre de menus. */
  onNewTask: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('new-task', listener)
    return () => ipcRenderer.removeListener('new-task', listener)
  },
  /** Page hors ligne : recharge le site. */
  retry: () => ipcRenderer.send('retry'),
})
