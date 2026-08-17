import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useEffect, useState } from 'react'
import { WeaveLoader, type WeaveStep } from './WeaveLoader'

// Demo steps with pre-resolved string labels (the live app passes translated
// copy from the manager's registration step catalog).
const DEMO_STEPS: WeaveStep[] = [
  { label: 'Reserving your name', end: 0.16 },
  { label: 'Carving your name into the blockchain', end: 0.32 },
  { label: 'Making your name work everywhere', end: 0.48 },
  { label: 'Planting your name in the infinite garden', end: 0.62 },
  { label: 'Farming aura', end: 0.76 },
  { label: 'Growing your corner of the decentralized web', end: 0.9 },
  { label: 'Placing your new identity in your wallet', end: 1 },
]

const meta = {
  title: 'Components/WeaveLoader',
  component: WeaveLoader,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    progress: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
    fontSize: { control: { type: 'range', min: 24, max: 140, step: 2 } },
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-[320px] w-full items-center justify-center p-10">
        <Story />
      </div>
    ),
  ],
  args: {
    name: 'erni.eth',
    progress: 0.6,
    fontSize: 80,
    steps: DEMO_STEPS,
  },
} satisfies Meta<typeof WeaveLoader>

export default meta
type Story = StoryObj<typeof meta>

/** Mid-registration: the name is partly woven and the step label tracks progress. */
export const Default: Story = {}

/** Nothing woven yet — light-grey base name, first step. */
export const Idle: Story = {
  args: { progress: 0 },
}

/** Fully registered — name completely woven, final step. */
export const Complete: Story = {
  args: { progress: 1 },
}

/** Long name to check measurement + reveal scaling. */
export const LongName: Story = {
  args: { name: 'verylongname.eth', progress: 0.5, fontSize: 56 },
}

/** Each playful step at the progress where it becomes active. */
export const AllSteps: Story = {
  render: (args) => (
    <div className="flex flex-col gap-10">
      {DEMO_STEPS.map((step, i) => {
        const prev = i === 0 ? 0 : (DEMO_STEPS[i - 1]?.end ?? 0)
        const mid = (prev + step.end) / 2
        return (
          <WeaveLoader
            key={step.label}
            {...args}
            fontSize={48}
            progress={mid}
          />
        )
      })}
    </div>
  ),
  parameters: { layout: 'padded' },
}

/** Animated full loop: progress ramps 0→1 then restarts, like a live registration. */
export const AnimatedLoop: Story = {
  render: (args) => {
    const [progress, setProgress] = useState(0)
    useEffect(() => {
      const DURATION = 9000
      let raf = 0
      let start = performance.now()
      const tick = (now: number) => {
        const t = ((now - start) % DURATION) / DURATION
        setProgress(t)
        if (now - start >= DURATION) start = now
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(raf)
    }, [])
    return <WeaveLoader {...args} progress={progress} />
  },
}

/** Reduced-motion: fill snaps to progress with no transition. */
export const ReducedMotion: Story = {
  args: { progress: 0.7, animate: false },
}

/** Garnet (pink) single colorway instead of the multi-colorway default. */
export const GarnetColorway: Story = {
  args: {
    progress: 0.65,
    weaveOptions: { useAllColorways: false, palette: 1, gridSize: 28 },
  },
}
