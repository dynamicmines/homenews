// ---------- Telegram WebApp bootstrap ----------

const tg = window.Telegram?.WebApp
if (tg) {
  tg.ready()
  tg.expand()
  try {
    tg.setHeaderColor('secondary_bg_color')
  } catch { /* older clients may not support this */ }
}

const initData = tg?.initData || ''

// ---------- API helper ----------

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-init-data': initData,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.ok === false) {
    throw new Error(json.error || json.reason || `HTTP ${res.status}`)
  }
  return json.data
}

// ---------- Toast ----------

let toastTimer = null
function showToast(message, tone = 'default') {
  const el = document.getElementById('toast')
  el.textContent = message
  el.dataset.tone = tone
  el.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { el.hidden = true }, 2600)
}

// ---------- View routing ----------

const views = document.querySelectorAll('.view')
const tabs = document.querySelectorAll('.tab')
let activeMainView = 'dashboard'

function switchView(name, { isOverlay = false } = {}) {
  views.forEach((v) => { v.hidden = v.dataset.view !== name })

  if (!isOverlay) {
    activeMainView = name
    tabs.forEach((t) => t.classList.toggle('is-active', t.dataset.view === name))
    tg?.BackButton?.hide()
  } else {
    tg?.BackButton?.show()
  }
}

tg?.BackButton?.onClick(() => switchView(activeMainView))

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    switchView(tab.dataset.view)
    if (tab.dataset.view === 'dashboard') loadDashboard()
    if (tab.dataset.view === 'drafts') loadDrafts(currentDraftStatus)
    if (tab.dataset.view === 'sources') loadSources()
    if (tab.dataset.view === 'settings') loadSettings()
  })
})

// ---------- Dashboard ----------

async function loadDashboard() {
  try {
    const stats = await api('/stats')
    document.getElementById('statPending').textContent = stats.pendingDrafts
    document.getElementById('statReview').textContent = stats.reviewDrafts
    document.getElementById('statSources').textContent = stats.activeSources
    document.getElementById('statToday').textContent = stats.articlesToday
    document.getElementById('pendingChip').textContent = `${stats.pendingDrafts} на проверке`
  } catch (e) {
    showToast(`Не удалось загрузить статистику: ${e.message}`, 'error')
  }
}

document.getElementById('runParserBtn').addEventListener('click', async (e) => {
  const btn = e.currentTarget
  btn.disabled = true
  btn.textContent = 'Парсинг запущен…'
  try {
    await api('/run-parser', { method: 'POST' })
    showToast('Парсинг завершён', 'success')
    loadDashboard()
  } catch (err) {
    showToast(`Ошибка: ${err.message}`, 'error')
  } finally {
    btn.disabled = false
    btn.textContent = 'Запустить парсинг сейчас'
  }
})

// ---------- Drafts list ----------

let currentDraftStatus = 'new'
let draftsCache = []

document.querySelectorAll('#draftStatusTabs .segmented-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#draftStatusTabs .segmented-item').forEach((b) => b.classList.remove('is-active'))
    btn.classList.add('is-active')
    currentDraftStatus = btn.dataset.status
    loadDrafts(currentDraftStatus)
  })
})

function urgencyLabel(u) {
  return { high: 'Срочно', medium: 'Важно', low: 'Обычная' }[u] || 'Обычная'
}

function statusLabel(s) {
  return { new: 'новый', review: 'на доработке', approved: 'опубликован', rejected: 'отклонён' }[s] || 'новый'
}

function sourceTypeLabel(t) {
  return { website: 'Веб-сайт', rss: 'RSS-лента', telegram: 'Telegram-канал', manual: 'Добавлено вручную' }[t] || t
}

function sourceCategoryLabel(c) {
  return {
    zkh: 'ЖКХ', roads: 'Дороги', water: 'Водоснабжение', electricity: 'Электроснабжение',
    heating: 'Отопление', government: 'Акимат', emergency: 'Экстренные случаи',
  }[c] || c
}

