/**
 * Custom AI Draft routes.
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/generate-ai-draft',
      handler: 'ai-draft.generateDraft',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/parse-source-and-generate-draft',
      handler: 'ai-draft.parseSourceAndGenerateDraft',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/parse-source-feed-and-generate-drafts',
      handler: 'ai-draft.parseSourceFeedAndGenerateDrafts',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/parse-active-sources-and-generate-drafts',
      handler: 'ai-draft.parseActiveSourcesAndGenerateDrafts',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/publish-ai-draft',
      handler: 'ai-draft.publishAiDraft',
      config: {
        auth: false,
      },
    },
  ],
}
