import { useQueryClient } from '@tanstack/react-query'
import type { Address, PublicClient } from 'viem'
import { useConfig, usePublicClient } from 'wagmi'
import {
  computeMigrationPreflight,
  EMPTY_PREFLIGHT,
  type MigrationPreflight,
} from '@/features/migration/service/computeMigrationPreflight'
import type { V1Domain } from '@/features/migration/service/v1SubgraphClient'

type HookParams = {
  eoa: Address | undefined
  hcaAddress?: Address
}

type EnsureOptions = {
  readonly staleTime?: number
}

export const useMigrationPreflight = ({ eoa, hcaAddress }: HookParams) => {
  const publicClient = usePublicClient()
  const wagmiConfig = useConfig()
  const queryClient = useQueryClient()

  const ensure = (
    domains: readonly V1Domain[],
    options: EnsureOptions = {},
  ): Promise<MigrationPreflight> => {
    if (!eoa || !publicClient) {
      return Promise.resolve(EMPTY_PREFLIGHT)
    }
    const ids = [...domains]
      .map((d) => d.id)
      .sort()
      .join(',')
    return queryClient.fetchQuery({
      queryKey: [
        'migration-preflight',
        eoa.toLowerCase(),
        hcaAddress?.toLowerCase() ?? '',
        ids,
      ] as const,
      queryFn: () =>
        computeMigrationPreflight({
          eoa,
          hcaAddress,
          domains,
          wagmiConfig,
          publicClient: publicClient as unknown as PublicClient,
        }),
      staleTime: options.staleTime ?? 60_000,
    })
  }

  return { ensure }
}
