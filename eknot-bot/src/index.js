import 'dotenv/config'
import { createServer } from './server.js'
import { createBot } from './bot.js'

const PORT = process.env.PORT || 3001

const app = createServer()
app.listen(PORT, () => {
  console.log(`[eknot-bot] Mini App server listening on http://localhost:${PORT}`)
  if (!process.env.MINI_APP_URL) {
    console.log('[eknot-bot] MINI_APP_URL не задан — открой ngrok на этот порт и добавь ссылку в .env')
  }
})

if (process.env.BOT_TOKEN) {
  const bot = createBot()
  bot
    .launch()
    .then(() => console.log('[eknot-bot] Telegram bot запущен (polling)'))
    .catch((e) => console.error('[eknot-bot] Не удалось запустить Telegram-бота:', e.message))

  process.once('SIGINT', () => bot.stop('SIGINT'))
  process.once('SIGTERM', () => bot.stop('SIGTERM'))
} else {
  console.log('[eknot-bot] BOT_TOKEN не задан — бот не запущен, работает только веб-сервер Mini App')
}
