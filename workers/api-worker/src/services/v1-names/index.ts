import { logger } from '#utils/logger.js'

/**
 * ENS v1 subgraph used to check whether an address still owns v1 names.
 * Mirrors the manager's `v1SubgraphClient` (apps/manager
 * src/features/migration/service/v1SubgraphClient.ts) — same endpoint and the
 * same eligibility filters — so the faucet's "owns v1 names" verdict can't
 * drift from what the migration flow actually shows the user.
 */
const V1_SUBGRAPH_URL = 'https://api.sepolia.ensnode.io/subgraph'

// keccak-derived namehash of `addr.reverse` — reverse records are not
// migratable names, so they're excluded just like in the manager.
const REVERSE_NODE =
  '0x91d1777781884d03a6757a803996e38de2a42967fb37eeaca72729271025a9e2'

const HAS_NAMES_QUERY = `
query hasV1NamesForAddress($whereFilter: Domain_filter) {
  domains(first: 1, where: $whereFilter) {
    id
  }
}
`

type V1SubgraphResponse = {
  data?: {
    domains: Array<{ id: string }>
  }
  errors?: Array<{ message: string }>
}

/**
 * Whether `address` owns (owner / registrant / wrappedOwner) at least one
 * live, migratable ENS v1 name. A single `first: 1` existence query — we only
 * need the verdict, not the names.
 *
 * Throws on subgraph/network errors so callers can decide the failure mode
 * (the faucet treats a failed check as "no drip", fail-closed).
 */
export const hasV1Names = async (address: string): Promise<boolean> => {
  const addr = address.toLowerCase()
  const now = Math.floor(Date.now() / 1000).toString()

  // Same filter set as the manager's getV1NamesForAddress: owned by the
  // address, not a reverse record, not expired, and not an empty husk
  // (zero owner with no resolver/registrant).
  const whereFilter = {
    and: [
      {
        or: [{ owner: addr }, { registrant: addr }, { wrappedOwner: addr }],
      },
      { parent_not: REVERSE_NODE },
      {
        or: [{ expiryDate_gt: now }, { expiryDate: null }],
      },
      {
        or: [
          { owner_not: '0x0000000000000000000000000000000000000000' },
          { resolver_not: null },
          {
            and: [
              {
                registrant_not: '0x0000000000000000000000000000000000000000',
              },
              { registrant_not: null },
            ],
          },
        ],
      },
    ],
  }

  const response = await fetch(V1_SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: HAS_NAMES_QUERY,
      variables: { whereFilter },
      operationName: 'hasV1NamesForAddress',
    }),
  })

  if (!response.ok) {
    throw new Error(`V1 subgraph request failed: ${response.status}`)
  }

  const json: V1SubgraphResponse = await response.json()
  if (json.errors?.length && json.errors[0]) {
    throw new Error(`V1 subgraph error: ${json.errors[0].message}`)
  }

  const owns = (json.data?.domains.length ?? 0) > 0
  logger.debug('Checked v1 name ownership', { address: addr, owns })
  return owns
}