async function loadDrafts(status) {
  const list = document.getElementById('draftsList')
  const empty = document.getElementById('draftsEmpty')
  list.innerHTML = ''
  try {
    const res = await api(`/drafts?status=${status}`)
    draftsCache = res.data || []
    empty.hidden = draftsCache.length > 0

    for (const item of draftsCache) {
      const d = item.attributes || item
      const urgency = d.suggestedUrgency || 'medium'
      const card = document.createElement('div')
      card.className = 'card card-draft'
      card.dataset.urgency = urgency
      card.innerHTML = `
        <div class="card-top">
          <div class="card-title">${escapeHtml(d.generatedTitleRu || d.originalTitle || 'Без заголовка')}</div>
          <span class="badge badge-${urgency}">${urgencyLabel(urgency)}</span>
        </div>
        <div class="card-meta">${escapeHtml(d.sourceName || d.sourceUrl || 'Источник неизвестен')}</div>
      `
      card.addEventListener('click', () => openDraftDetail(item.documentId || item.id))
      list.appendChild(card)
    }
  } catch (e) {
    showToast(`Не удалось загрузить черновики: ${e.message}`, 'error')
  }
}

// ---------- Draft detail ----------

async function openDraftDetail(id) {
  switchView('draft-detail', { isOverlay: true })
  const body = document.getElementById('draftDetailBody')
  body.innerHTML = '<p class="hint">Загрузка…</p>'

  try {
    const res = await api(`/drafts/${id}`)
    const d = res.data?.attributes || res.data
    renderDraftDetail(id, d)
  } catch (e) {
    body.innerHTML = `<p class="hint">Ошибка загрузки: ${escapeHtml(e.message)}</p>`
  }
}

function renderDraftDetail(id, d) {
  const body = document.getElementById('draftDetailBody')
  const isDecided = d.draftStatus === 'approved' || d.draftStatus === 'rejected'

  body.innerHTML = `
    <div class="field">
      <label>Заголовок (RU)</label>
      <input type="text" id="f_titleRu" value="${escapeAttr(d.generatedTitleRu || '')}" ${isDecided ? 'disabled' : ''} />
    </div>
    <div class="field">
      <label>Заголовок (KZ)</label>
      <input type="text" id="f_titleKz" value="${escapeAttr(d.generatedTitleKz || '')}" ${isDecided ? 'disabled' : ''} />
    </div>
    <div class="field">
      <label>Краткое содержание (RU)</label>
      <textarea id="f_summaryRu" ${isDecided ? 'disabled' : ''}>${escapeHtml(d.generatedSummaryRu || '')}</textarea>
    </div>
    <div class="field">
      <label>Краткое содержание (KZ)</label>
      <textarea id="f_summaryKz" ${isDecided ? 'disabled' : ''}>${escapeHtml(d.generatedSummaryKz || '')}</textarea>
    </div>
    <div class="field">
      <label>Текст новости (RU)</label>
      <textarea id="f_contentRu" style="min-height:140px" ${isDecided ? 'disabled' : ''}>${escapeHtml(d.generatedContentRu || '')}</textarea>
    </div>
    <div class="field">
      <label>Текст новости (KZ)</label>
      <textarea id="f_contentKz" style="min-height:140px" ${isDecided ? 'disabled' : ''}>${escapeHtml(d.generatedContentKz || '')}</textarea>
    </div>
    <div class="field">
      <label>Уровень срочности</label>
      <select id="f_urgency" ${isDecided ? 'disabled' : ''}>
        <option value="low" ${d.suggestedUrgency === 'low' ? 'selected' : ''}>Обычная</option>
        <option value="medium" ${d.suggestedUrgency === 'medium' ? 'selected' : ''}>Важно</option>
        <option value="high" ${d.suggestedUrgency === 'high' ? 'selected' : ''}>Срочно</option>
      </select>
    </div>
    <div class="field">
      <label>Район (необязательно)</label>
      <input type="text" id="f_district" value="${escapeAttr(d.district || '')}" />
    </div>

    <div class="field-row">
      <div>
        <div class="field-row-label">Закрепить на главной</div>
      </div>
      <label class="switch">
        <input type="checkbox" id="f_featured" ${d.isFeatured ? 'checked' : ''} />
        <span class="switch-track"></span>
      </label>
    </div>
    <div class="field-row">
      <div>
        <div class="field-row-label">Важное уведомление</div>
      </div>
      <label class="switch">
        <input type="checkbox" id="f_important" ${d.isImportant ? 'checked' : ''} />
        <span class="switch-track"></span>
      </label>
    </div>

    <p class="hint" style="margin-top:14px; text-align:left;">Источник: ${escapeHtml(d.sourceName || '—')}<br>Статус черновика: ${statusLabel(d.draftStatus)}</p>

    <div class="btn-row">
      <button class="btn btn-secondary" id="saveDraftBtn" ${isDecided ? 'disabled' : ''}>Сохранить</button>
      <button class="btn btn-danger" id="rejectDraftBtn" ${isDecided ? 'disabled' : ''}>Отклонить</button>
    </div>
    <button class="btn btn-primary btn-block" id="publishDraftBtn" style="margin-top:8px;" ${isDecided ? 'disabled' : ''}>
      Опубликовать как новость
    </button>
  `

  document.getElementById('saveDraftBtn').addEventListener('click', async () => {
    try {
      await api(`/drafts/${id}`, {
        method: 'PUT',
        body: {
          generatedTitleRu: document.getElementById('f_titleRu').value,
          generatedTitleKz: document.getElementById('f_titleKz').value,
          generatedSummaryRu: document.getElementById('f_summaryRu').value,
          generatedSummaryKz: document.getElementById('f_summaryKz').value,
          generatedContentRu: document.getElementById('f_contentRu').value,
          generatedContentKz: document.getElementById('f_contentKz').value,
          suggestedUrgency: document.getElementById('f_urgency').value,
          district: document.getElementById('f_district').value,
        },
      })
      showToast('Изменения сохранены', 'success')
    } catch (e) {
      showToast(`Ошибка сохранения: ${e.message}`, 'error')
    }
  })

  document.getElementById('rejectDraftBtn').addEventListener('click', async () => {
    try {
      await api(`/drafts/${id}/reject`, { method: 'POST', body: {} })
      showToast('Черновик отклонён')
      switchView('drafts')
      loadDrafts(currentDraftStatus)
    } catch (e) {
      showToast(`Ошибка: ${e.message}`, 'error')
    }
  })

  document.getElementById('publishDraftBtn').addEventListener('click', async () => {
    try {
      await api(`/drafts/${id}/publish`, {
        method: 'POST',
        body: {
          isFeatured: document.getElementById('f_featured').checked,
          isImportant: document.getElementById('f_important').checked,
          district: document.getElementById('f_district').value,
        },
      })
      showToast('Опубликовано на сайте', 'success')
      switchView('drafts')
      loadDrafts(currentDraftStatus)
      loadDashboard()
    } catch (e) {
      showToast(`Ошибка публикации: ${e.message}`, 'error')
    }
  })
}

