import type { ReverseRegistrarChainId } from '@ens-apps/l2-primary/v1'

const icons = {
  1: '/icons/eth.svg',
  60: '/icons/eth.svg',
  10: '/icons/op.svg',
  42161: '/icons/arb.svg',
  8453: '/icons/base.svg',
  59144: '/icons/linea.svg',
  534352: '/icons/scroll.svg',
} as const satisfies Record<ReverseRegistrarChainId, string>

const names = {
  1: 'Ethereum',
  60: 'Ethereum',
  10: 'Optimism',
  42161: 'Arbitrum',
  8453: 'Base',
  59144: 'Linea',
  534352: 'Scroll',
} as const satisfies Record<ReverseRegistrarChainId, string>

function isL1ReverseRegistrarChainId(
  chainId: number | ReverseRegistrarChainId,
): chainId is 1 | 60 {
  const numeric = Number(chainId)
  return numeric === 1 || numeric === 60
}

export { icons, isL1ReverseRegistrarChainId, names }
