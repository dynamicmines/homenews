export default {
  routes: [
    {
      method: 'GET',
      path: '/telegram-image',
      handler: 'article.telegramImage',
      config: {
        auth: false,
      },
    },
  ],
}