document.getElementById('draftDetailBack').addEventListener('click', () => switchView('drafts'))

// ---------- Sources ----------

let sourcesCache = []

async function loadSources() {
  const list = document.getElementById('sourcesList')
  list.innerHTML = '<p class="hint">Загрузка…</p>'
  try {
    const res = await api('/sources')
    sourcesCache = res.data || []
    list.innerHTML = ''

    for (const item of sourcesCache) {
      const s = item.attributes || item
      const card = document.createElement('div')
      card.className = 'card'
      card.innerHTML = `
        <div class="card-source-row">
          <div>
            <div class="card-source-name">${escapeHtml(s.name || 'Без имени')}</div>
            <div class="card-source-meta">${escapeHtml(sourceTypeLabel(s.type))}, категория «${escapeHtml(sourceCategoryLabel(s.sourceCategory))}»</div>
          </div>
          <label class="switch">
            <input type="checkbox" class="source-toggle" ${s.isActive ? 'checked' : ''} />
            <span class="switch-track"></span>
          </label>
        </div>
      `
      card.querySelector('.card-source-row > div').addEventListener('click', () => openSourceForm(item))
      card.querySelector('.source-toggle').addEventListener('click', async (ev) => {
        ev.stopPropagation()
        const checked = ev.target.checked
        try {
          await api(`/sources/${item.documentId || item.id}`, { method: 'PUT', body: { isActive: checked } })
          showToast(checked ? 'Источник включён' : 'Источник выключен')
          loadDashboard()
        } catch (e) {
          ev.target.checked = !checked
          showToast(`Ошибка: ${e.message}`, 'error')
        }
      })
      list.appendChild(card)
    }
  } catch (e) {
    list.innerHTML = `<p class="hint">Ошибка загрузки: ${escapeHtml(e.message)}</p>`
  }
}

