import type { Address } from 'viem'

export type RegistrationPostRegistrationSetup = {
  primaryName?: {
    enabled: boolean
    syncEthRecord?: boolean
  }
}

export function getManagerRegistrationPostRegistrationSetup(params: {
  ownerAddress?: Address | null
  existingPrimaryName?: string | null
  ownedNamesCount?: number | null
}): RegistrationPostRegistrationSetup | undefined {
  if (
    !params.ownerAddress ||
    params.existingPrimaryName ||
    params.ownedNamesCount == null ||
    params.ownedNamesCount >= 5
  ) {
    return undefined
  }

  return {
    primaryName: {
      enabled: true,
      syncEthRecord: true,
    },
  }
}
