import type { MigrationTokenType } from './classifyNames'

export const TARGET_GAS = 20_000_000n

// dRPC caps eth_estimateGas at 2^24 gas. Keep live migration calls below that
// ceiling so an out-of-gas receiver callback is not masked as an ERC1155 error.
export const EXECUTION_TARGET_GAS = 15_000_000n

export const PER_BATCH_OVERHEAD = 80_000n

export const GAS_HEURISTIC: Record<MigrationTokenType, bigint> = {
  unwrapped: 195_000n,
  unlocked: 220_000n,
  'locked-2ld': 240_000n,
  'locked-child': 150_000n,
  'detached-child': 150_000n,
}

export const SETTEXT_GAS = 50_000n
export const SETADDR_GAS = 35_000n
export const SETCONTENTHASH_GAS = 50_000n
export const SETABI_GAS = 70_000n
export const MULTICALL_OVERHEAD = 60_000n

export const GRANT_ROLES_GAS = 80_000n