document.getElementById('addSourceBtn').addEventListener('click', () => openSourceForm(null))
document.getElementById('sourceFormBack').addEventListener('click', () => switchView('sources'))

function openSourceForm(item) {
  switchView('source-form', { isOverlay: true })
  const s = (item && (item.attributes || item)) || {}
  const id = item ? (item.documentId || item.id) : null
  const body = document.getElementById('sourceFormBody')

  body.innerHTML = `
    <div class="field">
      <label>Название</label>
      <input type="text" id="s_name" value="${escapeAttr(s.name || '')}" />
    </div>
    <div class="field">
      <label>Ссылка</label>
      <input type="url" id="s_url" value="${escapeAttr(s.url || '')}" />
    </div>
    <div class="field">
      <label>Тип источника</label>
      <select id="s_type">
        ${['website', 'rss', 'telegram', 'manual'].map((v) => `<option value="${v}" ${s.type === v ? 'selected' : ''}>${sourceTypeLabel(v)}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label>Способ парсинга</label>
      <select id="s_parseMode">
        ${['html', 'rss', 'manual', 'govkz', 'telegram'].map((v) => `<option value="${v}" ${s.parseMode === v ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label>Категория источника</label>
      <select id="s_category">
        ${['zkh', 'roads', 'water', 'electricity', 'heating', 'government', 'emergency']
          .map((v) => `<option value="${v}" ${s.sourceCategory === v ? 'selected' : ''}>${sourceCategoryLabel(v)}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label>Описание</label>
      <textarea id="s_description">${escapeHtml(s.description || '')}</textarea>
    </div>
    <div class="field-row">
      <div class="field-row-label">Активен</div>
      <label class="switch">
        <input type="checkbox" id="s_active" ${s.isActive !== false ? 'checked' : ''} />
        <span class="switch-track"></span>
      </label>
    </div>

    <div class="btn-row">
      <button class="btn btn-primary" id="saveSourceBtn" style="flex:2">Сохранить</button>
      ${id ? '<button class="btn btn-danger" id="deleteSourceBtn">Удалить</button>' : ''}
    </div>
  `

  document.getElementById('saveSourceBtn').addEventListener('click', async () => {
    const payload = {
      name: document.getElementById('s_name').value,
      url: document.getElementById('s_url').value,
      type: document.getElementById('s_type').value,
      parseMode: document.getElementById('s_parseMode').value,
      sourceCategory: document.getElementById('s_category').value,
      description: document.getElementById('s_description').value,
      isActive: document.getElementById('s_active').checked,
    }
    try {
      if (id) {
        await api(`/sources/${id}`, { method: 'PUT', body: payload })
      } else {
        await api('/sources', { method: 'POST', body: payload })
      }
      showToast('Источник сохранён', 'success')
      switchView('sources')
      loadSources()
      loadDashboard()
    } catch (e) {
      showToast(`Ошибка сохранения: ${e.message}`, 'error')
    }
  })

  const deleteBtn = document.getElementById('deleteSourceBtn')
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      try {
        await api(`/sources/${id}`, { method: 'DELETE' })
        showToast('Источник удалён')
        switchView('sources')
        loadSources()
      } catch (e) {
        showToast(`Ошибка удаления: ${e.message}`, 'error')
      }
    })
  }
}

// ---------- Settings ----------

async function loadSettings() {
  const body = document.getElementById('settingsBody')
  body.innerHTML = '<p class="hint">Загрузка…</p>'
  try {
    const [aiRes, siteRes] = await Promise.all([api('/settings/ai'), api('/settings/site')])
    const ai = aiRes.data?.attributes || aiRes.data || {}
    const site = siteRes.data?.attributes || siteRes.data || {}

    body.innerHTML = `
      <div class="section-title">Правила AI-обработки</div>
      <div class="field">
        <label>Стиль по умолчанию</label>
        <textarea id="ai_style">${escapeHtml(ai.defaultStylePrompt || '')}</textarea>
      </div>
      <div class="field">
        <label>Правило проверки фактов</label>
        <textarea id="ai_factcheck">${escapeHtml(ai.factCheckRule || '')}</textarea>
      </div>
      <div class="field">
        <label>Правило перевода RU → KZ</label>
        <textarea id="ai_translation">${escapeHtml(ai.translationRule || '')}</textarea>
      </div>

      <div class="section-title" style="margin-top:12px;">Дополнительные правила</div>
      <div id="customRulesList"></div>
      <button class="btn btn-secondary btn-block" id="addCustomRuleBtn" type="button">+ Добавить правило</button>

      <button class="btn btn-secondary btn-block" id="saveAiBtn" style="margin-top:12px;">Сохранить правила AI</button>

      <div class="divider"></div>

      <div class="section-title">Настройки сайта</div>
      <div class="field">
        <label>Название сайта (RU)</label>
        <input type="text" id="site_nameRu" value="${escapeAttr(site.siteNameRu || '')}" />
      </div>
      <div class="field">
        <label>Название сайта (KZ)</label>
        <input type="text" id="site_nameKz" value="${escapeAttr(site.siteNameKz || '')}" />
      </div>
      <div class="field">
        <label>Описание (RU)</label>
        <textarea id="site_descRu">${escapeHtml(site.descriptionRu || '')}</textarea>
      </div>
      <div class="field">
        <label>Телефон</label>
        <input type="text" id="site_phone" value="${escapeAttr(site.phone || '')}" />
      </div>
      <div class="field">
        <label>Email</label>
        <input type="text" id="site_email" value="${escapeAttr(site.contactEmail || '')}" />
      </div>
      <button class="btn btn-secondary btn-block" id="saveSiteBtn">Сохранить настройки сайта</button>
    `

    let customRules = Array.isArray(ai.customRules) ? ai.customRules.map((r) => ({ ...r })) : []

    function renderCustomRules() {
      const list = document.getElementById('customRulesList')
      list.innerHTML = customRules
        .map(
          (rule, i) => `
        <div class="field custom-rule" data-index="${i}">
          <label>Название правила</label>
          <input type="text" class="rule-label" value="${escapeAttr(rule.label || '')}" placeholder="Например: Хэштеги" />
          <label>Текст правила</label>
          <textarea class="rule-text" placeholder="Что должен делать AI">${escapeHtml(rule.text || '')}</textarea>
          <button class="btn btn-danger btn-block rule-remove" type="button">Удалить правило</button>
        </div>
      `
        )
        .join('')

      list.querySelectorAll('.custom-rule').forEach((el) => {
        const i = Number(el.dataset.index)
        el.querySelector('.rule-label').addEventListener('input', (e) => {
          customRules[i].label = e.target.value
        })
        el.querySelector('.rule-text').addEventListener('input', (e) => {
          customRules[i].text = e.target.value
        })
        el.querySelector('.rule-remove').addEventListener('click', () => {
          customRules.splice(i, 1)
          renderCustomRules()
        })
      })
    }
    renderCustomRules()

    document.getElementById('addCustomRuleBtn').addEventListener('click', () => {
      customRules.push({ label: '', text: '' })
      renderCustomRules()
    })

    document.getElementById('saveAiBtn').addEventListener('click', async () => {
      try {
        await api('/settings/ai', {
          method: 'PUT',
          body: {
            defaultStylePrompt: document.getElementById('ai_style').value,
            factCheckRule: document.getElementById('ai_factcheck').value,
            translationRule: document.getElementById('ai_translation').value,
            customRules: customRules.filter((r) => r.label || r.text),
          },
        })
        showToast('Правила AI сохранены', 'success')
      } catch (e) {
        showToast(`Ошибка: ${e.message}`, 'error')
      }
    })

    document.getElementById('saveSiteBtn').addEventListener('click', async () => {
      try {
        await api('/settings/site', {
          method: 'PUT',
          body: {
            siteNameRu: document.getElementById('site_nameRu').value,
            siteNameKz: document.getElementById('site_nameKz').value,
            descriptionRu: document.getElementById('site_descRu').value,
            phone: document.getElementById('site_phone').value,
            contactEmail: document.getElementById('site_email').value,
          },
        })
        showToast('Настройки сайта сохранены', 'success')
      } catch (e) {
        showToast(`Ошибка: ${e.message}`, 'error')
      }
    })
  } catch (e) {
    body.innerHTML = `<p class="hint">Ошибка загрузки настроек: ${escapeHtml(e.message)}</p>`
  }
}

// ---------- Utils ----------

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;')
}

// ---------- Init ----------

loadDashboard()
