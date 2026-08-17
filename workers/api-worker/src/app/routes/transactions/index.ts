import { UpsertTransactionSchema } from '@ens-apps/shared-schema/transactions'
import { vValidator } from '@hono/valibot-validator'
import { desc, eq } from 'drizzle-orm'
import { requireAuth } from '#app/middleware/auth.js'
import { injectDb } from '#app/middleware/database.js'
import { createApp } from '#app/middleware/hono.js'
import { TABLE } from '#core/database/index.js'
import { logger } from '#utils/logger.js'

/**
 * Per-user transaction history routes.
 *
 * - GET  /transactions  -> the authenticated user's records, newest first
 * - POST /transactions  -> upsert a record keyed by (user_id, tx_id), so the
 *   transaction manager can report a transaction and then update its status
 *   (e.g. pending -> success) without creating duplicates.
 */
export default createApp()
  .basePath('/transactions')
  .get('/', ...requireAuth, injectDb, async (c) => {
    const transactions = await c.var.db.query.transactions.findMany({
      where: eq(TABLE.transactions.user_id, c.var.user_id),
      orderBy: [desc(TABLE.transactions.created_at)],
    })

    return c.json({ transactions })
  })
  .post(
    '/',
    ...requireAuth,
    injectDb,
    vValidator('json', UpsertTransactionSchema),
    async (c) => {
      const { user_id } = c.var
      const body = c.req.valid('json')

      const row = await c.var.db
        .insert(TABLE.transactions)
        .values({
          user_id,
          tx_id: body.txId,
          chain_id: body.chainId,
          hash: body.hash ?? null,
          status: body.status,
          operation: body.operation ?? null,
          name: body.name ?? null,
          payload: body.payload ?? null,
          updated_at: new Date(),
        })
        .onConflictDoUpdate({
          target: [TABLE.transactions.user_id, TABLE.transactions.tx_id],
          set: {
            // A hash is monotonic: once known it must not be nulled by a
            // later status-only report, so only overwrite when one is given.
            ...(body.hash == null ? {} : { hash: body.hash }),
            status: body.status,
            ...(body.operation === undefined
              ? {}
              : { operation: body.operation ?? null }),
            ...(body.name === undefined ? {} : { name: body.name ?? null }),
            ...(body.payload === undefined
              ? {}
              : { payload: body.payload ?? null }),
            updated_at: new Date(),
          },
        })
        .returning()
        .then((result) => result[0])

      if (!row) {
        return c.json({ error: 'Failed to save transaction' }, 500)
      }

      logger.info('Transaction history upserted', {
        userId: user_id,
        txId: body.txId,
        status: body.status,
      })

      return c.json({ transaction: row })
    },
  )
