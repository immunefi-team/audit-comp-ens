import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { getByteLength } from '@/utils/domain'
import { DomainCard } from './DomainCard'

const meta: Meta<typeof DomainCard> = {
  title: 'Atoms/DomainCard',
  component: DomainCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['garnet', 'lapis', 'peridot'],
    },
    domainName: {
      control: 'text',
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
    domainName: 'erni.eth',
    variant: 'garnet',
  },
}

export const Garnet: Story = {
  args: {
    domainName: 'example.eth',
    variant: 'garnet',
  },
}

export const Lapis: Story = {
  args: {
    domainName: 'test.eth',
    variant: 'lapis',
  },
}

export const Peridot: Story = {
  args: {
    domainName: 'domain.eth',
    variant: 'peridot',
  },
}

export const LongDomainName: Story = {
  args: {
    domainName: 'verylongdomainname.eth',
    variant: 'garnet',
  },
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <DomainCard domainName="garnet.eth" variant="garnet" />
        <p className="mt-2 text-sm">Garnet</p>
      </div>
      <div className="text-center">
        <DomainCard domainName="lapis.eth" variant="lapis" />
        <p className="mt-2 text-sm">Lapis</p>
      </div>
      <div className="text-center">
        <DomainCard domainName="peridot.eth" variant="peridot" />
        <p className="mt-2 text-sm">Peridot</p>
      </div>
    </div>
  ),
}

// Dynamic font sizing stories
export const ByteLengthTier0: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <p className="mb-2 text-gray-600 text-sm">
          Tier 0 (0-30 bytes) - text-xl - {getByteLength('abc.eth')} bytes
        </p>
        <DomainCard domainName="abc.eth" variant="garnet" />
      </div>
      <div className="text-center">
        <p className="mb-2 text-gray-600 text-sm">
          Emoji - {getByteLength('😀.eth')} bytes
        </p>
        <DomainCard domainName="😀.eth" variant="lapis" />
      </div>
      <div className="text-center">
        <p className="mb-2 text-gray-600 text-sm">
          Chinese - {getByteLength('中国.eth')} bytes
        </p>
        <DomainCard domainName="中国.eth" variant="peridot" />
      </div>
    </div>
  ),
}

export const ByteLengthTier1: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <p className="mb-2 text-gray-600 text-sm">
          Tier 1 (31-80 bytes) - text-base -{' '}
          {getByteLength('verylongdomainnamewithmore.eth')} bytes
        </p>
        <DomainCard
          domainName="verylongdomainnamewithmore.eth"
          variant="garnet"
        />
      </div>
      <div className="text-center">
        <p className="mb-2 text-gray-600 text-sm">
          Emoji - {getByteLength('😀😀😀😀😀😀😀.eth')} bytes
        </p>
        <DomainCard domainName="😀😀😀😀😀😀😀.eth" variant="lapis" />
      </div>
    </div>
  ),
}

export const ByteLengthTier2: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <p className="mb-2 text-gray-600 text-sm">
          Tier 2 (81-150 bytes) - text-sm -{' '}
          {getByteLength('😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀.eth')} bytes
        </p>
        <DomainCard
          domainName="😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀.eth"
          variant="garnet"
        />
      </div>
      <div className="text-center">
        <p className="mb-2 text-gray-600 text-sm">
          Chinese -{' '}
          {getByteLength('中国日本韓国印度泰国越南老挝柬埔寨菲律賓馬來.eth')}{' '}
          bytes
        </p>
        <DomainCard
          domainName="中国日本韓国印度泰国越南老挝柬埔寨菲律賓馬來.eth"
          variant="peridot"
        />
      </div>
    </div>
  ),
}

export const ByteLengthTier3: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <p className="mb-2 text-gray-600 text-sm">
          Tier 3 (151+ bytes) - text-xs -{' '}
          {getByteLength(
            'verylongdomainnamewithmultiplewordsinreallylongformatwithmultiplelinesthisgoesonevenmorewithmorecontentandmore.eth',
          )}{' '}
          bytes
        </p>
        <DomainCard
          domainName="verylongdomainnamewithmultiplewordsinreallylongformatwithmultiplelinesthisgoesonevenmorewithmorecontentandmore.eth"
          variant="garnet"
        />
      </div>
      <div className="text-center">
        <p className="mb-2 text-gray-600 text-sm">
          Emoji -{' '}
          {getByteLength(
            '😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀.eth',
          )}{' '}
          bytes
        </p>
        <DomainCard
          domainName="😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀.eth"
          variant="lapis"
        />
      </div>
    </div>
  ),
}

// Multi-byte character showcase
export const MultiByteCharacters: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <p className="mb-2 text-gray-600 text-sm">
          Emoji faces - {getByteLength('🎉🎊🎈.eth')} bytes
        </p>
        <DomainCard domainName="🎉🎊🎈.eth" variant="garnet" />
      </div>
      <div className="text-center">
        <p className="mb-2 text-gray-600 text-sm">
          Accented - {getByteLength('café.eth')} bytes
        </p>
        <DomainCard domainName="café.eth" variant="lapis" />
      </div>
      <div className="text-center">
        <p className="mb-2 text-gray-600 text-sm">
          Mixed - {getByteLength('test😀中国.eth')} bytes
        </p>
        <DomainCard domainName="test😀中国.eth" variant="peridot" />
      </div>
    </div>
  ),
}

// All tiers comparison
export const AllByteTiers: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <p className="mb-2 font-semibold text-sm">
          Tier 0 (0-30 bytes) - text-xl - {getByteLength('abc.eth')} bytes
        </p>
        <DomainCard domainName="abc.eth" variant="garnet" />
      </div>
      <div className="text-center">
        <p className="mb-2 font-semibold text-sm">
          Tier 1 (31-80 bytes) - text-base -{' '}
          {getByteLength('verylongdomainnamewithmore.eth')} bytes
        </p>
        <DomainCard
          domainName="verylongdomainnamewithmore.eth"
          variant="lapis"
        />
      </div>
      <div className="text-center">
        <p className="mb-2 font-semibold text-sm">
          Tier 2 (81-150 bytes) - text-sm -{' '}
          {getByteLength('😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀.eth')} bytes
        </p>
        <DomainCard
          domainName="😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀.eth"
          variant="peridot"
        />
      </div>
      <div className="text-center">
        <p className="mb-2 font-semibold text-sm">
          Tier 3 (151+ bytes) - text-xs -{' '}
          {getByteLength(
            '😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀.eth',
          )}{' '}
          bytes
        </p>
        <DomainCard
          domainName="😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀.eth"
          variant="garnet"
        />
      </div>
    </div>
  ),
}
