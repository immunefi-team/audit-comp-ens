/**
 * Shared ENSIP-11 / ENSIP-19 coin type constants, used by both the
 * forward-resolution (name-view) and reverse-resolution (address-view)
 * features. `0x80000000` and `60` are SEPARATE records: coin 60 does not imply
 * the default is set, and vice versa.
 */

/**
 * ENSIP-19 "default" EVM coin type (`0x80000000`): the fallback address record
 * that applies to any EVM chain without a chain-specific record, and the
 * `default.reverse` namespace for reverse resolution.
 */
export const DEFAULT_EVM_COIN_TYPE = 0x80000000

/** SLIP-44 coin type for mainnet ETH (`addr(60)` / `addr.reverse`). */
export const MAINNET_COIN_TYPE = 60
