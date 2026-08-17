import { isAddress } from 'viem'

export type GetIsSubmitDisabledParams = {
  readonly walletOk: boolean
  readonly useCustomResolver: boolean
  readonly resolverAddress: string
  readonly deployNewResolver: boolean
  readonly selectedExistingResolver: string
}

export function getIsSubmitDisabled({
  walletOk,
  useCustomResolver,
  resolverAddress,
  deployNewResolver,
  selectedExistingResolver,
}: GetIsSubmitDisabledParams): boolean {
  if (!walletOk) return true

  if (useCustomResolver) {
    return !isAddress(resolverAddress)
  }

  if (deployNewResolver) return false

  return !isAddress(selectedExistingResolver)
}
