import { UserNotificationSettingsSchema } from '@ens-apps/shared-schema/notifications'
import { vValidator } from '@hono/valibot-validator'
import { and, eq } from 'drizzle-orm'
import * as v from 'valibot'
import { requireAuth } from '#app/middleware/auth.js'
import { injectDb } from '#app/middleware/database.js'
import { createApp } from '#app/middleware/hono.js'
import { TABLE } from '#core/database/index.js'
import { logger } from '#utils/logger.js'

/**
 * Notification preferences routes for managing user notification settings.
 *
 * This module handles:
 * - Getting user preferences with defaults
 * - Updating individual preference toggles
 * - Batch updating multiple preferences
 */
export default createApp()
  .basePath('/preferences')
  /**
   * GET /preferences
   *
   * Returns the user's notification settings (3 toggles).
   */
  .get('/', ...requireAuth, injectDb, async (c) => {
    const userId = c.var.user_id

    // Get user's verified channels
    const channels = await c.var.db.query.userChannels.findMany({
      where: and(
        eq(TABLE.userChannels.user_id, userId),
        eq(TABLE.userChannels.status, 'verified'),
      ),
      columns: {
        channel: true,
      },
    })

    const verifiedChannels = channels.map((c) => c.channel)

    const row = await c.var.db.query.userNotificationSettings.findFirst({
      where: eq(TABLE.userNotificationSettings.user_id, userId),
    })

    const settings = {
      ownedNameExpiry: row?.owned_name_expiry ?? false,
      favouritedNameExpiry: row?.favourited_name_expiry ?? false,
      ensLabsUpdates: row?.ens_labs_updates ?? false,
    }

    return c.json({
      settings,
      verifiedChannels,
    })
  })
  /**
   * PATCH /preferences
   *
   * Updates the user's notification settings (partial).
   */
  .patch(
    '/',
    ...requireAuth,
    injectDb,
    vValidator('json', v.partial(UserNotificationSettingsSchema)),
    async (c) => {
      const userId = c.var.user_id
      const patch = c.req.valid('json')

      const row = await c.var.db
        .insert(TABLE.userNotificationSettings)
        .values({
          user_id: userId,
          owned_name_expiry: patch.ownedNameExpiry ?? false,
          favourited_name_expiry: patch.favouritedNameExpiry ?? false,
          ens_labs_updates: patch.ensLabsUpdates ?? false,
          updated_at: new Date(),
        })
        .onConflictDoUpdate({
          target: TABLE.userNotificationSettings.user_id,
          set: {
            ...(patch.ownedNameExpiry === undefined
              ? {}
              : { owned_name_expiry: patch.ownedNameExpiry }),
            ...(patch.favouritedNameExpiry === undefined
              ? {}
              : { favourited_name_expiry: patch.favouritedNameExpiry }),
            ...(patch.ensLabsUpdates === undefined
              ? {}
              : { ens_labs_updates: patch.ensLabsUpdates }),
            updated_at: new Date(),
          },
        })
        .returning()
        .then((result) => result[0])

      if (!row) {
        return c.json({ error: 'Failed to update notification settings' }, 500)
      }

      // TODO: If ensLabsUpdates changes, sync SendGrid marketing list (handled in separate PR).

      logger.info('Notification settings updated', {
        userId,
        changedFields: Object.keys(patch),
      })
      logger.trace('Notification settings row updated', {
        userId,
        rowUserId: row.user_id,
      })

      return c.json({
        settings: {
          ownedNameExpiry: row.owned_name_expiry,
          favouritedNameExpiry: row.favourited_name_expiry,
          ensLabsUpdates: row.ens_labs_updates,
        },
      })
    },
  )
