import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Badge } from './Badge'

const meta = {
  title: 'Atoms/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'secondary',
        'outline',
        'destructive',
        'available',
        'unavailable',
        'premium',
      ],
    },
    size: {
      control: 'select',
      options: ['sm', 'default', 'lg'],
    },
  },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: 'Default Badge',
  },
}

// @ts-expect-error - TODO: Fix args
export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="destructive">Destructive</Badge>
    </div>
  ),
}

// @ts-expect-error - TODO: Fix args
export const CustomVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="available">Available</Badge>
      <Badge variant="unavailable">Unavailable</Badge>
      <Badge variant="premium">Premium</Badge>
    </div>
  ),
}

// @ts-expect-error - TODO: Fix args
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge size="sm">Small</Badge>
      <Badge size="default">Default</Badge>
      <Badge size="lg">Large</Badge>
    </div>
  ),
}

// @ts-expect-error - TODO: Fix args
export const DomainStatuses: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span>example.eth</span>
        <Badge variant="available">Available</Badge>
      </div>
      <div className="flex items-center gap-2">
        <span>premium.eth</span>
        <Badge variant="premium">Premium</Badge>
      </div>
      <div className="flex items-center gap-2">
        <span>taken.eth</span>
        <Badge variant="unavailable">Unavailable</Badge>
      </div>
    </div>
  ),
}

// @ts-expect-error - TODO: Fix args
export const WithNumbers: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">99+</Badge>
      <Badge variant="destructive">Error</Badge>
      <Badge variant="available">✓ Valid</Badge>
      <Badge variant="secondary">v2.1.0</Badge>
    </div>
  ),
}

// @ts-expect-error - TODO: Fix args
export const AllCombinations: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4">
      <div>
        <h4 className="mb-2 font-semibold text-sm">Small</h4>
        <div className="flex flex-col gap-1">
          <Badge size="sm" variant="default">
            Default
          </Badge>
          <Badge size="sm" variant="available">
            Available
          </Badge>
          <Badge size="sm" variant="premium">
            Premium
          </Badge>
        </div>
      </div>
      <div>
        <h4 className="mb-2 font-semibold text-sm">Default</h4>
        <div className="flex flex-col gap-1">
          <Badge size="default" variant="default">
            Default
          </Badge>
          <Badge size="default" variant="available">
            Available
          </Badge>
          <Badge size="default" variant="premium">
            Premium
          </Badge>
        </div>
      </div>
      <div>
        <h4 className="mb-2 font-semibold text-sm">Large</h4>
        <div className="flex flex-col gap-1">
          <Badge size="lg" variant="default">
            Default
          </Badge>
          <Badge size="lg" variant="available">
            Available
          </Badge>
          <Badge size="lg" variant="premium">
            Premium
          </Badge>
        </div>
      </div>
    </div>
  ),
}
