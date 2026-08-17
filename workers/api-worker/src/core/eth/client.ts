import { extendChainWithEns } from '@ensdomains/ensjs/chain'
import { ok, type Result } from 'neverthrow'
import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { error } from '../../utils/result'

const sepoliaWithEns = extendChainWithEns(sepolia)
export type ViemClient =
  ReturnType<typeof createEnsClient> extends Result<infer T, infer _E>
    ? T
    : never

export const createEnsClient = (env: CloudflareBindings) => {
  if ((env.CHAIN as string) !== 'sepolia') {
    return error({
      code: 'INVALID_CHAIN',
      message: `Invalid chain: ${env.CHAIN}`,
    })
  }

  if (!env.SEPOLIA_RPC_URL) {
    return error({
      code: 'MISSING_SEPOLIA_RPC_URL',
      message: 'SEPOLIA_RPC_URL is not configured',
    })
  }

  const client = createPublicClient({
    chain: sepoliaWithEns,
    transport: http(env.SEPOLIA_RPC_URL),
  })

  return ok(client)
}
