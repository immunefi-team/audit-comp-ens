import type { Call } from '@ens-apps/transaction-manager'
import { labelToCanonicalId } from '@ensdomains/ensjs/utils/v2'
import { encodeFunctionData } from 'viem'
import { ETH_REGISTRY_V2_ABI } from '../contracts/abis'
import { V2_CONTRACTS } from '../contracts/addresses'
import type { ClassifiedName } from './classifyNames'

// RegistryRolesLib uses nybble-packed roles in the remediated V2 deployment.
const ROLE_SET_RESOLVER = 1n << 24n

export const buildRoleGrantCall = (name: ClassifiedName): Call => {
  if (!name.managerAddress) {
    throw new Error(`No manager address for ${name.domain.name}`)
  }

  const resource = labelToCanonicalId(name.label)

  return {
    to: V2_CONTRACTS.ETHRegistry,
    data: encodeFunctionData({
      abi: ETH_REGISTRY_V2_ABI,
      functionName: 'grantRoles',
      args: [resource, ROLE_SET_RESOLVER, name.managerAddress],
    }),
    value: 0n,
  }
}
