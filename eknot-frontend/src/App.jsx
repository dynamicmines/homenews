import { useEffect, useMemo, useState } from 'react'

const API_URL = ''

const UI = {
  ru: {
    city: 'Астана',
    all: 'Все',
    latest: 'Последние новости',
    important: 'Важное',
    sources: 'Источники',
    ikomek: 'События iKOMEK109',
    ikomekHint: 'Оперативные уведомления: отключения, аварии, перекрытия и коммунальные события.',
    akimat: 'Новости Акимата',
    urgent: 'Срочные уведомления',
    ai: 'AI-журналист',
    aiBadge: 'AI Draft',
    aiText: 'Парсер получает материалы из источников, Gemini формирует черновики, администратор проверяет и публикует.',
    readMore: 'Читать подробнее',
    back: 'Назад к новостям',
    district: 'Район',
    source: 'Источник',
    published: 'Опубликовано',
    verified: 'Материал создан из источника и проверяется администратором перед публикацией',
    breaking: 'Важно',
    noCategory: 'Без категории',
    loading: 'Загрузка новостей...',
    error: 'Не удалось загрузить данные из Strapi. Проверь, что CMS запущена и Public permissions включены.',
    empty: 'Пока нет опубликованных новостей в этом блоке.',
    footerFallback: 'HomeNews — городская информационная платформа',
    descriptionFallback: 'Городские новости, ЖКХ, инфраструктура и официальные уведомления',
    materials: 'материалов',
    admin: '',
    urgency: { high: 'Срочно', medium: 'Важно', low: 'Обычное' },
  },
  kz: {
    city: 'Астана',
    all: 'Барлығы',
    latest: 'Соңғы жаңалықтар',
    important: 'Маңызды',
    sources: 'Дереккөздер',
    ikomek: 'iKOMEK109 оқиғалары',
    ikomekHint: 'Жедел хабарламалар: ажыратулар, апаттар, жол жабылуы және коммуналдық оқиғалар.',
    akimat: 'Әкімдік жаңалықтары',
    urgent: 'Шұғыл хабарламалар',
    ai: 'AI-журналист',
    aiBadge: 'AI Draft',
    aiText: 'Парсер дереккөздерден материал алады, Gemini черновик жасайды, әкімші тексеріп жариялайды.',
    readMore: 'Толығырақ оқу',
    back: 'Жаңалықтарға оралу',
    district: 'Аудан',
    source: 'Дереккөз',
    published: 'Жарияланды',
    verified: 'Материал дереккөзден жасалып, жарияланар алдында әкімші тексеруінен өтеді',
    breaking: 'Маңызды',
    noCategory: 'Санатсыз',
    loading: 'Жаңалықтар жүктелуде...',
    error: 'Strapi деректерін жүктеу мүмкін болмады. CMS қосылғанын және Public permissions берілгенін тексер.',
    empty: 'Бұл блокта әзірге жарияланған жаңалық жоқ.',
    footerFallback: 'HomeNews — қалалық ақпараттық платформа',
    descriptionFallback: 'Қалалық жаңалықтар, ТКШ, инфрақұрылым және ресми хабарламалар',
    materials: 'материал',
    admin: '',
    urgency: { high: 'Шұғыл', medium: 'Маңызды', low: 'Қарапайым' },
  },
}

function getText(item, field, lang) {
  return item?.[`${field}${lang === 'kz' ? 'Kz' : 'Ru'}`] || item?.[`${field}Ru`] || ''
}

function withCurrentBrand(value, fallback = '') {
  return String(value || fallback).replace(/e[\s‑-]*knot(?:\s+news)?/gi, 'HomeNews')
}

function getMediaUrl(media) {
  const item = media?.data?.attributes || media?.data || media
  const url = item?.url
  if (!url) return null
  return url.startsWith('http') ? url : `${API_URL}${url}`
}

