// import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs after Strapi starts.
   */
  async bootstrap({ strapi }: any) {
    const cronEnabled = process.env.CRON_ENABLED !== 'false'
    const parserEnabled = process.env.AUTO_PARSER_ENABLED !== 'false'
    const cronRule = process.env.AUTO_PARSER_CRON || '0 */5 * * * *'
    const limit = process.env.AUTO_PARSER_LIMIT || '3'

    strapi.log.info(
      `Автопарсинг HomeNews: cron=${cronEnabled ? 'on' : 'off'}, parser=${parserEnabled ? 'on' : 'off'}, rule=${cronRule}, limit=${limit}`
    )

    // The recovered database predates sourceUrl on Article. Backfill the two
    // published iKOMEK materials without republishing them or changing their dates.
    const legacySourceUrls = [
      {
        titleRu: 'Временное перекрытие движения по улице Акан Сери 4-5 июня',
        sourceUrl: 'https://t.me/ikomek109/37139',
      },
      {
        titleRu: 'Временное отключение горячего водоснабжения 4 июня 2026 года',
        sourceUrl: 'https://t.me/ikomek109/37147',
      },
    ]

    for (const item of legacySourceUrls) {
      const articles = await strapi.db.query('api::article.article').findMany({
        where: {
          titleRu: item.titleRu,
        },
      })

      for (const article of articles) {
        if (article.sourceUrl === item.sourceUrl) continue

        await strapi.db.query('api::article.article').update({
          where: {
            id: article.id,
          },
          data: {
            sourceUrl: item.sourceUrl,
          },
        })
      }
    }
  },
};
