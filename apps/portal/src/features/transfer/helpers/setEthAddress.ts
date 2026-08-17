import { createSetForwardResolutionRequest } from '@ens-apps/l2-primary/utils'
import type { Signer } from '@ens-apps/transaction-manager'
import { getResolver } from '@ensdomains/ensjs/public'
import type { Address, Hex, PublicClient, WalletClient } from 'viem'
import { setForwardResolution } from '@/features/reverse-resolution/helpers/setForwardResolution'
import { MAINNET_COIN_TYPE } from '@/lib/coinType'
import { safeGetClient } from '@/lib/wagmi/helpers'

type SetEthAddressParameters = {
  readonly name: string
  readonly recipient: Address
  readonly walletClient: WalletClient
  readonly publicClient: PublicClient
  readonly signer: Signer
  readonly chainId: number
  readonly id: string
}

/**
 * Point the name's ETH address record (`addr(60)`) at the recipient, so the
 * previous owner can no longer re-claim it as their primary name.
 */
export const setEthAddress = async ({
  name,
  recipient,
  walletClient,
  publicClient,
  signer,
  chainId,
  id,
}: SetEthAddressParameters): Promise<{ txId: string; hash: Hex }> => {
  const clientResult = safeGetClient()
  if (clientResult.isErr()) {
    throw new Error('Failed to get client')
  }

  const resolverAddress = await getResolver(clientResult.value, { name })

  const request = createSetForwardResolutionRequest({
    name,
    coinType: MAINNET_COIN_TYPE,
    resolverAddress,
    targetAddress: recipient,
  })

  return setForwardResolution({
    name,
    request,
    walletClient,
    publicClient,
    signer,
    chainId,
    id,
    description: `Point ETH address for ${name} to the recipient`,
  })
}
