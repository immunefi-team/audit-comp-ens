import type { GetRecordsReturnType } from '@ensdomains/ensjs/public'
import { describe, expect, it } from 'vitest'
import { recordsToTableData } from './recordsToTableData'

const MOCK_RESOLVER = '0x0000000000000000000000000000000000000000' as const

describe('recordsToTableData', () => {
  it('should return empty array for empty records', () => {
    const records: GetRecordsReturnType = {
      texts: [],
      coins: [],
      contentHash: null,
      abi: null,
      resolverAddress: '0x0000000000000000000000000000000000000000',
    }

    expect(recordsToTableData(records)).toEqual([])
  })

  it('should transform contentHash into table data', () => {
    const records: GetRecordsReturnType = {
      texts: [],
      coins: [],
      contentHash: {
        protocolType: 'ipfs',
        decoded: 'QmTest123',
      },
      abi: null,
      resolverAddress: MOCK_RESOLVER,
    }

    const result = recordsToTableData(records)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      type: 'contentHash',
      value: 'ipfs://QmTest123',
    })
  })

  it('should transform text and coin records into table data', () => {
    const records: GetRecordsReturnType = {
      texts: [
        { key: 'email', value: 'test@example.com' },
        { key: 'url', value: 'https://example.com' },
      ],
      coins: [
        { coinType: 60, value: '0x1234...', symbol: 'ETH' },
        { coinType: 0, value: 'bc1q...', symbol: 'BTC' },
      ],
      contentHash: null,
      abi: null,
      resolverAddress: MOCK_RESOLVER,
    }

    const result = recordsToTableData(records)

    expect(result).toHaveLength(4)
    expect(result).toContainEqual({
      key: 'email',
      value: 'test@example.com',
      type: 'text',
    })
    expect(result).toContainEqual({
      key: 'url',
      value: 'https://example.com',
      type: 'text',
    })
    expect(result).toContainEqual({
      key: 'ETH',
      value: '0x1234...',
      type: 'address',
      id: 60,
    })
    expect(result).toContainEqual({
      key: 'BTC',
      value: 'bc1q...',
      type: 'address',
      id: 0,
    })
  })

  it('should handle all record types together', () => {
    const records: GetRecordsReturnType = {
      texts: [{ key: 'email', value: 'test@example.com' }],
      coins: [{ coinType: 60, value: '0x1234...', symbol: 'ETH' }],
      contentHash: {
        protocolType: 'ipfs',
        decoded: 'QmTest123',
      },
      abi: null,
      resolverAddress: MOCK_RESOLVER,
    }

    const result = recordsToTableData(records)

    expect(result).toHaveLength(3)
    expect(result).toContainEqual({
      type: 'contentHash',
      value: 'ipfs://QmTest123',
    })
    expect(result).toContainEqual({
      key: 'email',
      value: 'test@example.com',
      type: 'text',
    })
    expect(result).toContainEqual({
      key: 'ETH',
      value: '0x1234...',
      type: 'address',
      id: 60,
    })
  })

  it('should handle multiple contentHash protocol types', () => {
    const ipfsRecord: GetRecordsReturnType = {
      texts: [],
      coins: [],
      contentHash: { protocolType: 'ipfs', decoded: 'QmHash' },
      abi: null,
      resolverAddress: MOCK_RESOLVER,
    }

    const ipnsRecord: GetRecordsReturnType = {
      texts: [],
      coins: [],
      contentHash: { protocolType: 'ipns', decoded: 'k51qzi5uqu5...' },
      abi: null,
      resolverAddress: MOCK_RESOLVER,
    }

    expect(recordsToTableData(ipfsRecord)[0].value).toBe('ipfs://QmHash')
    expect(recordsToTableData(ipnsRecord)[0].value).toBe(
      'ipns://k51qzi5uqu5...',
    )
  })

  it('should preserve text record order', () => {
    const records: GetRecordsReturnType = {
      texts: [
        { key: 'first', value: 'value1' },
        { key: 'second', value: 'value2' },
        { key: 'third', value: 'value3' },
      ],
      coins: [],
      contentHash: null,
      abi: null,
      resolverAddress: MOCK_RESOLVER,
    }

    const result = recordsToTableData(records)

    expect(result[0]).toMatchObject({ key: 'first', type: 'text' })
    expect(result[1]).toMatchObject({ key: 'second', type: 'text' })
    expect(result[2]).toMatchObject({ key: 'third', type: 'text' })
  })

  it('should preserve coin record order', () => {
    const records: GetRecordsReturnType = {
      texts: [],
      coins: [
        { coinType: 60, value: 'eth-addr', symbol: 'ETH' },
        { coinType: 0, value: 'btc-addr', symbol: 'BTC' },
        { coinType: 714, value: 'bnb-addr', symbol: 'BNB' },
      ],
      contentHash: null,
      abi: null,
      resolverAddress: MOCK_RESOLVER,
    }

    const result = recordsToTableData(records)

    expect(result[0]).toMatchObject({ key: 'ETH', type: 'address' })
    expect(result[1]).toMatchObject({ key: 'BTC', type: 'address' })
    expect(result[2]).toMatchObject({ key: 'BNB', type: 'address' })
  })

  it('should transform ABI record with object into table data', () => {
    const records: GetRecordsReturnType = {
      texts: [],
      coins: [],
      contentHash: null,
      abi: {
        contentType: 1,
        decoded: true,
        abi: { name: 'test', type: 'function', inputs: [] },
      },
      resolverAddress: MOCK_RESOLVER,
    }

    const result = recordsToTableData(records)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      type: 'abi',
      value: '{"name":"test","type":"function","inputs":[]}',
    })
  })

  it('should transform ABI record with string into table data', () => {
    const records: GetRecordsReturnType = {
      texts: [],
      coins: [],
      contentHash: null,
      abi: {
        contentType: 1,
        decoded: true,
        abi: '[{"name":"test"}]',
      },
      resolverAddress: MOCK_RESOLVER,
    }

    const result = recordsToTableData(records)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      type: 'abi',
      value: '[{"name":"test"}]',
    })
  })

  it('should handle null ABI record', () => {
    const records: GetRecordsReturnType = {
      texts: [],
      coins: [],
      contentHash: null,
      abi: null,
      resolverAddress: MOCK_RESOLVER,
    }

    const result = recordsToTableData(records)

    expect(result).toHaveLength(0)
  })
})
