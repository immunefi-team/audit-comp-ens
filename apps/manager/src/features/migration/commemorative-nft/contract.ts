import {
  readContract,
  type Config as WagmiConfig,
  waitForTransactionReceipt,
  writeContract,
} from '@wagmi/core'
import { type Address, getAddress, type Hex, parseAbi } from 'viem'
import { getCommemorativeNftContractAddress } from './config'

export const COMMEMORATIVE_NFT_ABI = parseAbi([
  'function claim(bytes32[] proof)',
  'function hasClaimed(address account) view returns (bool)',
  'function tokenIdOf(address account) pure returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'error AlreadyClaimed(uint256 tokenId)',
  'error InvalidProof()',
])

export type CommemorativeNftClaimErrorReason =
  | 'user-rejected'
  | 'already-claimed'
  | 'invalid-proof'
  | 'reverted'
  | 'wallet-mismatch'
  | 'unsupported-network'
  | 'generic'

export class CommemorativeNftClaimError extends Error {
  override readonly name = 'CommemorativeNftClaimError'

  constructor(
    readonly reason: CommemorativeNftClaimErrorReason,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}

const errorChainText = (error: unknown): string => {
  const messages: string[] = []
  let current: unknown = error
  const visited = new Set<unknown>()

  while (current && !visited.has(current)) {
    visited.add(current)
    if (current instanceof Error)
      messages.push(`${current.name} ${current.message}`)
    current =
      typeof current === 'object' && current !== null && 'cause' in current
        ? current.cause
        : undefined
  }

  return messages.join(' ')
}

export const decodeCommemorativeNftClaimError = (
  error: unknown,
): CommemorativeNftClaimError => {
  if (error instanceof CommemorativeNftClaimError) return error

  const text = errorChainText(error)
  if (/user rejected|UserRejectedRequestError/i.test(text)) {
    return new CommemorativeNftClaimError(
      'user-rejected',
      'The mint request was cancelled.',
      { cause: error },
    )
  }
  if (/AlreadyClaimed/i.test(text)) {
    return new CommemorativeNftClaimError(
      'already-claimed',
      'This commemorative NFT has already been minted.',
      { cause: error },
    )
  }
  if (/InvalidProof/i.test(text)) {
    return new CommemorativeNftClaimError(
      'invalid-proof',
      'The eligibility proof could not be verified.',
      { cause: error },
    )
  }

  return new CommemorativeNftClaimError(
    'generic',
    'The commemorative NFT could not be minted. Please try again.',
    { cause: error },
  )
}

export const readCommemorativeNftClaimed = async (params: {
  readonly wagmiConfig: WagmiConfig
  readonly chainId: number
  readonly ownerAddress: Address
}): Promise<boolean> => {
  const contractAddress = getCommemorativeNftContractAddress(params.chainId)
  if (!contractAddress) {
    throw new CommemorativeNftClaimError(
      'unsupported-network',
      'The commemorative NFT is not available on this network.',
    )
  }

  return readContract(params.wagmiConfig, {
    abi: COMMEMORATIVE_NFT_ABI,
    address: contractAddress,
    functionName: 'hasClaimed',
    args: [params.ownerAddress],
    chainId: params.chainId,
  })
}

export const claimCommemorativeNft = async (params: {
  readonly wagmiConfig: WagmiConfig
  readonly chainId: number
  readonly ownerAddress: Address
  readonly walletAddress: Address
  readonly proof: readonly Hex[]
}): Promise<Hex> => {
  const contractAddress = getCommemorativeNftContractAddress(params.chainId)
  if (!contractAddress) {
    throw new CommemorativeNftClaimError(
      'unsupported-network',
      'The commemorative NFT is not available on this network.',
    )
  }

  if (
    getAddress(params.ownerAddress).toLowerCase() !==
    getAddress(params.walletAddress).toLowerCase()
  ) {
    throw new CommemorativeNftClaimError(
      'wallet-mismatch',
      'Reconnect the eligible owner wallet before minting.',
    )
  }

  try {
    return await writeContract(params.wagmiConfig, {
      abi: COMMEMORATIVE_NFT_ABI,
      account: params.walletAddress,
      address: contractAddress,
      functionName: 'claim',
      args: [params.proof],
      chainId: params.chainId,
    })
  } catch (error) {
    throw decodeCommemorativeNftClaimError(error)
  }
}

export const waitForCommemorativeNftClaimReceipt = async (params: {
  readonly wagmiConfig: WagmiConfig
  readonly chainId: number
  readonly hash: Hex
}): Promise<void> => {
  const receipt = await waitForTransactionReceipt(params.wagmiConfig, {
    chainId: params.chainId,
    hash: params.hash,
    timeout: 5 * 60 * 1_000,
  })

  if (receipt.status !== 'success') {
    throw new CommemorativeNftClaimError(
      'reverted',
      'The mint transaction reverted. Please try again.',
    )
  }
}
