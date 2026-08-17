import type { ExpiryStageId } from '#types/events/index.js'

export type ExpiryStageConfig = {
  id: ExpiryStageId
  offsetDays: number
  includeFavorites: boolean
}

export const STAGES: ExpiryStageConfig[] = [
  {
    id: '30d',
    offsetDays: 30,
    includeFavorites: false,
  },
  {
    id: '7d',
    offsetDays: 7,
    includeFavorites: true,
  },
  {
    id: '1d',
    offsetDays: 1,
    includeFavorites: true,
  },
  {
    id: 'expired',
    offsetDays: 0,
    includeFavorites: true,
  },
]

const DAY_IN_SECONDS = 24 * 60 * 60

export function getUpperBoundForStage(
  stage: ExpiryStageConfig,
  nowSec: number,
) {
  if (stage.id === 'expired') {
    return nowSec
  }

  return nowSec + stage.offsetDays * DAY_IN_SECONDS
}
