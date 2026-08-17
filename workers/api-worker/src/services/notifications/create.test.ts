import { beforeEach, describe, expect, it, vi } from 'vitest'

const schemaMocks = vi.hoisted(() => ({
  definitionPatches: {} as Record<string, Record<string, unknown>>,
  actualDefinitions: null as
    | typeof import('@ens-apps/shared-schema/notifications').notificationDefinitions
    | null,
}))

vi.mock('@ens-apps/shared-schema/notifications', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@ens-apps/shared-schema/notifications')
    >()
  schemaMocks.actualDefinitions = actual.notificationDefinitions

  return {
    ...actual,
    get notificationDefinitions() {
      const base =
        schemaMocks.actualDefinitions ?? actual.notificationDefinitions

      return Object.fromEntries(
        Object.entries(base).map(([kind, definition]) => [
          kind,
          {
            ...definition,
            ...schemaMocks.definitionPatches[kind],
          },
        ]),
      ) as typeof actual.notificationDefinitions
    },
  }
})

import { shouldCreateExternalDeliveriesForNotification } from './create'

describe('shouldCreateExternalDeliveriesForNotification', () => {
  beforeEach(() => {
    schemaMocks.definitionPatches = {}
  })

  it('gates name-expiry delivery by watch reason and preference toggles', () => {
    const payload = {
      name: 'example.eth',
      expiryDate: Date.now(),
      isOwner: true,
      watchReason: 'owned' as const,
    }

    expect(
      shouldCreateExternalDeliveriesForNotification('name-expiry', payload, {
        owned_name_expiry: true,
        favourited_name_expiry: false,
        ens_labs_updates: false,
      }),
    ).toBe(true)

    expect(
      shouldCreateExternalDeliveriesForNotification('name-expiry', payload, {
        owned_name_expiry: false,
        favourited_name_expiry: false,
        ens_labs_updates: false,
      }),
    ).toBe(false)
  })

  it('does not create external deliveries for delivery.mode=none kinds', () => {
    schemaMocks.definitionPatches['name-transferred'] = {
      delivery: { mode: 'none' },
    }

    expect(
      shouldCreateExternalDeliveriesForNotification(
        'name-transferred',
        {
          name: 'example.eth',
          txHash: '0xabc',
          to: '0x1234',
        },
        {
          owned_name_expiry: true,
          favourited_name_expiry: true,
          ens_labs_updates: true,
        },
      ),
    ).toBe(false)
  })
})
