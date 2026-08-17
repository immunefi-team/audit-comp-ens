import {
  type ChannelType,
  channelSupportsNotification,
  type NotificationDefinition,
  notificationDefinitions,
  type PersonalNotificationKind,
  type PersonalNotificationPayloads,
} from '@ens-apps/shared-schema/notifications'
import {
  getFirstOrFallback,
  ResultFn,
  TaggedError,
} from '@ens-apps/utils/neverthrow'
import { and, eq, inArray } from 'drizzle-orm'
import { ok } from 'neverthrow'
// biome-ignore lint/nursery/noRestrictedDependencies: uuid is used for its v7 (time-ordered) generator, which has no native equivalent (crypto.randomUUID only produces v4)
import { v7 as uuidv7 } from 'uuid'
import { getQueueForChannel } from '#config/queues.js'
import { type Database, intoDbResult, TABLE } from '#core/database/index.js'
import type { BaseDeliveryJob } from '#types/delivery.js'
import { chunk } from '#utils/chunk.js'
import { logger } from '#utils/logger.js'

type WatchReason = 'owned' | 'favourited' | 'manual'

type DeliveryPreferenceSettings = {
  owned_name_expiry: boolean
  favourited_name_expiry: boolean
  ens_labs_updates: boolean
}

export function shouldCreateExternalDeliveriesForNotification(
  kind: PersonalNotificationKind,
  payload: PersonalNotificationPayloads[PersonalNotificationKind],
  settings: DeliveryPreferenceSettings,
): boolean {
  const definition = notificationDefinitions[kind] as NotificationDefinition
  if (definition.delivery.mode === 'none') {
    return false
  }

  const preferenceKey = definition.delivery.preferenceKey

  switch (preferenceKey) {
    case 'ownedNameExpiry':
      return settings.owned_name_expiry
    case 'favouritedNameExpiry':
      return settings.favourited_name_expiry
    case 'ensLabsUpdates':
      return settings.ens_labs_updates
    case 'watchBasedNameExpiry': {
      if (kind !== 'name-expiry') {
        return settings.owned_name_expiry || settings.favourited_name_expiry
      }

      const nameExpiryPayload =
        payload as PersonalNotificationPayloads['name-expiry']
      const watchReason: WatchReason =
        // Prefer explicit watch reason (new flow)
        nameExpiryPayload.watchReason ??
        // Fallback for old payloads / tests
        (nameExpiryPayload.isOwner ? 'owned' : 'favourited')

      switch (watchReason) {
        case 'owned':
          return settings.owned_name_expiry
        case 'favourited':
          return settings.favourited_name_expiry
        case 'manual':
          // Conservative default: manual watches follow either toggle.
          return settings.owned_name_expiry || settings.favourited_name_expiry
      }

      return settings.owned_name_expiry || settings.favourited_name_expiry
    }
    default:
      // Opt-in kind without a preference key defaults to enabled.
      return true
  }
}

class NotificationCreationError extends TaggedError(
  'NOTIFICATION_CREATION_ERROR',
) {}

