import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { QRPattern } from './QRPattern'

const meta: Meta<typeof QRPattern> = {
  title: 'Atoms/QRPattern',
  component: QRPattern,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
    className: {
      control: 'text',
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    size: 'md',
  },
}

export const Small: Story = {
  args: {
    size: 'sm',
  },
}

export const Large: Story = {
  args: {
    size: 'lg',
  },
}

export const WithCustomClassName: Story = {
  args: {
    size: 'md',
    className: 'border border-gray-300 rounded-lg p-4',
  },
}

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-8">
      <div className="text-center">
        <QRPattern size="sm" />
        <p className="mt-2 text-sm">Small</p>
      </div>
      <div className="text-center">
        <QRPattern size="md" />
        <p className="mt-2 text-sm">Medium</p>
      </div>
      <div className="text-center">
        <QRPattern size="lg" />
        <p className="mt-2 text-sm">Large</p>
      </div>
    </div>
  ),
}
