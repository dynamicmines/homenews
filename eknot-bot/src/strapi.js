import 'dotenv/config'

const STRAPI_URL = (process.env.STRAPI_URL || 'http://localhost:1337').replace(/\/$/, '')
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || ''

/**
 * Low-level request to Strapi. Always attaches the API token server-side —
 * the Mini App frontend never sees this token.
 */
async function request(path, { method = 'GET', body, query } = {}) {
  const url = new URL(STRAPI_URL + path)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, value)
    }
  }

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(STRAPI_API_TOKEN ? { Authorization: `Bearer ${STRAPI_API_TOKEN}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }

  if (!res.ok) {
    const message = data?.error?.message || data?.message || `Strapi ${method} ${path} -> HTTP ${res.status}`
    const err = new Error(message)
    err.status = res.status
    err.data = data
    throw err
  }

  return data
}

// ---------- AI Drafts ----------

export function listDrafts({ status = 'new', page = 1, pageSize = 20 } = {}) {
  const filters = status && status !== 'all'
    ? `&filters[draftStatus][$eq]=${encodeURIComponent(status)}`
    : ''
  return request(
    `/api/ai-drafts?populate=*&sort=createdAt:desc&pagination[page]=${page}&pagination[pageSize]=${pageSize}${filters}`
  )
}

export function getDraft(documentId) {
  return request(`/api/ai-drafts/${documentId}?populate=*`)
}

export function updateDraft(documentId, data) {
  return request(`/api/ai-drafts/${documentId}`, { method: 'PUT', body: { data } })
}

export function rejectDraft(documentId, comment = '') {
  return updateDraft(documentId, {
    draftStatus: 'rejected',
    adminComment: comment,
  })
}

export function publishDraft({ draftDocumentId, isFeatured, isImportant, district }) {
  return request('/api/publish-ai-draft', {
    method: 'POST',
    body: { draftDocumentId, isFeatured, isImportant, district },
  })
}

export function runAutoParser(limit) {
  return request('/api/parse-active-sources-and-generate-drafts', {
    method: 'POST',
    body: limit ? { limit } : {},
  })
}

// ---------- Sources ----------

export function listSources() {
  return request('/api/sources?sort=name:asc&pagination[pageSize]=200')
}

export function createSource(data) {
  return request('/api/sources', { method: 'POST', body: { data } })
}

export function updateSource(documentId, data) {
  return request(`/api/sources/${documentId}`, { method: 'PUT', body: { data } })
}

export function deleteSource(documentId) {
  return request(`/api/sources/${documentId}`, { method: 'DELETE' })
}

// ---------- Categories ----------

export function listCategories() {
  return request('/api/categories?sort=nameRu:asc&pagination[pageSize]=200')
}

// ---------- AI Settings (single type) ----------

export function getAiSettings() {
  return request('/api/ai-setting')
}

export function updateAiSettings(data) {
  return request('/api/ai-setting', { method: 'PUT', body: { data } })
}

// ---------- Site Settings (single type) ----------

export function getSiteSettings() {
  return request('/api/site-setting')
}

export function updateSiteSettings(data) {
  return request('/api/site-setting', { method: 'PUT', body: { data } })
}

// ---------- Dashboard counts ----------

export async function getDashboardStats() {
  const [pending, review, sources, articlesToday] = await Promise.all([
    request('/api/ai-drafts?filters[draftStatus][$eq]=new&pagination[pageSize]=1'),
    request('/api/ai-drafts?filters[draftStatus][$eq]=review&pagination[pageSize]=1'),
    request('/api/sources?filters[isActive][$eq]=true&pagination[pageSize]=1'),
    request(
      `/api/articles?filters[publishedAt][$gte]=${new Date(new Date().setHours(0, 0, 0, 0)).toISOString()}&pagination[pageSize]=1`
    ),
  ])

  return {
    pendingDrafts: pending?.meta?.pagination?.total ?? 0,
    reviewDrafts: review?.meta?.pagination?.total ?? 0,
    activeSources: sources?.meta?.pagination?.total ?? 0,
    articlesToday: articlesToday?.meta?.pagination?.total ?? 0,
  }
}
