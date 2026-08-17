import { extendChainWithEns } from '@ensdomains/ensjs/chain'
import { sepolia } from 'viem/chains'

export const sepoliaWithEns = extendChainWithEns(sepolia)
