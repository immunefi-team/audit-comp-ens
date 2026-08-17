import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

export interface WeaveStep {
  label: MessageDescriptor
  end: number
}

export const WEAVE_STEPS: WeaveStep[] = [
  { label: msg`Reserving your name`, end: 0.16 },
  { label: msg`Carving your name into the blockchain`, end: 0.32 },
  { label: msg`Making your name work everywhere`, end: 0.48 },
  { label: msg`Planting your name in the infinite garden`, end: 0.62 },
  { label: msg`Farming aura`, end: 0.76 },
  { label: msg`Growing your corner of the decentralized web`, end: 0.9 },
  { label: msg`Placing your new identity in your wallet`, end: 1 },
]

export const WEAVE_REGISTRATION_STEP_LABEL_HEIGHT_PX = 87

export const WEAVE_REGISTRATION_STEP_LABEL_HEIGHT_MOBILE_PX = 28

export function stepIndexForProgress(
  progress: number,
  steps: WeaveStep[] = WEAVE_STEPS,
): number {
  const p = Math.max(0, Math.min(1, progress))
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (step && p <= step.end) return i
  }
  return steps.length - 1
}

export function stepMessageForProgress(
  progress: number,
  steps: WeaveStep[] = WEAVE_STEPS,
): MessageDescriptor | undefined {
  return steps[stepIndexForProgress(progress, steps)]?.label
}
