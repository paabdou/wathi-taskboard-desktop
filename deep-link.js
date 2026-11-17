'use strict'

// Liens profonds wathi-taskboard:// reçus par l'application (clic sur un lien
// dans un e-mail ou une page web). Seules les destinations connues sont
// acceptées, avec leurs seuls paramètres utiles ; tout le reste est ignoré.

const SCHEME = 'wathi-taskboard'

const ROUTES = {
  // Lien de confirmation d'e-mail : la page du site consomme le jeton dans la
  // fenêtre de l'app, qui se retrouve connectée.
  'auth/confirm': { path: '/auth/confirm', params: ['token_hash', 'type', 'next'] },
}

/**
 * Convertit un lien profond en adresse du site à charger dans la fenêtre.
 * Retourne null si le lien n'est pas un lien profond valide.
 */
function parseDeepLink(rawUrl, appUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.startsWith(`${SCHEME}://`)) return null
  let url
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  // wathi-taskboard://auth/confirm → host « auth », pathname « /confirm »
  const key = `${url.host}${url.pathname}`.replace(/\/+$/, '')
  const route = ROUTES[key]
  if (!route) return null
  const query = new URLSearchParams()
  for (const name of route.params) {
    const value = url.searchParams.get(name)
    if (value) query.set(name, value)
  }
  const target = new URL(route.path, `${appUrl.replace(/\/$/, '')}/`)
  target.search = query.toString()
  return target.toString()
}

/** Lien profond éventuellement passé en argument de ligne de commande (Windows, Linux). */
function deepLinkFromArgv(argv) {
  return (argv || []).find((arg) => typeof arg === 'string' && arg.startsWith(`${SCHEME}://`)) || null
}

module.exports = { SCHEME, parseDeepLink, deepLinkFromArgv }
