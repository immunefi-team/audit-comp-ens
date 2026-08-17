import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Alert } from './Alert'

const meta = {
  title: 'Molecules/Alert',
  component: Alert,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'success', 'warning', 'destructive'],
    },
  },
} satisfies Meta<typeof Alert>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    title: 'Information',
    description: 'This is a default alert message.',
  },
}

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Alert
        description="This is an informational message."
        title="Information"
        variant="default"
      />
      <Alert
        description="Your action was completed successfully."
        title="Success"
        variant="success"
      />
      <Alert
        description="Please review this information carefully."
        title="Warning"
        variant="warning"
      />
      <Alert
        description="Something went wrong. Please try again."
        title="Error"
        variant="destructive"
      />
    </div>
  ),
}

export const TitleOnly: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Alert title="Just a title" variant="default" />
      <Alert title="Success!" variant="success" />
      <Alert title="Warning!" variant="warning" />
      <Alert title="Error!" variant="destructive" />
    </div>
  ),
}

export const DescriptionOnly: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Alert
        description="Just a description without title."
        variant="default"
      />
      <Alert
        description="Operation completed successfully."
        variant="success"
      />
      <Alert description="This action cannot be undone." variant="warning" />
      <Alert description="Failed to save changes." variant="destructive" />
    </div>
  ),
}

export const CustomIcons: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Alert
        description="This alert uses a custom icon."
        icon={<span>🔔</span>}
        title="Custom Icon"
        variant="default"
      />
      <Alert
        description="Custom icon for success state."
        icon={<span>🎉</span>}
        title="Custom Success"
        variant="success"
      />
    </div>
  ),
}

export const WithChildren: Story = {
  render: () => (
    <Alert title="Action Required" variant="warning">
      <p>Your subscription expires in 3 days.</p>
      <button
        className="mt-2 rounded bg-yellow-600 px-4 py-2 text-white hover:bg-yellow-700"
        type="button"
      >
        Renew Subscription
      </button>
    </Alert>
  ),
}

export const RealWorldExamples: Story = {
  render: () => (
    <div className="flex max-w-2xl flex-col gap-4">
      <Alert
        description="example.eth has been registered to your wallet."
        title="Domain registered successfully!"
        variant="success"
      />

      <Alert
        description="Current network congestion may result in higher transaction costs."
        title="Gas fees are high"
        variant="warning"
      />

      <Alert
        description="Insufficient funds to complete the registration."
        title="Transaction failed"
        variant="destructive"
      />

      <Alert
        description="The domain you searched for is available for registration."
        title="ENS Domain Available"
        variant="default"
      />
    </div>
  ),
}

export const SystemMessages: Story = {
  render: () => (
    <div className="space-y-4">
      <Alert variant="default">
        <div>
          <h4 className="font-semibold">System Maintenance</h4>
          <p className="mt-1">
            Our services will be temporarily unavailable on March 15th from 2:00
            AM to 4:00 AM UTC for scheduled maintenance.
          </p>
          <ul className="mt-2 list-inside list-disc text-sm">
            <li>Domain registration will be disabled</li>
            <li>Existing domains will continue to resolve</li>
            <li>Dashboard access may be limited</li>
          </ul>
        </div>
      </Alert>
    </div>
  ),
}
