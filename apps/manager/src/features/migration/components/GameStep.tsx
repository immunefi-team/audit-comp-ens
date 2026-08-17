import { Trans, useLingui } from '@lingui/react/macro'
import { AnimatePresence, motion } from 'motion/react'
import { match } from 'ts-pattern'
import { useElementWidth } from '@/features/migration/hooks/useElementWidth'
import type { MigrationStepDescriptor } from '@/features/migration/service/migrationService'
import { useMigrationUiContext } from '@/features/migration/state/migrationUi.context'
import {
  useMigrateSubstep,
  useMigrationProgress,
  useMigrationStepDescriptors,
} from '@/features/migration/state/migrationUi.selectors'
import { cn } from '@/lib/utils'
import {
  computeBridgeLayout,
  describeNextStep,
  displayStepOf,
  giantAnimateFor,
  giantModeOf,
  giantTransitionFor,
  VISIBLE_PLANKS,
} from './GameStep.helpers'

const collapseTransition = {
  duration: 0.8,
  ease: [0.55, 0, 1, 0.45] as const,
}

type BridgePlankProps = {
  readonly completed: boolean
  readonly hasCollapsed: boolean
  readonly id: string
  readonly index: number
  readonly width: number
}

const BridgePlank = ({
  completed,
  hasCollapsed,
  id,
  index,
  width,
}: BridgePlankProps) => {
  const staggerIndex = index % VISIBLE_PLANKS
  const alternatingRotation = index % 2 === 0

  return (
    <motion.div
      animate={
        hasCollapsed
          ? {
              y: 40 + staggerIndex * 15,
              rotate: alternatingRotation ? 12 : -10,
              opacity: 0,
            }
          : { y: 0, rotate: 0, opacity: 1 }
      }
      className="flex items-stretch"
      key={id}
      style={{ width }}
      transition={
        hasCollapsed
          ? {
              ...collapseTransition,
              delay: 0.05 + staggerIndex * 0.06,
            }
          : { duration: 0 }
      }
    >
      <motion.div
        animate={completed ? { scaleX: 1, opacity: 1 } : undefined}
        className={cn(
          'h-6 flex-1 origin-left rounded-[3px] border-x-[3px]',
          completed
            ? 'border-ens-garnet-900/50 bg-ens-garnet-900/45 shadow-[inset_0_-3px_0_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)]'
            : 'border-ens-garnet-900/8 bg-ens-garnet-900/4',
        )}
        initial={completed ? { scaleX: 0, opacity: 0 } : undefined}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      />
      <motion.div
        animate={
          hasCollapsed
            ? {
                y: 30 + staggerIndex * 10,
                rotate: alternatingRotation ? -15 : 8,
                opacity: 0,
              }
            : { y: 0, rotate: 0, opacity: 1 }
        }
        className={cn(
          'ml-1.5 w-1 shrink-0 rounded-sm',
          completed ? 'bg-ens-garnet-900/40' : 'bg-ens-garnet-900/10',
        )}
        transition={
          hasCollapsed
            ? {
                ...collapseTransition,
                delay: 0.08 + staggerIndex * 0.06,
              }
            : { duration: 0 }
        }
      />
    </motion.div>
  )
}

const useStepDescriptionText = (
  progressDescription: string | undefined,
  descriptor: MigrationStepDescriptor | undefined,
): string => {
  const { t } = useLingui()
  const stepDescription = describeNextStep({
    progressDescription,
    descriptor,
  })

  return match(stepDescription)
    .with({ kind: 'progress' }, ({ text }) => text)
    .with({ kind: 'preparing' }, () => t`Getting ready...`)
    .with(
      { kind: 'deploy-hca' },
      () => `${t`Setting up your migration account`}...`,
    )
    .with({ kind: 'approval' }, ({ approvalId }) =>
      match(approvalId)
        .with(
          'base-registrar:hca-token',
          () => `${t`Approve this name for your migration account`}...`,
        )
        .with(
          'base-registrar:hca',
          'name-wrapper:hca',
          () => `${t`Approve your migration account in your wallet`}...`,
        )
        .with(
          'eth-registry:hca',
          () => `${t`Approve manager restoration in your wallet`}...`,
        )
        .exhaustive(),
    )
    .with({ kind: 'atomic-batch' }, ({ index, total, count }) =>
      total === 1
        ? `${t`Upgrading ${count} name(s) atomically`}...`
        : `${t`Upgrading atomic batch ${index + 1} of ${total} (${count} name(s))`}...`,
    )
    .with({ kind: 'cleanup' }, () => `${t`Revoking temporary HCA access`}...`)
    .exhaustive()
}

