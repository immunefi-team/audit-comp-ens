import { type Address, isAddress } from 'viem'
import { getEnsAddress } from 'viem/actions'
import { getEnsOwner } from '@/features/profile/hooks/useEnsOwner'
import { universalResolverAddress } from '@/lib/constants/universalResolver'

type ResolveAddressOrNameParams = {
  client: Parameters<typeof getEnsAddress>[0]
  nameOrAddress: string
}

export async function resolveAddressOrName({
  client,
  nameOrAddress,
}: ResolveAddressOrNameParams): Promise<Address | null> {
  if (isAddress(nameOrAddress, { strict: false })) {
    return nameOrAddress as Address
  }

  try {
    const resolved = await getEnsAddress(client, {
      name: nameOrAddress,
      universalResolverAddress,
    })

    let resolvedAddress = resolved

    // Fallback for names that do not set an address record:
    // use current ENS owner address so the role can still be granted.
    if (!resolvedAddress) {
      const ownerResult = await getEnsOwner({ name: nameOrAddress })
      if (ownerResult.isOk()) {
        resolvedAddress = ownerResult.value?.owner ?? null
      }
    }

    return resolvedAddress
  } catch {
    return null
  }
}
