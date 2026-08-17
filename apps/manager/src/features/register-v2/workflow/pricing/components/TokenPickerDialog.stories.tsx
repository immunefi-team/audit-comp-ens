import type { SUPPORTED_TOKEN } from '@ens-apps/transaction-manager/contracts/ens-sepolia'
import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useState } from 'react'
import type { StablecoinBalance } from '@/lib/smart-account'
import { TokenPickerContentBase } from './TokenPickerContent'
import { PaymentDialogBase } from './TokenPickerDialog'

/**
 * `TokenPickerDialog` is a controlled dialog driven by the registration-v2
 * state machine and `useSmartAccountContext`. Storybook can't easily boot
 * those providers, so we story a shell that composes the provider-free
 * pieces directly:
 *
 *   - `PaymentDialogBase` — the responsive Dialog/Drawer wrapper.
 *   - `TokenPickerContentBase` — the pure content component (balances,
 *     selection state, pricing) that accepts all data via props.
 *
 * The shell holds its own open + selectedToken state so you can interact
 * with the dialog and watch the `Buy Name` button flip between disabled
 * and enabled based on the args you pass in.
 */

// ---------------------------------------------------------------------------
// Mock balances
// ---------------------------------------------------------------------------

const MOCK_BALANCES: StablecoinBalance[] = [
  {
    address: '0x0000000000000000000000000000000000000001',
    symbol: 'USDC',
    balance: '1000000000', // 1,000 USDC
    decimals: 6,
    formattedBalance: '1000.00',
  },
  {
    address: '0x0000000000000000000000000000000000000002',
    symbol: 'DAI',
    balance: '500000000000000000000', // 500 DAI
    decimals: 18,
    formattedBalance: '500.00',
  },
]

const LOW_BALANCES: StablecoinBalance[] = [
  {
    address: '0x0000000000000000000000000000000000000001',
    symbol: 'USDC',
    balance: '10000000', // 10 USDC
    decimals: 6,
    formattedBalance: '10.00',
  },
  {
    address: '0x0000000000000000000000000000000000000002',
    symbol: 'DAI',
    balance: '5000000000000000000', // 5 DAI
    decimals: 18,
    formattedBalance: '5.00',
  },
]

// ---------------------------------------------------------------------------
// Shell component — stands in for TokenPickerDialog without providers
// ---------------------------------------------------------------------------

interface TokenPickerDialogShellProps {
  label: string
  defaultOpen?: boolean
  pricingData?: number
  pricingLoading?: boolean
  isInPriceCooldown?: boolean
  isConnected?: boolean
  isLoadingBalances?: boolean
  stablecoinBalances?: StablecoinBalance[]
  errorMessage?: string | null
  initialSelectedToken?: SUPPORTED_TOKEN
}

const TokenPickerDialogShell = ({
  label,
  defaultOpen = true,
  pricingData = 352,
  pricingLoading = false,
  isInPriceCooldown = false,
  isConnected = true,
  isLoadingBalances = false,
  stablecoinBalances = MOCK_BALANCES,
  errorMessage = null,
  initialSelectedToken,
}: TokenPickerDialogShellProps) => {
  const [open, setOpen] = useState(defaultOpen)
  const [selectedToken, setSelectedToken] = useState<
    SUPPORTED_TOKEN | undefined
  >(initialSelectedToken)

  return (
    <PaymentDialogBase
      onOpenChange={setOpen}
      open={open}
      title="Select payment"
    >
      <TokenPickerContentBase
        errorMessage={errorMessage}
        isConnected={isConnected}
        isInPriceCooldown={isInPriceCooldown}
        isLoadingBalances={isLoadingBalances}
        label={label}
        onNext={() => {
          console.log('Buy Name clicked', { label, selectedToken, pricingData })
        }}
        onSelectCoin={setSelectedToken}
        pricingData={pricingData}
        pricingLoading={pricingLoading}
        selectedToken={selectedToken}
        stablecoinBalances={stablecoinBalances}
      />
    </PaymentDialogBase>
  )
}

