import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useEffect, useRef, useState } from 'react'
import { WEAVE_PROGRESS_BAR_HEIGHT, WeaveProgressBar } from './WeaveProgressBar'

const REGISTRATION_TRACK_WIDTH = 672

const meta = {
  title: 'Components/WeaveLoader/WeaveProgressBar',
  component: WeaveProgressBar,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  argTypes: {
    progress: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
    height: { control: { type: 'range', min: 8, max: 40, step: 1 } },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-2xl">
        <Story />
      </div>
    ),
  ],
  args: {
    progress: 0.5,
    height: WEAVE_PROGRESS_BAR_HEIGHT,
  },
} satisfies Meta<typeof WeaveProgressBar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  args: { progress: 0 },
}

export const Full: Story = {
  args: { progress: 1 },
}

export const FigmaSpec: Story = {
  args: {
    progress: 0.42,
    height: WEAVE_PROGRESS_BAR_HEIGHT,
    animate: false,
  },
  decorators: [
    (Story) => (
      <div style={{ width: REGISTRATION_TRACK_WIDTH }}>
        <Story />
      </div>
    ),
  ],
}

export const AnimatedFill: Story = {
  render: (args) => {
    const [progress, setProgress] = useState(0)
    const startRef = useRef<number | null>(null)
    useEffect(() => {
      const DURATION = 8000
      let raf = 0
      const tick = (now: number) => {
        if (startRef.current === null) startRef.current = now
        setProgress(((now - startRef.current) % DURATION) / DURATION)
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(raf)
    }, [])
    return <WeaveProgressBar {...args} animate progress={progress} />
  },
}

export const RegistrationProgress: Story = {
  render: (args) => {
    const [progress, setProgress] = useState(0)
    useEffect(() => {
      const interval = setInterval(() => {
        setProgress((current) => {
          if (current >= 1) return 0
          return Math.min(1, current + 0.004)
        })
      }, 50)
      return () => clearInterval(interval)
    }, [])
    return (
      <div className="flex w-full max-w-2xl flex-col gap-3">
        <p className="font-mono text-ens-gray text-xs tabular-nums">
          {(progress * 100).toFixed(1)}%
        </p>
        <WeaveProgressBar {...args} animate={false} progress={progress} />
      </div>
    )
  },
}
