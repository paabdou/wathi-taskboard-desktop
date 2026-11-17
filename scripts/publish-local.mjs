#!/usr/bin/env node
// Publie les installeurs déjà construits (dossier dist/) dans la release GitHub de la version
// courante, sans passer par GitHub Actions. Usage :
//   GH_TOKEN=<jeton> npm run publish:local
// Le jeton doit avoir l'autorisation « Contents : Read and write » sur ce dépôt.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const REPO = 'paabdou/wathi-taskboard-desktop'
const token = process.env.GH_TOKEN
if (!token) {
  console.error('GH_TOKEN manquant. Lancez : GH_TOKEN=<jeton> npm run publish:local')
  process.exit(1)
}
const version = JSON.parse(readFileSync('package.json', 'utf8')).version
const tag = `v${version}`
const dist = 'dist'
const wanted = /\.(dmg|exe|blockmap|yml)$/
const files = readdirSync(dist).filter((f) => wanted.test(f) && !f.startsWith('builder-'))
if (!files.some((f) => f.endsWith('.dmg')) || !files.some((f) => f.endsWith('.exe'))) {
  console.error('dist/ ne contient pas les deux installeurs. Lancez d’abord : npx electron-builder --mac --win --publish never')
  process.exit(1)
}

const api = (path, init = {}) =>
  fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers ?? {}),
    },
  })

async function getOrCreateRelease() {
  const existing = await api(`/repos/${REPO}/releases/tags/${tag}`)
  if (existing.ok) return existing.json()
  const created = await api(`/repos/${REPO}/releases`, {
    method: 'POST',
    body: JSON.stringify({ tag_name: tag, name: `WATHI TaskBoard ${version}`, body: `Installeurs Mac (universel) et Windows, version ${version}.`, draft: false, prerelease: false }),
  })
  if (!created.ok) throw new Error(`Création de la release impossible (${created.status}) : ${await created.text()}`)
  return created.json()
}

const release = await getOrCreateRelease()
console.log(`Release ${tag} : ${release.html_url}`)
const uploadBase = release.upload_url.replace(/\{.*$/, '')

for (const name of files) {
  const already = (release.assets ?? []).find((a) => a.name === name)
  if (already) {
    const del = await api(`/repos/${REPO}/releases/assets/${already.id}`, { method: 'DELETE' })
    if (!del.ok && del.status !== 404) throw new Error(`Suppression de ${name} impossible (${del.status})`)
  }
  const path = join(dist, name)
  const size = statSync(path).size
  process.stdout.write(`  ${name} (${Math.round(size / 1048576)} Mo)… `)
  const res = await fetch(`${uploadBase}?name=${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream', 'Content-Length': String(size) },
    body: readFileSync(path),
  })
  if (!res.ok) throw new Error(`échec (${res.status}) : ${await res.text()}`)
  console.log('ok')
}
console.log(`\nPublié : https://github.com/${REPO}/releases/tag/${tag}`)