function makeGeneratedImage(title = 'HomeNews', category = 'Город', source = 'HomeNews') {
  const safeTitle = String(title || 'HomeNews').replace(/[<>&"']/g, ' ').slice(0, 80)
  const safeCategory = String(category || 'Город').replace(/[<>&"']/g, ' ').slice(0, 36)
  const safeSource = String(source || 'HomeNews').replace(/[<>&"']/g, ' ').slice(0, 34)

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#072b3a"/>
        <stop offset="55%" stop-color="#0b5563"/>
        <stop offset="100%" stop-color="#0f9ca6"/>
      </linearGradient>
      <radialGradient id="r" cx="80%" cy="15%" r="60%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1200" height="760" fill="url(#g)"/>
    <rect width="1200" height="760" fill="url(#r)"/>
    <circle cx="1000" cy="135" r="160" fill="#ffffff" opacity="0.08"/>
    <circle cx="1110" cy="610" r="210" fill="#ffffff" opacity="0.07"/>
    <path d="M0 545 C210 490 365 625 575 560 C805 488 950 510 1200 430 L1200 760 L0 760 Z" fill="#021b2b" opacity="0.45"/>
    <rect x="70" y="70" width="210" height="54" rx="27" fill="#ffffff" opacity="0.92"/>
    <text x="105" y="106" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="800" fill="#083044">${safeCategory}</text>
    <text x="70" y="190" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="800" fill="#9ee8ed">${safeSource}</text>
    <foreignObject x="70" y="235" width="900" height="260">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,Helvetica,sans-serif;font-size:58px;line-height:1.08;font-weight:900;color:white;letter-spacing:-2px;">${safeTitle}</div>
    </foreignObject>
    <rect x="70" y="620" width="170" height="14" rx="7" fill="#00a3ad"/>
    <text x="70" y="685" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="900" fill="#ffffff">HomeNews</text>
  </svg>`

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function getArticleImage(article, lang) {
  const uploadedImage = getMediaUrl(article?.coverImage)
  const sourceImage = String(article?.sourceImageUrl || '').trim()
  const telegramPost = String(article?.sourceUrl || '').trim()
  const telegramImage = /^https:\/\/t\.me\/(?:s\/)?[a-zA-Z0-9_]+\/\d+/.test(telegramPost)
    ? `${API_URL}/api/telegram-image?url=${encodeURIComponent(telegramPost)}`
    : ''

  return uploadedImage || sourceImage || telegramImage || makeGeneratedImage(
    getText(article, 'title', lang),
    getCategoryName(article?.category, lang),
    article?.source || article?.sourceName || 'HomeNews'
  )
}

function ArticleImage({ article, lang, className = '', detail = false, thumbnail = false, priority = false }) {
  const title = getText(article, 'title', lang)
  const preferredImage = getArticleImage(article, lang)
  const fallbackImage = makeGeneratedImage(
    title,
    getCategoryName(article?.category, lang),
    article?.source || article?.sourceName || 'HomeNews'
  )
  const [failedImage, setFailedImage] = useState('')
  const src = failedImage === preferredImage ? fallbackImage : preferredImage

  const isGenerated = src.startsWith('data:image/svg+xml')
  const framedIkomekImage = isIkomekArticle(article) && !isGenerated
  const loading = priority ? 'eager' : 'lazy'

  if (!framedIkomekImage) {
    return (
      <div className={`relative overflow-hidden bg-muted ${className}`}>
        <img
          src={src}
          alt={title}
          loading={loading}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          onError={() => setFailedImage(preferredImage)}
          className={`h-full w-full ${detail ? 'object-contain' : 'object-cover'} transition duration-500 group-hover:scale-[1.025]`}
        />
      </div>
    )
  }

  return (
    <div className={`relative isolate overflow-hidden bg-slate-950 ${className}`}>
      <img src={src} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/20 via-slate-950/10 to-slate-950/60" />
      <div className={`absolute overflow-hidden bg-white/5 shadow-2xl ring-1 ring-white/35 ${thumbnail ? 'inset-1 rounded-lg' : 'inset-2.5 rounded-xl md:inset-3'}`}>
        <img
          src={src}
          alt={title}
          loading={loading}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          onError={() => setFailedImage(preferredImage)}
          className={`h-full w-full ${detail ? 'object-contain object-top' : 'object-cover object-top'} transition duration-500 group-hover:scale-[1.025]`}
        />
      </div>
      {!thumbnail && (
        <span className="absolute bottom-5 left-5 rounded-full border border-white/25 bg-slate-950/65 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-white shadow-lg backdrop-blur-md">
          iKOMEK109
        </span>
      )}
    </div>
  )
}

function formatDate(date, lang) {
  if (!date) return ''
  try {
    return new Intl.DateTimeFormat(lang === 'kz' ? 'kk-KZ' : 'ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(date))
  } catch {
    return ''
  }
}

function getCategoryName(category, lang) {
  return getText(category, 'name', lang) || UI[lang].noCategory
}

function getUrgencyClass(urgency) {
  if (urgency === 'high') return 'bg-urgent text-urgent-foreground'
  if (urgency === 'medium') return 'bg-amber-500 text-white'
  return 'bg-muted text-muted-foreground'
}

function getSourceString(article) {
  return String(article?.source || article?.sourceName || article?.sourceUrl || '').toLowerCase()
}

function isIkomekArticle(article) {
  const source = getSourceString(article)
  return source.includes('ikomek') || source.includes('109') || source.includes('t.me')
}

function isAkimatArticle(article) {
  const source = getSourceString(article)
  return source.includes('акимат') || source.includes('әкім') || source.includes('gov.kz') || source.includes('astana')
}

function LanguageSwitcher({ lang, setLang }) {
  return (
    <div className="flex items-center rounded-lg bg-muted p-1">
      {['ru', 'kz'].map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => setLang(value)}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${lang === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {value.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

function Navbar({ lang, setLang, siteName, siteDescription, categories, selectedCategory, setSelectedCategory }) {
  const today = new Intl.DateTimeFormat(lang === 'kz' ? 'kk-KZ' : 'ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="border-b border-border bg-muted/40">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 text-xs text-muted-foreground">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <span>{today}</span>
            <span>•</span>
            <span>{UI[lang].city}</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher lang={lang} setLang={setLang} />
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-5">
        <button type="button" onClick={() => setSelectedCategory('all')} className="min-w-0 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-black text-primary-foreground">H</div>
            <div>
              <div className="text-2xl font-black tracking-tight text-foreground md:text-3xl">{siteName}</div>
              <div className="max-w-[560px] truncate text-sm text-muted-foreground">{siteDescription}</div>
            </div>
          </div>
        </button>

        <div className="hidden md:block" />
      </div>

      <nav className="border-t border-border bg-primary">
        <div className="mx-auto flex max-w-7xl overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`shrink-0 px-4 py-3 text-sm font-bold transition ${selectedCategory === 'all' ? 'bg-accent text-accent-foreground' : 'text-primary-foreground/80 hover:bg-white/10 hover:text-white'}`}
          >
            {UI[lang].all}
          </button>
          {categories.map((category) => (
            <button
              key={category.id || category.slug}
              type="button"
              onClick={() => setSelectedCategory(category.slug)}
              className={`shrink-0 border-l border-white/10 px-4 py-3 text-sm font-bold transition ${selectedCategory === category.slug ? 'bg-accent text-accent-foreground' : 'text-primary-foreground/80 hover:bg-white/10 hover:text-white'}`}
            >
              {getCategoryName(category, lang)}
            </button>
          ))}
        </div>
      </nav>
    </header>
  )
}

function BreakingTicker({ lang, articles }) {
  const urgent = articles.filter((article) => article.urgency === 'high' || article.isImportant).slice(0, 4)
  if (!urgent.length) return null
  const text = urgent.map((article) => getText(article, 'title', lang)).filter(Boolean).join('  •  ')
  return (
    <section className="border-b border-border bg-urgent text-urgent-foreground">
      <div className="mx-auto flex max-w-7xl items-center gap-4 overflow-hidden px-4 py-2.5">
        <div className="shrink-0 border-r border-white/30 pr-4 text-xs font-black uppercase tracking-wide">{UI[lang].breaking}</div>
        <div className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-sm font-semibold">
          <div className="inline-block animate-ticker pr-8">{text} • {text}</div>
        </div>
      </div>
    </section>
  )
}

function SmallEventCard({ article, lang, openArticle, index }) {
  return (
    <button type="button" onClick={() => openArticle(article)} className="group grid w-full grid-cols-[78px_1fr] gap-3 border-t border-border py-3 text-left first:border-t-0 first:pt-0">
      <span className="relative block">
        <ArticleImage article={article} lang={lang} thumbnail className="h-[72px] w-[78px] rounded-xl" />
        <span className="absolute left-1.5 top-1.5 rounded-md bg-slate-950/75 px-1.5 py-0.5 text-[10px] font-black text-white backdrop-blur-sm">{String(index + 1).padStart(2, '0')}</span>
      </span>
      <span className="min-w-0">
        <span className="mb-1 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          <span className={`rounded-full px-2 py-0.5 ${getUrgencyClass(article.urgency)}`}>{UI[lang].urgency[article.urgency] || article.urgency}</span>
          <span>{formatDate(article.publishedAt, lang)}</span>
        </span>
        <span className="line-clamp-2 text-sm font-black leading-snug text-foreground group-hover:text-accent">{getText(article, 'title', lang)}</span>
      </span>
    </button>
  )
}

function MainAkimatCard({ article, lang, openArticle }) {
  if (!article) return null
  const title = getText(article, 'title', lang)
  const summary = getText(article, 'summary', lang)
  return (
    <button type="button" onClick={() => openArticle(article)} className="group grid w-full overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl lg:grid-cols-[1.04fr_0.96fr]">
      <div className="relative min-h-[260px] overflow-hidden bg-muted lg:min-h-[360px]">
        <ArticleImage article={article} lang={lang} priority className="absolute inset-0 h-full w-full" />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-foreground shadow-sm backdrop-blur">{getCategoryName(article.category, lang)}</span>
          <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${getUrgencyClass(article.urgency)}`}>{UI[lang].urgency[article.urgency] || article.urgency}</span>
        </div>
      </div>
      <div className="flex flex-col justify-center p-6 lg:p-8">
        <div className="mb-4 inline-flex w-fit rounded-full bg-accent/10 px-4 py-2 text-sm font-bold text-accent">{UI[lang].akimat}</div>
        <h1 className="text-balance text-3xl font-black leading-tight tracking-tight text-foreground md:text-4xl">{title}</h1>
        <p className="mt-4 line-clamp-3 text-base leading-relaxed text-muted-foreground">{summary}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>{formatDate(article.publishedAt, lang)}</span>
          {article.source && <span>• {article.source}</span>}
        </div>
        <div className="mt-7 inline-flex w-fit rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition group-hover:bg-primary/90">{UI[lang].readMore}</div>
      </div>
    </button>
  )
}

function NewsCard({ article, lang, openArticle, compact = false }) {
  const title = getText(article, 'title', lang)
  const summary = getText(article, 'summary', lang)
  return (
    <button type="button" onClick={() => openArticle(article)} className="group overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg">
      {!compact && (
        <ArticleImage article={article} lang={lang} className="h-48 w-full" />
      )}
      <div className="p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-accent/10 px-3 py-1 font-bold text-accent">{getCategoryName(article.category, lang)}</span>
          <span className={`rounded-full px-3 py-1 font-bold ${getUrgencyClass(article.urgency)}`}>{UI[lang].urgency[article.urgency] || article.urgency}</span>
        </div>
        <h3 className="line-clamp-2 text-lg font-black leading-snug tracking-tight text-foreground group-hover:text-accent">{title}</h3>
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{summary}</p>
        <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs font-medium text-muted-foreground">
          <span className="truncate">{article.source || getCategoryName(article.category, lang)}</span>
          <span>{formatDate(article.publishedAt, lang)}</span>
        </div>
      </div>
    </button>
  )
}

function SourceColumn({ title, hint, children, count }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 border-b border-border pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black tracking-tight text-foreground">{title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{hint}</p>
          </div>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-black text-muted-foreground">{count}</span>
        </div>
      </div>
      {children}
    </section>
  )
}

function PortalHome({ lang, articles, categories, selectedCategory, openArticle, sources }) {
  const shownArticles = selectedCategory === 'all'
    ? articles
    : articles.filter((article) => article.category?.slug === selectedCategory)

  const ikomekNews = shownArticles.filter(isIkomekArticle)
  const akimatNews = shownArticles.filter(isAkimatArticle)
  const urgentNews = shownArticles.filter((article) => article.urgency === 'high' || article.isImportant)
  const mainAkimat = akimatNews[0] || null
  const akimatGrid = akimatNews.filter((article) => article.id !== mainAkimat?.id).slice(0, 6)
  const latestNews = shownArticles.filter((article) => article.id !== mainAkimat?.id).slice(0, 9)

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      {selectedCategory === 'all' ? (
        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_310px]">
          <SourceColumn title={UI[lang].ikomek} hint={UI[lang].ikomekHint} count={ikomekNews.length}>
            {ikomekNews.length ? ikomekNews.slice(0, 8).map((article, index) => (
              <SmallEventCard key={article.id || article.documentId} article={article} lang={lang} openArticle={openArticle} index={index} />
            )) : <div className="text-sm text-muted-foreground">{UI[lang].empty}</div>}
          </SourceColumn>

          <section className="min-w-0 space-y-6">
            <div>
              <h2 className="mb-2 text-2xl font-black tracking-tight text-foreground">{UI[lang].akimat}</h2>
              {mainAkimat ? (
                <MainAkimatCard article={mainAkimat} lang={lang} openArticle={openArticle} />
              ) : (
                <div className="rounded-2xl border border-border bg-card p-8 text-muted-foreground shadow-sm">{UI[lang].empty}</div>
              )}
            </div>

            {akimatGrid.length ? (
              <div className="grid gap-5 sm:grid-cols-2">
                {akimatGrid.map((article) => (
                  <NewsCard key={article.id || article.documentId} article={article} lang={lang} openArticle={openArticle} />
                ))}
              </div>
            ) : null}
          </section>

          <aside className="space-y-6">
            <SourceColumn title={UI[lang].urgent} hint={UI[lang].important} count={urgentNews.length}>
              {urgentNews.length ? urgentNews.slice(0, 6).map((article, index) => (
                <SmallEventCard key={article.id || article.documentId} article={article} lang={lang} openArticle={openArticle} index={index} />
              )) : <div className="text-sm text-muted-foreground">{UI[lang].empty}</div>}
            </SourceColumn>

            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-black text-foreground">{UI[lang].sources}</h2>
              <div className="space-y-1">
                {(sources.length ? sources : [
                  { id: 'source-ikomek', name: 'iKOMEK109', type: 'telegram', isActive: true },
                  { id: 'source-akimat', name: 'Акимат города Астаны', type: 'rss', isActive: true },
                ]).slice(0, 5).map((source) => (
                  <div key={source.id || source.documentId || source.name} className="flex items-center justify-between gap-3 border-t border-border py-3 first:border-t-0 first:pt-0">
                    <div>
                      <div className="text-sm font-bold text-foreground">{source.name}</div>
                      <div className="text-xs text-muted-foreground">{source.parseMode || source.type || 'source'}</div>
                    </div>
                    <span className={`h-2.5 w-2.5 rounded-full ${source.isActive === false ? 'bg-muted-foreground' : 'bg-success'}`} />
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-primary p-6 text-primary-foreground shadow-sm">
              <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-accent">{UI[lang].ai}</div>
              <p className="text-sm leading-relaxed text-primary-foreground/80">{UI[lang].aiText}</p>
            </section>
          </aside>
        </div>
      ) : (
        <section>
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-black tracking-tight text-foreground">{categories.find((category) => category.slug === selectedCategory) ? getCategoryName(categories.find((category) => category.slug === selectedCategory), lang) : UI[lang].latest}</h2>
            <div className="hidden text-sm font-medium text-muted-foreground sm:block">{shownArticles.length} {UI[lang].materials}</div>
          </div>
          {shownArticles.length ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {shownArticles.map((article) => (
                <NewsCard key={article.id || article.documentId} article={article} lang={lang} openArticle={openArticle} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 text-muted-foreground shadow-sm">{UI[lang].empty}</div>
          )}
        </section>
      )}

      {selectedCategory === 'all' && latestNews.length ? (
        <section className="mt-10">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-black tracking-tight text-foreground">{UI[lang].latest}</h2>
            <div className="hidden text-sm font-medium text-muted-foreground sm:block">{shownArticles.length} {UI[lang].materials}</div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {latestNews.map((article) => (
              <NewsCard key={article.id || article.documentId} article={article} lang={lang} openArticle={openArticle} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  )
}

function Footer({ siteSetting, siteName, footerText }) {
  const contactEmail = siteSetting?.contactEmail || ''
  const showContactEmail = contactEmail && !contactEmail.toLowerCase().includes('eknot')

  return (
    <footer className="mt-14 border-t border-border bg-card">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 md:grid-cols-[1.4fr_1fr] md:items-end">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-black text-primary-foreground">H</div>
            <div className="text-xl font-black tracking-tight text-foreground">{siteName}</div>
          </div>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{footerText}</p>
        </div>
        <div className="flex flex-col gap-1 text-sm text-muted-foreground md:items-end">
          {showContactEmail && <span>{contactEmail}</span>}
          {siteSetting?.phone && <span>{siteSetting.phone}</span>}
          <span>Powered by Strapi CMS</span>
        </div>
      </div>
    </footer>
  )
}

function ArticleDetail({ article, lang, setLang, back }) {
  const title = getText(article, 'title', lang)
  const summary = getText(article, 'summary', lang)
  const content = getText(article, 'content', lang)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <button type="button" onClick={back} className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-bold text-foreground hover:border-accent hover:text-accent">← {UI[lang].back}</button>
          <LanguageSwitcher lang={lang} setLang={setLang} />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="p-6 md:p-10">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-accent/10 px-3 py-1 font-bold text-accent">{getCategoryName(article.category, lang)}</span>
              <span className={`rounded-full px-3 py-1 font-bold ${getUrgencyClass(article.urgency)}`}>{UI[lang].urgency[article.urgency] || article.urgency}</span>
              <span className="text-muted-foreground">{formatDate(article.publishedAt, lang)}</span>
            </div>
            <h1 className="text-balance text-3xl font-black leading-tight tracking-tight text-foreground md:text-5xl">{title}</h1>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-muted-foreground">{summary}</p>
          </div>

          <ArticleImage article={article} lang={lang} detail priority className="h-[340px] w-full md:h-[520px]" />

          <div className="grid border-y border-border md:grid-cols-3">
            <div className="border-b border-border p-5 md:border-b-0 md:border-r">
              <div className="text-xs font-black uppercase tracking-wide text-muted-foreground">{UI[lang].district}</div>
              <div className="mt-1 font-bold text-foreground">{article.district || '—'}</div>
            </div>
            <div className="border-b border-border p-5 md:border-b-0 md:border-r">
              <div className="text-xs font-black uppercase tracking-wide text-muted-foreground">{UI[lang].source}</div>
              <div className="mt-1 font-bold text-foreground">{article.source || '—'}</div>
            </div>
            <div className="p-5">
              <div className="text-xs font-black uppercase tracking-wide text-muted-foreground">{UI[lang].published}</div>
              <div className="mt-1 font-bold text-foreground">{formatDate(article.publishedAt, lang)}</div>
            </div>
          </div>

          <div className="max-w-3xl whitespace-pre-line p-6 text-lg leading-8 text-foreground md:p-10">{content}</div>
          <div className="mx-6 mb-8 rounded-lg border-l-4 border-accent bg-accent/10 p-4 text-sm font-bold text-accent md:mx-10">{UI[lang].verified}</div>
        </article>
      </main>
    </div>
  )
}

function App() {
  const [lang, setLang] = useState('ru')
  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [siteSetting, setSiteSetting] = useState(null)
  const [sources, setSources] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setError('')

        const [articlesRes, categoriesRes, siteSettingRes, sourcesRes] = await Promise.all([
          fetch(`${API_URL}/api/articles?populate=*&sort=publishedAt:desc`),
          fetch(`${API_URL}/api/categories`),
          fetch(`${API_URL}/api/site-setting`),
          fetch(`${API_URL}/api/sources`).catch(() => null),
        ])

        if (!articlesRes.ok) throw new Error(UI[lang].error)
        if (!categoriesRes.ok) throw new Error(UI[lang].error)
        // Site settings are optional. A fresh Strapi instance returns 404 until
        // the single type is created; the UI already has sensible fallbacks.

        const articlesJson = await articlesRes.json()
        const categoriesJson = await categoriesRes.json()
        const siteSettingJson = siteSettingRes.ok ? await siteSettingRes.json() : { data: null }
        const sourcesJson = sourcesRes?.ok ? await sourcesRes.json() : { data: [] }

        setArticles(articlesJson.data || [])
        setCategories(categoriesJson.data || [])
        setSiteSetting(siteSettingJson.data || null)
        setSources(sourcesJson.data || [])
      } catch (err) {
        setError(err.message || UI[lang].error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [lang])

  const sortedArticles = useMemo(() => {
    return [...articles].sort((a, b) => new Date(b.publishedAt || b.createdAt || 0) - new Date(a.publishedAt || a.createdAt || 0))
  }, [articles])

  const siteName = withCurrentBrand(getText(siteSetting, 'siteName', lang), 'HomeNews')
  const siteDescription = getText(siteSetting, 'description', lang) || UI[lang].descriptionFallback
  const footerText = withCurrentBrand(getText(siteSetting, 'footerText', lang), UI[lang].footerFallback)

  if (selectedArticle) {
    return <ArticleDetail article={selectedArticle} lang={lang} setLang={setLang} back={() => setSelectedArticle(null)} />
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar lang={lang} setLang={setLang} siteName={siteName} siteDescription={siteDescription} categories={categories} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} />
      <BreakingTicker lang={lang} articles={sortedArticles} />

      {loading && (
        <main className="mx-auto max-w-7xl px-4 py-10">
          <div className="rounded-xl border border-border bg-card p-8 text-muted-foreground shadow-sm">{UI[lang].loading}</div>
        </main>
      )}

      {!loading && error && (
        <main className="mx-auto max-w-7xl px-4 py-10">
          <div className="rounded-xl border border-red-200 bg-red-50 p-8 font-semibold text-red-700">{error}</div>
        </main>
      )}

      {!loading && !error && (
        <PortalHome lang={lang} articles={sortedArticles} categories={categories} selectedCategory={selectedCategory} openArticle={setSelectedArticle} sources={sources} />
      )}

      <Footer siteSetting={siteSetting} siteName={siteName} footerText={footerText} />
    </div>
  )
}

export default App
