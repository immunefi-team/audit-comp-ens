import {
  JACQUARD_PATTERN3_DYE_BLEED_OPTIONS,
  WEAVE_REGISTRATION_LONG_NAME as LONG_NAME,
  JACQUARD_PATTERN6_DYE_BLEED_OPTIONS as LONG_NAME_WEAVE_OPTIONS,
} from '@ens-apps/weave-loader'
import { useRafProgress } from '@ens-apps/weave-loader/hooks/useRafProgress'
import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useEffect, useRef, useState } from 'react'
import { REGISTRATION_STAGE_PROGRESS } from '@/features/register-v2/state/registration.stages'
import { useForwardProgress } from '../lib/useForwardProgress'
import { WeaveRegistration } from './WeaveRegistration'

const meta = {
  title: 'Features/WeaveRegistration/WeaveRegistration',
  component: WeaveRegistration,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  argTypes: {
    progress: { control: { type: 'range', min: 0, max: 100, step: 1 } },
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-screen w-full items-center justify-center p-8">
        <div className="w-full max-w-6xl">
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    name: 'erni.eth',
    progress: 45,
  },
} satisfies Meta<typeof WeaveRegistration>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Pattern3Preset: Story = {
  args: {
    progress: 45,
    weaveOptions: JACQUARD_PATTERN3_DYE_BLEED_OPTIONS,
  },
}

export const Start: Story = {
  args: { progress: 2 },
}

export const Complete: Story = {
  args: { progress: 100 },
}

export const WithCooldown: Story = {
  args: {
    progress: 40,
    description: 'Waiting for commitment cooldown — register unlocks in 38s',
  },
}

export const LongName: Story = {
  args: {
    name: LONG_NAME,
    progress: 55,
    weaveOptions: LONG_NAME_WEAVE_OPTIONS,
  },
}

const ANIMATED_REGISTRATION_MS = 12_000

export const AnimatedRegistration: Story = {
  render: (args) => {
    const timingRef = useRef({
      start: performance.now(),
      duration: ANIMATED_REGISTRATION_MS,
    })

    const progress = useRafProgress({
      advance: (_ctx, _current, _dt) => {
        const { start, duration } = timingRef.current
        const t = Math.min(1, (performance.now() - start) / duration)
        return (1 - (1 - t) ** 2) * 100
      },
      context: timingRef.current,
      snap: (value) => Math.round(value),
    })

    return <WeaveRegistration {...args} progress={progress} />
  },
}

const STAGE_SEQUENCE = [
  REGISTRATION_STAGE_PROGRESS.settingUpRegistration,
  REGISTRATION_STAGE_PROGRESS.preparingCommitment,
  REGISTRATION_STAGE_PROGRESS.committingTransaction,
  REGISTRATION_STAGE_PROGRESS.waitingForCommitment,
  REGISTRATION_STAGE_PROGRESS.commitmentCooldown,
  REGISTRATION_STAGE_PROGRESS.checkingAllowance,
  REGISTRATION_STAGE_PROGRESS.waitingForApproval,
  REGISTRATION_STAGE_PROGRESS.registeringDomain,
  REGISTRATION_STAGE_PROGRESS.waitingForRegistration,
  REGISTRATION_STAGE_PROGRESS.verifyingRegistration,
]

const COOLDOWN_DEMO_SECONDS = 8

function tickForwardProgressStage(
  stageIndex: number,
  cooldown: number | null,
  cooldownSeconds: number,
):
  | { done: true; cooldownLeft: null }
  | {
      done?: false
      stageIndex: number
      cooldown: number | null
      cooldownLeft?: number | null
    } {
  if (
    STAGE_SEQUENCE[stageIndex] ===
    REGISTRATION_STAGE_PROGRESS.commitmentCooldown
  ) {
    const nextCooldown = (cooldown ?? cooldownSeconds) - 1
    if (nextCooldown > 0) {
      return {
        stageIndex,
        cooldown: nextCooldown,
        cooldownLeft: nextCooldown,
      }
    }
  }

  if (stageIndex + 1 >= STAGE_SEQUENCE.length) {
    return { done: true, cooldownLeft: null }
  }

  return { stageIndex: stageIndex + 1, cooldown: null }
}

const LiveForwardProgressDemo = (
  args: React.ComponentProps<typeof WeaveRegistration>,
) => {
  const [stageIndex, setStageIndex] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [cooldownLeft, setCooldownLeft] = useState<number | null>(null)
  useEffect(() => {
    let i = 0
    let cooldown: number | null = null
    const interval = setInterval(() => {
      const result = tickForwardProgressStage(
        i,
        cooldown,
        COOLDOWN_DEMO_SECONDS,
      )
      if (result.done) {
        clearInterval(interval)
        setCooldownLeft(null)
        setIsComplete(true)
        return
      }
      i = result.stageIndex
      cooldown = result.cooldown
      if (result.cooldownLeft !== undefined) {
        setCooldownLeft(result.cooldownLeft)
        return
      }
      setStageIndex(i)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const stageProgress = STAGE_SEQUENCE[stageIndex] ?? 0
  const { progress } = useForwardProgress(
    stageProgress,
    isComplete,
    args.name.length,
    cooldownLeft,
  )

  return <WeaveRegistration {...args} animate={false} progress={progress} />
}

export const LiveForwardProgress: Story = {
  render: (args) => <LiveForwardProgressDemo {...args} />,
}

export const LiveForwardProgressMaxLength: Story = {
  args: {
    name: LONG_NAME,
    weaveOptions: LONG_NAME_WEAVE_OPTIONS,
  },
  render: (args) => <LiveForwardProgressDemo {...args} />,
}

const RegisteringCompletionHoldDemo = ({
  name = 'erni.eth',
}: {
  name?: string
}) => {
  const [isComplete, setIsComplete] = useState(false)
  const [exitReady, setExitReady] = useState(false)
  const machineProgress = isComplete ? 100 : 88

  useEffect(() => {
    if (!isComplete) setExitReady(false)
  }, [isComplete])

  const { progress: fillProgress, fillDone } = useForwardProgress(
    machineProgress,
    isComplete,
    name.length,
    null,
  )

  useEffect(() => {
    if (!isComplete || !fillDone) return undefined
    const id = window.setTimeout(() => setExitReady(true), 200)
    return () => window.clearTimeout(id)
  }, [fillDone, isComplete])

  const showCenteredLoader = !isComplete || !exitReady

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <button
        className="rounded-lg bg-ens-blue px-4 py-2 text-sm text-white"
        disabled={isComplete}
        onClick={() => setIsComplete(true)}
        type="button"
      >
        Complete registration (fill at ~88%)
      </button>
      <p className="text-ens-gray text-sm">
        Fill progress: {fillProgress.toFixed(1)}%
        {fillDone ? ' — 100% reached' : ''}
        {exitReady ? ' — showing details' : ''}
      </p>
      {showCenteredLoader ? (
        <WeaveRegistration
          animate={false}
          name={name}
          progress={fillProgress}
        />
      ) : (
        <div className="w-full max-w-2xl space-y-4 rounded-xl border border-ens-gray-two p-6">
          <p className="font-medium text-ens-blue text-lg">
            Registration complete
          </p>
          <p className="text-ens-gray text-sm">
            Registration details (shown after fill progress reaches 100%)
          </p>
        </div>
      )}
    </div>
  )
}

export const CompletionHoldTransition: Story = {
  render: () => <RegisteringCompletionHoldDemo />,
}

export const CompletionHoldTransitionLongName: Story = {
  render: () => <RegisteringCompletionHoldDemo name="vitalik.eth" />,
}
