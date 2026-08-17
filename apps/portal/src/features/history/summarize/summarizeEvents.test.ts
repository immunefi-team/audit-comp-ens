import type { Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import type { TimelineIndexerEvent } from '../hooks/useNameHistoryTimeline'
import { summarizeEvents } from './summarizeEvents'

const ZERO = '0x0000000000000000000000000000000000000000'
const OWNER = '0x1111111111111111111111111111111111111111'

const event = (
  type: string,
  id: string,
  extra: Partial<TimelineIndexerEvent> = {},
): TimelineIndexerEvent =>
  ({
    id,
    type,
    name: 'alice.eth',
    transactionHash: '0xabc' as Hex,
    blockNumber: 1,
    timestamp: 1_700_000_000,
    ...extra,
  }) as TimelineIndexerEvent

const records = [
  event('AddressChanged', 'r1', {
    asAddressChanged: { address: OWNER, coinType: 60 },
  }),
  event('TextChanged', 'r2', { asTextChanged: { key: 'avatar', value: 'x' } }),
  event('TextChanged', 'r3', { asTextChanged: { key: 'url', value: 'y' } }),
]

describe('summarizeEvents — records recipe vs structural events', () => {
  it('headlines a v2 register-and-seed-records transaction as the register', () => {
    const [action] = summarizeEvents([
      event('NameRegistered', '1', { asNameRegistered: { name: 'alice.eth' } }),
      event('Transfer', '2', { asTransfer: { from: ZERO, to: OWNER } }),
      ...records,
    ])

    expect(action.label).toBe('Register name')
    // The records are still on the action; only the headline changed.
    expect(action.events).toHaveLength(5)
  })

  it('still headlines a resolver change plus records as the records', () => {
    const [action] = summarizeEvents([
      event('ResolverUpdated', '1', { asResolverUpdated: { resolver: OWNER } }),
      ...records,
    ])

    expect(action.label).toBe('Set 3 records')
  })

  it('does not let a mint Transfer — which describes as nothing — swallow the recipe', () => {
    const [action] = summarizeEvents([
      event('Transfer', '1', { asTransfer: { from: ZERO, to: OWNER } }),
      ...records,
    ])

    expect(action.label).toBe('Set 3 records')
  })

  it('lets a real Transfer headline over the records', () => {
    const [action] = summarizeEvents([
      event('Transfer', '1', { asTransfer: { from: OWNER, to: ZERO } }),
      ...records,
    ])

    expect(action.label).toBe('Transfer name')
  })
})
