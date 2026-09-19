'use strict'

const { factories } = require('@strapi/strapi')
const cheerio = require('cheerio')
const fs = require('fs/promises')
const path = require('path')
const os = require('os')

const EKNOT_KEYWORDS = [
  'жкх',
  'коммун',
  'коммунальные',
  'коммуналдық',
  'вода',
  'водоснабжение',
  'горячей воды',
  'холодной воды',
  'отключение воды',
  'канализация',
  'кәріз',
  'электричество',
  'электроснабжение',
  'свет',
  'жарық',
  'электр',
  'отопление',
  'тепло',
  'жылу',
  'дорога',
  'дороги',
  'жол',
  'жолдар',
  'улица',
  'улицы',
  'көше',
  'көшелер',
  'тротуар',
  'ремонт дорог',
  'ямочный ремонт',
  'благоустройство',
  'абаттандыру',
  'двор',
  'дворовые территории',
  'аула',
  'мусор',
  'вывоз мусора',
  'қоқыс',
  'санитар',
  'уборка',
  'тазалау',
  'снег',
  'қар',
  'авария',
  'аварийные работы',
  'акимат',
  'әкімдік',
  'уведомление',
  'хабарлама',
  'инфраструктура',
  'инженерные сети',
  'инженерлік желілер',
  'городские службы',
  'тұрғын',
  'тұрғындар',
  'тұрғын үй',
  'қалалық',
  'құрылыс',
  'ливневая',
  'нөсер',
  'iKOMEK',
  '109',
  'ikomek',
]

const BAD_TEXT_MARKERS = [
  'facebook',
  'instagram',
  'whatsapp',
  'youtube',
  'cookie',
  'javascript',
  'egov',
  'личный кабинет',
  'версия для слабовидящих',
  'skip to content',
  'поделиться',
  'share',
]

function cleanJsonText(text: string) {
  if (!text) return ''

  return text
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim()
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeText(text: string) {
  return String(text || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim()
}

function normalizeUrgency(value: string) {
  const urgency = String(value || '').toLowerCase()

  if (['low', 'medium', 'high'].includes(urgency)) {
    return urgency
  }

  return 'medium'
}


function getMediaId(media: any) {
  if (!media) return null
  if (Array.isArray(media)) return media[0]?.id || null
  if (media?.id) return media.id
  if (media?.data?.id) return media.data.id
  return null
}

async function resolveCoverImageForArticle(strapi: any, draft: any, category: any) {
  // Prefer the real source image. Category artwork is only a fallback.
  const draftCoverId = getMediaId(draft.coverImage)

  if (draftCoverId) {
    return draftCoverId
  }

  if (draft.originalImageUrl) {
    const uploadedImage = await uploadRemoteImageToStrapi(
      strapi,
      draft.originalImageUrl,
      draft.generatedTitleRu || draft.originalTitle || 'article-cover'
    )

    if (uploadedImage?.id) {
      return uploadedImage.id
    }
  }

  const categoryCoverId = getMediaId(category?.defaultCoverImage)

  if (categoryCoverId) {
    return categoryCoverId
  }

  if (category?.defaultImageUrl) {
    const uploadedImage = await uploadRemoteImageToStrapi(
      strapi,
      category.defaultImageUrl,
      category.nameRu || category.slug || 'category-cover'
    )

    if (uploadedImage?.id) {
      return uploadedImage.id
    }
  }

  return null
}

function isRelevantByKeywords(text: string) {
  const normalized = String(text || '').toLowerCase()

  return EKNOT_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase()))
}

function normalizeHostname(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return String(value || '').replace(/^www\./, '').toLowerCase()
  }
}

function isAllowedUrl(articleUrl: string, source: any) {
  const articleHost = normalizeHostname(articleUrl)

  const allowedDomain = source.allowedDomain || source.url || source.sourceUrl || ''
  const allowedHost = normalizeHostname(allowedDomain)

  if (!articleHost || !allowedHost) return false

  return articleHost === allowedHost || articleHost.endsWith(`.${allowedHost}`)
}

function pushUnique(parts: string[], value: string, minLength = 40) {
  const text = normalizeText(value)
  const lower = text.toLowerCase()

  if (text.length < minLength) return
  if (text.length > 6000) return
  if (BAD_TEXT_MARKERS.some((marker) => lower.includes(marker))) return
  if (parts.some((item) => item === text || item.includes(text) || text.includes(item))) return

  parts.push(text)
}

function collectStringsFromJson(value: any, parts: string[], depth = 0) {
  if (depth > 8 || value === null || value === undefined) return

  if (typeof value === 'string') {
    pushUnique(parts, value, 60)
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStringsFromJson(item, parts, depth + 1))
    return
  }

  if (typeof value === 'object') {
    const priorityKeys = [
      'articleBody',
      'body',
      'content',
      'description',
      'text',
      'title',
      'headline',
      'name',
      'shortDescription',
    ]

    priorityKeys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        collectStringsFromJson(value[key], parts, depth + 1)
      }
    })

    Object.keys(value).forEach((key) => {
      if (!priorityKeys.includes(key)) {
        collectStringsFromJson(value[key], parts, depth + 1)
      }
    })
  }
}

