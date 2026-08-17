import { logger } from '@ens-apps/utils/logger'
import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { backendClient } from '@/utils/backend-client'

export type MigrationGasFundingStatus = 'idle' | 'funding' | 'settled'

/**
 * Migration gas funding gate.
 *
 * Every migration transaction is EOA-paid (the NFT approvals, the resolver
 * deploy, and the gas-heavy migrate batches all come from the owner's wallet
 * — none of it is Warp-sponsored), so the owner needs sepETH before they hit
 * "Begin upgrade". `/wallet/fund` decides server-side whether to drip: it tops
 * the address up to a target ETH balance only when it's low AND actually owns
 * v1 names (V1 subgraph check), and it does NOT return until the drip
 * transaction is confirmed on-chain. That makes the request a reliable gate —
 * once it resolves, any ETH the owner was owed is already spendable.
 *
 * The previous implementation fired this fire-and-forget on page entry, so an
 * owner with no sepETH could hit "Begin upgrade" before the drip landed,
 * watch the migration fail for lack of gas, cancel, and only then have the ETH
 * show up. We now surface a status so the upgrade button can wait for funding
 * to settle (`'funding'` -> `'settled'`).
 *
 * Backed by React Query keyed on the address, so it fires once per address
 * (re-renders are deduped), refetch is disabled, and concurrent callers (e.g.
 * the stablecoin auto-fund in SmartAccountContext) share the worker's
 * per-address KV lock. Best-effort: a failed request resolves to `'settled'`
 * rather than blocking the user forever — the migration flow still surfaces
 * any out-of-gas failure itself.
 */
export const useMigrationGasFunding = (
  ownerAddress: Address | string | null | undefined,
): MigrationGasFundingStatus => {
  const enabled = !!ownerAddress

  const query = useQuery({
    queryKey: [
      'migration-gas-funding',
      ownerAddress ? String(ownerAddress).toLowerCase() : '',
    ] as const,
    enabled,
    // The drip is a one-shot top-up; never auto-refetch or expire it.
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      try {
        const response = await backendClient.wallet.fund.$post({
          json: { address: ownerAddress as Address },
        })
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`)
        }
        logger.debug('Migration gas funding settled', { ownerAddress })
      } catch (error) {
        // Best-effort: never block the user on a faucet failure. They can top
        // up from a public faucet and the migration flow surfaces gas errors.
        logger.warn('Migration gas funding request failed', {
          ownerAddress,
          error,
        })
      }
      return true as const
    },
  })

  if (!enabled) return 'idle'
  return query.isSuccess ? 'settled' : 'funding'
}
