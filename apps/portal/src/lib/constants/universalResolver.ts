import { getChainContractAddress } from '@ensdomains/ensjs/chain'
import { sepoliaWithEns } from '@/lib/wagmi'

export const universalResolverAddress = getChainContractAddress({
  chain: sepoliaWithEns,
  contract: 'ensUniversalResolver',
})

// The audited, officially-deployed ENS Public Resolver instance on Sepolia.
// Used to recognize it on the resolver pages so the Type row can label it
// (and link its docs) instead of calling it a custom resolver.
export const officialPublicResolverAddress =
  '0x640294a2b2d87e7f522db3e3e3e876764bce170d' as const
