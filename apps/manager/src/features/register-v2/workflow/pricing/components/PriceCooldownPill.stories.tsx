import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { PriceCooldownPill } from './PriceCooldownPill'

const meta = {
  title: 'Register v2/Pricing/Price cooldown/Pill',
  component: PriceCooldownPill,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof PriceCooldownPill>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