function collectJsonFromScripts($: any, parts: string[]) {
  $('script').each((_: any, element: any) => {
    const raw = $(element).html() || ''
    const text = raw.trim()

    if (!text || text.length < 80) return

    const type = String($(element).attr('type') || '').toLowerCase()

    if (type.includes('application/ld+json')) {
      try {
        collectStringsFromJson(JSON.parse(text), parts)
      } catch {
        // ignore broken JSON-LD
      }
    }

    if (
      text.includes('__NEXT_DATA__') ||
      text.includes('window.__NUXT__') ||
      text.includes('articleBody') ||
      text.includes('description') ||
      text.includes('content')
    ) {
      const quotedStrings = text.match(/"([^"\\]*(?:\\.[^"\\]*)*)"/g) || []

      quotedStrings.slice(0, 500).forEach((quoted: string) => {
        try {
          const decoded = JSON.parse(quoted)
          pushUnique(parts, decoded, 70)
        } catch {
          // ignore
        }
      })
    }
  })
}

function extractCssUrl(value: string) {
  const match = String(value || '').match(/url\((['"]?)(.*?)\1\)/)
  return normalizeImageUrl(match?.[2] || '')
}

function normalizeImageUrl(url: string) {
  return String(url || '')
    .replace(/&amp;/g, '&')
    .replace(/^['"]|['"]$/g, '')
    .trim()
}

function normalizeContentUrl(value: string) {
  const rawUrl = normalizeImageUrl(value)

  if (!rawUrl) return ''

  try {
    const url = new URL(rawUrl)

    url.hash = ''
    url.searchParams.delete('single')

    Array.from(url.searchParams.keys()).forEach((key) => {
      if (/^(utm_.+|fbclid|gclid|yclid)$/i.test(key)) {
        url.searchParams.delete(key)
      }
    })

    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, '')
    }

    return url.toString()
  } catch {
    return rawUrl.replace(/[?#].*$/, '').replace(/\/+$/, '')
  }
}

function extractArticleTextFromHtml(html: string) {
  const $ = cheerio.load(html)
  const parts: string[] = []

  collectJsonFromScripts($, parts)

  const metaTitle =
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="twitter:title"]').attr('content') ||
    ''

  const metaDescription =
    $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="twitter:description"]').attr('content') ||
    ''

  const imageUrl = normalizeImageUrl(
    $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('img').first().attr('src') ||
      ''
  )

  pushUnique(parts, metaDescription, 40)

  $('script, style, noscript, svg, iframe, nav, footer, header, form, button').remove()

  const pageTitle =
    normalizeText($('h1').first().text()) ||
    normalizeText(metaTitle) ||
    normalizeText($('title').first().text()) ||
    'Материал из источника'

  const selectors = [
    'article',
    'main',
    '[role="main"]',
    '[class*="content"]',
    '[class*="Content"]',
    '[class*="news"]',
    '[class*="News"]',
    '[class*="article"]',
    '[class*="Article"]',
    '[class*="description"]',
    '[class*="Description"]',
    '[class*="body"]',
    '[class*="Body"]',
    '[class*="text"]',
    '[class*="Text"]',
    '[class*="detail"]',
    '[class*="Detail"]',
    '[class*="post"]',
    '[class*="Post"]',
    'section',
    'p',
    'li',
    'div',
    'span',
  ]

  selectors.forEach((selector) => {
    $(selector).each((_: any, element: any) => {
      const text = normalizeText($(element).text())
      pushUnique(parts, text, 60)
    })
  })

  let originalText = parts
    .sort((a, b) => b.length - a.length)
    .slice(0, 10)
    .join('\n\n')

  if (!originalText || originalText.length < 80) {
    const bodyText = normalizeText($('body').text())

    if (bodyText.length >= 120) {
      originalText = bodyText.slice(0, 6000)
    }
  }

  if ((!originalText || originalText.length < 80) && metaDescription) {
    originalText = `${pageTitle}\n\n${metaDescription}`
  }

  return {
    pageTitle,
    originalText: originalText.slice(0, 9000),
    extractedLength: originalText.length,
    imageUrl,
  }
}

function extractTelegramImageUrls(message: any, $: any) {
  const urls: string[] = []

  message.find('.tgme_widget_message_photo_wrap').each((_: any, element: any) => {
    const style = $(element).attr('style') || ''

    const imageUrl = extractCssUrl(style)

    if (imageUrl && !urls.includes(imageUrl)) {
      urls.push(imageUrl)
    }

    const dataSrc = normalizeImageUrl($(element).attr('data-src') || '')

    if (dataSrc && !urls.includes(dataSrc)) {
      urls.push(dataSrc)
    }
  })

  return urls
}

function extractTelegramPostUrl(message: any, feedUrl: string) {
  const dataPost = String(message.attr('data-post') || '')

  if (dataPost.includes('/')) {
    return `https://t.me/${dataPost}`.replace('?single', '')
  }

  const dateHref =
    message.find('.tgme_widget_message_date a').attr('href') ||
    message.find('.tgme_widget_message_date').attr('href') ||
    ''

  if (dateHref) {
    return normalizeImageUrl(dateHref).replace('?single', '')
  }

  return feedUrl
}

function extractTelegramPostsFromHtml(html: string, feedUrl: string) {
  const $ = cheerio.load(html)

  const posts: Array<{
    title: string
    text: string
    url: string
    imageUrl: string
    imageUrls: string[]
    hasText: boolean
    hasImage: boolean
  }> = []

  $('.tgme_widget_message').each((_: any, element: any) => {
    const message = $(element)

    const rawText = normalizeText(
      message
        .find('.tgme_widget_message_text')
        .text()
    )

    const postUrl = extractTelegramPostUrl(message, feedUrl)
    const imageUrls = extractTelegramImageUrls(message, $)
    const imageUrl = imageUrls[0] || ''

    const postCode =
      String(message.attr('data-post') || '')
        .split('/')
        .pop() || ''

    const cleanText = rawText
      .replace(/#[\wа-яА-ЯёЁ_]+/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    const hasText = cleanText.length >= 40
    const hasImage = imageUrls.length > 0

    if (!hasText && !hasImage) return

    // This is an internal fallback for the draft only. It must not become a public
    // “look at the image” placeholder in generated news.
    const fallbackText = hasImage
      ? 'Публикация iKOMEK109 содержит медиа-материалы без текстового описания. Требуется проверка администратором перед публикацией.'
      : ''

    const finalText = hasText ? cleanText : fallbackText

    posts.push({
      title: hasText
        ? cleanText.slice(0, 100)
        : `Публикация iKOMEK109 ${postCode}`,
      text: finalText,
      url: postUrl,
      imageUrl,
      imageUrls,
      hasText,
      hasImage,
    })
  })

  return posts
    .filter((post, index, arr) => {
      return arr.findIndex((item) => item.url === post.url) === index
    })
    // Telegram's public HTML is oldest-first; parsing must start from fresh posts.
    .reverse()
}

async function getAiSetting(strapi: any) {
  try {
    const settings = await strapi
      .documents('api::ai-setting.ai-setting')
      .findFirst({ status: 'published' })

    return settings || null
  } catch (error) {
    strapi.log.warn('AI Setting не найден или не опубликован')
    return null
  }
}

async function findExistingDraftByOriginalUrl(strapi: any, originalUrl: string) {
  if (!originalUrl) return null

  const normalizedUrl = normalizeContentUrl(originalUrl)
  const urlCandidates = Array.from(new Set([originalUrl, normalizedUrl].filter(Boolean)))

  try {
    const existing = await strapi.documents('api::ai-draft.ai-draft').findMany({
      filters: {
        originalUrl: {
          $in: urlCandidates,
        },
      },
      status: 'published',
      limit: 1,
    })

    return existing?.[0] || null
  } catch (error) {
    strapi.log.warn('Не удалось проверить дубликаты AI Draft')
    return null
  }
}

async function uploadRemoteImageToStrapi(strapi: any, imageUrl: string, title = 'ai-draft-image') {
  if (!imageUrl || imageUrl.startsWith('data:')) return null

  let tmpPath = ''

  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 HomeNews Parser/1.0',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    })

    if (!response.ok) {
      strapi.log.warn(`Не удалось скачать изображение: ${response.status}`)
      return null
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'

    if (!contentType.startsWith('image/')) {
      strapi.log.warn(`URL не является изображением: ${contentType}`)
      return null
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    if (!buffer.length) return null

    const ext =
      contentType.includes('png') ? '.png' :
      contentType.includes('webp') ? '.webp' :
      contentType.includes('gif') ? '.gif' :
      contentType.includes('svg') ? '.svg' :
      '.jpg'

    const safeName = String(title || 'ai-draft-image')
      .replace(/[^\wа-яА-ЯёЁ-]+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60) || 'ai-draft-image'

    const fileName = `${safeName}-${Date.now()}${ext}`
    tmpPath = path.join(os.tmpdir(), fileName)

    await fs.writeFile(tmpPath, buffer)

    const uploadedFiles = await strapi.plugin('upload').service('upload').upload({
      data: {},
      files: {
        filepath: tmpPath,
        originalFilename: fileName,
        mimetype: contentType,
        size: buffer.length,
      },
    })

    return uploadedFiles?.[0] || null
  } catch (error) {
    strapi.log.warn('Ошибка загрузки изображения в Strapi')
    strapi.log.warn(error)
    return null
  } finally {
    if (tmpPath) {
      await fs.unlink(tmpPath).catch(() => null)
    }
  }
}

async function fetchRemoteImageForGemini(strapi: any, imageUrl: string) {
  if (!imageUrl || imageUrl.startsWith('data:')) return null

  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 HomeNews Parser/1.0',
        Accept: 'image/avif,image/webp,image/apng,image/jpeg,image/png,image/*,*/*;q=0.8',
      },
    })

    if (!response.ok) {
      strapi.log.warn(`Не удалось скачать изображение для Gemini: ${response.status}`)
      return null
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'

    if (!contentType.startsWith('image/')) {
      strapi.log.warn(`URL для Gemini не является изображением: ${contentType}`)
      return null
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    if (!buffer.length) return null

    const maxBytes = 8 * 1024 * 1024

    if (buffer.length > maxBytes) {
      strapi.log.warn(`Изображение слишком большое для Gemini: ${buffer.length} bytes`)
      return null
    }

    return {
      mimeType: contentType.split(';')[0],
      data: buffer.toString('base64'),
    }
  } catch (error) {
    strapi.log.warn('Ошибка подготовки изображения для Gemini')
    strapi.log.warn(error)
    return null
  }
}

async function generateWithGemini(strapi: any, payload: any) {
  const {
    sourceName = '',
    sourceUrl = '',
    originalTitle = '',
    originalUrl = '',
    originalText = '',
    processingPrompt = '',
    imageUrl = '',
    imageUrls = [],
  } = payload

  const normalizedOriginalUrl = normalizeContentUrl(originalUrl || sourceUrl)

  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY не найден в .env')
  }

  const existingDraft = await findExistingDraftByOriginalUrl(strapi, normalizedOriginalUrl)

  if (existingDraft) {
    return {
      rejected: true,
      duplicate: true,
      reason: 'Черновик для этого материала уже существует',
      draft: existingDraft,
    }
  }

  const aiSetting = await getAiSetting(strapi)

  const defaultStylePrompt =
    aiSetting?.defaultStylePrompt ||
    'Пиши новости официально, кратко и понятно для жителей города.'

  const factCheckRule =
    aiSetting?.factCheckRule ||
    'Используй только информацию из исходного материала. Не добавляй неподтвержденные факты.'

  const translationRule =
    aiSetting?.translationRule ||
    'Подготавливай русскую и казахскую версии с одинаковым смыслом.'

  const customRules = Array.isArray(aiSetting?.customRules) ? aiSetting.customRules : []

  const customRulesBlock = customRules.length
    ? customRules
        .filter((rule: any) => rule?.text)
        .map((rule: any) => `- ${rule.label ? `${rule.label}: ` : ''}${rule.text}`)
        .join('\n')
    : ''

  const adminInstruction =
    processingPrompt ||
    'Сделай из исходного текста полноценный черновик новости для городского портала.'

  const finalPrompt = `
Ты AI-журналист городской новостной платформы HomeNews.

HomeNews пишет только о:
- ЖКХ;
- коммунальных службах;
- дорогах;
- водоснабжении;
- электроснабжении;
- отоплении;
- благоустройстве;
- городской инфраструктуре;
- аварийных ситуациях;
- государственных городских уведомлениях.

Если исходный материал НЕ относится к этим темам, верни:
{
  "isRelevant": false,
  "rejectionReason": "Материал не относится к тематике HomeNews"
}

Если материал подходит, подготовь черновик новости.

Ты НЕ публикуешь материал. Ты только создаёшь черновик, который администратор проверит и отредактирует.

РЕДАКЦИОННЫЙ СТИЛЬ ИЗ АДМИН-ПАНЕЛИ:
${defaultStylePrompt}

ПРАВИЛА ПРОВЕРКИ ФАКТОВ ИЗ АДМИН-ПАНЕЛИ:
${factCheckRule}

ПРАВИЛА ПЕРЕВОДА ИЗ АДМИН-ПАНЕЛИ:
${translationRule}
${customRulesBlock ? `\nДОПОЛНИТЕЛЬНЫЕ ПРАВИЛА ИЗ АДМИН-ПАНЕЛИ:\n${customRulesBlock}\n` : ''}
КОНКРЕТНАЯ ИНСТРУКЦИЯ АДМИНА:
${adminInstruction}

ИСТОЧНИК:
${sourceName || 'Не указан'}

ССЫЛКА НА ИСТОЧНИК:
${sourceUrl || originalUrl || 'Не указана'}

ЗАГОЛОВОК ИСХОДНИКА:
${originalTitle || 'Не указан'}

ИСХОДНЫЙ ТЕКСТ:
${originalText}

МЕДИА:
${imageUrl ? 'К материалу может быть прикреплено изображение. Используй изображение только как дополнительный источник проверки. Не используй заглушки, которые отправляют пользователя смотреть картинку вместо текста. Не выдумывай адреса, даты, организации и последствия, которых нет в исходнике.' : 'Изображение не прикреплено.'}

Не сокращай важные факты. Сохраняй даты, адреса, маршруты, ограничения, причины, рекомендации, номера служб и другие детали, которые важны для жителей. Картинка используется только как тематическая иллюстрация и не должна заменять текст новости.

Верни строго JSON без markdown, без пояснений и без текста вокруг.

Формат для подходящего материала:
{
  "isRelevant": true,
  "rejectionReason": "",
  "generatedTitleRu": "заголовок на русском",
  "generatedTitleKz": "заголовок на казахском",
  "generatedSummaryRu": "краткое описание на русском",
  "generatedSummaryKz": "краткое описание на казахском",
  "generatedContentRu": "полный текст новости на русском",
  "generatedContentKz": "полный текст новости на казахском",
  "suggestedCategoryName": "ЖКХ | Дороги | Водоснабжение | Электроснабжение | Госуведомления",
  "suggestedUrgency": "low | medium | high"
}
`

  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'

  const imageForGemini = imageUrl
    ? await fetchRemoteImageForGemini(strapi, imageUrl)
    : null

  const geminiParts: any[] = [
    {
      text: finalPrompt,
    },
  ]

  if (imageForGemini) {
    geminiParts.push({
      inlineData: {
        mimeType: imageForGemini.mimeType,
        data: imageForGemini.data,
      },
    })
  }

  const geminiRequestBody = {
    contents: [
      {
        parts: geminiParts,
      },
    ],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  }

  let geminiResponse: any = null
  let lastGeminiErrorText = ''
  const retryableStatuses = [429, 500, 502, 503, 504]

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(geminiRequestBody),
      }
    )

    if (geminiResponse.ok) {
      break
    }

    lastGeminiErrorText = await geminiResponse.text()
    strapi.log.warn(`Gemini attempt ${attempt} failed: ${lastGeminiErrorText}`)

    if (!retryableStatuses.includes(geminiResponse.status)) {
      break
    }

    await sleep(attempt * 2500)
  }

  if (!geminiResponse?.ok) {
    strapi.log.error(lastGeminiErrorText)
    throw new Error('Gemini API временно недоступен или вернул ошибку')
  }

  const geminiData = (await geminiResponse.json()) as any

  const rawText =
    geminiData?.candidates?.[0]?.content?.parts
      ?.map((part: any) => part.text)
      .join('') || ''

  let generated: any

  try {
    generated = JSON.parse(cleanJsonText(rawText))
  } catch (error) {
    strapi.log.error('Gemini вернул невалидный JSON:')
    strapi.log.error(rawText)
    throw new Error('Gemini вернул невалидный JSON')
  }

  if (generated.isRelevant === false) {
    const rejectionReason =
      generated.rejectionReason || 'Материал не относится к тематике HomeNews'

    const rejectedDraft = await strapi.documents('api::ai-draft.ai-draft').create({
      data: {
        sourceName,
        sourceUrl: sourceUrl || normalizedOriginalUrl,
        originalTitle,
        originalUrl: normalizedOriginalUrl,
        originalText,
        originalImageUrl: imageUrl || '',
        originalImageUrls: Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : [],
        prompt: finalPrompt,
        processingPrompt,
        stylePrompt: defaultStylePrompt,
        suggestedUrgency: 'low',
        adminComment: rejectionReason,
        draftStatus: 'rejected',
      },
      status: 'published',
    })

    return {
      rejected: true,
      reason: rejectionReason,
      draft: rejectedDraft,
    }
  }

  const allImageUrls = Array.isArray(imageUrls) && imageUrls.length
    ? imageUrls.filter(Boolean)
    : imageUrl
      ? [imageUrl]
      : []

  const uploadedImage = allImageUrls[0]
    ? await uploadRemoteImageToStrapi(strapi, allImageUrls[0], originalTitle)
    : null

  const draft = await strapi.documents('api::ai-draft.ai-draft').create({
    data: {
      sourceName,
      sourceUrl: sourceUrl || originalUrl,
      originalTitle,
      originalUrl: normalizedOriginalUrl,
      originalText,
      originalImageUrl: allImageUrls[0] || '',
      originalImageUrls: allImageUrls,
      coverImage: uploadedImage?.id || null,

      prompt: finalPrompt,
      processingPrompt,
      stylePrompt: defaultStylePrompt,

      generatedTitleRu: generated.generatedTitleRu || '',
      generatedTitleKz: generated.generatedTitleKz || '',

      generatedSummaryRu: generated.generatedSummaryRu || '',
      generatedSummaryKz: generated.generatedSummaryKz || '',

      generatedContentRu: generated.generatedContentRu || '',
      generatedContentKz: generated.generatedContentKz || '',

      suggestedCategoryName: generated.suggestedCategoryName || '',
      suggestedUrgency: normalizeUrgency(generated.suggestedUrgency),

      adminComment: '',
      draftStatus: 'new',
    },
    status: 'published',
  })

  return {
    rejected: false,
    draft,
  }
}

async function getSourceByRequest(strapi: any, sourceId = '', sourceDocumentId = '') {
  const sources = await strapi.documents('api::source.source').findMany({
    status: 'published',
    limit: 200,
  })

  return sources.find((item: any) => {
    return (
      String(item.id) === String(sourceId) ||
      String(item.documentId) === String(sourceDocumentId)
    )
  })
}

async function processTelegramSource(strapi: any, source: any, limit = 5, processingPrompt = '') {
  if (source.parseMode !== 'telegram') {
    return {
      source: source.name,
      ok: false,
      message: 'parseMode источника должен быть telegram',
      parsedCount: 0,
      relevantCount: 0,
      createdCount: 0,
      duplicateCount: 0,
      rejectedCount: 0,
      data: [],
      rejected: [],
    }
  }

  const feedUrl = source.url || 'https://t.me/s/ikomek109'

  if (!isAllowedUrl(feedUrl, source)) {
    return {
      source: source.name,
      ok: false,
      message: 'URL ленты не относится к разрешённому домену источника',
      parsedCount: 0,
      relevantCount: 0,
      createdCount: 0,
      duplicateCount: 0,
      rejectedCount: 0,
      data: [],
      rejected: [],
    }
  }

  const response = await fetch(feedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; HomeNews Parser/1.0)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.9,kk;q=0.8,en;q=0.5',
    },
  })

  if (!response.ok) {
    return {
      source: source.name,
      ok: false,
      message: `Не удалось загрузить Telegram-ленту: ${response.status}`,
      parsedCount: 0,
      relevantCount: 0,
      createdCount: 0,
      duplicateCount: 0,
      rejectedCount: 0,
      data: [],
      rejected: [],
    }
  }

  const html = await response.text()
  const posts = extractTelegramPostsFromHtml(html, feedUrl)

  const perSourceLimit = Math.max(1, Number(source.limitPerRun || limit) || 5)
  const scanLimit = Math.min(100, Math.max(30, perSourceLimit * 10))

  const relevantPosts = posts
    .filter((post) => isRelevantByKeywords(post.text) || Boolean(post.imageUrl))
    .slice(0, scanLimit)

  const createdDrafts = []
  const rejectedItems = []
  let duplicateCount = 0
  let aiAttemptCount = 0

  for (const post of relevantPosts) {
    if (aiAttemptCount >= perSourceLimit) break

    try {
      const result = await generateWithGemini(strapi, {
        sourceName: source.name,
        sourceUrl: source.url,
        originalTitle: post.title,
        originalUrl: post.url,
        originalText: post.text,
        imageUrl: post.imageUrl,
        imageUrls: post.imageUrls,
        processingPrompt:
          processingPrompt ||
          'Не сокращай важные факты. Сохраняй даты, адреса, маршруты, ограничения, причины, рекомендации, номера служб и другие детали, которые важны для жителей. Картинка используется только как тематическая иллюстрация и не должна заменять текст новости. Не используй заглушки, которые отправляют пользователя смотреть картинку вместо текста.',
      })

      if (result.duplicate) {
        duplicateCount += 1
        continue
      }

      aiAttemptCount += 1

      if (result.rejected) {
        rejectedItems.push({
          title: post.title,
          url: post.url,
          reason: result.reason,
        })
      } else {
        createdDrafts.push(result.draft)
      }
    } catch (error: any) {
      aiAttemptCount += 1
      rejectedItems.push({
        title: post.title,
        url: post.url,
        reason: error?.message || 'Ошибка Gemini API',
      })

      strapi.log.warn(`Пост пропущен из-за ошибки Gemini: ${post.url}`)
      strapi.log.warn(error)
    }
  }

  return {
    source: source.name,
    ok: true,
    message: `Пакетный парсинг завершён. Создано черновиков: ${createdDrafts.length}`,
    parsedCount: posts.length,
    relevantCount: relevantPosts.length,
    aiAttemptCount,
    createdCount: createdDrafts.length,
    duplicateCount,
    rejectedCount: rejectedItems.length,
    data: createdDrafts,
    rejected: rejectedItems,
  }
}



