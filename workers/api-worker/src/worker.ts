/// <reference types="vite/client" />

import router from './app'
import { handleQueue } from './queues'
import { handleScheduled } from './scheduled'
import { logger } from './utils/logger'

export type AppRouter = typeof router

// @ts-expect-error
BigInt.prototype.toJSON = function () {
  return this.toString()
}

export default {
  fetch: router.fetch,
  queue: handleQueue,
  scheduled: handleScheduled,
  // Temporary email handler until inbound email processing is implemented.
  email: async (message) => {
    logger.info('Inbound email received', {
      from: message.from,
      to: message.to,
      subject: message.headers.get('subject'),
    })

    if (logger.isLevelEnabled('debug')) {
      const emailText = await new Response(message.raw).text()
      logger.debug('Inbound email body preview', {
        from: message.from,
        to: message.to,
        preview: emailText.slice(0, 2000),
        truncated: emailText.length > 2000,
      })
    }
  },
} satisfies ExportedHandler<CloudflareBindings>
