import { TaggedError } from '@ens-apps/utils/neverthrow'
import { getAvailable } from '@ensdomains/ensjs/public/v2'
import { count, eq } from 'drizzle-orm'
import { fromPromise } from 'neverthrow'
import { injectDb } from '#app/middleware/database.js'
import { injectEthClient } from '#app/middleware/eth.js'
import { createApp } from '#app/middleware/hono.js'
import { intoDbResult, schema } from '#core/database/index.js'
import { getUniqueSearchesLast30dFromPostHog } from '#services/posthog/name-search-stats.js'
import { logger } from '#utils/logger.js'

const MAX_NAME_LENGTH = 255
const INVALID_ASCII_CHARS = /[&*@#$%^()[\]{}|\\:;"'<>?,=+~`!]/

class NameStatsRouteError extends TaggedError('NAME_STATS_ROUTE_ERROR')<{
  cause: unknown
}> {}

const isValidName = (name: string): boolean => {
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
    return false
  }

  if (!name.endsWith('.eth') || name.includes(' ') || name.includes('..')) {
    return false
  }

  const label = name.slice(0, -4)

  if (label.length === 0 || label.includes('.')) {
    return false
  }

  if ([...label].length < 3 || INVALID_ASCII_CHARS.test(label)) {
    return false
  }

  return true
}

export default createApp()
  .basePath('/names')
  .get('/:name/stats', injectDb, injectEthClient, async (c) => {
    const { name: requestedName } = c.req.param()
    const name = requestedName.trim().toLowerCase()

    if (!isValidName(name)) {
      return c.json({ error: 'Invalid name' }, 400)
    }

    const availabilityResult = await fromPromise(
      getAvailable(c.var.ethClient, { name }),
      (cause) => new NameStatsRouteError({ cause }),
    )

    if (availabilityResult.isErr()) {
      logger.error('Failed to check name availability for stats', {
        error: availabilityResult.error,
        name,
      })
      return c.json({ error: 'Failed to fetch name stats' }, 500)
    }

    if (!availabilityResult.value) {
      return c.json(
        { error: 'Name stats are only available for unregistered names' },
        404,
      )
    }

    const [favoriteCountResult, uniqueSearchesResult] = await Promise.all([
      intoDbResult(
        c.var.db
          .select({ value: count() })
          .from(schema.favorites)
          .where(eq(schema.favorites.name, name)),
      ),
      getUniqueSearchesLast30dFromPostHog(c.env, name),
    ])

    if (favoriteCountResult.isErr()) {
      logger.error('Failed to fetch favorite count for name stats', {
        error: favoriteCountResult.error,
        name,
      })
      return c.json({ error: 'Failed to fetch name stats' }, 500)
    }

    return c.json({
      name,
      favorites: favoriteCountResult.value[0]?.value ?? 0,
      unique_searches_last_30d: uniqueSearchesResult.unwrapOr(0),
    })
  })
