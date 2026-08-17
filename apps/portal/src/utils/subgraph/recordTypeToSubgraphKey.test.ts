import { describe, expect, it } from 'vitest'
import { recordTypeToSubgraphKey } from './recordTypeToSubgraphKey'

describe('recordTypeToSubgraphKey', () => {
  it('should map record types to subgraph keys', () => {
    expect(recordTypeToSubgraphKey('address')).toBe('coins')
    expect(recordTypeToSubgraphKey('text')).toBe('texts')
    expect(recordTypeToSubgraphKey('contentHash')).toBe('contentHash')
    expect(recordTypeToSubgraphKey('abi')).toBe('abi')
  })
})
