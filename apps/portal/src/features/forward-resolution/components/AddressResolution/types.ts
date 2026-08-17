import type { ReverseMatchStatus } from '../hooks/useReverseMatch'
import type { L2ReverseRegistrarChainId } from './networks'

export type AddressResolutionRow = {
  /** ENSIP-11 / SLIP-44 coin type the address record is keyed on. */
  coinType: number
  label: string
  icon: string
  /**
   * L2 chain id — present only for L2 rows, used to route "Set primary name"
   * writes to that chain's reverse registrar. Absent for the Default and
   * Mainnet rows, which write via L1 registrars.
   */
  l2ChainId?: L2ReverseRegistrarChainId
  /** Resolved address for this network (chain-specific record, else the default). */
  address: string | null
  /**
   * Verification state of the reverse half for this network (see
   * {@link ReverseMatchStatus}). `null` when there's no address to check;
   * `undefined` while the reverse lookup is in flight.
   */
  reverseMatch: ReverseMatchStatus | null | undefined
  /** The name backing `reverseMatch`, if any (see `ReverseMatchResult`). */
  reverseName: string | null | undefined
  /** For `unverifiable`: the decoded reason the verification path failed. */
  reverseError: string | null | undefined
}
