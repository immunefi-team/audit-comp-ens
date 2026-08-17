import { runExpiryDiscoveryCron } from '#services/expiry-discovery/index.js'
import { logger } from '#utils/logger.js'

export const handleScheduled: ExportedHandlerScheduledHandler<
  CloudflareBindings
> = async (controller, env, _ctx): Promise<void> => {
  logger.info('Scheduled event triggered', {
    cron: controller.cron,
    scheduledTime: new Date(controller.scheduledTime).toISOString(),
  })

  const result = await runExpiryDiscoveryCron(env)

  if (result.isErr()) {
    logger.error('Scheduled expiry discovery failed', {
      cron: controller.cron,
      error: result.error,
    })
    return
  }

  logger.info('Scheduled expiry discovery completed', {
    cron: controller.cron,
    totalEnqueued: result.value.totalEnqueued,
    failedStages: result.value.failedStages,
  })
}
