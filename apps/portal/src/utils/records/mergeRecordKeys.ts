/**
 * Merges coin type arrays from multiple sources and removes duplicates.
 * Handles conversion from string to number for subgraph coin types.
 *
 * @param subgraphCoins - Coin types from subgraph (as strings or numbers)
 * @param defaultCoins - Default coin types to always include
 * @returns Deduplicated array of coin types as numbers
 *
 * @example
 * mergeCoinTypes(['60', '0'], [60, 2])
 * // [60, 0, 2]
 *
 * @example
 * mergeCoinTypes(undefined, [60, 2, 501])
 * // [60, 2, 501]
 */
export const mergeCoinTypes = (
  subgraphCoins: (string | number)[] | undefined,
  defaultCoins: number[],
): number[] => {
  return Array.from(
    new Set([
      ...(subgraphCoins?.map((coin) => Number(coin)) || []),
      ...defaultCoins,
    ]),
  )
}

/**
 * Merges text record keys from multiple sources and removes duplicates.
 * Combines keys from V1 subgraph, V2 subgraph, and default text keys.
 *
 * @param subgraphV1Texts - Text keys from V1 subgraph
 * @param subgraphV2Texts - Text keys from V2 subgraph
 * @param defaultTexts - Default text keys to always include
 * @returns Deduplicated array of text keys
 *
 * @example
 * mergeTextKeys(['name'], ['description'], ['name', 'avatar'])
 * // ['name', 'description', 'avatar']
 *
 * @example
 * mergeTextKeys(undefined, undefined, ['name', 'description'])
 * // ['name', 'description']
 */
export const mergeTextKeys = (
  subgraphV1Texts: string[] | undefined,
  subgraphV2Texts: string[] | undefined,
  defaultTexts: string[],
): string[] => {
  return Array.from(
    new Set([
      ...(subgraphV1Texts || []),
      ...(subgraphV2Texts || []),
      ...defaultTexts,
    ]),
  )
}