async function processRssSource(strapi: any, source: any, limit = 5, processingPrompt = '') {
  if (source.parseMode !== 'rss' && source.type !== 'rss') {
    return {
      source: source.name,
      ok: false,
      message: 'parseMode источника должен быть rss',
      parsedCount: 0,
      relevantCount: 0,
      createdCount: 0,
      duplicateCount: 0,
      rejectedCount: 0,
      data: [],
      rejected: [],
    }
  }

  const feedUrl = source.url

  if (!feedUrl) {
    return {
      source: source.name,
      ok: false,
      message: 'URL RSS-ленты не указан',
      parsedCount: 0,
      relevantCount: 0,
      createdCount: 0,
      duplicateCount: 0,
      rejectedCount: 0,
      data: [],
      rejected: [],
    }
  }

  if (!isAllowedUrl(feedUrl, source)) {
    return {
      source: source.name,
      ok: false,
      message: 'URL RSS-ленты не относится к разрешённому домену источника',
      parsedCount: 0,
      relevantCount: 0,
      createdCount: 0,
      duplicateCount: 0,
      rejectedCount: 0,
      data: [],
      rejected: [],
    }
  }

  const response = await fetch(feedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; HomeNews Parser/1.0)',
      Accept: 'application/rss+xml, application/xml, text/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.9,kk;q=0.8,en;q=0.5',
    },
  })

  if (!response.ok) {
    return {
      source: source.name,
      ok: false,
      message: `Не удалось загрузить RSS-ленту: ${response.status}`,
      parsedCount: 0,
      relevantCount: 0,
      createdCount: 0,
      duplicateCount: 0,
      rejectedCount: 0,
      data: [],
      rejected: [],
    }
  }

  const xml = await response.text()
  const $ = cheerio.load(xml, { xmlMode: true })

  const items = $('item')
    .toArray()
    .map((item: any) => {
      const el = $(item)

      const title = normalizeText(el.find('title').first().text())
      const link = normalizeText(el.find('link').first().text())
      const guid = normalizeText(el.find('guid').first().text())
      const pubDate = normalizeText(el.find('pubDate').first().text())

      const descriptionRaw = el.find('description').first().text() || ''
      const descriptionDom = cheerio.load(descriptionRaw)
      const descriptionText = normalizeText(descriptionDom.text())

      const enclosureUrl = normalizeImageUrl(el.find('enclosure').attr('url') || '')
      const mediaUrl = normalizeImageUrl(
        el.find('media\\:content').attr('url') ||
        el.find('media\\:thumbnail').attr('url') ||
        ''
      )
      const descriptionImageUrl = normalizeImageUrl(descriptionDom('img').first().attr('src') || '')

      let imageUrl = ''

      const rawImageUrl = enclosureUrl || mediaUrl || descriptionImageUrl

      if (rawImageUrl) {
        try {
          imageUrl = new URL(rawImageUrl, feedUrl).toString()
        } catch {
          imageUrl = rawImageUrl
        }
      }

      const originalUrl = link || guid || feedUrl
      const originalText = descriptionText || title

      return {
        title: title || 'Новость Акимата города Астаны',
        text: originalText,
        url: originalUrl,
        imageUrl,
        imageUrls: imageUrl ? [imageUrl] : [],
        pubDate,
      }
    })
    .filter((item: any) => {
      return item.title && item.url && item.text && item.text.length >= 40
    })

  const perSourceLimit = Math.max(1, Number(source.limitPerRun || limit) || 5)
  const scanLimit = Math.min(100, Math.max(30, perSourceLimit * 10))

  const relevantItems = items
    .filter((item: any) => {
      const combined = `${item.title}\n${item.text}`
      return isRelevantByKeywords(combined)
    })
    .slice(0, scanLimit)

  const createdDrafts = []
  const rejectedItems = []
  let duplicateCount = 0
  let aiAttemptCount = 0

  for (const item of relevantItems) {
    if (aiAttemptCount >= perSourceLimit) break

    try {
      const result = await generateWithGemini(strapi, {
        sourceName: source.name,
        sourceUrl: source.url,
        originalTitle: item.title,
        originalUrl: item.url,
        originalText: item.text,
        imageUrl: item.imageUrl,
        imageUrls: item.imageUrls,
        processingPrompt:
          processingPrompt ||
          'Материал получен из официальной RSS-ленты Акимата города Астаны. Сделай городскую новость для HomeNews. Сохрани важные факты, даты, адреса, ограничения, рекомендации и официальные формулировки. Не выдумывай факты.',
      })

      if (result.duplicate) {
        duplicateCount += 1
        continue
      }

      aiAttemptCount += 1

      if (result.rejected) {
        rejectedItems.push({
          title: item.title,
          url: item.url,
          reason: result.reason,
        })
      } else {
        createdDrafts.push(result.draft)
      }
    } catch (error: any) {
      aiAttemptCount += 1
      rejectedItems.push({
        title: item.title,
        url: item.url,
        reason: error?.message || 'Ошибка Gemini API',
      })

      strapi.log.warn(`RSS-новость пропущена из-за ошибки Gemini: ${item.url}`)
      strapi.log.warn(error)
    }
  }

  return {
    source: source.name,
    ok: true,
    message: `RSS-парсинг завершён. Создано черновиков: ${createdDrafts.length}`,
    parsedCount: items.length,
    relevantCount: relevantItems.length,
    aiAttemptCount,
    createdCount: createdDrafts.length,
    duplicateCount,
    rejectedCount: rejectedItems.length,
    data: createdDrafts,
    rejected: rejectedItems,
  }
}