export const createNotification = ResultFn(async function* <
  K extends PersonalNotificationKind,
>(ctx: {
  env: CloudflareBindings
  db: Database
  userId: string
  kind: K
  payload: PersonalNotificationPayloads[K]
  idempotencyKey: string
}) {
  // Create the notification record
  const notification = yield* intoDbResult(
    ctx.db
      .insert(TABLE.notifications)
      .values({
        user_id: ctx.userId,
        kind: ctx.kind,
        payload: ctx.payload,
        idempotency_key: ctx.idempotencyKey,
      })
      .returning(),
  ).andThen(
    getFirstOrFallback(() =>
      new NotificationCreationError({
        message: 'Failed to create notification',
      }).toErr(),
    ),
  )

  // Get user's verified channels
  const channels = yield* intoDbResult(
    ctx.db.query.userChannels.findMany({
      where: and(
        eq(TABLE.userChannels.user_id, ctx.userId),
        eq(TABLE.userChannels.status, 'verified'),
      ),
    }),
  )

  // Get user notification settings (new preferences model)
  const settingsRow = yield* intoDbResult(
    ctx.db.query.userNotificationSettings.findFirst({
      where: eq(TABLE.userNotificationSettings.user_id, ctx.userId),
      columns: {
        owned_name_expiry: true,
        favourited_name_expiry: true,
        ens_labs_updates: true,
      },
    }),
  )

  const settings = {
    owned_name_expiry: settingsRow?.owned_name_expiry ?? false,
    favourited_name_expiry: settingsRow?.favourited_name_expiry ?? false,
    ens_labs_updates: settingsRow?.ens_labs_updates ?? false,
  }

  const shouldCreateDeliveries = shouldCreateExternalDeliveriesForNotification(
    ctx.kind,
    ctx.payload as PersonalNotificationPayloads[PersonalNotificationKind],
    settings,
  )

  // Queue delivery for each enabled channel
  for (const channel of channels) {
    // Check if channel supports this notification type
    if (!channelSupportsNotification(channel.channel, ctx.kind)) {
      logger.debug('Channel does not support notification', {
        channel: channel.channel,
        kind: ctx.kind,
      })
      continue
    }

    // UI notifications are always created; external deliveries are gated by settings.
    if (!shouldCreateDeliveries) {
      logger.debug('External delivery disabled by settings', {
        channel: channel.channel,
        kind: ctx.kind,
        userId: ctx.userId,
      })
      continue
    }

    if (!channel.target) {
      logger.warn('Verified channel missing target, skipping', {
        channel: channel.channel,
        kind: ctx.kind,
        userId: ctx.userId,
      })
      continue
    }

    // Create delivery record
    const delivery = yield* intoDbResult(
      ctx.db
        .insert(TABLE.notificationDeliveries)
        .values({
          notification_id: notification.id,
          channel: channel.channel,
          target: channel.target,
          status: 'queued',
          attempts: 0,
        })
        .returning(),
    ).andThen(
      getFirstOrFallback(
        new NotificationCreationError({
          message: 'Failed to create delivery',
        }).toErr(),
      ),
    )

    // Enqueue based on channel type using centralized mapping
    const queueBinding = getQueueForChannel(channel.channel)
    if (!queueBinding) {
      logger.warn('No queue mapping found for channel', {
        channel: channel.channel,
        deliveryId: delivery.id,
      })
      continue
    }

    const job: BaseDeliveryJob = {
      id: delivery.id,
      notificationId: notification.id,
      userId: ctx.userId,
      kind: ctx.kind,
    }

    // Dynamically access the queue from env using the binding name
    const queue = ctx.env[queueBinding] as Queue<BaseDeliveryJob>
    await queue.send(job)

    logger.info('Delivery job queued', {
      deliveryId: delivery.id,
      channel: channel.channel,
      kind: ctx.kind,
    })
  }

  return ok(notification)
})

/**
 * Creates multiple notifications in a single batch operation.
 *
 * This function optimizes notification creation by batching database operations
 * and queue submissions to minimize queries and avoid Cloudflare's 1,000 sub-request limit.
 *
 * Key optimizations:
 * - Batch inserts all notifications in a single database query
 * - Fetches all user channels and preferences in two queries (instead of per-user)
 * - Groups channels/preferences by userId using Map.groupBy for efficient lookup
 * - Batch inserts all delivery records in a single query
 * - Chunks queue jobs into batches of 95 (Cloudflare queue limit is 100, leaving buffer)
 * - Uses sendBatch for each chunk to minimize sub-requests
 *
 * This is particularly useful when processing many names (e.g., 200+ ENS names)
 * where calling createNotification individually would exceed sub-request limits.
 *
 * @param ctx - Context object containing environment, database, and notification array
 * @param ctx.env - Cloudflare environment bindings (for queue access)
 * @param ctx.db - Database connection
 * @param ctx.kind - Notification kind (all notifications in the batch must be the same kind)
 * @param ctx.notifications - Array of notification inputs to create (kind is inferred from ctx.kind)
 * @returns Result containing summary of created notifications, or error
 */
