import { DnsResponseStatus, getDnsTxtRecords } from '@ensdomains/ensjs/utils'

/**
 * Checks whether a TLD has DNSSEC enabled, via a DNS-over-HTTPS lookup.
 *
 * @param tld - The TLD to check (e.g., "xyz", "com")
 * @returns true if DNSSEC is enabled, false otherwise
 */
export const getDnsSecEnabled = async (tld: string): Promise<boolean> => {
  const result = await getDnsTxtRecords({ name: tld })

  // NXDOMAIN means the TLD doesn't exist
  if (result.Status === DnsResponseStatus.NXDOMAIN) return false

  // AD flag indicates DNSSEC validation passed
  return result.AD ?? false
}