function generateSlug(text: string) {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e',
    ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
    н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
    ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
    ә: 'a', ғ: 'g', қ: 'q', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h', і: 'i',
  }

  const base = String(text || 'news')
    .toLowerCase()
    .replace(/[а-яёәғқңөұүһі]/gi, (char) => map[char.toLowerCase()] || '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  return `${base || 'news'}-${Date.now()}`
}

function normalizeCategoryName(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim()
}

function mapSuggestedCategoryToSlug(value: string) {
  const normalized = normalizeCategoryName(value)

  if (normalized.includes('вод')) return 'water'
  if (normalized.includes('дорог') || normalized.includes('жол')) return 'roads'
  if (normalized.includes('электр') || normalized.includes('свет') || normalized.includes('жарық')) return 'electricity'
  if (normalized.includes('гос') || normalized.includes('уведом') || normalized.includes('әкім') || normalized.includes('мем')) return 'government'
  if (normalized.includes('жкх') || normalized.includes('тұрғын') || normalized.includes('коммун')) return 'zkh'

  return normalized
}

async function findCategoryForDraft(strapi: any, suggestedCategoryName: string) {
  const categories = await strapi.documents('api::category.category').findMany({
  status: 'published',
  populate: {
    defaultCoverImage: true,
  },
  limit: 100,
})

  const normalized = normalizeCategoryName(suggestedCategoryName)
  const mappedSlug = mapSuggestedCategoryToSlug(suggestedCategoryName)

  return categories.find((category: any) => {
    return (
      normalizeCategoryName(category.nameRu) === normalized ||
      normalizeCategoryName(category.nameKz) === normalized ||
      normalizeCategoryName(category.slug) === normalized ||
      normalizeCategoryName(category.slug) === mappedSlug
    )
  }) || null
}

