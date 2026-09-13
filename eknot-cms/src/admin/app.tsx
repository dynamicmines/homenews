import type { StrapiApp } from '@strapi/strapi/admin'

const AI_DRAFT_UID = 'api::ai-draft.ai-draft'

function getDocumentId(props: any) {
  const fromProps =
    props?.documentId ||
    props?.document?.documentId ||
    props?.entry?.documentId ||
    ''

  if (fromProps) return String(fromProps)

  const parts = window.location.pathname.split('/').filter(Boolean)

  return parts[parts.length - 1] || ''
}

function isAiDraftPage(props: any) {
  const possibleUids = [
    props?.model,
    props?.uid,
    props?.slug,
    props?.contentType?.uid,
    props?.contentType?.apiID,
    props?.collectionType,
  ]
    .filter(Boolean)
    .map((value) => String(value))

  return possibleUids.some((value) => {
    return (
      value === AI_DRAFT_UID ||
      value.includes('ai-draft') ||
      value.includes('ai_draft')
    )
  })
}

async function publishAiDraft(documentId: string) {
  const response = await fetch('/api/publish-ai-draft', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      draftDocumentId: documentId,
    }),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        data?.message ||
        'Не удалось опубликовать AI Draft'
    )
  }

  return data
}

export default {
  config: {
    locales: ['ru'],
  },

  bootstrap(app: StrapiApp) {
    const contentManagerPlugin = app.getPlugin('content-manager') as any
    const apis = contentManagerPlugin?.apis

    if (!apis?.addDocumentAction) {
      console.warn('Content Manager API addDocumentAction не найден')
      return
    }

    apis.addDocumentAction((actions: any[]) => [
      ...actions,
      (props: any) => {
        const documentId = getDocumentId(props)

        if (!isAiDraftPage(props) || !documentId) {
          return null
        }

        const draftStatus =
          props?.document?.draftStatus ||
          props?.entry?.draftStatus ||
          ''

        const isApproved = draftStatus === 'approved'

        return {
          label: isApproved
            ? 'Уже опубликовано'
            : 'Опубликовать как новость',
          position: ['header', 'panel'],
          variant: 'default',
          disabled: isApproved,
          dialog: {
            type: 'dialog',
            title: 'Опубликовать AI Draft как новость?',
            content:
              'Будет создана опубликованная News-запись. Черновик получит статус approved. Перед подтверждением проверьте заголовок, текст и картинку.',
            onConfirm: async () => {
              try {
                const result = await publishAiDraft(String(documentId))
                window.alert(
                  result?.message ||
                    'AI Draft опубликован как новость'
                )
                window.location.reload()
              } catch (error: any) {
                window.alert(
                  error?.message ||
                    'Ошибка публикации AI Draft'
                )
              }
            },
          },
        }
      },
    ])
  },
}
