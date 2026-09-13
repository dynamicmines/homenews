# e-Knot Bot — Telegram-панель модератора

Telegram-бот с Mini App для управления e-Knot News: проверка AI-черновиков,
источники парсинга, настройки — всё прямо из Telegram, без захода в Strapi admin.

Общается с уже существующим `eknot-cms` через его API. Ничего в самом Strapi
менять не нужно — все нужные эндпоинты там уже есть.

## Структура

```
eknot-bot/
  src/
    index.js         # точка входа: поднимает и сервер, и бота
    server.js         # Express: отдаёт Mini App + проксирует запросы к Strapi
    bot.js             # Telegraf: команды /start, /status, /parse
    strapi.js          # обёртка над Strapi REST API (токен только здесь)
    telegramAuth.js     # проверка подписи Telegram initData
  public/
    index.html, styles.css, app.js   # сам Mini App (дашборд/черновики/источники/настройки)
```

## 1. Создать бота в Telegram

1. Открой @BotFather → `/newbot` → задай имя и юзернейм.
2. Скопируй токен вида `123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`.
3. Узнай свой Telegram id у @userinfobot — он понадобится для `ADMIN_IDS`,
   иначе панелью сможет пользоваться кто угодно, кто найдёт бота.

## 2. Создать API-токен Strapi

Strapi admin → **Settings → API Tokens → Create new API Token**:
- Name: `eknot-bot`
- Token type: **Full access**

Скопируй токен — он показывается один раз.

## 3. Настроить .env

```bash
cd eknot-bot
cp .env.example .env
```

Заполни:

```env
BOT_TOKEN=токен_от_BotFather
ADMIN_IDS=твой_telegram_id
STRAPI_URL=http://localhost:1337
STRAPI_API_TOKEN=токен_из_шага_2
PORT=3001
MINI_APP_URL=   # заполнить после запуска ngrok, см. шаг 5
```

## 4. Установить и запустить

```bash
npm install
npm run develop    # или: npm start
```

В консоли должно появиться:
```
[eknot-bot] Mini App server listening on http://localhost:3001
[eknot-bot] Telegram bot запущен (polling)
```

## 5. Открыть Mini App наружу через ngrok

Telegram Mini App обязательно должен открываться по HTTPS.

```bash
ngrok http 3001
```

Скопируй выданный `https://....ngrok-free.app`, вставь в `.env` бота как
`MINI_APP_URL`, перезапусти бота (`npm run develop`).

Открой бота в Telegram → `/start` → кнопка **«Открыть панель»**.

## Что умеет панель

- **Дашборд** — сколько черновиков ждут проверки, сколько источников активно,
  сколько опубликовано сегодня; кнопка ручного запуска парсинга.
- **Черновики** — фильтр по статусу (новые/правки/готово/отказ), редактирование
  заголовка, краткого содержания, текста, срочности и района прямо в форме,
  публикация как новости или отклонение.
- **Источники** — список с переключателем «активен», добавление нового
  источника (название, ссылка, тип, способ парсинга, категория).
- **Настройки** — правила AI-обработки (стиль, проверка фактов, перевод на
  казахский) и настройки сайта (название, описание, контакты).

## Безопасность

- Strapi API-токен живёт только на сервере бота (`src/strapi.js`), в код
  Mini App, который выполняется в браузере пользователя, он не попадает.
- Каждый запрос от Mini App подписан Telegram (`initData`) и проверяется на
  сервере (HMAC, см. `src/telegramAuth.js`) — подделать запрос от чужого
  имени нельзя.
- `ADMIN_IDS` в `.env` ограничивает круг людей, которые вообще могут открыть
  панель. Если оставить пустым — доступ открыт всем, кто найдёт бота (годится
  только для локальной разработки).

## Известные ограничения

- Custom-эндпоинты Strapi (`generate-ai-draft`, `parse-active-sources-and-generate-drafts`,
  `publish-ai-draft`) в текущем `eknot-cms` помечены `auth: false` — то есть
  теоретически доступны без токена любому, кто знает адрес Strapi. Для
  продакшена стоит закрыть их авторизацией на стороне Strapi (см. заметку
  в `README_AI.md` основного проекта).
- Бот работает через long polling — это ок для одного модератора и локальной
  разработки; для постоянной работы в проде обычно переходят на webhook.