const FrenParty = ({
  frensX,
  hasCollapsed,
  isExcited,
}: {
  readonly frensX: number
  readonly hasCollapsed: boolean
  readonly isExcited: boolean
}) => (
  <motion.div
    animate={
      hasCollapsed
        ? { x: frensX, y: 300, rotate: 15, opacity: 0 }
        : { x: frensX }
    }
    className="absolute bottom-0 left-0 -translate-x-1/2"
    transition={
      hasCollapsed
        ? { duration: 1, ease: [0.36, 0, 0.66, -0.56] }
        : { type: 'spring', stiffness: 80, damping: 18 }
    }
  >
    <div className="flex items-end gap-1">
      <motion.img
        alt=""
        animate={
          isExcited
            ? { y: [0, -12, 0], rotate: [0, -5, 5, 0] }
            : { y: 0, rotate: 0 }
        }
        className="h-[54px] shrink-0"
        src="/frens/peanut.svg"
        transition={
          isExcited
            ? {
                duration: 0.5,
                repeat: Number.POSITIVE_INFINITY,
                repeatDelay: 0.1,
              }
            : { duration: 0.3 }
        }
      />
      <motion.img
        alt=""
        animate={
          isExcited
            ? { y: [0, -16, 0], rotate: [0, 4, -4, 0] }
            : { y: 0, rotate: 0 }
        }
        className="h-[72px] shrink-0"
        src="/frens/lili.svg"
        transition={
          isExcited
            ? {
                duration: 0.6,
                repeat: Number.POSITIVE_INFINITY,
                repeatDelay: 0.05,
                delay: 0.1,
              }
            : { duration: 0.3 }
        }
      />
      <div className="relative shrink-0">
        <motion.img
          alt=""
          animate={
            isExcited
              ? { y: [0, -20, -10, 0], x: [0, 5, -5, 0] }
              : { y: [0, -6, -3, 0] }
          }
          className="absolute top-[-36px] left-1/2 h-[30px] -translate-x-1/2"
          src="/frens/bittu.svg"
          transition={
            isExcited
              ? {
                  duration: 0.8,
                  ease: 'easeInOut',
                  repeat: Number.POSITIVE_INFINITY,
                }
              : {
                  duration: 4,
                  ease: 'easeInOut',
                  repeat: Number.POSITIVE_INFINITY,
                }
          }
        />
        <motion.img
          alt=""
          animate={
            isExcited
              ? { y: [0, -10, 0], rotate: [0, -3, 3, 0] }
              : { y: 0, rotate: 0 }
          }
          className="h-[60px] shrink-0"
          src="/frens/kuzco.svg"
          transition={
            isExcited
              ? {
                  duration: 0.55,
                  repeat: Number.POSITIVE_INFINITY,
                  repeatDelay: 0.15,
                  delay: 0.2,
                }
              : { duration: 0.3 }
          }
        />
      </div>
    </div>
  </motion.div>
)

