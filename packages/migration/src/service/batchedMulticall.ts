import type { PublicClient } from 'viem'
import { multicall } from 'viem/actions'
import { withTimeout } from './withTimeout'

const PREFLIGHT_TIMEOUT_MS = 15000
const MULTICALL_BATCH_SIZE = 5000

type MulticallFailure = {
  status: 'failure'
  error: Error
  result: undefined
}

type MulticallResult<T> = { status: 'success'; result: T } | MulticallFailure

export const batchedMulticall = async <T>(
  publicClient: PublicClient,
  contracts: Parameters<typeof multicall>[1]['contracts'],
): Promise<MulticallResult<T>[]> => {
  const chunks: (typeof contracts)[] = []
  for (let i = 0; i < contracts.length; i += MULTICALL_BATCH_SIZE) {
    chunks.push(contracts.slice(i, i + MULTICALL_BATCH_SIZE))
  }

  const settled = await Promise.allSettled(
    chunks.map((chunk) =>
      withTimeout(
        multicall(publicClient, {
          contracts: chunk,
          allowFailure: true,
          batchSize: 0,
        }),
        PREFLIGHT_TIMEOUT_MS,
      ),
    ),
  )

  const out: MulticallResult<T>[] = []
  for (const [i, r] of settled.entries()) {
    const chunk = chunks[i]
    if (!chunk) continue
    if (r.status === 'fulfilled') {
      for (const entry of r.value) {
        out.push(entry as MulticallResult<T>)
      }
      continue
    }
    const error =
      r.reason instanceof Error ? r.reason : new Error(String(r.reason))
    for (let j = 0; j < chunk.length; j++) {
      out.push({ status: 'failure', error, result: undefined })
    }
  }
  return out
}
