import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { GracePeriodBadge } from './GracePeriodBadge'

const meta = {
  title: 'Features/Grace/GracePeriodBadge',
  component: GracePeriodBadge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof GracePeriodBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
