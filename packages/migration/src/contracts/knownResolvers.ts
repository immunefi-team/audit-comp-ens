import { getChainContractAddress } from '@ensdomains/ensjs/chain'
import { type Address, isAddressEqual } from 'viem'
import { sepoliaWithEns } from '../chain'

const KNOWN_PUBLIC_RESOLVERS: readonly Address[] = [
  getChainContractAddress({
    chain: sepoliaWithEns,
    contract: 'ensPublicResolver',
  }),
  '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD',
  '0x640294a2b2d87e7f522db3e3e3e876764bce170d',
  '0xc30ba2bd21583605d815826c3807e8224e398e10',
  '0x1da022710dF5002339274AaDEe8D58218e9D6AB5',
  '0xDaaF96c344f63131acadD0Ea35170E7892d3dfBA',
  '0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41',
  '0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63',
  '0xF29100983E058B709F3D539b0c765937B804AC15',
]

export const isKnownPublicResolver = (address: string | null): boolean => {
  if (!address) return false
  return KNOWN_PUBLIC_RESOLVERS.some((known) =>
    isAddressEqual(known, address as Address),
  )
}
