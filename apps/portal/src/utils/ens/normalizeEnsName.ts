/**
 * Ensures an ENS name has the .eth suffix if no TLD is present.
 * If the name doesn't contain a dot (.), it appends '.eth' to it.
 * Otherwise, it returns the name as-is (lowercased).
 *
 * Note: This does NOT perform ENS normalization (ENSIP-15).
 * For actual normalization, use viem's `normalize` function.
 *
 * @param name - The ENS name to process
 * @returns The name with .eth suffix if needed, lowercased
 *
 * @example
 * ensureEthSuffix("vitalik")
 * // "vitalik.eth"
 *
 * @example
 * ensureEthSuffix("vitalik.eth")
 * // "vitalik.eth"
 *
 * @example
 * ensureEthSuffix("sub.vitalik.eth")
 * // "sub.vitalik.eth"
 */
export const ensureEthSuffix = (name: string): string => {
  return (name.includes('.') ? name : `${name}.eth`).toLowerCase()
}
