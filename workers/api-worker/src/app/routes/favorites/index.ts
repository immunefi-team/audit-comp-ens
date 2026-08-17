import { and, eq } from 'drizzle-orm'
import { requireAuth } from '#app/middleware/auth.js'
import { injectDb } from '#app/middleware/database.js'
import { createApp } from '#app/middleware/hono.js'
import { schema } from '#core/database/index.js'
import { logger } from '#utils/logger.js'

export default createApp()
  .basePath('/favorites')
  .get('/', ...requireAuth, injectDb, async (c) => {
    const favorites = await c.var.db.query.favorites.findMany({
      where: eq(schema.favorites.user_id, c.var.user_id),
      columns: {
        name: true,
        created_at: true,
      },
    })

    return c.json(favorites)
  })
  .put('/:name', ...requireAuth, injectDb, async (c) => {
    const { name } = c.req.param()
    const { user_id } = c.var

    logger.debug('Adding favorite', { name, user_id })

    await c.var.db
      .insert(schema.favorites)
      .values({
        name,
        user_id,
      })
      .onConflictDoNothing()

    return c.json({ message: 'Favorite added' }, 200)
  })

  .delete('/:name', ...requireAuth, injectDb, async (c) => {
    const { name } = c.req.param()
    const { user_id } = c.var

    logger.debug('Deleting favorite', { name, user_id })

    const result = await c.var.db
      .delete(schema.favorites)
      .where(
        and(
          eq(schema.favorites.name, name),
          eq(schema.favorites.user_id, user_id),
        ),
      )

    if (result.rowCount === 0) {
      return c.json({ message: 'Favorite not found' }, 404)
    }

    return c.json({ message: 'Favorite deleted' }, 200)
  })
