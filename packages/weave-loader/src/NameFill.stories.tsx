import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useEffect, useState } from 'react'
import { NameFill } from './NameFill'
import {
  WEAVE_REGISTRATION_LONG_NAME,
  WEAVE_REGISTRATION_NAME_FILL,
} from './weaveNameFill'

const meta = {
  title: 'Components/WeaveLoader/NameFill',
  component: NameFill,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    progress: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
    fontSize: { control: { type: 'range', min: 24, max: 140, step: 2 } },
    fill: { control: { type: 'color' } },
    baseColor: { control: { type: 'color' } },
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-[200px] w-full items-center justify-center p-10">
        <Story />
      </div>
    ),
  ],
  args: {
    name: 'erni.eth',
    progress: 0.5,
    fill: '#0080bc',
    fontSize: 80,
  },
} satisfies Meta<typeof NameFill>

export default meta
type Story = StoryObj<typeof meta>

/** Half filled with ENS blue over a light-grey base. */
export const Default: Story = {}

/** Nothing filled yet — light-grey base only. */
export const Idle: Story = {
  args: { progress: 0 },
}

/** Fully filled. */
export const Complete: Story = {
  args: { progress: 1 },
}

/** Garnet (pink) fill. */
export const GarnetFill: Story = {
  args: { progress: 0.6, fill: '#e72a96' },
}

/** Any CSS background works, including a gradient. */
export const GradientFill: Story = {
  args: {
    progress: 0.7,
    fill: 'linear-gradient(90deg, #0080bc, #e72a96)',
  },
}

/** Animated full loop: progress ramps 0→1 then restarts. */
export const AnimatedLoop: Story = {
  render: (args) => {
    const [progress, setProgress] = useState(0)
    useEffect(() => {
      const DURATION = 6000
      let raf = 0
      let start = performance.now()
      const tick = (now: number) => {
        setProgress(((now - start) % DURATION) / DURATION)
        if (now - start >= DURATION) start = now
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(raf)
    }, [])
    return <NameFill {...args} progress={progress} />
  },
}

/** Long name — multi-line fill must not bleed onto lower lines. */
export const FigmaLongName: Story = {
  args: {
    name: WEAVE_REGISTRATION_LONG_NAME,
    progress: 0.55,
    className: 'w-full whitespace-normal break-all',
    ...WEAVE_REGISTRATION_NAME_FILL,
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-[200px] w-full max-w-6xl items-start justify-center p-10">
        <div className="flex h-full w-[50%] min-w-0 flex-col gap-12">
          <Story />
        </div>
      </div>
    ),
  ],
}
