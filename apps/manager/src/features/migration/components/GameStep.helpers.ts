import { match, P } from 'ts-pattern'
import type { MigrationApprovalId } from '@/features/migration/service/migrationApprovals'
import type { MigrationStepDescriptor } from '@/features/migration/service/migrationService'

export const VISIBLE_PLANKS = 6

export type BridgeLayout = {
  readonly plankWidth: number
  readonly frensX: number
  readonly scrollOffset: number
  readonly totalBridgeWidth: number
  readonly needsScroll: boolean
}

export const computeBridgeLayout = (params: {
  readonly totalSteps: number
  readonly completedSteps: number
  readonly trackWidth: number
  readonly visiblePlanks?: number
}): BridgeLayout => {
  const { totalSteps, completedSteps, trackWidth } = params
  const visiblePlanks = params.visiblePlanks ?? VISIBLE_PLANKS
  const activeStep = Math.min(
    Math.max(completedSteps, 0),
    Math.max(totalSteps - 1, 0),
  )
  const needsScroll = totalSteps > visiblePlanks
  const plankWidth =
    trackWidth > 0 ? trackWidth / Math.min(totalSteps, visiblePlanks) : 0
  const totalBridgeWidth = plankWidth * totalSteps

  if (!needsScroll || trackWidth === 0) {
    const frensX = ((activeStep + 0.5) / totalSteps) * trackWidth
    return {
      plankWidth,
      frensX,
      scrollOffset: 0,
      totalBridgeWidth,
      needsScroll,
    }
  }

  const midPlank = Math.floor(visiblePlanks / 2)
  const scrollStart = midPlank
  const scrollEnd = totalSteps - (visiblePlanks - midPlank)

  if (activeStep < scrollStart) {
    return {
      plankWidth,
      frensX: (activeStep + 0.5) * plankWidth,
      scrollOffset: 0,
      totalBridgeWidth,
      needsScroll,
    }
  }
  if (activeStep >= scrollEnd) {
    const stepsFromEnd = totalSteps - activeStep
    return {
      plankWidth,
      frensX: trackWidth - (stepsFromEnd - 0.5) * plankWidth,
      scrollOffset: (scrollEnd - scrollStart) * plankWidth,
      totalBridgeWidth,
      needsScroll,
    }
  }
  return {
    plankWidth,
    frensX: (midPlank + 0.5) * plankWidth,
    scrollOffset: (activeStep - scrollStart) * plankWidth,
    totalBridgeWidth,
    needsScroll,
  }
}

export type StepDescription =
  | { readonly kind: 'progress'; readonly text: string }
  | { readonly kind: 'preparing' }
  | { readonly kind: 'deploy-hca' }
  | { readonly kind: 'approval'; readonly approvalId: MigrationApprovalId }
  | {
      readonly kind: 'atomic-batch'
      readonly index: number
      readonly total: number
      readonly count: number
    }
  | { readonly kind: 'cleanup' }

export const describeNextStep = (params: {
  readonly progressDescription?: string
  readonly descriptor: MigrationStepDescriptor | undefined
}): StepDescription =>
  match(params)
    .with(
      { progressDescription: P.string },
      ({ progressDescription }) =>
        ({ kind: 'progress' as const, text: progressDescription }) as const,
    )
    .with({ descriptor: P.nullish }, () => ({ kind: 'preparing' as const }))
    .with({ descriptor: { type: 'deploy-hca' } }, () => ({
      kind: 'deploy-hca' as const,
    }))
    .with({ descriptor: { type: 'approval' } }, ({ descriptor }) => ({
      kind: 'approval' as const,
      approvalId: descriptor.approvalId,
    }))
    .with({ descriptor: { type: 'atomic-batch' } }, ({ descriptor }) => ({
      kind: 'atomic-batch' as const,
      index: descriptor.index,
      total: descriptor.total,
      count: descriptor.count,
    }))
    .with({ descriptor: { type: 'cleanup' } }, () => ({
      kind: 'cleanup' as const,
    }))
    .exhaustive()

export type GiantMode = 'collapsed' | 'excited' | 'idle'

export const giantModeOf = (params: {
  readonly hasCollapsed: boolean
  readonly isExcited: boolean
}): GiantMode =>
  match(params)
    .with({ hasCollapsed: true }, () => 'collapsed' as const)
    .with({ isExcited: true }, () => 'excited' as const)
    .otherwise(() => 'idle' as const)

export const giantAnimateFor = (mode: GiantMode) =>
  match(mode)
    .with('collapsed', () => ({ y: 300, rotate: -10, opacity: 0 }))
    .with('excited', () => ({ y: [0, -14, 0], scale: [1, 1.05, 1] }))
    .with('idle', () => ({ y: [0, -6, 0] }))
    .exhaustive()

export const giantTransitionFor = (mode: GiantMode) =>
  match(mode)
    .with('collapsed', () => ({
      duration: 0.9,
      ease: [0.36, 0, 0.66, -0.56] as const,
      delay: 0.1,
    }))
    .with('excited', () => ({
      duration: 0.7,
      ease: 'easeInOut' as const,
      repeat: Number.POSITIVE_INFINITY,
    }))
    .with('idle', () => ({
      duration: 4,
      ease: 'easeInOut' as const,
      repeat: Number.POSITIVE_INFINITY,
    }))
    .exhaustive()

export const displayStepOf = (
  completedSteps: number,
  totalSteps: number,
): number => Math.min(completedSteps + 1, totalSteps)
