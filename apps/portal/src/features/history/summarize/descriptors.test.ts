import { describe, expect, it } from 'vitest'
import type { TimelineIndexerEvent } from '../hooks/useNameHistoryTimeline'
import { DESCRIPTORS, humanizeType } from './descriptors'

describe('humanizeType', () => {
  it('sentence-cases camel-cased event types', () => {
    expect(humanizeType('NameRegistered')).toBe('Name registered')
    expect(humanizeType('SubregistryUpdated')).toBe('Subregistry updated')
    expect(humanizeType('AddrChanged')).toBe('Addr changed')
  })

  it('preserves acronyms', () => {
    expect(humanizeType('EACRolesChanged')).toBe('EAC roles changed')
  })
})

describe('Figma history labels', () => {
  const base = {
    id: '1',
    transactionHash: '0xabc',
    blockNumber: 1,
    timestamp: 1,
    name: 'collector.eth',
  } as const

  it('AddressChanged stays Set address to', () => {
    const built = DESCRIPTORS.AddressChanged.build({
      ...base,
      type: 'AddressChanged',
      asAddressChanged: {
        address: '0x801d2e48d378f161dba7ad7ad002ad557714c191',
        coinType: 60,
      },
    } as TimelineIndexerEvent)
    expect(built).toMatchObject({
      label: 'Set address to',
      slots: [
        {
          kind: 'address',
          value: '0x801d2e48d378f161dba7ad7ad002ad557714c191',
        },
      ],
    })
  })

  it('NameRegistered is Register name by the tx sender', () => {
    const built = DESCRIPTORS.NameRegistered.build({
      ...base,
      type: 'NameRegistered',
      asNameRegistered: {
        name: 'collector.eth',
        owner: '0xowner000000000000000000000000000000000001',
      },
    } as TimelineIndexerEvent)
    expect(built).toEqual({
      label: 'Register name',
      slots: [
        { kind: 'name', value: 'collector.eth' },
        { kind: 'connective', value: 'by' },
        { kind: 'actor', txHash: '0xabc' },
      ],
    })
  })

  it('ResolverUpdated includes a resolver contract badge', () => {
    const built = DESCRIPTORS.ResolverUpdated.build({
      ...base,
      type: 'ResolverUpdated',
      asResolverUpdated: {
        resolver: '0xb88b00000000000000000000000000000000Fa98',
      },
    } as TimelineIndexerEvent)
    expect(built).toEqual({
      label: 'Update resolver',
      slots: [
        {
          kind: 'contract',
          value: '0xb88b00000000000000000000000000000000Fa98',
          label: 'resolver',
        },
      ],
    })
  })

  it('SubregistryUpdated marks the contract slot as a registry', () => {
    const built = DESCRIPTORS.SubregistryUpdated.build({
      ...base,
      type: 'SubregistryUpdated',
      data: JSON.stringify({
        registry: '0x541C00000000000000000000000000000000976F',
      }),
    } as TimelineIndexerEvent)
    expect(built).toEqual({
      label: 'Deploy and link subregistry',
      slots: [
        {
          kind: 'contract',
          value: '0x541C00000000000000000000000000000000976F',
          isRegistry: true,
        },
      ],
    })
  })
})
