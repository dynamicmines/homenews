# e-Knot News

Городская новостная платформа для Астаны: Strapi CMS, автоматический сбор материалов из официальных источников, обработка через Gemini, публичный сайт и Telegram Mini App для модерации.

## Состав проекта

- `eknot-cms` — Strapi 5, SQLite, парсеры, AI-черновики и публикация.
- `eknot-frontend` — публичный React/Vite-сайт.
- `eknot-bot` — Telegram-бот и Mini App администратора.

Требования: Node.js 20–24 и npm 10+.

## Быстрый локальный запуск

```bash
npm run setup:env
npm run install:all
```

Команда `setup:env` создаёт локальные `.env` и безопасные случайные секреты Strapi. Существующие `.env` она не перезаписывает.

После этого заполни:

- `GEMINI_API_KEY` в `eknot-cms/.env`;
- `BOT_TOKEN`, `ADMIN_IDS` и позднее `STRAPI_API_TOKEN` в `eknot-bot/.env`;
- `MINI_APP_URL` в `eknot-bot/.env`, когда будет готов HTTPS-туннель.

Запусти CMS:

```bash
npm run start:cms
```

Открой `http://localhost:1337/admin`, создай первого Super Admin, затем создай Full Access API token в Settings → API Tokens и вставь его в `eknot-bot/.env`.

В отдельных терминалах запусти frontend и Telegram-панель:

```bash
npm run start:frontend
npm run start:bot
```

- сайт: `http://localhost:5173`;
- Strapi: `http://localhost:1337`;
- Mini App: `http://localhost:3001`.

## Проверка перед запуском

```bash
npm run build
npm run lint
```

## Автопарсер

По умолчанию Strapi запускает парсер каждые пять минут. Управление находится в `eknot-cms/.env`:

```dotenv
CRON_ENABLED=true
AUTO_PARSER_ENABLED=true
AUTO_PARSER_LIMIT=3
AUTO_PARSER_CRON=0 */5 * * * *
```

Для безопасной проверки без запросов к источникам временно установи `AUTO_PARSER_ENABLED=false`.

## Секреты и данные

Файлы `.env`, локальная SQLite-база `.tmp/data.db`, uploads, `node_modules` и build-артефакты не отправляются в Git. Не добавляй реальные Gemini, Telegram или Strapi-токены в репозиторий.

При переносе существующей установки отдельно перенеси `.env`, `.tmp/data.db` и `public/uploads` через защищённый канал.
