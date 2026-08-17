import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { DomainProfileCard } from './DomainProfileCard'

const meta = {
  title: 'Molecules/DomainProfileCard',
  component: DomainProfileCard,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="mx-auto flex w-full max-w-4xl items-center justify-center">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    domainName: {
      control: 'text',
    },
    avatarUrl: {
      control: 'text',
    },
    registeredDate: {
      control: 'date',
    },
    expiryDate: {
      control: 'date',
    },
  },
} satisfies Meta<typeof DomainProfileCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    domainName: 'example.eth',
    registeredDate: new Date('2023-01-15'),
    expiryDate: new Date('2024-01-15'),
  },
}

export const WithAvatar: Story = {
  args: {
    domainName: 'vitalik.eth',
    avatarUrl: 'https://i.imgur.com/3QXU8wR.png',
    registeredDate: new Date('2022-05-10'),
    expiryDate: new Date('2025-05-10'),
  },
}

export const WithAction: Story = {
  args: {
    domainName: 'ens.eth',
    registeredDate: new Date('2021-03-20'),
    expiryDate: new Date('2026-03-20'),
  },
}

export const WithoutDates: Story = {
  args: {
    domainName: 'newdomain.eth',
  },
}

export const OnlyRegisteredDate: Story = {
  args: {
    domainName: 'registered.eth',
    registeredDate: new Date('2023-09-15'),
  },
}

export const OnlyExpiryDate: Story = {
  args: {
    domainName: 'expires.eth',
    expiryDate: new Date('2025-12-31'),
  },
}

export const LongDomainName: Story = {
  args: {
    domainName: 'verylongdomainname.eth',
    registeredDate: new Date('2022-01-01'),
    expiryDate: new Date('2027-01-01'),
    avatarUrl: 'https://i.imgur.com/3QXU8wR.png',
  },
}

export const ShortDomainName: Story = {
  args: {
    domainName: 'a.eth',
    registeredDate: new Date('2020-01-01'),
    expiryDate: new Date('2025-01-01'),
  },
}

export const DateStringFormat: Story = {
  args: {
    domainName: 'datestring.eth',
    registeredDate: '2023-03-15',
    expiryDate: '2024-03-15',
  },
}

// @ts-expect-error - TODO: Fix args
export const WithActionHandlers: Story = {
  render: () => (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <DomainProfileCard
        domainName="action1.eth"
        expiryDate={new Date('2024-01-15')}
        registeredDate={new Date('2023-01-15')}
      />
      <DomainProfileCard
        avatarUrl="https://i.imgur.com/3QXU8wR.png"
        domainName="action2.eth"
        expiryDate={new Date('2025-05-10')}
        registeredDate={new Date('2022-05-10')}
      />
    </div>
  ),
}
