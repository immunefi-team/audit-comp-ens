import { ok } from 'neverthrow'
import type { Address, PublicClient, WalletClient } from 'viem'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { setForwardResolution, createSetForwardResolutionRequest, getResolver } =
  vi.hoisted(() => ({
    setForwardResolution: vi.fn(),
    createSetForwardResolutionRequest: vi.fn(() => ({
      address: '0x2222222222222222222222222222222222222222',
      abi: [],
      functionName: 'setAddr',
      args: [],
    })),
    getResolver: vi.fn(),
  }))

vi.mock('@ens-apps/l2-primary/utils', () => ({
  createSetForwardResolutionRequest,
}))

vi.mock('@/features/reverse-resolution/helpers/setForwardResolution', () => ({
  setForwardResolution,
}))

vi.mock('@ensdomains/ensjs/public', () => ({
  getResolver,
}))

const mockClient = { chain: { id: 11155111 } }
vi.mock('@/lib/wagmi/helpers', () => ({
  safeGetClient: () => ok(mockClient),
}))

import type { Signer } from '@ens-apps/transaction-manager'
import { MAINNET_COIN_TYPE } from '@/lib/coinType'
import { setEthAddress } from './setEthAddress'

const RECIPIENT = '0x3333333333333333333333333333333333333333' as Address
const RESOLVER = '0x2222222222222222222222222222222222222222' as Address

const walletClient = {} as WalletClient
const publicClient = {} as PublicClient
const signer: Signer = { type: 'eoa', walletClient: {} as WalletClient }

afterEach(() => {
  vi.clearAllMocks()
})

describe('setEthAddress', () => {
  it('looks up the resolver and submits the ETH forward record for the recipient', async () => {
    getResolver.mockResolvedValueOnce(RESOLVER)
    setForwardResolution.mockResolvedValueOnce({ txId: 'tx-1', hash: '0x1' })

    const result = await setEthAddress({
      name: 'alice.eth',
      recipient: RECIPIENT,
      walletClient,
      publicClient,
      signer,
      chainId: 11155111,
      id: 'transfer-alice.eth-set-eth-addr',
    })

    expect(getResolver).toHaveBeenCalledWith(mockClient, { name: 'alice.eth' })
    expect(createSetForwardResolutionRequest).toHaveBeenCalledWith({
      name: 'alice.eth',
      coinType: MAINNET_COIN_TYPE,
      resolverAddress: RESOLVER,
      targetAddress: RECIPIENT,
    })
    expect(setForwardResolution).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'transfer-alice.eth-set-eth-addr' }),
    )
    expect(result).toEqual({ txId: 'tx-1', hash: '0x1' })
  })
})