export const createBatchNotifications = ResultFn(async function* <
  K extends PersonalNotificationKind,
>(ctx: {
  env: CloudflareBindings
  db: Database
  kind: K
  notifications: Array<{
    userId: string
    payload: PersonalNotificationPayloads[K]
    idempotencyKey: string
  }>
}) {
  // Handle empty array gracefully
  if (ctx.notifications.length === 0) {
    return ok({
      notificationCount: 0,
      deliveryCount: 0,
      queueJobCounts: {},
    })
  }

  // Generate IDs for all notifications using sequential UUIDs
  // This ensures deterministic IDs and allows for better tracking
  let notificationCounter = 0
  const notificationsWithIds = ctx.notifications.map((notification) => ({
    ...notification,
    id: uuidv7({
      seq: notificationCounter++,
    }),
    kind: ctx.kind,
  }))

  // Batch insert all notifications in a single database query
  yield* intoDbResult(
    ctx.db.insert(TABLE.notifications).values(
      notificationsWithIds.map((notification) => ({
        id: notification.id,
        user_id: notification.userId,
        kind: notification.kind,
        payload: notification.payload,
        idempotency_key: notification.idempotencyKey,
      })),
    ),
  )

  // Extract unique user IDs to fetch channels and preferences in batch
  // Using Set ensures uniqueness and Array.from converts back to array
  // This is the standard and efficient approach for deduplication
  const uniqueUserIds = Array.from(
    new Set(notificationsWithIds.map((n) => n.userId)),
  )

  // Batch fetch all user channels for all users in a single query
  // This is much more efficient than fetching per-user
  const allChannels = yield* intoDbResult(
    ctx.db.query.userChannels.findMany({
      where: and(
        inArray(TABLE.userChannels.user_id, uniqueUserIds),
        eq(TABLE.userChannels.status, 'verified'),
      ),
      columns: {
        user_id: true,
        channel: true,
        target: true,
      },
    }),
  )

  // Group channels by userId for efficient lookup
  // Map.groupBy creates a Map<userId, Channel[]> structure
  const channelsByUserId = Map.groupBy(
    allChannels,
    (channel) => channel.user_id,
  )

  // Batch fetch user notification settings for all users (new preferences model)
  const allSettings = yield* intoDbResult(
    ctx.db.query.userNotificationSettings.findMany({
      where: inArray(TABLE.userNotificationSettings.user_id, uniqueUserIds),
      columns: {
        user_id: true,
        owned_name_expiry: true,
        favourited_name_expiry: true,
        ens_labs_updates: true,
      },
    }),
  )

  const settingsByUserId = Map.groupBy(allSettings, (s) => s.user_id)

  // Build delivery records and queue jobs
  // We collect all deliveries first, then batch insert them
  const deliveriesToCreate: (typeof TABLE.notificationDeliveries.$inferInsert)[] =
    []
  // Use a Map to group jobs by channel type for dynamic queue handling
  // This allows us to add new channels without modifying switch statements
  const jobsByChannel = new Map<ChannelType, BaseDeliveryJob[]>()

  // Counter for sequential delivery IDs
  let deliveryCounter = 0

  // Process each notification and build delivery records
  for (const notification of notificationsWithIds) {
    const channels = channelsByUserId.get(notification.userId)
    if (!channels || channels.length === 0) {
      // No channels found for this user, skip delivery creation
      logger.debug('No verified channels found for user', {
        userId: notification.userId,
      })
      continue
    }

    const settingsRow = settingsByUserId.get(notification.userId)?.[0]
    const settings = {
      owned_name_expiry: settingsRow?.owned_name_expiry ?? false,
      favourited_name_expiry: settingsRow?.favourited_name_expiry ?? false,
      ens_labs_updates: settingsRow?.ens_labs_updates ?? false,
    }

    const shouldCreateDeliveries =
      shouldCreateExternalDeliveriesForNotification(
        ctx.kind,
        notification.payload as PersonalNotificationPayloads[PersonalNotificationKind],
        settings,
      )

    if (!shouldCreateDeliveries) {
      continue
    }

    // Check each channel and create deliveries if appropriate
    for (const channel of channels) {
      // Skip if channel doesn't support this notification type
      if (!channelSupportsNotification(channel.channel, ctx.kind)) {
        logger.debug('Channel does not support notification', {
          channel: channel.channel,
          kind: ctx.kind,
        })
        continue
      }

      // Skip if channel has no target (e.g., unverified telegram)
      if (!channel.target) {
        logger.debug('Channel has no target', {
          channel: channel.channel,
          userId: notification.userId,
        })
        continue
      }

      // Generate delivery ID
      const deliveryId = uuidv7({
        seq: deliveryCounter++,
      })

      // Add delivery record to batch
      deliveriesToCreate.push({
        id: deliveryId,
        notification_id: notification.id,
        channel: channel.channel,
        target: channel.target,
        status: 'queued',
        attempts: 0,
      })

      // Add job to appropriate queue job array based on channel type
      // Using centralized channel-to-queue mapping for extensibility
      const queueBinding = getQueueForChannel(channel.channel)
      if (!queueBinding) {
        logger.warn('No queue mapping found for channel, skipping queue job', {
          channel: channel.channel,
          deliveryId,
        })
        // Note: We still create the delivery record, but don't queue it
        // This allows for manual processing or future channel support
        continue
      }

      const job: BaseDeliveryJob = {
        id: deliveryId,
        notificationId: notification.id,
        userId: notification.userId,
        kind: ctx.kind,
      }

      // Initialize channel array if it doesn't exist
      if (!jobsByChannel.has(channel.channel)) {
        jobsByChannel.set(channel.channel, [])
      }
      jobsByChannel.get(channel.channel)?.push(job)
    }
  }

  // Batch insert all delivery records in a single query
  if (deliveriesToCreate.length > 0) {
    yield* intoDbResult(
      ctx.db.insert(TABLE.notificationDeliveries).values(deliveriesToCreate),
    )
  }

  // Chunk queue jobs into batches of 95 to stay under Cloudflare's limit
  // Cloudflare queue limit is 100, but we use 95 to leave buffer room
  // This prevents hitting the limit if there are any other concurrent operations
  const QUEUE_BATCH_SIZE = 95

  // Track queue job counts by channel for the return value
  const queueJobCounts: Record<string, number> = {}

  // Process each channel's jobs and send them in batches
  for (const [channel, jobs] of jobsByChannel.entries()) {
    const queueBinding = getQueueForChannel(channel)
    if (!queueBinding) {
      logger.warn('No queue mapping found for channel, skipping', {
        channel,
      })
      continue
    }

    // Get the queue from env using the binding name
    const queue = ctx.env[queueBinding] as Queue<BaseDeliveryJob>

    // Chunk jobs for this channel
    const batches = chunk(jobs, QUEUE_BATCH_SIZE)

    // Send each batch
    for (const batch of batches) {
      // sendBatch expects an array of { body: job } objects
      await queue.sendBatch(batch.map((job) => ({ body: job })))
      logger.info('Delivery jobs queued', {
        channel,
        count: batch.length,
        totalQueued: jobs.length,
      })
    }

    queueJobCounts[channel] = jobs.length
  }

  logger.info('Batch notifications created', {
    notificationCount: notificationsWithIds.length,
    deliveryCount: deliveriesToCreate.length,
    queueJobCounts,
  })

  // Return summary instead of full notification data
  return ok({
    notificationCount: notificationsWithIds.length,
    deliveryCount: deliveriesToCreate.length,
    queueJobCounts,
    notificationsWithIds,
  })
})
