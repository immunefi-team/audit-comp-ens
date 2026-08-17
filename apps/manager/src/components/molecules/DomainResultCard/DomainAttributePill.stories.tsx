import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { DomainAttributePill } from './DomainAttributePill'

const meta = {
  title: 'Molecules/DomainResultCard/DomainAttributePill',
  component: DomainAttributePill,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['available', 'premium-3', 'premium-4'],
    },
    label: {
      control: 'text',
    },
    className: {
      control: 'text',
    },
  },
} satisfies Meta<typeof DomainAttributePill>

export default meta
type Story = StoryObj<typeof meta>

export const Available: Story = {
  args: {
    label: 'available',
    variant: 'available',
  },
}

export const Premium3: Story = {
  args: {
    label: '3 character',
    variant: 'premium-3',
  },
}

export const Premium4: Story = {
  args: {
    label: '4 character',
    variant: 'premium-4',
  },
}

export const AllVariants: Story = {
  args: {
    label: 'available',
    variant: 'available',
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <DomainAttributePill label="available" variant="available" />
      <DomainAttributePill label="3 character" variant="premium-3" />
      <DomainAttributePill label="4 character" variant="premium-4" />
    </div>
  ),
}

export const LongLabel: Story = {
  args: {
    label: 'Premium 4+ character name',
    variant: 'premium-4',
  },
}
