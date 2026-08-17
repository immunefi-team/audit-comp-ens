import type { Address } from 'viem'

type ConnectedAddressCandidates = {
  readonly walletAddress: Address | undefined
  readonly accountAddress: Address | null | undefined
  readonly ownerAddress: Address | null | undefined
}

type IsConnectedProfileOwnerParams = ConnectedAddressCandidates & {
  readonly owner: Address | undefined
}

type IsViewingConnectedAddressParams = ConnectedAddressCandidates & {
  readonly address: Address | undefined
}

const matchesConnectedAddress = (
  target: Address | undefined,
  candidates: ConnectedAddressCandidates,
): boolean => {
  const normalizedTarget = target?.toLowerCase()
  if (!normalizedTarget) return false

  return [
    candidates.walletAddress,
    candidates.accountAddress,
    candidates.ownerAddress,
  ]
    .filter((addr): addr is Address => !!addr)
    .some((addr) => addr.toLowerCase() === normalizedTarget)
}

export const isConnectedProfileOwner = ({
  owner,
  walletAddress,
  accountAddress,
  ownerAddress,
}: IsConnectedProfileOwnerParams): boolean =>
  matchesConnectedAddress(owner, {
    walletAddress,
    accountAddress,
    ownerAddress,
  })

export const isViewingConnectedAddress = ({
  address,
  walletAddress,
  accountAddress,
  ownerAddress,
}: IsViewingConnectedAddressParams): boolean =>
  matchesConnectedAddress(address, {
    walletAddress,
    accountAddress,
    ownerAddress,
  })
