import 'dotenv/config'
import { Telegraf, Markup } from 'telegraf'
import { isAdmin } from './telegramAuth.js'
import * as strapi from './strapi.js'

const BOT_TOKEN = process.env.BOT_TOKEN
const MINI_APP_URL = process.env.MINI_APP_URL

export function createBot() {
  if (!BOT_TOKEN) {
    throw new Error('BOT_TOKEN не задан в .env')
  }

  const bot = new Telegraf(BOT_TOKEN)

  bot.use((ctx, next) => {
    const userId = ctx.from?.id
    if (!isAdmin(userId)) {
      return ctx.reply('Доступ ограничен. Обратитесь к владельцу e-Knot News.')
    }
    return next()
  })

  bot.command('start', async (ctx) => {
    if (!MINI_APP_URL) {
      return ctx.reply(
        'e-Knot News — панель модератора.\n\n' +
          'MINI_APP_URL ещё не настроен в .env бота, поэтому кнопка приложения недоступна. ' +
          'Добавь публичную ссылку (например, из ngrok) и перезапусти бота.'
      )
    }

    await ctx.reply(
      'e-Knot News — панель модератора\n\n' +
        'Здесь можно проверять AI-черновики новостей, управлять источниками и настройками парсинга прямо из Telegram.',
      Markup.inlineKeyboard([Markup.button.webApp('Открыть панель', MINI_APP_URL)])
    )
  })

  bot.command('status', async (ctx) => {
    try {
      const stats = await strapi.getDashboardStats()
      await ctx.reply(
        [
          'Статус e-Knot News',
          '',
          `Черновиков на проверке: ${stats.pendingDrafts}`,
          `На доработке: ${stats.reviewDrafts}`,
          `Активных источников: ${stats.activeSources}`,
          `Опубликовано сегодня: ${stats.articlesToday}`,
        ].join('\n')
      )
    } catch (e) {
      await ctx.reply(`Не получилось получить статус: ${e.message}\n\nПроверь, что Strapi запущен и STRAPI_API_TOKEN верный.`)
    }
  })

  bot.command('parse', async (ctx) => {
    await ctx.reply('Запускаю парсинг активных источников…')
    try {
      const result = await strapi.runAutoParser()
      await ctx.reply(`Готово.\n${JSON.stringify(result?.data ?? result, null, 2).slice(0, 1500)}`)
    } catch (e) {
      await ctx.reply(`Ошибка парсинга: ${e.message}`)
    }
  })

  bot.command('help', (ctx) =>
    ctx.reply(
      [
        'Команды:',
        '/start — открыть панель управления (Mini App)',
        '/status — быстрая сводка по черновикам и источникам',
        '/parse — запустить парсинг источников вручную',
      ].join('\n')
    )
  )

  return bot
}
