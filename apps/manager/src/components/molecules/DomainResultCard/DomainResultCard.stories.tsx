import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { getByteLength } from '@/utils/domain'
import { DomainResultCard } from './DomainResultCard'
import { DOMAIN_RESULT_STATUSES } from './domainResultStatus'

const meta = {
  title: 'Molecules/DomainResultCard',
  component: DomainResultCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: [...DOMAIN_RESULT_STATUSES],
    },
    price: {
      control: 'number',
    },
  },
} satisfies Meta<typeof DomainResultCard>

export default meta
type Story = StoryObj<typeof meta>

export const Available: Story = {
  args: {
    domainName: 'example.eth',
    status: 'available',
    price: 45.2,
  },
}

export const Premium: Story = {
  args: {
    domainName: 'premium.eth',
    status: 'premium',
    price: 245000,
  },
}

export const Registered: Story = {
  args: {
    domainName: 'earl.eth',
    status: 'registered',
  },
}

export const RegisteredInGrace: Story = {
  args: {
    domainName: 'earl.eth',
    status: 'grace',
  },
}

export const MultipleCards = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-4">
      <DomainResultCard
        domainName="awesome.eth"
        price={32.5}
        status="available"
      />
      <DomainResultCard
        domainName="super.eth"
        price={125000}
        status="premium"
      />
      <DomainResultCard
        domainName="test123.eth"
        price={12.75}
        status="available"
      />
    </div>
  ),
}

export const DifferentLengths = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-4">
      <DomainResultCard domainName="a.eth" price={2450000} status="premium" />
      <DomainResultCard domainName="ab.eth" price={1225000} status="premium" />
      <DomainResultCard domainName="abc.eth" price={245000} status="premium" />
      <DomainResultCard
        domainName="abcd.eth"
        price={61.25}
        status="available"
      />
      <DomainResultCard
        domainName="verylongdomainname.eth"
        price={12.25}
        status="available"
      />
    </div>
  ),
}

export const PricingVariations = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-4">
      <DomainResultCard
        domainName="cheap.eth"
        price={2.45}
        status="available"
      />
      <DomainResultCard
        domainName="moderate.eth"
        price={122.5}
        status="available"
      />
      <DomainResultCard
        domainName="expensive.eth"
        price={24500}
        status="premium"
      />
    </div>
  ),
}

export const WithoutPricing = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-4">
      <DomainResultCard domainName="noprice.eth" status="available" />
      <DomainResultCard domainName="alsono.eth" status="premium" />
    </div>
  ),
}

export const CustomLabels = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-4">
      <DomainResultCard domainName="custom.eth" price={50} status="available" />
      <DomainResultCard
        domainName="another.eth"
        price={1000}
        priceLabel="one-time"
        status="premium"
      />
    </div>
  ),
}

export const InteractiveExample = {
  render: () => (
    <div className="max-w-xl">
      <h3 className="mb-4 font-semibold text-lg">Domain Search Results</h3>
      <div className="space-y-3">
        <DomainResultCard
          domainName="myproject.eth"
          price={42.5}
          status="available"
        />
      </div>
    </div>
  ),
}

// Byte-tier font scaling stories (Tier 0-3)
export const ByteLengthTier0: Story = {
  args: {
    domainName: 'a.eth',
    status: 'premium',
  },
  render: () => (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <p className="mb-2 text-gray-600 text-sm">
          Tier 0 (0-30 bytes) - text-xl font
        </p>
      </div>
      <DomainResultCard domainName="a.eth" price={2450000} status="premium" />
      <DomainResultCard domainName="abc.eth" price={245000} status="premium" />
      <DomainResultCard domainName="😀.eth" price={245000} status="premium" />
      <DomainResultCard
        domainName="café.eth"
        price={61.25}
        status="available"
      />
      <DomainResultCard domainName="中国.eth" price={45.2} status="available" />
    </div>
  ),
}

export const ByteLengthTier1: Story = {
  args: {
    domainName: 'verylongdomainnamewithmore.eth',
    status: 'available',
  },
  render: () => (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <p className="mb-2 text-gray-600 text-sm">
          Tier 1 (31-80 bytes) - text-base font
        </p>
      </div>
      <DomainResultCard
        domainName="verylongdomainnamewithmore.eth"
        price={12.25}
        status="available"
      />
      <DomainResultCard
        domainName="😀😀😀😀😀😀😀.eth"
        price={32.5}
        status="available"
      />
      <DomainResultCard
        domainName="café café café café café.eth"
        price={18.75}
        status="available"
      />
    </div>
  ),
}

