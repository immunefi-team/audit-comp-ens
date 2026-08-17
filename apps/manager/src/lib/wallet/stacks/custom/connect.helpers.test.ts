import { describe, expect, it } from 'vitest'
import type { Connector } from 'wagmi'
import {
  isCoinbase,
  isConnectionCancelled,
  isMetaMask,
  normalizeConnectError,
  resolveConnectChainId,
} from './connect.helpers'

// Minimal stand-in for a wagmi Connector — only the fields the matchers read.
const connector = (fields: Partial<Connector>): Connector =>
  ({ id: '', name: '', type: 'injected', ...fields }) as Connector

describe('isMetaMask', () => {
  it('matches the EIP-6963 rdns id', () => {
    expect(isMetaMask(connector({ id: 'io.metamask' }))).toBe(true)
  })

  it('matches by name', () => {
    expect(isMetaMask(connector({ id: 'injected', name: 'MetaMask' }))).toBe(
      true,
    )
  })

  it('does not match other wallets', () => {
    expect(isMetaMask(connector({ id: 'io.rabby', name: 'Rabby' }))).toBe(false)
  })
})

describe('isCoinbase', () => {
  it.each([
    { id: 'coinbaseWalletSDK', name: 'Coinbase Wallet' },
    { id: 'com.coinbase.wallet', name: 'Coinbase Wallet' },
    { id: 'other', name: 'Coinbase Smart Wallet' },
  ])('matches Coinbase variant %o', (fields) => {
    expect(isCoinbase(connector(fields))).toBe(true)
  })

  it('does not match non-Coinbase wallets', () => {
    expect(isCoinbase(connector({ id: 'io.metamask', name: 'MetaMask' }))).toBe(
      false,
    )
  })
})

describe('isConnectionCancelled', () => {
  it('detects a viem UserRejectedRequestError by name', () => {
    const error = new Error('nope')
    error.name = 'UserRejectedRequestError'
    expect(isConnectionCancelled(error)).toBe(true)
  })

  it.each([
    'User rejected the request.',
    'user denied account authorization',
    'Connection request cancelled',
    'The request was canceled', // single-l spelling
  ])('detects rejection message: %s', (message) => {
    expect(isConnectionCancelled(new Error(message))).toBe(true)
  })

  it('treats other failures as not cancelled', () => {
    expect(isConnectionCancelled(new Error('network unreachable'))).toBe(false)
  })

  it('handles non-Error values', () => {
    expect(isConnectionCancelled('boom')).toBe(false)
    expect(isConnectionCancelled(undefined)).toBe(false)
  })
})

describe('normalizeConnectError', () => {
  it('returns the cancel copy for user rejections', () => {
    expect(normalizeConnectError(new Error('user rejected the request'))).toBe(
      'Connection cancelled',
    )
  })

  it('returns the generic copy for real failures (no raw detail leaked)', () => {
    expect(normalizeConnectError(new Error('RPC 500: rug'))).toBe(
      'Unable to connect wallet',
    )
  })
})

describe('resolveConnectChainId', () => {
  const chains = [{ id: 11155111 }] as const

  it("keeps the wallet's chain when the app supports it", () => {
    expect(resolveConnectChainId(11155111, chains)).toBe(11155111)
  })

  it('forces the first app chain when the wallet is elsewhere (e.g. mainnet)', () => {
    expect(resolveConnectChainId(1, chains)).toBe(11155111)
  })
})
