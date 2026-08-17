import type { Hash, Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import type { TransactionRequest } from '../types/transaction.types'
import { buildArchivedTransaction } from './transactionManager'

const TIMESTAMP = 1_700_000_000_000
const HASH = '0xabc' as Hash
const FROM = '0x1111111111111111111111111111111111111111' as Hex
const TO = '0x2222222222222222222222222222222222222222' as Hex

const customRequest: TransactionRequest = {
  type: 'eoa',
  from: FROM,
  to: TO,
  data: '0x' as Hex,
  value: 0n,
  chainId: 11155111,
}

describe('buildArchivedTransaction', () => {
  it('passes through the core terminal fields', () => {
    const archived = buildArchivedTransaction({
      txId: 'tx-1',
      chainId: 11155111,
      status: 'success',
      hash: HASH,
      operation: 'set-resolver',
      name: 'leon.eth',
      timestamp: TIMESTAMP,
    })

    expect(archived).toMatchObject({
      txId: 'tx-1',
      chainId: 11155111,
      status: 'success',
      hash: HASH,
      operation: 'set-resolver',
      name: 'leon.eth',
      timestamp: TIMESTAMP,
    })
  })

  it('carries the error message for failed transactions', () => {
    const archived = buildArchivedTransaction({
      txId: 'tx-2',
      status: 'error',
      error: 'reverted',
      timestamp: TIMESTAMP,
    })

    expect(archived.status).toBe('error')
    expect(archived.error).toBe('reverted')
  })

  describe('name fallback', () => {
    it('prefers the caller-supplied option name', () => {
      const archived = buildArchivedTransaction({
        txId: 'tx',
        status: 'success',
        name: 'explicit.eth',
        intent: {
          type: 'ens-renewal',
          name: 'fromintent',
          duration: 1n,
          from: FROM,
        },
        timestamp: TIMESTAMP,
      })

      expect(archived.name).toBe('explicit.eth')
    })

    it('falls back to the intent name for ENS renewals', () => {
      const archived = buildArchivedTransaction({
        txId: 'tx',
        status: 'success',
        intent: {
          type: 'ens-renewal',
          name: 'fromintent',
          duration: 1n,
          from: FROM,
        },
        timestamp: TIMESTAMP,
      })

      expect(archived.name).toBe('fromintent')
    })

    it('is undefined when neither option nor renewal intent supplies one', () => {
      const archived = buildArchivedTransaction({
        txId: 'tx',
        status: 'success',
        intent: { type: 'custom', request: customRequest },
        timestamp: TIMESTAMP,
      })

      expect(archived.name).toBeUndefined()
    })
  })

  describe('request fallback', () => {
    it('prefers the prepared request', () => {
      const archived = buildArchivedTransaction({
        txId: 'tx',
        status: 'success',
        request: customRequest,
        intent: { type: 'custom', request: { ...customRequest, to: FROM } },
        timestamp: TIMESTAMP,
      })

      expect(archived.request).toBe(customRequest)
    })

    it('falls back to a custom intent embedded request', () => {
      const archived = buildArchivedTransaction({
        txId: 'tx',
        status: 'success',
        intent: { type: 'custom', request: customRequest },
        timestamp: TIMESTAMP,
      })

      expect(archived.request).toBe(customRequest)
    })

    it('is undefined for a non-custom intent with no prepared request', () => {
      const archived = buildArchivedTransaction({
        txId: 'tx',
        status: 'success',
        intent: { type: 'ens-renewal', name: 'leon', duration: 1n, from: FROM },
        timestamp: TIMESTAMP,
      })

      expect(archived.request).toBeUndefined()
    })

    it('carries the machine-prepared request for a non-custom intent', () => {
      // ens-renewal/eth-transfer intents have no embedded request; the machine
      // prepares one into ctx.request. The manager passes that prepared request
      // (ctx.request) here, so the archive must carry it rather than dropping
      // `to`/`value` from the history report.
      const archived = buildArchivedTransaction({
        txId: 'tx',
        status: 'success',
        request: customRequest,
        intent: { type: 'ens-renewal', name: 'leon', duration: 1n, from: FROM },
        timestamp: TIMESTAMP,
      })

      expect(archived.request).toBe(customRequest)
    })
  })
})