// ---------------------------------------------------------------------------
// Storybook meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Features/Register-v2/Pricing/TokenPickerDialog',
  component: TokenPickerDialogShell,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    label: 'erni',
    defaultOpen: true,
    pricingData: 352,
    pricingLoading: false,
    isConnected: true,
    isLoadingBalances: false,
    stablecoinBalances: MOCK_BALANCES,
    errorMessage: null,
  },
  argTypes: {
    stablecoinBalances: { control: false },
    initialSelectedToken: {
      control: 'inline-radio',
      options: [undefined, 'USDC', 'DAI'],
    },
  },
} satisfies Meta<typeof TokenPickerDialogShell>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Dialog opened, no coin selected yet → `Buy Name` is disabled.
 */
export const Default: Story = {}

/**
 * USDC preselected with sufficient balance → `Buy Name` is enabled.
 */
export const WithTokenSelected: Story = {
  args: {
    initialSelectedToken: 'USDC',
  },
}

/**
 * Premium 4-character domain variant.
 */
export const PremiumDomain: Story = {
  args: {
    label: 'erni', // 4 chars → 4-char premium pill
    pricingData: 640,
    initialSelectedToken: 'USDC',
  },
}

/**
 * 4-char premium + price cooldown — both pills side-by-side on desktop.
 */
export const PremiumDomainWithCooldown: Story = {
  args: {
    label: 'erni',
    pricingData: 48_292.56,
    isInPriceCooldown: true,
    initialSelectedToken: 'USDC',
  },
}

/**
 * Same as PremiumDomainWithCooldown on mobile — pills stack in a column.
 */
export const PremiumDomainWithCooldownMobile: Story = {
  args: {
    label: 'erni',
    pricingData: 48_292.56,
    isInPriceCooldown: true,
    initialSelectedToken: 'USDC',
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}

/**
 * Price cooldown only (no 3/4-char premium pill).
 */
export const PriceCooldownOnly: Story = {
  args: {
    label: 'expiredname',
    pricingData: 47_800,
    isInPriceCooldown: true,
    initialSelectedToken: 'USDC',
  },
}

/**
 * Premium 3-character domain variant.
 */
export const ShortPremiumDomain: Story = {
  args: {
    label: 'eni',
    pricingData: 2800,
    initialSelectedToken: 'USDC',
  },
}

/**
 * Long domain name → font size should shrink.
 */
export const LongDomain: Story = {
  args: {
    label: 'averyverylongensdomainname',
    pricingData: 70,
    initialSelectedToken: 'USDC',
  },
}

/**
 * Max-length domain (255 total chars: 251 label + ".eth") rendered in a
 * mobile viewport to verify the dialog bounds the height and the Buy Name
 * button stays visible while the content scrolls.
 */
export const MaxLengthDomainMobile: Story = {
  args: {
    label: 'a'.repeat(251),
    pricingData: 5,
    initialSelectedToken: 'USDC',
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}

/**
 * Balances still loading.
 */
export const LoadingBalances: Story = {
  args: {
    isLoadingBalances: true,
    stablecoinBalances: [],
  },
}

/**
 * Pricing request in flight after a coin was selected.
 */
export const LoadingPricing: Story = {
  args: {
    pricingLoading: true,
    initialSelectedToken: 'USDC',
  },
}

/**
 * Wallet not connected.
 */
export const WalletDisconnected: Story = {
  args: {
    isConnected: false,
    stablecoinBalances: [],
  },
}

/**
 * User has zero stablecoins in their smart account.
 */
export const NoStablecoins: Story = {
  args: {
    stablecoinBalances: [],
  },
}

/**
 * Balances present but every coin is under the target price → button stays
 * disabled and each row shows the `Need $X` hint.
 */
export const InsufficientBalance: Story = {
  args: {
    pricingData: 352,
    stablecoinBalances: LOW_BALANCES,
    initialSelectedToken: 'USDC',
  },
}

/**
 * Availability recheck failed — inline error below the list.
 */
export const AvailabilityError: Story = {
  args: {
    initialSelectedToken: 'USDC',
    errorMessage:
      "We couldn't confirm that erni.eth is still available. Please try again.",
  },
}
