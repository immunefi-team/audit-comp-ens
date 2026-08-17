import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import * as sharedSchema from '../index'
import {
  channelDefinitions,
  notificationDefinitions,
  TelegramAuthSchema,
} from '../index'

describe('notifications catalog', () => {
  it('exposes all required fields for every notification kind', () => {
    for (const [kind, definition] of Object.entries(notificationDefinitions)) {
      expect(definition.kind).toBe(kind)
      expect(definition.payloadSchema).toBeDefined()
      expect(definition.metadata).toBeDefined()
      expect(definition.delivery).toBeDefined()
      expect(definition.source).toMatch(/^(personal|broadcast)$/)
    }
  })

  it('defines minimal channel metadata for all supported channel types', () => {
    expect(Object.keys(channelDefinitions).sort()).toEqual([
      'email',
      'push',
      'telegram',
    ])
    expect(channelDefinitions.email.requiresVerification).toBe(true)
    expect(channelDefinitions.telegram.label).toBe('Telegram')
  })

  it('partitions kinds into personal and broadcast by source', () => {
    const definitions = Object.values(notificationDefinitions)
    const personal = definitions.filter((d) => d.source === 'personal')
    const broadcast = definitions.filter((d) => d.source === 'broadcast')

    expect(personal.length + broadcast.length).toBe(definitions.length)
    expect(personal.length).toBeGreaterThan(0)
    expect(broadcast.length).toBeGreaterThan(0)
  })

  it('exposes canonical notification exports only', () => {
    expect('NotificationKind' in sharedSchema).toBe(false)
    expect('BroadcastKind' in sharedSchema).toBe(false)
    expect('Broadcasts' in sharedSchema).toBe(false)
    expect('UserNotifications' in sharedSchema).toBe(false)
    expect('AnyUserNotificationPayload' in sharedSchema).toBe(false)
    expect('AnyBroadcastPayload' in sharedSchema).toBe(false)
  })
})

describe('telegram auth schema', () => {
  it('parses valid auth payload', () => {
    const parsed = v.safeParse(TelegramAuthSchema, {
      id: 1,
      username: 'ens_user',
      auth_date: 1_700_000_000,
      hash: 'abc123',
    })

    expect(parsed.success).toBe(true)
  })
})
