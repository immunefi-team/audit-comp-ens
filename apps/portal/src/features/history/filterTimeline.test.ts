import type { Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import { filterActions } from './filterTimeline'
import type { TimelineIndexerEvent } from './hooks/useNameHistoryTimeline'
import type { Action } from './summarize/summarize.types'

const event = (
  type: string,
  id: string,
  extra: Partial<TimelineIndexerEvent> = {},
): TimelineIndexerEvent =>
  ({
    id,
    type,
    transactionHash: '0xabc' as Hex,
    blockNumber: 1,
    timestamp: 1_700_000_000,
    ...extra,
  }) as TimelineIndexerEvent

const action = (events: TimelineIndexerEvent[]): Action => ({
  txHash: '0xabc' as Hex,
  icon: 'default',
  label: 'Test',
  slots: [],
  timestamp: 1_700_000_000,
  events,
})

describe('filterActions', () => {
  it('keeps the whole matching action without narrowing its events', () => {
    const registerAction: Action = {
      ...action([
        event('NameRegistered', '1', {
          name: 'alice.eth',
          asNameRegistered: { name: 'alice.eth' },
        }),
        event('Transfer', '2', {
          name: 'alice.eth',
          asTransfer: {
            from: '0x1111111111111111111111111111111111111111',
            to: '0x2222222222222222222222222222222222222222',
          },
        }),
        event('EACRolesChanged', '3'),
      ]),
      label: 'Register name',
    }
    const filtered = filterActions([registerAction], {}, ['Transfer'])
    expect(filtered).toHaveLength(1)
    // The filter only selects which transactions appear — it must not narrow
    // events or relabel. The full action is preserved (same reference).
    expect(filtered[0]).toBe(registerAction)
    expect(filtered[0].events.map((e) => e.type)).toEqual([
      'NameRegistered',
      'Transfer',
      'EACRolesChanged',
    ])
    expect(filtered[0].label).toBe('Register name')
  })

  it('drops actions with no matching event types', () => {
    const filtered = filterActions(
      [action([event('NameRegistered', '1')])],
      {},
      ['Transfer'],
    )
    expect(filtered).toEqual([])
  })
})
