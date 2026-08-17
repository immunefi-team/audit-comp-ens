import { REGISTRATION_STAGE_PROGRESS } from '@/features/register-v2/state/registration.stages'

const COOLDOWN_MACHINE = REGISTRATION_STAGE_PROGRESS.commitmentCooldown
const POST_COOLDOWN_MACHINE = REGISTRATION_STAGE_PROGRESS.validatingCommitment
const PRE_COOLDOWN_DISPLAY = 20
const POST_COOLDOWN_DISPLAY = 80

const MILESTONES = [
  ...new Set(Object.values(REGISTRATION_STAGE_PROGRESS)),
].sort((a, b) => a - b)

const GAP_CLOSE_FRACTION_PER_SEC = 0.07
const MIN_SPEED_PCT_PER_SEC = 0.25
const MIN_SPEED_CHARS_PER_SEC = 0.04
/** Finish the remaining fill in 0.5s once registration succeeds. */
const COMPLETE_SWEEP_SEC = 0.5
const COMPLETE_MIN_SPEED = 50

export interface ForwardProgressInputs {
  stageProgress: number
  isComplete: boolean
  nameLength: number
  cooldownRemainingSeconds: number | null
}

function remapToDisplay(machineProgress: number): number {
  const m = Math.max(0, Math.min(100, machineProgress))
  if (m <= COOLDOWN_MACHINE) {
    return (m / COOLDOWN_MACHINE) * PRE_COOLDOWN_DISPLAY
  }
  if (m >= POST_COOLDOWN_MACHINE) {
    return (
      POST_COOLDOWN_DISPLAY +
      ((m - POST_COOLDOWN_MACHINE) / (100 - POST_COOLDOWN_MACHINE)) *
        (100 - POST_COOLDOWN_DISPLAY)
    )
  }
  return (
    PRE_COOLDOWN_DISPLAY +
    ((m - COOLDOWN_MACHINE) / (POST_COOLDOWN_MACHINE - COOLDOWN_MACHINE)) *
      (POST_COOLDOWN_DISPLAY - PRE_COOLDOWN_DISPLAY)
  )
}

function nextMilestone(machineProgress: number): number {
  for (const milestone of MILESTONES) {
    if (milestone > machineProgress) return milestone
  }
  return 100
}

function displayCap(machineProgress: number): number {
  const current = remapToDisplay(machineProgress)
  const next = remapToDisplay(nextMilestone(machineProgress))
  return current + (next - current) * 0.85
}

/** Advance display progress by `dt` seconds toward the next cap. Pure — no side effects. */
export function advanceForwardProgress(
  inputs: ForwardProgressInputs,
  current: number,
  dt: number,
): number {
  const { stageProgress, isComplete, nameLength, cooldownRemainingSeconds } =
    inputs

  if (isComplete) {
    const remaining = 100 - current
    if (remaining <= 1e-4) return 100
    const speed = Math.max(remaining / COMPLETE_SWEEP_SEC, COMPLETE_MIN_SPEED)
    return Math.min(100, current + speed * dt)
  }

  const pctPerChar = 100 / Math.max(1, nameLength)
  const minSpeed = Math.max(
    MIN_SPEED_PCT_PER_SEC,
    MIN_SPEED_CHARS_PER_SEC * pctPerChar,
  )

  if (cooldownRemainingSeconds !== null && cooldownRemainingSeconds > 0) {
    const cap = POST_COOLDOWN_DISPLAY
    if (current >= cap) return current
    const speed = Math.max(
      (cap - current) / Math.max(cooldownRemainingSeconds, 0.5),
      minSpeed,
    )
    return Math.min(cap, current + speed * dt)
  }

  const cap = displayCap(stageProgress)
  if (current >= cap) return current
  const speed = Math.max((cap - current) * GAP_CLOSE_FRACTION_PER_SEC, minSpeed)
  return Math.min(cap, current + speed * dt)
}

export function snapForwardProgress(value: number): number {
  return value >= 100 - 1e-4 ? 100 : value
}

export function isForwardProgressComplete(
  isComplete: boolean,
  progress: number,
): boolean {
  return isComplete && progress >= 100 - 1e-4
}
