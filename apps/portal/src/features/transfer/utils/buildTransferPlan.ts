/**
 * Turns the user's transfer options into an ordered list of on-chain steps.
 * Config steps run before the token moves, since the sender loses the roles to
 * make them once the ERC-1155 token transfers. The token transfer is last.
 */

export type TransferOptions = {
  /** Point the name's ETH address record at the recipient. */
  readonly setEthAddress: boolean
  /** Detach the name from its resolver (`setResolver(0x0)`). */
  readonly detachResolver: boolean
  /** Detach the name from its subregistry (`setSubregistry(0x0)`). */
  readonly detachRegistry: boolean
}

export type TransferStepKind =
  | 'set-eth-addr'
  | 'detach-resolver'
  | 'detach-registry'
  | 'transfer-token'

export const buildTransferPlan = (
  options: TransferOptions,
): TransferStepKind[] => {
  const steps: TransferStepKind[] = []

  // Redundant once the resolver is detached, so only when the resolver is kept.
  if (options.setEthAddress && !options.detachResolver) {
    steps.push('set-eth-addr')
  }

  if (options.detachResolver) {
    steps.push('detach-resolver')
  }

  if (options.detachRegistry) {
    steps.push('detach-registry')
  }

  steps.push('transfer-token')

  return steps
}

export const STEP_LABELS: Record<TransferStepKind, string> = {
  'set-eth-addr': 'Update ETH address',
  'detach-resolver': 'Detach resolver',
  'detach-registry': 'Detach registry',
  'transfer-token': 'Transfer name',
}
