import type { CustomTransactionIntent } from '@ens-apps/transaction-manager'
import { type Address, encodeFunctionData, erc20Abi, type Hex } from 'viem'

/**
 * Builds the standard EOA {@link CustomTransactionIntent} that every
 * `prepare*Transaction` builder returns. Centralizing the wrapper means the
 * intent contract (the `value: 0n` default, the request field set) lives in one
 * place instead of being hand-rolled at every builder — change it here once
 * rather than hunting ~20 identical object literals.
 */
export function toEoaCustomIntent(params: {
  readonly from: Address
  readonly to: Address
  readonly data: Hex
  readonly chainId: number
  /** Defaults to `0n` — the overwhelming majority of ENS writes send no ETH. */
  readonly value?: bigint
  /** Explicit gas cap for calls where live estimation is unreliable. */
  readonly gas?: bigint
}): CustomTransactionIntent {
  return {
    type: 'custom',
    request: {
      type: 'eoa',
      from: params.from,
      to: params.to,
      data: params.data,
      value: params.value ?? 0n,
      chainId: params.chainId,
      ...(params.gas != null ? { gas: params.gas } : {}),
    },
  }
}

/**
 * The ERC-20 `approve` intent shared by both the pre-start gas estimate and the
 * submit path, so the estimated call is byte-identical to what's sent. The
 * `amount` is the caller's choice (registration approves the exact price;
 * renewal approves 2× for headroom against price drift) — only the encoding is
 * shared, since `approve` gas is amount-independent.
 */
export function buildApproveIntent(params: {
  readonly from: Address
  readonly token: Address
  readonly spender: Address
  readonly amount: bigint
  readonly chainId: number
}): CustomTransactionIntent {
  return toEoaCustomIntent({
    from: params.from,
    to: params.token,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [params.spender, params.amount],
    }),
    chainId: params.chainId,
  })
}
