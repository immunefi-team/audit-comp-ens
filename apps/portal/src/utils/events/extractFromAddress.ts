/**
 * Extracts the "from" address from event details.
 * Checks common address fields in order: owner, registrant, newOwner.
 *
 * @param eventDetails - Event details object that may contain address fields
 * @returns The extracted address or null if none found
 *
 * @example
 * extractFromAddress({ owner: '0x123' }) // '0x123'
 * extractFromAddress({ registrant: '0x456' }) // '0x456'
 * extractFromAddress({ newOwner: '0x789' }) // '0x789'
 * extractFromAddress({ other: 'value' }) // null
 */
export const extractFromAddress = (
  eventDetails: Record<string, unknown>,
): string | null => {
  if (eventDetails.owner && typeof eventDetails.owner === 'string') {
    return eventDetails.owner
  }

  if (eventDetails.registrant && typeof eventDetails.registrant === 'string') {
    return eventDetails.registrant
  }

  if (eventDetails.newOwner && typeof eventDetails.newOwner === 'string') {
    return eventDetails.newOwner
  }

  return null
}
