import { getDnsSecEnabled } from '@ens-apps/utils/dnssec'
import { qk } from '@ens-apps/utils/tanstack-query/queryKey'

export const dnsSecEnabledQuery = (tld: string) => ({
  queryKey: qk('profile', 'dnsSecEnabled', { tld }),
  queryFn: () => getDnsSecEnabled(tld),
  staleTime: 1000 * 60 * 60,
  retry: 2,
})
