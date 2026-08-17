import { getLabel } from '@/utils/token/getLabel'

export type PremiumLabelVariant = 'premium-3' | 'premium-4'

export type PremiumLabel = {
  readonly label: string
  readonly variant: PremiumLabelVariant
}

/**
 * Gets the premium label information for a domain name.
 * Returns undefined if not premium (not 3–4 chars) or has no valid label.
 */
export const getPremiumLabel = (
  domainName: string,
): PremiumLabel | undefined => {
  let label: string

  try {
    label = getLabel(domainName)
  } catch {
    return undefined
  }

  // Codepoint count to match the contract's StringUtils.strlen (UTF-8
  // codepoints), not UTF-16 code units — see getBaseRateForName.
  const length = [...label].length

  if (length < 3 || length > 4) {
    return undefined
  }

  const variant: PremiumLabelVariant = length === 3 ? 'premium-3' : 'premium-4'

  return { label: `${length} letter premium price`, variant }
}