export const ByteLengthTier2: Story = {
  args: {
    domainName:
      'verylongdomainnamewithmultiplewordsinreallylongformatwithlots.eth',
    status: 'available',
  },
  render: () => (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <p className="mb-2 text-gray-600 text-sm">
          Tier 2 (81-150 bytes) - text-sm font
        </p>
      </div>
      <DomainResultCard
        domainName="verylongdomainnamewithmultiplewordsinreallylongformatwithlots.eth"
        price={5.25}
        status="available"
      />
      <DomainResultCard
        domainName="😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀.eth"
        price={8.5}
        status="available"
      />
      <DomainResultCard
        domainName="中国日本韓国印度泰国越南老挝柬埔寨菲律賓馬來.eth"
        price={6.75}
        status="available"
      />
    </div>
  ),
}

export const ByteLengthTier3: Story = {
  args: {
    domainName:
      'verylongdomainnamewithmultiplewordsinreallylongformatwithmultiplelinesthisgoesonevenmorewithmorecontentandmore.eth',
    status: 'available',
  },
  render: () => (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <p className="mb-2 text-gray-600 text-sm">
          Tier 3 (151+ bytes) - text-xs font
        </p>
      </div>
      <DomainResultCard
        domainName="verylongdomainnamewithmultiplewordsinreallylongformatwithmultiplelinesthisgoesonevenmorewithmorecontentandmore.eth"
        price={3.25}
        status="available"
      />
      <DomainResultCard
        domainName="😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀.eth"
        price={4.5}
        status="available"
      />
    </div>
  ),
}

// Multi-byte character showcase
export const MultiByteCardExamples: Story = {
  args: {
    domainName: '🎉🎊🎈.eth',
    status: 'premium',
  },
  render: () => (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <p className="mb-4 font-semibold text-lg">
          Multi-byte Character Examples
        </p>
        <p className="mb-4 text-gray-600 text-sm">
          Testing emoji, Chinese, Arabic, and mixed characters
        </p>
      </div>
      <DomainResultCard
        domainName="🎉🎊🎈.eth"
        price={245000}
        status="premium"
      />
      <DomainResultCard
        domainName="中国日本.eth"
        price={45.2}
        status="available"
      />
      <DomainResultCard
        domainName="مرحبا.eth"
        price={32.5}
        status="available"
      />
      <DomainResultCard
        domainName="naïve.eth"
        price={28.75}
        status="available"
      />
      <DomainResultCard
        domainName="test😀中国.eth"
        price={22.5}
        status="available"
      />
    </div>
  ),
}

// Complete tier comparison
export const ByteTierComparison: Story = {
  args: {
    domainName: 'abc.eth',
    status: 'premium',
  },
  render: () => (
    <div className="space-y-6">
      <h3 className="font-semibold text-lg">Font Size by Byte Length Tiers</h3>
      <div className="space-y-6">
        <div>
          <p className="mb-2 font-medium text-gray-700 text-sm">
            Tier 0 (0-30 bytes): {getByteLength('abc.eth')} bytes - text-xl
          </p>
          <DomainResultCard
            domainName="abc.eth"
            price={245000}
            status="premium"
          />
        </div>
        <div>
          <p className="mb-2 font-medium text-gray-700 text-sm">
            Tier 1 (31-80 bytes):{' '}
            {getByteLength('verylongdomainnamewithmore.eth')} bytes - text-base
          </p>
          <DomainResultCard
            domainName="verylongdomainnamewithmore.eth"
            price={12.25}
            status="available"
          />
        </div>
        <div>
          <p className="mb-2 font-medium text-gray-700 text-sm">
            Tier 2 (81-150 bytes):{' '}
            {getByteLength('😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀.eth')}{' '}
            bytes - text-sm
          </p>
          <DomainResultCard
            domainName="😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀.eth"
            price={8.5}
            status="available"
          />
        </div>
        <div>
          <p className="mb-2 font-medium text-gray-700 text-sm">
            Tier 3 (151+ bytes):{' '}
            {getByteLength(
              '😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀.eth',
            )}{' '}
            bytes - text-xs
          </p>
          <DomainResultCard
            domainName="😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀.eth"
            price={4.5}
            status="available"
          />
        </div>
      </div>
    </div>
  ),
}
