import type { CoinType, EvmCoinType } from '@ensdomains/address-encoder'

/**
 * Record text entry structure from ENS records
 */
export type RecordText = {
  key: string
  value: string
}

/**
 * Record coin entry structure from ENS records
 */
export type RecordCoin = {
  coinType: number
  value: string
}

/**
 * Transforms an array of text records into a key-value object
 *
 * @param texts - Array of text records with key and value
 * @returns Object with text keys mapped to values
 *
 * @example
 * recordTextsToObject([
 *   { key: 'name', value: 'Alice' },
 *   { key: 'description', value: 'Developer' }
 * ])
 * // { name: 'Alice', description: 'Developer' }
 */
export const recordTextsToObject = (
  texts: RecordText[] | undefined,
): Record<string, string> => {
  if (!texts) return {}

  return Object.fromEntries(texts.map(({ key, value }) => [key, value]))
}

/**
 * Transforms an array of coin records into a coinType-value object
 *
 * @param coins - Array of coin records with coinType and value
 * @returns Object with coin types (as strings) mapped to addresses
 *
 * @example
 * recordCoinsToObject([
 *   { coinType: 60, value: '0x123...' },
 *   { coinType: 0, value: '1A1zP1...' }
 * ])
 * // { '60': '0x123...', '0': '1A1zP1...' }
 */
export const recordCoinsToObject = (
  coins: RecordCoin[] | undefined,
): Record<string, string> => {
  if (!coins) return {}

  return Object.fromEntries(
    coins.map(({ coinType, value }) => [coinType, value]),
  )
}

/**
 * Filters coin records to only include EVM chains
 * Includes coinType 60 (ETH) and any coinType in the evmCoinTypes list
 *
 * @param coins - Object with coin types as keys and addresses as values
 * @param evmCoinTypes - Array of EVM coin type numbers
 * @returns Object with only EVM chains, keys converted to numbers
 *
 * @example
 * filterEvmChains(
 *   { '60': '0x123...', '0': '1A1zP1...' },
 *   [60, 10, 42161]
 * )
 * // { 60: '0x123...' }
 */
export const filterEvmChains = (
  coins: Record<string, string>,
  evmCoinTypes: EvmCoinType[],
): Record<number, string> => {
  return Object.fromEntries(
    Object.entries(coins)
      .filter(
        ([coinType]) =>
          evmCoinTypes.includes(Number(coinType) as EvmCoinType) ||
          coinType === '60',
      )
      .map(([coinType, value]) => [Number(coinType), value]),
  )
}

/**
 * Filters coin records to only include non-EVM chains
 * Excludes coinType 60 (ETH) even if it appears in nonEvmCoinTypes
 *
 * @param coins - Object with coin types as keys and addresses as values
 * @param nonEvmCoinTypes - Array of non-EVM coin type numbers
 * @returns Object with only non-EVM chains, keys converted to numbers
 *
 * @example
 * filterNonEvmChains(
 *   { '60': '0x123...', '0': '1A1zP1...', '501': 'sol...' },
 *   [0, 501, 2]
 * )
 * // { 0: '1A1zP1...', 501: 'sol...' }
 */
export const filterNonEvmChains = (
  coins: Record<string, string>,
  nonEvmCoinTypes: Exclude<CoinType, EvmCoinType>[],
): Record<number, string> => {
  return Object.fromEntries(
    Object.entries(coins)
      .filter(
        ([coinType]) =>
          nonEvmCoinTypes.includes(
            Number(coinType) as Exclude<CoinType, EvmCoinType>,
          ) && coinType !== '60',
      )
      .map(([coinType, value]) => [Number(coinType), value]),
  )
}
