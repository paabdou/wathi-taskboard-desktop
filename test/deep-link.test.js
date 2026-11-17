'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { parseDeepLink, deepLinkFromArgv } = require('../deep-link')

const APP = 'https://wathi-taskboard.vercel.app'

test('lien de confirmation d’e-mail → page du site avec ses paramètres', () => {
  assert.equal(
    parseDeepLink('wathi-taskboard://auth/confirm?token_hash=abc123&type=email&next=%2Fsettings', APP),
    `${APP}/auth/confirm?token_hash=abc123&type=email&next=%2Fsettings`,
  )
})

test('les paramètres inconnus sont ignorés, les manquants omis', () => {
  assert.equal(parseDeepLink('wathi-taskboard://auth/confirm?token_hash=abc&foo=bar', APP), `${APP}/auth/confirm?token_hash=abc`)
})

test('destination inconnue, autre schéma ou lien malformé → null', () => {
  assert.equal(parseDeepLink('wathi-taskboard://settings', APP), null)
  assert.equal(parseDeepLink('wathi-taskboard://auth/confirm/../../evil', APP), null)
  assert.equal(parseDeepLink('https://wathi-taskboard.vercel.app/auth/confirm?token_hash=abc', APP), null)
  assert.equal(parseDeepLink('wathi-taskboard://', APP), null)
  assert.equal(parseDeepLink(undefined, APP), null)
})

test('le lien est retrouvé dans les arguments de ligne de commande', () => {
  assert.equal(deepLinkFromArgv(['app.exe', '--flag', 'wathi-taskboard://auth/confirm?token_hash=x']), 'wathi-taskboard://auth/confirm?token_hash=x')
  assert.equal(deepLinkFromArgv(['app.exe']), null)
})
