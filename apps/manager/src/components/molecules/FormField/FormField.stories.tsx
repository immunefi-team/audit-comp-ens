import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { FormField } from './FormField'

const meta = {
  title: 'Molecules/FormField',
  component: FormField,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'tel', 'url', 'number', 'search'],
    },
    variant: {
      control: 'select',
      options: ['default', 'error', 'success'],
    },
    required: {
      control: 'boolean',
    },
    disabled: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof FormField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    label: 'Email Address',
    name: 'email',
    placeholder: 'Enter your email',
  },
}

export const Required: Story = {
  args: {
    label: 'Full Name',
    name: 'fullName',
    placeholder: 'Enter your full name',
    required: true,
  },
}

export const WithHelperText: Story = {
  args: {
    label: 'Username',
    name: 'username',
    placeholder: 'Choose a username',
    helperText:
      'Must be at least 3 characters long and contain only letters and numbers',
  },
}

export const WithError: Story = {
  args: {
    label: 'Password',
    name: 'password',
    type: 'password',
    placeholder: 'Enter password',
    errorText: 'Password must be at least 8 characters long',
  },
}

// @ts-expect-error - TODO: Fix args
export const DifferentTypes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <FormField
        label="Email"
        name="email"
        placeholder="your@email.com"
        type="email"
      />
      <FormField
        label="Phone Number"
        name="phone"
        placeholder="+1 (555) 123-4567"
        type="tel"
      />
      <FormField
        label="Website"
        name="website"
        placeholder="https://example.com"
        type="url"
      />
      <FormField label="Age" name="age" placeholder="25" type="number" />
      <FormField
        label="Search"
        name="search"
        placeholder="Search domains..."
        type="search"
      />
    </div>
  ),
}

// @ts-expect-error - TODO: Fix args
export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <FormField
        label="Search Domain"
        name="search"
        placeholder="Search for a domain..."
        startIcon={<span>🔍</span>}
      />
      <FormField
        endIcon={<span>📧</span>}
        label="Email Address"
        name="email"
        placeholder="your@email.com"
        type="email"
      />
    </div>
  ),
}

// @ts-expect-error - TODO: Fix args
export const FormExample: Story = {
  render: () => (
    <div className="max-w-md space-y-4">
      <h3 className="font-semibold text-lg">Registration Form</h3>
      <FormField
        label="First Name"
        name="firstName"
        placeholder="John"
        required
      />
      <FormField label="Last Name" name="lastName" placeholder="Doe" required />
      <FormField
        helperText="We'll never share your email"
        label="Email"
        name="email"
        placeholder="john@example.com"
        required
        type="email"
      />
      <FormField
        helperText="Must be at least 8 characters"
        label="Password"
        name="password"
        placeholder="Enter a secure password"
        required
        type="password"
      />
      <FormField
        label="Confirm Password"
        name="confirmPassword"
        placeholder="Confirm your password"
        required
        type="password"
      />
    </div>
  ),
}

// @ts-expect-error - TODO: Fix args
export const ValidationStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <FormField
        label="Valid Field"
        name="valid"
        placeholder="This field is valid"
        variant="success"
      />
      <FormField
        errorText="This field is required"
        label="Error Field"
        name="error"
        placeholder="This field has an error"
        variant="error"
      />
      <FormField
        label="Normal Field"
        name="normal"
        placeholder="This is a normal field"
      />
    </div>
  ),
}

// @ts-expect-error - TODO: Fix args
export const Disabled: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <FormField
        disabled
        label="Disabled Field"
        name="disabled"
        placeholder="This field is disabled"
      />
      <FormField
        disabled
        label="Disabled with Value"
        name="disabledValue"
        value="Cannot edit this"
      />
    </div>
  ),
}
