import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { requireTelegramAuth } from './telegramAuth.js'
import * as strapi from './strapi.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function createServer() {
  const app = express()
  app.use(express.json({ limit: '2mb' }))

  // Static Mini App (HTML/CSS/JS) — public, no secrets inside it.
  app.use(express.static(path.join(__dirname, '..', 'public')))

  const api = express.Router()
  api.use(requireTelegramAuth)

  // ---- Dashboard ----
  api.get('/stats', async (req, res, next) => {
    try {
      res.json({ ok: true, data: await strapi.getDashboardStats() })
    } catch (e) {
      next(e)
    }
  })

  api.post('/run-parser', async (req, res, next) => {
    try {
      const result = await strapi.runAutoParser(req.body?.limit)
      res.json({ ok: true, data: result })
    } catch (e) {
      next(e)
    }
  })

  // ---- Drafts ----
  api.get('/drafts', async (req, res, next) => {
    try {
      const { status = 'new', page = 1, pageSize = 20 } = req.query
      res.json({ ok: true, data: await strapi.listDrafts({ status, page: Number(page), pageSize: Number(pageSize) }) })
    } catch (e) {
      next(e)
    }
  })

  api.get('/drafts/:id', async (req, res, next) => {
    try {
      res.json({ ok: true, data: await strapi.getDraft(req.params.id) })
    } catch (e) {
      next(e)
    }
  })

  api.put('/drafts/:id', async (req, res, next) => {
    try {
      res.json({ ok: true, data: await strapi.updateDraft(req.params.id, req.body) })
    } catch (e) {
      next(e)
    }
  })

  api.post('/drafts/:id/reject', async (req, res, next) => {
    try {
      res.json({ ok: true, data: await strapi.rejectDraft(req.params.id, req.body?.comment) })
    } catch (e) {
      next(e)
    }
  })

  api.post('/drafts/:id/publish', async (req, res, next) => {
    try {
      const { isFeatured, isImportant, district } = req.body || {}
      const result = await strapi.publishDraft({
        draftDocumentId: req.params.id,
        isFeatured,
        isImportant,
        district,
      })
      res.json({ ok: true, data: result })
    } catch (e) {
      next(e)
    }
  })

  // ---- Sources ----
  api.get('/sources', async (req, res, next) => {
    try {
      res.json({ ok: true, data: await strapi.listSources() })
    } catch (e) {
      next(e)
    }
  })

  api.post('/sources', async (req, res, next) => {
    try {
      res.json({ ok: true, data: await strapi.createSource(req.body) })
    } catch (e) {
      next(e)
    }
  })

  api.put('/sources/:id', async (req, res, next) => {
    try {
      res.json({ ok: true, data: await strapi.updateSource(req.params.id, req.body) })
    } catch (e) {
      next(e)
    }
  })

  api.delete('/sources/:id', async (req, res, next) => {
    try {
      res.json({ ok: true, data: await strapi.deleteSource(req.params.id) })
    } catch (e) {
      next(e)
    }
  })

  // ---- Categories (for dropdowns) ----
  api.get('/categories', async (req, res, next) => {
    try {
      res.json({ ok: true, data: await strapi.listCategories() })
    } catch (e) {
      next(e)
    }
  })

  // ---- Settings ----
  api.get('/settings/ai', async (req, res, next) => {
    try {
      res.json({ ok: true, data: await strapi.getAiSettings() })
    } catch (e) {
      next(e)
    }
  })

  api.put('/settings/ai', async (req, res, next) => {
    try {
      res.json({ ok: true, data: await strapi.updateAiSettings(req.body) })
    } catch (e) {
      next(e)
    }
  })

  api.get('/settings/site', async (req, res, next) => {
    try {
      res.json({ ok: true, data: await strapi.getSiteSettings() })
    } catch (e) {
      next(e)
    }
  })

  api.put('/settings/site', async (req, res, next) => {
    try {
      res.json({ ok: true, data: await strapi.updateSiteSettings(req.body) })
    } catch (e) {
      next(e)
    }
  })

  app.use('/api', api)

  // Basic health check (no auth) — useful for ngrok / uptime checks
  app.get('/health', (req, res) => res.json({ ok: true }))

  // Error handler
  app.use((err, req, res, _next) => {
    console.error('[server error]', err.message)
    res.status(err.status && err.status < 600 ? err.status : 500).json({
      ok: false,
      error: err.message || 'internal error',
    })
  })

  return app
}
