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
  bootstrap({ strapi }: any) {
    const cronEnabled = process.env.CRON_ENABLED !== 'false'
    const parserEnabled = process.env.AUTO_PARSER_ENABLED !== 'false'
    const cronRule = process.env.AUTO_PARSER_CRON || '0 */5 * * * *'
    const limit = process.env.AUTO_PARSER_LIMIT || '3'

    strapi.log.info(
      `Автопарсинг HomeNews: cron=${cronEnabled ? 'on' : 'off'}, parser=${parserEnabled ? 'on' : 'off'}, rule=${cronRule}, limit=${limit}`
    )
  },
};
