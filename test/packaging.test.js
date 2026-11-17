'use strict'
// Garde-fou : tout module local chargé par le processus principal doit figurer
// dans la liste « files » d'electron-builder.yml, sinon l'app empaquetée plante
// au démarrage (« Cannot find module »).
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const builderConfig = fs.readFileSync(path.join(root, 'electron-builder.yml'), 'utf8')
const packagedFiles = builderConfig
  .split('\n')
  .map((line) => line.match(/^\s+-\s+([^\s#]+)\s*$/)?.[1])
  .filter(Boolean)

for (const entry of ['main.js', 'preload.js', 'updater.js']) {
  test(`${entry} : ses require('./…') sont empaquetés`, () => {
    const source = fs.readFileSync(path.join(root, entry), 'utf8')
    const locals = [...source.matchAll(/require\(['"]\.\/([^'"]+)['"]\)/g)].map((m) => m[1])
    for (const local of locals) {
      const file = local.endsWith('.js') ? local : `${local}.js`
      assert.ok(fs.existsSync(path.join(root, file)), `${file} introuvable`)
      assert.ok(packagedFiles.includes(file), `${file} manque dans electron-builder.yml (files)`)
    }
  })
}
