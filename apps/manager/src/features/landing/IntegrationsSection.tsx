import { Trans } from '@lingui/react/macro'
import arbitrumIcon from '@/assets/coins/arb1-icon.svg'
import baseIcon from '@/assets/coins/base-icon.svg'
import bitcoinIcon from '@/assets/coins/btc-icon.svg'
import optimismIcon from '@/assets/coins/op-icon.svg'
import braveIcon from '@/assets/icons/brave-color.svg'
import consensysIcon from '@/assets/icons/consensys.svg'
import ethereumIcon from '@/assets/icons/ethereum-color.svg'
import etherscanIcon from '@/assets/icons/etherscan-color.svg'
import farcasterIcon from '@/assets/icons/farcaster-color.svg'
import godaddyIcon from '@/assets/icons/godaddy-color.svg'
import metamaskIcon from '@/assets/icons/metamask-color.svg'
import phantomIcon from '@/assets/icons/phantom-color.svg'
import rainbowIcon from '@/assets/icons/rainbow-color.webp'
import uniswapIcon from '@/assets/icons/uniswap-color.svg'
import zksyncIcon from '@/assets/icons/zksync-color.svg'

const INTEGRATIONS: {
  name: string
  icon: string
}[] = [
  {
    name: 'Base',
    icon: baseIcon,
  },
  {
    name: 'Optimism',
    icon: optimismIcon,
  },
  {
    name: 'GoDaddy',
    icon: godaddyIcon,
  },
  {
    name: 'Farcaster',
    icon: farcasterIcon,
  },
  {
    name: 'Uniswap',
    icon: uniswapIcon,
  },
  {
    name: 'Brave',
    icon: braveIcon,
  },
  {
    name: 'Phantom',
    icon: phantomIcon,
  },
  {
    name: 'Ethereum',
    icon: ethereumIcon,
  },
  {
    name: 'Etherscan',
    icon: etherscanIcon,
  },
  {
    name: 'Arbitrum',
    icon: arbitrumIcon,
  },
  {
    name: 'ZKSync',
    icon: zksyncIcon,
  },
  {
    name: 'Bitcoin',
    icon: bitcoinIcon,
  },
  {
    name: 'Consensys',
    icon: consensysIcon,
  },
  {
    name: 'MetaMask',
    icon: metamaskIcon,
  },
  {
    name: 'Rainbow',
    icon: rainbowIcon,
  },
]
export const IntegrationsSection = () => {
  return (
    <div className="mt-20 bg-white">
      <div className="mx-auto w-full-[4rem] max-w-6xl py-20">
        <div className="space-y-6">
          <h2 className="font-medium text-ens-lapis-core text-temp-32px leading-ens-none">
            <Trans>Your ENS name works across web3</Trans>
          </h2>
          <p className="max-w-md font-serif text-lg leading-ens-normal">
            <Trans>
              Use your ENS name in wallets, apps, blockchains, and browsers you
              already know - no setup required.
            </Trans>
          </p>
        </div>

        <div className="mt-16 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {INTEGRATIONS.map((integration) => (
            <div
              className="flex items-center gap-2 border-ens-lapis-dust border-t py-4"
              key={integration.name}
            >
              <img
                alt={integration.name}
                className="size-10 object-fit"
                src={integration.icon}
              />
              <span className="font-medium text-base text-ens-blue-midnight md:text-lg lg:text-[22px]">
                {integration.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
