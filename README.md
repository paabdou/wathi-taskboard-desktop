# WATHI TaskBoard pour Mac et Windows

Application de bureau Electron : une fenêtre native autour de https://wathi-taskboard.vercel.app, avec notifications système, pastille sur l'icône, icône de barre de menus, raccourci global et mise à jour automatique.

## Ce que l'app ajoute au site

- **Notifications système** quand une tâche vous est assignée (depuis l'app ou depuis Slack) ou réassignée vers vous. Un clic ramène la fenêtre.
- **Pastille** sur l'icône du Dock (macOS, avec le nombre) ou de la barre des tâches (Windows) : tâches reçues depuis votre dernière visite (d'un collègue ou de Slack), en retard ou à rendre aujourd'hui. Elle s'efface quand vous revenez sur la fenêtre, sauf pour les échéances.
- **Icône de barre de menus** (macOS) ou de zone de notification (Windows) : ouvrir, nouvelle tâche, rechercher une mise à jour, quitter. Fermer la fenêtre ne quitte pas l'app.
- **Raccourcis** : `⌘⇧T` / `Ctrl⇧T` pour ouvrir la fenêtre depuis n'importe où, `⌘N` / `Ctrl+N` pour une nouvelle tâche.
- Les liens externes (Slack, documents) s'ouvrent dans le navigateur ; l'app reste sur son domaine.
- Page hors ligne avec bouton « Réessayer » quand le site est injoignable.

Le site détecte l'app grâce au pont `window.taskboardDesktop` exposé par `preload.js`.

## Développement

```bash
npm install
npm start                                   # ouvre le site de production
TASKBOARD_URL=http://localhost:3001 npm start   # ouvre le serveur de développement
```

Sous Windows : `set TASKBOARD_URL=http://localhost:3001 && npm start`.

Depuis un terminal intégré à VS Code ou Cursor, si l'app plante au démarrage avec `Cannot read properties of undefined (reading 'setAppUserModelId')`, c'est que l'éditeur pose `ELECTRON_RUN_AS_NODE=1`, ce qui transforme Electron en simple Node : lancez `env -u ELECTRON_RUN_AS_NODE npm start` (ou utilisez le Terminal du système).

## Construire les installeurs

```bash
npm run build:mac   # dist/WATHI-TaskBoard-mac-universal.dmg (sur un Mac)
npm run build:win   # dist/WATHI-TaskBoard-win-x64.exe (sur Windows, ou via GitHub Actions)
```

L'application n'est pas signée (pas de compte Apple Developer ni de certificat Windows pour l'instant) :

- **macOS** : l'app reçoit une signature « ad hoc » au build (hook `scripts/adhoc-sign.cjs`), sans compte Apple. C'est indispensable pour que les notifications système s'affichent : macOS refuse celles d'une app non signée. Lors de la première notification, macOS demande l'autorisation ; on peut la revoir dans Réglages Système › Notifications › WATHI TaskBoard.
- **macOS** bloque la première ouverture d'une app téléchargée non notarisée. L'utilisateur va dans Réglages Système › Confidentialité et sécurité et clique sur « Ouvrir quand même ». Une seule fois.
- **Windows** affiche SmartScreen : « Informations complémentaires » puis « Exécuter quand même ».
- La mise à jour automatique fonctionne sur Windows. Sur macOS, elle exige une signature Apple : l'app prévient qu'une nouvelle version existe et renvoie vers la page de téléchargement.

Pour signer plus tard : un compte Apple Developer (identité « Developer ID Application » + notarisation) et un certificat de signature Windows ; electron-builder les prend en charge via les variables `CSC_LINK` / `CSC_KEY_PASSWORD` (et `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` pour la notarisation). Retirer alors `identity: null` de `electron-builder.yml`.

## Publier une version

Les installeurs sont publiés dans les Releases de ce dépôt (public : GitHub Actions y est gratuit, macOS compris). La page https://wathi-taskboard.vercel.app/desktop pointe vers la dernière version, et l'app s'y connecte pour se mettre à jour. Aucun jeton à configurer : le workflow publie avec le jeton intégré du dépôt.

À chaque version :

```bash
# 1. incrémenter "version" dans package.json, puis commit
# 2. poser le tag correspondant et le pousser
git tag v1.0.1
git push origin v1.0.1
```

GitHub Actions (`.github/workflows/release.yml`) construit les deux installeurs et les publie dans la release `v1.0.1`.

Sans GitHub Actions (compte bloqué, quota épuisé), tout se fait depuis un Mac :

```bash
npm run build:all                      # dist/ : .dmg universel et .exe Windows
GH_TOKEN=<jeton> npm run publish:local # crée la release vX.Y.Z et y dépose les fichiers
```

Le jeton est un jeton GitHub à granularité fine avec « Contents : Read and write » sur ce dépôt. Ne le collez jamais ailleurs que dans cette commande. Les utilisateurs Windows reçoivent la mise à jour automatiquement ; les utilisateurs Mac sont invités à télécharger.

Le code du site (Next.js, privé) vit dans un autre dépôt ; il détecte l'app grâce au pont `window.taskboardDesktop` (voir `preload.js`).

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `main.js` | Processus principal : fenêtre, menu, barre de menus, raccourci, pont IPC |
| `preload.js` | Pont `window.taskboardDesktop` exposé à la page |
| `updater.js` | Vérification et installation des mises à jour |
| `offline.html` | Page affichée quand le site est injoignable |
| `electron-builder.yml` | Cibles, icônes, publication |
| `build/icon.png` | Icône de l'app (1024 px), convertie automatiquement en .icns et .ico |
| `assets/` | Icônes de barre de menus et pastille Windows |