export const GameStep = () => {
  const { ref: trackRef, width: trackWidth } = useElementWidth()

  const { uiActor } = useMigrationUiContext()
  const substep = useMigrateSubstep(uiActor)
  const progress = useMigrationProgress(uiActor)
  const stepDescriptors = useMigrationStepDescriptors(uiActor)

  const hasCollapsed = substep === 'failing'

  const totalSteps = Math.max(progress?.totalSteps ?? stepDescriptors.length, 1)
  const completedSteps = progress?.currentStep ?? 0
  const displayStep = displayStepOf(completedSteps, totalSteps)
  const { plankWidth, frensX, scrollOffset, totalBridgeWidth } =
    computeBridgeLayout({ totalSteps, completedSteps, trackWidth })

  const isExcited = !!progress?.txHash && !hasCollapsed

  const nextDescriptor = stepDescriptors[completedSteps] as
    | MigrationStepDescriptor
    | undefined

  const descriptionText = useStepDescriptionText(
    progress?.description,
    nextDescriptor,
  )

  const stepIds = Array.from({ length: totalSteps }, (_, i) => `step-${i}`)

  const giantMode = giantModeOf({ hasCollapsed, isExcited })
  const giantAnimate = giantAnimateFor(giantMode)
  const giantTransition = giantTransitionFor(giantMode)

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-5 md:px-8">
      <div className="flex h-full w-full flex-col items-center justify-center">
        <motion.div
          animate={hasCollapsed ? { opacity: 0 } : { opacity: 1 }}
          className="flex h-11 shrink-0 items-center"
          transition={{ duration: 0.3 }}
        >
          <p className="text-center text-[32px] text-ens-garnet-900 leading-[1.1] tracking-[-0.64px]">
            <Trans>Upgrading your names...</Trans>
          </p>
        </motion.div>

        <motion.div
          animate={hasCollapsed ? { opacity: 0 } : { opacity: 1 }}
          className="flex h-6 shrink-0 items-center overflow-hidden"
          transition={{ duration: 0.3 }}
        >
          <AnimatePresence mode="popLayout">
            <motion.span
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              className="font-semi-mono text-ens-garnet-500 text-xs uppercase tracking-[0.12px]"
              exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
              initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
              key={descriptionText}
              transition={{ duration: 0.3 }}
            >
              {descriptionText}
            </motion.span>
          </AnimatePresence>
        </motion.div>

        {totalSteps > 1 && (
          <motion.div
            animate={hasCollapsed ? { opacity: 0 } : { opacity: 1 }}
            className="mt-1 flex h-4 shrink-0 items-center"
            transition={{ duration: 0.3 }}
          >
            <span className="font-semi-mono text-[10px] text-ens-garnet-400 uppercase tabular-nums tracking-[0.12px]">
              {displayStep}/{totalSteps}
            </span>
          </motion.div>
        )}

        <div className="relative mt-4 h-[360px] w-full max-w-[1040px] shrink-0">
          <div className="absolute inset-0">
            <div
              className="absolute right-[120px] bottom-[70px] left-0 z-10"
              ref={trackRef}
            >
              <FrenParty
                frensX={frensX}
                hasCollapsed={hasCollapsed}
                isExcited={isExcited}
              />
            </div>

            <motion.div
              animate={giantAnimate}
              className="absolute right-0 bottom-6"
              transition={giantTransition}
            >
              <img alt="" className="h-28" src="/frens/giant.svg" />
            </motion.div>

            <motion.div
              animate={
                hasCollapsed
                  ? { y: 300, opacity: 0, rotate: 3 }
                  : { y: 0, opacity: 1, rotate: 0 }
              }
              className="absolute right-[120px] bottom-6 left-0 origin-bottom overflow-hidden"
              transition={hasCollapsed ? collapseTransition : { duration: 0 }}
            >
              <div className="mb-[2px] h-[2px] rounded-full bg-ens-garnet-900/30" />

              <div className="overflow-hidden">
                <motion.div
                  animate={{ x: -scrollOffset }}
                  className="flex items-stretch gap-1.5"
                  style={{ width: totalBridgeWidth || '100%' }}
                  transition={{ type: 'spring', stiffness: 80, damping: 18 }}
                >
                  <motion.div
                    animate={
                      hasCollapsed
                        ? { y: 20, rotate: -8, opacity: 0 }
                        : { y: 0, rotate: 0, opacity: 1 }
                    }
                    className="w-1 shrink-0 rounded-sm bg-ens-garnet-900/40"
                    transition={
                      hasCollapsed
                        ? { ...collapseTransition, delay: 0 }
                        : { duration: 0 }
                    }
                  />
                  {stepIds.map((id, index) => (
                    <BridgePlank
                      completed={index < completedSteps}
                      hasCollapsed={hasCollapsed}
                      id={id}
                      index={index}
                      key={id}
                      width={plankWidth - 6}
                    />
                  ))}
                </motion.div>
              </div>

              <div className="mt-[2px] h-[2px] rounded-full bg-ens-garnet-900/30" />
            </motion.div>

            <motion.div
              animate={hasCollapsed ? { opacity: 0 } : { opacity: 1 }}
              className="absolute right-[120px] bottom-[23px] left-0 h-px bg-ens-garnet-900/5"
              transition={hasCollapsed ? { duration: 0.3 } : { duration: 0 }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
