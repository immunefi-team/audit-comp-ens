import type { Dispatch, SetStateAction } from 'react'

export type StartUpgradeParams = {
  readonly isUpgradeDisabled: boolean
  readonly onNext: () => boolean | Promise<boolean>
  readonly setIsStarting: Dispatch<SetStateAction<boolean>>
}

export const startUpgrade = async ({
  isUpgradeDisabled,
  onNext,
  setIsStarting,
}: StartUpgradeParams) => {
  if (isUpgradeDisabled) return
  setIsStarting(true)
  try {
    const didStart = await onNext()
    if (!didStart) setIsStarting(false)
  } catch (error) {
    setIsStarting(false)
    throw error
  }
}
