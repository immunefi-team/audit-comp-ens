import { normalize } from 'viem/ens'

type Eth2LdName = {
  readonly label: string
  readonly name: string
}

type EthName = {
  readonly leafLabel: string
  readonly name: string
  readonly parentLabelsRootFirst: readonly string[]
}

export const normalizeEthName = (name: string): EthName | null => {
  let normalized: string

  try {
    normalized = normalize(name)
  } catch {
    return null
  }

  const labels = normalized.split('.')
  const leafLabel = labels[0]

  if (
    labels.length < 2 ||
    labels.at(-1) !== 'eth' ||
    !leafLabel ||
    labels.some((label) => !label)
  ) {
    return null
  }

  return {
    leafLabel,
    name: normalized,
    parentLabelsRootFirst: labels.slice(1, -1).reverse(),
  }
}

// Normalizes a non-.eth name (e.g. a DNS name); bare labels are not
// DNS names here, they resolve as .eth candidates
export const normalizeDnsName = (name: string): string | null => {
  let normalized: string

  try {
    normalized = normalize(name)
  } catch {
    return null
  }

  const labels = normalized.split('.')

  if (labels.length < 2 || labels.some((label) => !label)) {
    return null
  }

  return normalized
}

export const normalizeEth2LdName = (name: string): Eth2LdName | null => {
  const ethName = normalizeEthName(name)

  if (!ethName || ethName.parentLabelsRootFirst.length > 0) {
    return null
  }

  return {
    label: ethName.leafLabel,
    name: ethName.name,
  }
}
