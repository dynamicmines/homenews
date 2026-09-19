/**
 * article controller
 */

import { factories } from '@strapi/strapi'
import * as cheerio from 'cheerio'

function normalizeTelegramPostUrl(value: unknown) {
  const input = String(value || '').trim()
  const match = input.match(/^https:\/\/t\.me\/(?:s\/)?([a-zA-Z0-9_]+)\/(\d+)/)

  if (!match) return ''

  return `https://t.me/${match[1]}/${match[2]}?embed=1&mode=tme`
}

function extractCssUrl(style = '') {
  const match = String(style).match(/url\((['"]?)(.*?)\1\)/i)
  const url = match?.[2]?.replace(/&amp;/g, '&').trim() || ''

  if (url.startsWith('//')) return `https:${url}`
  return url
}

export default factories.createCoreController('api::article.article', ({ strapi }) => ({
  async telegramImage(ctx: any) {
    const postUrl = normalizeTelegramPostUrl(ctx.query?.url)

    if (!postUrl) {
      return ctx.badRequest('Некорректная ссылка Telegram')
    }

    try {
      const postResponse = await fetch(postUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 HomeNews Image Proxy/1.0',
          Accept: 'text/html,application/xhtml+xml',
        },
      })

      if (!postResponse.ok) {
        return ctx.notFound('Изображение Telegram недоступно')
      }

      const $ = cheerio.load(await postResponse.text())
      const photoStyle = $('.tgme_widget_message_photo_wrap').first().attr('style') || ''
      const replyStyle = $('.tgme_widget_message_reply_thumb').first().attr('style') || ''
      const imageUrl = extractCssUrl(photoStyle) || extractCssUrl(replyStyle)

      if (!imageUrl) {
        return ctx.notFound('В публикации нет изображения')
      }

      const parsedImageUrl = new URL(imageUrl)
      const allowedImageHost = parsedImageUrl.hostname === 'telesco.pe' || parsedImageUrl.hostname.endsWith('.telesco.pe')

      if (!allowedImageHost) {
        return ctx.badRequest('Недопустимый источник изображения')
      }

      const imageResponse = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 HomeNews Image Proxy/1.0',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
      })

      const contentType = imageResponse.headers.get('content-type') || ''

      if (!imageResponse.ok || !contentType.startsWith('image/')) {
        return ctx.notFound('Изображение Telegram недоступно')
      }

      const image = Buffer.from(await imageResponse.arrayBuffer())

      ctx.set('Content-Type', contentType)
      ctx.set('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800')
      ctx.set('Content-Length', String(image.length))
      ctx.body = image
    } catch (error) {
      strapi.log.warn(`Не удалось получить изображение Telegram: ${error}`)
      return ctx.notFound('Изображение Telegram недоступно')
    }
  },
}))
