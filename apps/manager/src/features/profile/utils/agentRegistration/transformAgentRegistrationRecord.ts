import { truncateAddress } from '@/lib/utils'
import { getKnownRegistryName } from '../../constants'
import type { TextRecordValue } from '../../types'
import { decodeErc7930Address } from './decodeErc7930Address'
import { buildAddressExplorerUrl, getChainInfo } from './getChainInfo'
import { parseAgentRegistrationKey } from './parseAgentRegistrationKey'

export interface AgentRegistrationRecord {
  /** Raw text-record key — the full raw value copied to clipboard (req 4). */
  key: string
  /** Raw text-record value as stored on-chain (often a placeholder such as "1"). */
  value: string
  agentId: string
  chainId: number
  chainName: string
  registryAddress: `0x${string}`
  /** Resolved primary name (e.g. "8004.eth") or shortened raw address. */
  registryDisplayName: string
  /** Block explorer URL from viem's chain registry, or null. */
  explorerUrl: string | null
}

/**
 * Transforms a raw text record into an AgentRegistrationRecord if it's a valid
 * ENSIP-25 agent-registration record.
 *
 * @param record - The decoded text record from ENS ({ key, value })
 * @returns Transformed agent registration record, or null if invalid
 */
export function transformAgentRegistrationRecord(
  record: TextRecordValue,
): AgentRegistrationRecord | null {
  const parsed = parseAgentRegistrationKey(record.key)
  if (!parsed) return null

  const decoded = decodeErc7930Address(parsed.registryHex)
  if (!decoded) return null

  const chainInfo = getChainInfo(decoded.chainId)
  const knownName = getKnownRegistryName(decoded.chainId, decoded.address)
  const registryDisplayName = knownName ?? truncateAddress(decoded.address)
  const explorerUrl = buildAddressExplorerUrl(
    chainInfo.explorerUrl,
    decoded.address,
  )

  return {
    key: record.key,
    value: record.value,
    agentId: parsed.agentId,
    chainId: decoded.chainId,
    chainName: chainInfo.name,
    registryAddress: decoded.address,
    registryDisplayName,
    explorerUrl,
  }
}
