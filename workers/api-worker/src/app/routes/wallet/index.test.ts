import { ensL1Contracts, supportedL1Chains } from '@ensdomains/ensjs/chain'
import { describe, expect, it } from 'vitest'
import walletApp from './index'

describe('GET /wallet/tokens', () => {
  it('returns the faucet stablecoin addresses, decimals, and chain id', async () => {
    const res = await walletApp.request('/wallet/tokens')

    expect(res.status).toBe(200)

    const body = (await res.json()) as {
      chainId: number
      tokens: Record<
        string,
        { address: string; decimals: number; symbol: string }
      >
    }

    const sepoliaContracts = ensL1Contracts[supportedL1Chains.sepolia]

    expect(body.chainId).toBe(11155111)
    // Source of truth: the addresses must equal what /fund mints (ensjs config),
    // so the manager reads balances against exactly the minted tokens.
    expect(body.tokens.USDC).toEqual({
      address: sepoliaContracts.usdc.address,
      decimals: 6,
      symbol: 'USDC',
    })
    expect(body.tokens.DAI).toEqual({
      address: sepoliaContracts.dai.address,
      decimals: 18,
      symbol: 'DAI',
    })
  })
})
