import crypto from 'node:crypto'

const ADMIN_IDS = (process.env.ADMIN_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

/**
 * Verifies Telegram WebApp initData signature.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyInitData(initData, botToken) {
  if (!initData || !botToken) return { ok: false, reason: 'missing initData or bot token' }

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return { ok: false, reason: 'no hash in initData' }
  params.delete('hash')

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  if (computedHash !== hash) return { ok: false, reason: 'hash mismatch' }

  const authDate = Number(params.get('auth_date') || 0)
  const ageSeconds = Date.now() / 1000 - authDate
  if (ageSeconds > 86400) return { ok: false, reason: 'initData expired' }

  let user = null
  try {
    user = JSON.parse(params.get('user') || 'null')
  } catch {
    // ignore
  }

  return { ok: true, user }
}

export function isAdmin(userId) {
  if (ADMIN_IDS.length === 0) return true // no allowlist configured -> allow (dev mode)
  return ADMIN_IDS.includes(String(userId))
}

/**
 * Express middleware: expects header `x-telegram-init-data` with the raw initData
 * string that Telegram.WebApp.initData provides on the client.
 */
export function requireTelegramAuth(req, res, next) {
  const botToken = process.env.BOT_TOKEN
  const initData = req.header('x-telegram-init-data')

  const result = verifyInitData(initData, botToken)
  if (!result.ok) {
    return res.status(401).json({ ok: false, error: 'unauthorized', reason: result.reason })
  }

  const userId = result.user?.id
  if (!isAdmin(userId)) {
    return res.status(403).json({ ok: false, error: 'forbidden: not an admin' })
  }

  req.telegramUser = result.user
  next()
}
