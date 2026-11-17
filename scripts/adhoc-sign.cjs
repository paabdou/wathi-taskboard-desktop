'use strict'

// Hook electron-builder (afterPack) : signature « ad hoc » de l'app macOS.
// Sans compte Apple Developer, l'app ne peut pas être signée avec une identité ;
// mais une app totalement non signée est refusée par le centre de notifications
// de macOS (erreur UNErrorDomain 1 : notifications non autorisées). La signature
// ad hoc, gratuite et locale, suffit pour que les notifications système s'affichent.
// Elle ne change rien à l'avertissement Gatekeeper à la première ouverture.
const { execFileSync } = require('node:child_process')
const path = require('node:path')

module.exports = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return
  // Build universel : electron-builder empaquette d'abord x64 et arm64 dans des
  // dossiers « -temp », puis les fusionne et rappelle ce hook sur le paquet final.
  // Signer les paquets intermédiaires ferait échouer la fusion : on attend le final.
  if (/-(x64|arm64)-temp$/.test(context.appOutDir)) return
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })
  console.log(`  • signature ad hoc appliquée : ${appPath}`)
}
