import type {
  TransactionOperation,
  TransactionStatus,
} from '@ens-apps/shared-schema/transactions'
import { relations } from 'drizzle-orm'
import {
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './core'

/**
 * Stored payload shape. Structurally a `Record<string, unknown>` (matching the
 * shared `TransactionPayloadSchema` wire type) with the common display fields
 * named for convenience at the DB layer.
 */
export interface TransactionPayload {
  to?: string
  value?: string
  error?: string
  [key: string]: unknown
}

/**
 * Per-user transaction history.
 *
 * One row per on-chain transaction the user initiated through an ENS app.
 * Reported by the transaction manager as a transaction moves to a terminal
 * state, and upserted idempotently on (user_id, tx_id) so repeat reports
 * (e.g. pending -> success) update the existing row rather than duplicating.
 */
export const transactions = pgTable(
  'transactions',
  {
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
      }),
    /** Client-generated transaction id (idempotency key, unique per user) */
    tx_id: text('tx_id').notNull(),
    chain_id: integer('chain_id').notNull(),
    /** On-chain transaction hash; set once the transaction is submitted */
    hash: text('hash'),
    status: text('status').$type<TransactionStatus>().notNull(),
    /** Operation kind, for display */
    operation: text('operation').$type<TransactionOperation>(),
    /** ENS name involved, for display */
    name: text('name'),
    /** Small summary: { to, value, error, ... } */
    payload: jsonb('payload').$type<TransactionPayload>(),
    created_at: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Composite PK: one row per (user, client-generated tx id), which is also
    // the upsert idempotency key — no surrogate id or separate unique needed.
    primaryKey({ columns: [table.user_id, table.tx_id] }),
  ],
)

export const transactionRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.user_id],
    references: [users.id],
  }),
}))
