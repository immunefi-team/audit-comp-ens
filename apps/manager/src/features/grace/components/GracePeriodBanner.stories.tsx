import type { Meta, StoryObj } from '@storybook/tanstack-react'
import type { GracePeriodBannerVariant } from './GracePeriodBanner'
import { GracePeriodBanner } from './GracePeriodBanner'

const graceEndDate = new Date('2024-01-17T00:00:00Z')

const meta = {
  title: 'Features/Grace/GracePeriodBanner',
  component: GracePeriodBanner,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  args: {
    graceEndDate,
    renewName: 'example.eth',
    daysSinceExpiry: 12,
    isV2: true,
    previewRenew: true,
  },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'primaryExpired',
        'anyNameExpired',
        'profileOwnName',
        'profileNotOwnedName',
      ] satisfies GracePeriodBannerVariant[],
    },
    graceEndDate: { control: 'date' },
    daysSinceExpiry: { control: 'number' },
    isV2: { control: 'boolean' },
    previewRenew: { control: 'boolean' },
  },
} satisfies Meta<typeof GracePeriodBanner>

export default meta
type Story = StoryObj<typeof meta>

export const PrimaryExpired: Story = {
  args: {
    variant: 'primaryExpired',
    daysSinceExpiry: 12,
  },
}

export const PrimaryExpiredWithoutDayCount: Story = {
  args: {
    variant: 'primaryExpired',
    daysSinceExpiry: null,
  },
}

export const AnyNameExpired: Story = {
  args: {
    variant: 'anyNameExpired',
  },
}

export const ProfileOwnName: Story = {
  args: {
    variant: 'profileOwnName',
  },
}

export const ProfileNotOwnedName: Story = {
  args: {
    variant: 'profileNotOwnedName',
  },
}

export const V1GracePeriod: Story = {
  args: {
    variant: 'anyNameExpired',
    isV2: false,
  },
}

export const MobileWidth: Story = {
  render: (args) => (
    <div className="w-full max-w-sm">
      <GracePeriodBanner {...args} />
    </div>
  ),
  args: {
    variant: 'primaryExpired',
    daysSinceExpiry: 12,
    previewRenew: true,
  },
}

export const DesktopWidth: Story = {
  render: (args) => (
    <div className="w-full max-w-5xl">
      <GracePeriodBanner {...args} />
    </div>
  ),
  args: {
    variant: 'anyNameExpired',
    previewRenew: true,
  },
}

export const AllVariants: Story = {
  args: {
    variant: 'primaryExpired',
    graceEndDate,
    renewName: 'example.eth',
    previewRenew: true,
  },
  render: () => (
    <div className="flex w-full max-w-5xl flex-col gap-6">
      <GracePeriodBanner
        daysSinceExpiry={12}
        graceEndDate={graceEndDate}
        previewRenew
        renewName="primary.eth"
        variant="primaryExpired"
      />
      <GracePeriodBanner
        graceEndDate={graceEndDate}
        previewRenew
        renewName="other.eth"
        variant="anyNameExpired"
      />
      <GracePeriodBanner
        graceEndDate={graceEndDate}
        previewRenew
        renewName="profile.eth"
        variant="profileOwnName"
      />
      <GracePeriodBanner
        graceEndDate={graceEndDate}
        previewRenew
        renewName="not-owned.eth"
        variant="profileNotOwnedName"
      />
    </div>
  ),
}
