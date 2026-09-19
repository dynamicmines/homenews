import type { Core } from '@strapi/strapi';

let autoParserIsRunning = false;

const config = ({ env }: Core.Config.Shared.ConfigParams): any => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
  cron: {
    enabled: env.bool('CRON_ENABLED', true),
    tasks: {
      parseActiveSources: {
        task: async ({ strapi }: any) => {
          if (!env.bool('AUTO_PARSER_ENABLED', true)) {
            strapi.log.info('Автопарсинг отключён через AUTO_PARSER_ENABLED=false');
            return;
          }

          if (autoParserIsRunning) {
            strapi.log.info('Автопарсинг пропущен: предыдущий запуск ещё выполняется');
            return;
          }

          autoParserIsRunning = true;

          const port = env.int('PORT', 1337);
          const limitPerSource = env.int('AUTO_PARSER_LIMIT', 3);
          const processingPrompt = env(
            'AUTO_PARSER_PROMPT',
            'Сделай короткие городские новости для HomeNews. Пиши официально, понятно для жителей, без неподтвержденных фактов. Сохраняй все важные факты: даты, адреса, маршруты, ограничения, причины и рекомендации. Не используй фразы “смотрите в изображении” или “подробности на картинке”.'
          );

          try {
            strapi.log.info(`Автопарсинг запущен: limitPerSource=${limitPerSource}`);

            const response = await fetch(
              `http://127.0.0.1:${port}/api/parse-active-sources-and-generate-drafts`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json; charset=utf-8',
                },
                body: JSON.stringify({
                  limitPerSource,
                  processingPrompt,
                }),
              }
            );

            const data = (await response.json().catch(() => null)) as any;

            if (!response.ok) {
              strapi.log.warn(`Автопарсинг завершился ошибкой: ${response.status}`);
              strapi.log.warn(data);
              return;
            }

            strapi.log.info(
              `Автопарсинг завершён: источников ${data?.sourceCount || 0}, создано ${data?.createdCount || 0}, дубликаты ${data?.duplicateCount || 0}, отклонено ${data?.rejectedCount || 0}`
            );
          } catch (error) {
            strapi.log.warn('Автопарсинг не выполнен');
            strapi.log.warn(error);
          } finally {
            autoParserIsRunning = false;
          }
        },
        options: {
          // Strapi/node-schedule format with seconds: second minute hour day month weekday.
          // 0 */5 * * * * = every 5 minutes at second 0.
          rule: env('AUTO_PARSER_CRON', '0 */5 * * * *'),
        },
      },
    },
  },
});

export default config;