module.exports = factories.createCoreController('api::ai-draft.ai-draft', ({ strapi }: any) => ({
  async generateDraft(ctx: any) {
    try {
      const {
        sourceName = '',
        sourceUrl = '',
        originalTitle = '',
        originalUrl = '',
        originalText = '',
        processingPrompt = '',
        imageUrl = '',
      } = ctx.request.body || {}

      if (!originalText || !originalText.trim()) {
        return ctx.badRequest('Поле originalText обязательно')
      }

      if (!isRelevantByKeywords(originalText)) {
        return ctx.badRequest('Материал не относится к тематике HomeNews')
      }

      const result = await generateWithGemini(strapi, {
        sourceName,
        sourceUrl,
        originalTitle,
        originalUrl,
        originalText,
        processingPrompt,
        imageUrl,
      })

      if (result.duplicate) {
        ctx.body = {
          ok: false,
          duplicate: true,
          message: result.reason,
          data: result.draft,
        }
        return
      }

      if (result.rejected) {
        ctx.body = {
          ok: false,
          rejected: true,
          message: result.reason,
        }
        return
      }

      ctx.body = {
        ok: true,
        message: 'AI Draft создан',
        data: result.draft,
      }
    } catch (error: any) {
      strapi.log.error(error)
      ctx.internalServerError(error.message || 'Ошибка генерации AI Draft')
    }
  },

  async parseSourceAndGenerateDraft(ctx: any) {
    try {
      const {
        sourceId = '',
        sourceDocumentId = '',
        articleUrl = '',
        processingPrompt = '',
      } = ctx.request.body || {}

      if (!articleUrl || !articleUrl.trim()) {
        return ctx.badRequest('Поле articleUrl обязательно')
      }

      const source = await getSourceByRequest(strapi, sourceId, sourceDocumentId)

      if (!source) {
        return ctx.badRequest('Источник не найден в Strapi')
      }

      if (source.isActive === false) {
        return ctx.badRequest('Источник выключен в Strapi')
      }

      if (!isAllowedUrl(articleUrl, source)) {
        return ctx.badRequest('Ссылка не относится к разрешённому домену источника')
      }

      if (source.parseMode && !['html', 'govkz'].includes(source.parseMode)) {
        return ctx.badRequest('Для этого источника parseMode должен быть html или govkz')
      }

      const response = await fetch(articleUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HomeNews Parser/1.0)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,kk;q=0.8,en;q=0.5',
        },
      })

      if (!response.ok) {
        return ctx.badRequest(`Не удалось загрузить страницу: ${response.status}`)
      }

      const html = await response.text()
      const { pageTitle, originalText, extractedLength, imageUrl } = extractArticleTextFromHtml(html)

      if (!originalText || originalText.length < 80) {
        return ctx.badRequest(
          `Не удалось извлечь достаточно текста со страницы. Извлечено символов: ${extractedLength || 0}`
        )
      }

      const combinedText = `${pageTitle}\n\n${originalText}`

      if (!isRelevantByKeywords(combinedText)) {
        return ctx.badRequest('Материал не похож на новость по ЖКХ или городской инфраструктуре')
      }

      const result = await generateWithGemini(strapi, {
        sourceName: source.name,
        sourceUrl: source.url,
        originalTitle: pageTitle,
        originalUrl: articleUrl,
        originalText,
        imageUrl,
        processingPrompt:
          processingPrompt ||
          `Материал получен из источника категории ${source.sourceCategory || 'government'}. Сделай городскую новость для HomeNews.`,
      })

      if (result.duplicate) {
        ctx.body = {
          ok: false,
          duplicate: true,
          message: result.reason,
          data: result.draft,
        }
        return
      }

      if (result.rejected) {
        ctx.body = {
          ok: false,
          rejected: true,
          message: result.reason,
        }
        return
      }

      ctx.body = {
        ok: true,
        message: 'Страница распарсена, AI Draft создан',
        extractedLength,
        imageUrl,
        data: result.draft,
      }
    } catch (error: any) {
      strapi.log.error(error)
      ctx.internalServerError(error.message || 'Ошибка парсинга источника')
    }
  },

  async parseSourceFeedAndGenerateDrafts(ctx: any) {
    try {
      const {
        sourceId = '',
        sourceDocumentId = '',
        limit = 5,
        processingPrompt = '',
      } = ctx.request.body || {}

      const source = await getSourceByRequest(strapi, sourceId, sourceDocumentId)

      if (!source) {
        return ctx.badRequest('Источник не найден в Strapi')
      }

      if (source.isActive === false) {
        return ctx.badRequest('Источник выключен в Strapi')
      }

      let result: any

      if (source.parseMode === 'telegram' || source.type === 'telegram') {
        result = await processTelegramSource(strapi, source, source.limitPerRun || limit, processingPrompt)
      } else if (source.parseMode === 'rss' || source.type === 'rss') {
        result = await processRssSource(strapi, source, source.limitPerRun || limit, processingPrompt)
      } else {
        return ctx.badRequest('Для этого источника parseMode должен быть telegram или rss')
      }

      if (!result.ok) {
        return ctx.badRequest(result.message)
      }

      ctx.body = {
        ok: true,
        ...result,
      }
    } catch (error: any) {
      strapi.log.error(error)
      ctx.internalServerError(error.message || 'Ошибка пакетного парсинга источника')
    }
  },

  async parseActiveSourcesAndGenerateDrafts(ctx: any) {
    try {
      const {
        limitPerSource = 5,
        processingPrompt = '',
      } = ctx.request.body || {}

      const sources = await strapi.documents('api::source.source').findMany({
        status: 'published',
        limit: 200,
      })

      const activeSources = sources.filter((source: any) => source.isActive !== false)

      const parsableSources = activeSources.filter((source: any) => {
        return (
          source.parseMode === 'telegram' ||
          source.parseMode === 'rss' ||
          source.type === 'telegram' ||
          source.type === 'rss'
        )
      })

      const results = []

      for (const source of parsableSources) {
        try {
          let result: any

          if (source.parseMode === 'telegram' || source.type === 'telegram') {
            result = await processTelegramSource(
              strapi,
              source,
              source.limitPerRun || limitPerSource,
              processingPrompt
            )
          } else if (source.parseMode === 'rss' || source.type === 'rss') {
            result = await processRssSource(
              strapi,
              source,
              source.limitPerRun || limitPerSource,
              processingPrompt
            )
          } else {
            result = {
              source: source.name,
              ok: false,
              message: 'Неподдерживаемый parseMode источника',
              parsedCount: 0,
              relevantCount: 0,
              createdCount: 0,
              duplicateCount: 0,
              rejectedCount: 1,
              data: [],
              rejected: [
                {
                  title: source.name,
                  reason: 'Неподдерживаемый parseMode источника',
                },
              ],
            }
          }

          results.push(result)
          strapi.log.info(
            `Парсер ${source.name}: найдено ${result.parsedCount || 0}, кандидатов ${result.relevantCount || 0}, AI-проверок ${result.aiAttemptCount || 0}, создано ${result.createdCount || 0}, дубликатов ${result.duplicateCount || 0}, отклонено ${result.rejectedCount || 0}`
          )
        } catch (error: any) {
          strapi.log.warn(`Источник пропущен из-за ошибки: ${source.name}`)
          strapi.log.warn(error)
          results.push({
            source: source.name,
            ok: false,
            message: error?.message || 'Ошибка обработки источника',
            parsedCount: 0,
            relevantCount: 0,
            createdCount: 0,
            duplicateCount: 0,
            rejectedCount: 1,
            data: [],
            rejected: [
              {
                title: source.name,
                reason: error?.message || 'Ошибка обработки источника',
              },
            ],
          })
        }
      }

      ctx.body = {
        ok: true,
        message: 'Парсинг активных источников завершён',
        sourceCount: parsableSources.length,
        createdCount: results.reduce((sum: number, item: any) => sum + Number(item.createdCount || 0), 0),
        duplicateCount: results.reduce((sum: number, item: any) => sum + Number(item.duplicateCount || 0), 0),
        rejectedCount: results.reduce((sum: number, item: any) => sum + Number(item.rejectedCount || 0), 0),
        results,
      }
    } catch (error: any) {
      strapi.log.error(error)
      ctx.internalServerError(error.message || 'Ошибка парсинга активных источников')
    }
  },

  async publishAiDraft(ctx: any) {
    try {
      const {
        draftId = '',
        draftDocumentId = '',
        isFeatured = false,
        isImportant = false,
        district = '',
      } = ctx.request.body || {}

      if (!draftId && !draftDocumentId) {
        return ctx.badRequest('Нужно передать draftId или draftDocumentId')
      }

      let draft: any = null

      if (draftDocumentId) {
        draft = await strapi.documents('api::ai-draft.ai-draft').findOne({
          documentId: String(draftDocumentId),
          populate: {
            coverImage: true,
          },
        })
      }

      if (!draft && draftId) {
        const drafts = await strapi.documents('api::ai-draft.ai-draft').findMany({
          populate: {
            coverImage: true,
          },
          limit: 500,
        })

        draft = drafts.find((item: any) => {
          return String(item.id) === String(draftId)
        }) as any
      }

      if (!draft) {
        return ctx.badRequest('AI Draft не найден')
      }

      if (draft.draftStatus === 'approved') {
        return ctx.badRequest('AI Draft уже был опубликован')
      }

      if (!draft.generatedTitleRu || !draft.generatedContentRu) {
        return ctx.badRequest('AI Draft не готов к публикации: нет заголовка или текста')
      }

      const category = await findCategoryForDraft(strapi, draft.suggestedCategoryName || '')
      const coverImageId = await resolveCoverImageForArticle(strapi, draft, category)
      const articleData: any = {
        titleRu: draft.generatedTitleRu,
        titleKz: draft.generatedTitleKz || draft.generatedTitleRu,

        summaryRu: draft.generatedSummaryRu || '',
        summaryKz: draft.generatedSummaryKz || draft.generatedSummaryRu || '',

        contentRu: draft.generatedContentRu,
        contentKz: draft.generatedContentKz || draft.generatedContentRu,

        slug: generateSlug(draft.generatedTitleRu),

        district: district || '',
        source: draft.sourceName || draft.originalUrl || draft.sourceUrl || '',
        sourceUrl: draft.originalUrl || draft.sourceUrl || '',
        sourceImageUrl: draft.originalImageUrl || '',
        urgency: normalizeUrgency(draft.suggestedUrgency || 'medium'),

        isFeatured: Boolean(isFeatured),
        isImportant: Boolean(isImportant),

        coverImage: coverImageId,
      }

      if (coverImageId) {
        articleData.coverImage = coverImageId
      }

      if (category?.id) {
        articleData.category = category.id
      }

      const article = await strapi.documents('api::article.article').create({
        data: articleData,
        status: 'published',
      })

      try {
        await strapi.documents('api::ai-draft.ai-draft').update({
          documentId: draft.documentId,
          data: {
            draftStatus: 'approved',
            adminComment: `${draft.adminComment || ''}\nОпубликовано как News: ${article.documentId || article.id}`.trim(),
          },
        })
      } catch (updateError) {
        strapi.log.warn('Новость создана, но статус AI Draft не обновлён')
        strapi.log.warn(updateError)
      }

      ctx.body = {
        ok: true,
        message: 'AI Draft опубликован как новость',
        data: article,
      }
    } catch (error: any) {
      strapi.log.error(error)
      ctx.internalServerError(error.message || 'Ошибка публикации AI Draft')
    }
  },
}))
