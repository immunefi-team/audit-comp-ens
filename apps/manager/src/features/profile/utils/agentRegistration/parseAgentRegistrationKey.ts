/**
 * Parses an ENSIP-25 agent-registration text record key.
 *
 * Format: agent-registration[<ERC-7930 registry address>][<agentId>]
 *
 * @param key - The text record key to parse
 * @returns Parsed registry hex and agent ID, or null if invalid
 */
// Anchored to the exact ENSIP-25 shape so malformed keys (extra bracket
// sections, trailing characters, non-hex registries) are rejected outright.
const AGENT_REGISTRATION_KEY_PATTERN =
  /^agent-registration\[(0x[a-fA-F0-9]+)\]\[([^\]]+)\]$/

export function parseAgentRegistrationKey(
  key: string,
): { registryHex: string; agentId: string } | null {
  const match = AGENT_REGISTRATION_KEY_PATTERN.exec(key)
  if (!match) return null

  const [, registryHex, agentId] = match
  if (!registryHex || !agentId) return null

  return { registryHex: registryHex.toLowerCase(), agentId }
}

/**
 * Checks if a text record key is an agent-registration key.
 */
export function isAgentRegistrationKey(key: string): boolean {
  return key.startsWith('agent-registration[')
}
