import { bytesToHex, type Hex } from 'viem'
import { packetToBytes } from 'viem/ens'

export const dnsEncodeName = (name: string): Hex =>
  bytesToHex(packetToBytes(name))
