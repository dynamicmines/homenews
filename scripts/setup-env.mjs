import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function randomSecret(bytes = 48) {
  return randomBytes(bytes).toString('base64url')
}

function replaceEnvValue(source, key, value) {
  const line = `${key}=${value}`
  const pattern = new RegExp(`^${key}=.*$`, 'm')
  return pattern.test(source) ? source.replace(pattern, line) : `${source.trimEnd()}\n${line}\n`
}

function createCmsEnv() {
  const target = join(root, 'eknot-cms', '.env')

  if (existsSync(target)) {
    console.log('[setup] eknot-cms/.env уже существует — оставлен без изменений')
    return
  }

  const template = readFileSync(join(root, 'eknot-cms', '.env.example'), 'utf8')
  const values = {
    APP_KEYS: Array.from({ length: 4 }, () => randomSecret()).join(','),
    API_TOKEN_SALT: randomSecret(),
    ADMIN_JWT_SECRET: randomSecret(),
    TRANSFER_TOKEN_SALT: randomSecret(),
    JWT_SECRET: randomSecret(),
    ENCRYPTION_KEY: randomSecret(),
  }

  const output = Object.entries(values).reduce(
    (content, [key, value]) => replaceEnvValue(content, key, value),
    template
  )

  writeFileSync(target, output, { mode: 0o600 })
  console.log('[setup] создан eknot-cms/.env со случайными Strapi-секретами')
}

function createBotEnv() {
  const target = join(root, 'eknot-bot', '.env')

  if (existsSync(target)) {
    console.log('[setup] eknot-bot/.env уже существует — оставлен без изменений')
    return
  }

  const template = readFileSync(join(root, 'eknot-bot', '.env.example'), 'utf8')
  writeFileSync(target, template, { mode: 0o600 })
  console.log('[setup] создан eknot-bot/.env; заполни BOT_TOKEN, ADMIN_IDS и STRAPI_API_TOKEN')
}

createCmsEnv()
createBotEnv()

console.log('[setup] перед AI-обработкой добавь GEMINI_API_KEY в eknot-cms/.env')
