import { logger } from '@ens-apps/utils/logger'
import { fromPromise, type ResultAsync } from 'neverthrow'
import { encodeFunctionData, type Hex, type PublicClient } from 'viem'
import { readContract } from 'viem/actions'
import { ETH_REGISTRAR_CONTROLLER_ABI } from '../contracts/abis/ETHRegistrarController.abi'
import { ENS_SEPOLIA_CONTRACTS } from '../contracts/ens-sepolia'

export class RhinestoneAccountError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RhinestoneAccountError'
  }
}

export type GasPriceTier = 'slow' | 'standard' | 'fast'

export interface ENSRenewalParams {
  name: string // e.g., "myname" (without .eth)
  duration: bigint // Duration in seconds (e.g., 31536000n for 1 year)
  gasPriceTier?: GasPriceTier
}

/**
 * Get the renewal price for an ENS name
 */
export function getENSRenewalPrice(
  publicClient: PublicClient,
  name: string,
  duration: bigint,
): ResultAsync<bigint, RhinestoneAccountError> {
  return fromPromise(
    (async () => {
      const price = await readContract(publicClient, {
        address: ENS_SEPOLIA_CONTRACTS.ETHRegistrarController,
        abi: ETH_REGISTRAR_CONTROLLER_ABI,
        functionName: 'rentPrice',
        args: [name, duration],
      })
      const { base, premium } = price as { base: bigint; premium: bigint }
      return base + premium
    })(),
    (error) =>
      new RhinestoneAccountError(
        `Failed to get renewal price: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ),
  )
}

/**
 * Prepare an ENS renewal transaction (get price and encode call data)
 */
export function prepareENSRenewalTransaction(
  publicClient: PublicClient,
  params: ENSRenewalParams,
): ResultAsync<{ to: Hex; data: Hex; value: bigint }, RhinestoneAccountError> {
  const { name, duration } = params

  // Get the renewal price and chain the result
  return getENSRenewalPrice(publicClient, name, duration).map(
    (renewalPrice) => {
      // Encode the renew function call
      const data = encodeFunctionData({
        abi: ETH_REGISTRAR_CONTROLLER_ABI,
        functionName: 'renew',
        args: [name, duration],
      })

      const txData = {
        to: ENS_SEPOLIA_CONTRACTS.ETHRegistrarController,
        data,
        value: renewalPrice,
      }

      logger.debug('Prepared ENS renewal transaction', {
        to: txData.to,
        value: txData.value.toString(),
        dataLength: txData.data.length,
      })

      return txData
    },
  )
}
