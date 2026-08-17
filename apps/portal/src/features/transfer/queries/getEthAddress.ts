import { getAddressRecord } from '@ensdomains/ensjs/public'
import { queryOptions } from '@tanstack/react-query'
import { MAINNET_COIN_TYPE } from '@/lib/coinType'
import { safeGetClient } from '@/lib/wagmi/helpers'

/** The name's ETH address record (`addr(60)`), or null if unset/unreadable. */
export const getEthAddressQueryOptions = (name: string) =>
  queryOptions({
    queryKey: ['transfer-eth-address', name],
    queryFn: async () => {
      const clientResult = safeGetClient()
      if (clientResult.isErr()) return null
      const record = await getAddressRecord(clientResult.value, {
        name,
        coin: MAINNET_COIN_TYPE,
      }).catch(() => null)
      return record?.value ?? null
    },
    enabled: !!name,
  })
