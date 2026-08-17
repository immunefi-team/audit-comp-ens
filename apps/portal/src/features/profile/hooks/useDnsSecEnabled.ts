import { getDnsSecEnabled } from '@ens-apps/utils/dnssec'
import { useQuery } from '@tanstack/react-query'

type UseDnsSecEnabledParams = {
  /** The TLD to check (without dot, e.g., "eth", "xyz") */
  tld?: string
  /** Whether the query should be enabled */
  enabled?: boolean
}

/**
 * Query options for checking if a TLD has DNSSEC enabled.
 * "eth" is always considered valid (it's the native ENS TLD).
 */
export const getDnsSecEnabledQueryOptions = ({
  tld,
  enabled = true,
}: UseDnsSecEnabledParams) => ({
  queryKey: ['dnsSecEnabled', tld] as const,
  queryFn: async () => {
    if (!tld) throw new Error('TLD is required')
    return getDnsSecEnabled(tld)
  },
  // "eth" is always valid - it's the native ENS TLD, not a DNS TLD
  // "[root]" is a special case that should be skipped
  enabled: enabled && !!tld && tld !== 'eth' && tld !== '[root]',
  staleTime: 1000 * 60 * 60, // Cache for 1 hour
  retry: 2,
})

/**
 * Hook to check if a TLD has DNSSEC enabled.
 *
 * Any TLD with DNSSEC enabled at the DNS root level is supported by ENS.
 * "eth" is always considered valid as it's the native ENS TLD.
 *
 * @example
 * const { data: isDnsSecEnabled, isLoading } = useDnsSecEnabled({ tld: 'xyz' })
 */
export const useDnsSecEnabled = (params: UseDnsSecEnabledParams) => {
  return useQuery(getDnsSecEnabledQueryOptions(params))
}
