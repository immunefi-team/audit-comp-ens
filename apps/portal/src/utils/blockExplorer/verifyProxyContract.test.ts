import { type Chain, getAddress } from 'viem'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyProxyContract } from './verifyProxyContract'

const ADDRESS = getAddress('0x5bdd868cd51e44ef84ef7176063ccd8d8f3a4c7e')
const API_URL = 'https://api-sepolia.etherscan.io/api'

const MOCK_CHAIN = {
  id: 11155111,
  name: 'Sepolia',
  blockExplorers: {
    default: {
      name: 'Etherscan',
      url: 'https://sepolia.etherscan.io',
      apiUrl: API_URL,
    },
  },
} as Chain

const jsonResponse = (body: unknown): Response =>
  ({ json: async () => body }) as Response

describe('verifyProxyContract', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("hits the chain's API URL with verifyproxycontract and the proxy address", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: '0', result: 'NOTOK' }))
    vi.stubGlobal('fetch', fetchMock)

    await verifyProxyContract(MOCK_CHAIN, ADDRESS)

    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.origin + url.pathname).toBe(API_URL)
    expect(url.searchParams.get('action')).toBe('verifyproxycontract')
    expect(url.searchParams.get('address')).toBe(ADDRESS)
    // No multichain `chainid` param — host already pins the chain.
    expect(url.searchParams.has('chainid')).toBe(false)
    // Verification is fully keyless — never sends an API key.
    expect(url.searchParams.has('apikey')).toBe(false)
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('POST')
  })

  it('polls checkproxyverification after a successful submit', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: '1', result: 'the-guid' }))
      .mockResolvedValueOnce(jsonResponse({ status: '1', result: 'Verified' }))
    vi.stubGlobal('fetch', fetchMock)

    const promise = verifyProxyContract(MOCK_CHAIN, ADDRESS)
    await vi.runAllTimersAsync()
    await promise

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const pollUrl = new URL(fetchMock.mock.calls[1][0] as string)
    expect(pollUrl.searchParams.get('action')).toBe('checkproxyverification')
    expect(pollUrl.searchParams.get('guid')).toBe('the-guid')
  })

  it('does not poll when submit fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: '0', result: 'NOTOK' }))
    vi.stubGlobal('fetch', fetchMock)

    await verifyProxyContract(MOCK_CHAIN, ADDRESS)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('never throws when fetch rejects', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      verifyProxyContract(MOCK_CHAIN, ADDRESS),
    ).resolves.toBeUndefined()
  })

  it('never calls fetch when the chain has no API URL', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const chainNoApi = { id: 11155111, name: 'X' } as Chain

    await expect(
      verifyProxyContract(chainNoApi, ADDRESS),
    ).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
