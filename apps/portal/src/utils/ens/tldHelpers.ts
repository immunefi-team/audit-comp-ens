/**
 * TLD (Top-Level Domain) helper utilities for ENS name validation.
 *
 * ENS supports:
 * - "eth" - the native ENS TLD (always valid)
 * - DNS TLDs with DNSSEC enabled (like .xyz, .com, .io, etc.)
 */

/**
 * Check if a name is a TLD (1 label, no dots).
 * TLDs cannot be registered, only viewed if they exist.
 *
 * @example
 * isTLD('eth') // true
 * isTLD('florin.eth') // false
 */
export const isTLD = (name: string): boolean => !name.includes('.')

/**
 * Extract the TLD from a name.
 *
 * @example
 * getTLD('florin.eth') // 'eth'
 * getTLD('sub.florin.eth') // 'eth'
 * getTLD('eth') // 'eth'
 */
export const getTLD = (name: string): string => {
  const labels = name.split('.')
  return labels[labels.length - 1]
}

/**
 * Check if a name is a 2LD (second-level domain).
 * Only 2LDs can be registered/claimed.
 *
 * @example
 * is2LD('florin.eth') // true
 * is2LD('eth') // false
 * is2LD('sub.florin.eth') // false
 */
export const is2LD = (name: string): boolean => name.split('.').length === 2

/**
 * Check if a name is under the .eth TLD.
 *
 * @example
 * isEthName('florin.eth') // true
 * isEthName('florin.xyz') // false
 * isEthName('eth') // false (this is the TLD itself)
 */
export const isEthName = (name: string): boolean =>
  name.endsWith('.eth') && !isTLD(name)

/**
 * Check if a 2LD name can be directly registered (only .eth 2LDs).
 * Other valid TLDs require claiming via DNS proof.
 *
 * @example
 * isRegistrable('florin.eth') // true
 * isRegistrable('florin.xyz') // false (can be claimed, not registered)
 * isRegistrable('eth') // false (TLDs can't be registered)
 */
export const isRegistrable = (name: string): boolean =>
  is2LD(name) && name.endsWith('.eth')

/**
 * Check if a 2LD name can be claimed via DNS proof.
 * This applies to 2LDs under non-.eth TLDs that have DNSSEC enabled.
 *
 * @example
 * isClaimable('florin.xyz') // true (if xyz has DNSSEC)
 * isClaimable('florin.eth') // false (eth names are registered, not claimed)
 * isClaimable('eth') // false (TLDs can't be claimed)
 */
export const isClaimable = (name: string): boolean =>
  is2LD(name) && !name.endsWith('.eth')
