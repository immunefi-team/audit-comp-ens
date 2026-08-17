import { relations } from 'drizzle-orm'
import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { randomUUIDv7 } from '../utils/schemaHelpers'
import { favorites } from './favorites'
import { notifications, userChannels } from './notifications'
import { transactions } from './transactions'

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().default(randomUUIDv7),
    address: text('address').notNull().unique(),
  },
  (table) => [index('users_address_index').on(table.address)],
)

export const usersRelations = relations(users, ({ many }) => ({
  favorites: many(favorites),
  notifications: many(notifications),
  userChannels: many(userChannels),
  transactions: many(transactions),
}))
