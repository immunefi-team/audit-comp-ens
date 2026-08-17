import { type Address, getAddress, zeroAddress } from 'viem'
import type { CommemorativeNftEligibility } from './types'

const YOGINTH_FIXTURE_ADDRESS = getAddress(
  '0x03Ba34f6Ea1496fa316873CF8350A3f7eaD317EF',
)

const YOGINTH_FIXTURE: CommemorativeNftEligibility = {
  ownerAddress: YOGINTH_FIXTURE_ADDRESS,
  profileName: 'yoginth.eth',
  rendererName: 'unwrappedyogi',
  proof: ['0x017995f95e79303c1853e326b15e6dcc16e6aa20f07372e4f0ab63c0b84f2631'],
  traits: {
    Era: 'DeFi',
    Depth: 'Domainer',
    Gasveteran: 'Weathered',
    Archetype: 'Abstract',
    Rarity: 'Common',
    Seed: 742_941_409,
  },
  assets: {},
  source: 'dev-fixture',
}

export const getCommemorativeNftDevFixture = (
  ownerAddress: Address,
): CommemorativeNftEligibility | undefined =>
  ownerAddress.toLowerCase() === YOGINTH_FIXTURE_ADDRESS.toLowerCase()
    ? YOGINTH_FIXTURE
    : undefined

export const createCommemorativeNftPreviewEligibility = (params: {
  readonly ownerAddress?: Address
  readonly profileName?: string
}): CommemorativeNftEligibility => {
  const profileName = params.profileName?.trim() || 'preview.eth'

  return {
    ownerAddress: params.ownerAddress ?? zeroAddress,
    profileName,
    rendererName: profileName.replace(/\.eth$/i, ''),
    proof: [],
    traits: {
      Era: 'Founding',
      Depth: 'Collector',
      Gasveteran: 'Seasoned',
      Archetype: 'Personal',
      Rarity: 'Common',
      Seed: 742_941_409,
    },
    assets: {},
    source: 'preview',
  }
}
