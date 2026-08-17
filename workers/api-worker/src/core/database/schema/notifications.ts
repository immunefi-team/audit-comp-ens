import type {
  AnyBroadcastNotificationPayload,
  AnyChannelData,
  AnyPersonalNotificationPayload,
  BroadcastNotificationKind,
  ChannelType,
  PersonalNotificationKind,
} from '@ens-apps/shared-schema/notifications'
import { relations } from 'drizzle-orm'
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import type { FailureCategory } from '#types/delivery.js'
import { randomUUIDv7 } from '../utils/schemaHelpers'
import { users } from './core'

type UserChannelStatus = 'pending' | 'verified' | 'bounced' | 'unsubscribed'

export const userChannels = pgTable(
  'user_channels',
  {
    id: uuid('id').primaryKey().default(randomUUIDv7),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
      }),
    /**
     * Which medium (email, push, telegram)
     */
    channel: text('channel').$type<ChannelType>().notNull(),
    /**
     * The actual identifier (email address, FCM endpoint, etc)
     */
    target: text('target'),

    data: jsonb('data').$type<AnyChannelData>(),
    /**
     * When the channel was verified
     */
    verified_at: timestamp('verified_at', { withTimezone: true }),
    /**
     * The status of the channel, tracks lifecycle beyond verification
     */
    status: text('status').$type<UserChannelStatus>().notNull(),
    /**
     * Why a channel is in its current status
     */
    status_reason: text('status_reason'),
    /**
     * When the channel was last sent
     */
    last_sent_at: timestamp('last_sent_at', { withTimezone: true }),
    /**
     * When the channel was last bounced
     */
    last_bounce_at: timestamp('last_bounce_at', { withTimezone: true }),

    // ⏱️ anti‑spam: track verification sends/attempts
    last_verification_sent_at: timestamp('last_verification_sent_at', {
      withTimezone: true,
    }),
    verification_attempts: integer('verification_attempts').default(0),
  },
  (table) => [
    unique('user_channel_unique').on(
      table.user_id,
      table.channel,
      table.target,
    ),
  ],
)

export const userChannelRelations = relations(
  userChannels,
  ({ one, many }) => ({
    user: one(users, {
      fields: [userChannels.user_id],
      references: [users.id],
    }),
    verifications: many(channelVerifications),
  }),
)

// ===============================

export const channelVerifications = pgTable('channel_verifications', {
  id: uuid('id').primaryKey().default(randomUUIDv7),

  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  channel_id: uuid('channel_id')
    .references(() => userChannels.id, {
      onDelete: 'cascade',
    })
    .notNull(),

  channel: text('channel').$type<ChannelType>().notNull(),
  target: text('target'), // email during email verification, null for Telegram until bot callback

  purpose: text('purpose').notNull(), // 'verify' | 'unsubscribe' | 'link'

  token: text('token').notNull(),

  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumed_at: timestamp('consumed_at', { withTimezone: true }),

  attempts: integer('attempts').default(0),
})

export const channelVerificationRelations = relations(
  channelVerifications,
  ({ one }) => ({
    user: one(users, {
      fields: [channelVerifications.user_id],
      references: [users.id],
    }),
    channel: one(userChannels, {
      fields: [channelVerifications.channel_id],
      references: [userChannels.id],
    }),
  }),
)

// ===============================

export const userNotificationSettings = pgTable('user_notification_settings', {
  user_id: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),

  owned_name_expiry: boolean('owned_name_expiry').notNull().default(false),
  favourited_name_expiry: boolean('favourited_name_expiry')
    .notNull()
    .default(false),
  ens_labs_updates: boolean('ens_labs_updates').notNull().default(false),

  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const userNotificationSettingsRelations = relations(
  userNotificationSettings,
  ({ one }) => ({
    user: one(users, {
      fields: [userNotificationSettings.user_id],
      references: [users.id],
    }),
  }),
)

// ===============================

export const notifications = pgTable('notifications', {
  /**
   * Notification ID
   */
  id: uuid('id').primaryKey().default(randomUUIDv7),
  /**
   * User wallet address
   */
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, {
      onDelete: 'cascade',
    }),
  /**
   * Notification kind
   */
  kind: text('kind').$type<PersonalNotificationKind>().notNull(),
  /**
   * Payload
   */
  payload: jsonb('payload').$type<AnyPersonalNotificationPayload>(),
  created_at: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  read_at: timestamp('read_at', { withTimezone: true }),
  archived_at: timestamp('archived_at', { withTimezone: true }),
  idempotency_key: text('idempotency_key').unique().notNull(),
})

export const notificationRelations = relations(
  notifications,
  ({ one, many }) => ({
    user: one(users, {
      fields: [notifications.user_id],
      references: [users.id],
    }),
    deliveries: many(notificationDeliveries),
  }),
)

// ===============================

type DeliveryChannel = 'email' | 'push' | 'telegram'
type DeliveryStatus = 'queued' | 'delivered' | 'failed' | 'permanently_failed'

export const notificationDeliveries = pgTable('notification_deliveries', {
  id: uuid('id').primaryKey().default(randomUUIDv7),
  notification_id: uuid('notification_id')
    .notNull()
    .references(() => notifications.id, {
      onDelete: 'cascade',
    }),
  channel: text('channel').$type<DeliveryChannel>().notNull(),
  target: text('target').notNull(),
  status: text('status').$type<DeliveryStatus>().notNull(),
  attempts: integer('attempts').default(0),

  provider_msg_id: text('provider_msg_id'),

  error: text('error'),

  failure_category: text('failure_category').$type<FailureCategory>(),
  dlq_attempts: integer('dlq_attempts').default(0),

  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const notificationDeliveryRelations = relations(
  notificationDeliveries,
  ({ one }) => ({
    notification: one(notifications, {
      fields: [notificationDeliveries.notification_id],
      references: [notifications.id],
    }),
  }),
)

// ===============================

export const broadcasts = pgTable('broadcasts', {
  id: uuid('id').primaryKey().default(randomUUIDv7),
  kind: text('kind').$type<BroadcastNotificationKind>().notNull(),
  payload: jsonb('payload').$type<AnyBroadcastNotificationPayload>(),
  created_at: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const broadcastRelations = relations(broadcasts, ({ many }) => ({
  seen: many(broadcastsSeen),
}))

// ===============================

export const broadcastsSeen = pgTable(
  'broadcasts_seen',
  {
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
      }),
    broadcast_id: uuid('broadcast_id')
      .notNull()
      .references(() => broadcasts.id, {
        onDelete: 'cascade',
      }),
    read_at: timestamp('read_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    archived_at: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({
      columns: [table.user_id, table.broadcast_id],
    }),
  ],
)

export const broadcastsSeenRelations = relations(broadcastsSeen, ({ one }) => ({
  broadcast: one(broadcasts, {
    fields: [broadcastsSeen.broadcast_id],
    references: [broadcasts.id],
  }),
  user: one(users, {
    fields: [broadcastsSeen.user_id],
    references: [users.id],
  }),
}))
