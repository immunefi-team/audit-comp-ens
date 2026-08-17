/**
 * Mock V1 Subgraph — intercepts the ENS V1 subgraph requests in the browser
 * and injects locally-registered V1 names into the response.
 *
 * The migration UI queries `https://ensnode-api-sepolia-staging-v1.up.railway.app/subgraph`
 * for V1 names. Since our test names are registered on the local Anvil fork
 * (not the real Sepolia), the subgraph doesn't see them. This helper uses
 * Playwright's `page.route()` to intercept those requests and inject our
 * test domain(s) into the response.
 */
import type { Page } from '@playwright/test'
import { keccak256, namehash, toHex } from 'viem'
import type {
  V1AddressRecord,
  V1NameType,
  V1TextRecord,
} from '../fixtures/makeV1Name.js'

const V1_PUBLIC_RESOLVER = '0x640294a2b2d87e7f522db3e3e3e876764bce170d'

const V1_SUBGRAPH_URL = 'ensnode-api-sepolia-staging-v1.up.railway.app/subgraph'

/**
 * Fuse values matching the NameWrapper contract.
 * PARENT_CANNOT_CONTROL and IS_DOT_ETH are auto-set for .eth 2LDs.
 */
const FUSES = {
  CANNOT_UNWRAP: 1,
  PARENT_CANNOT_CONTROL: 1 << 16,
  IS_DOT_ETH: 1 << 17,
} as const

/** Fuses set by NameWrapper for an unlocked .eth 2LD wrap (fuses=0) */
const UNLOCKED_2LD_FUSES = FUSES.PARENT_CANNOT_CONTROL | FUSES.IS_DOT_ETH // 196608

/** Fuses set by NameWrapper for a locked .eth 2LD wrap (fuses=CANNOT_UNWRAP) */
const LOCKED_2LD_FUSES =
  FUSES.CANNOT_UNWRAP | FUSES.PARENT_CANNOT_CONTROL | FUSES.IS_DOT_ETH // 196609

/**
 * Build a V1Domain object matching the subgraph schema.
 * Supports unwrapped, wrapped (unlocked), and locked name types.
 */
function buildV1Domain(params: {
  label: string
  ownerAddress: string
  type?: V1NameType
  hasRecords?: boolean
  fuses?: number
  registrationDate?: number
  expiryDate?: number
}) {
  const {
    label,
    ownerAddress,
    type = 'unwrapped',
    hasRecords = false,
    registrationDate,
    expiryDate,
  } = params
  const name = `${label}.eth`
  const labelhash = keccak256(toHex(label))
  const node = namehash(name)
  const owner = ownerAddress.toLowerCase()
  const now = Math.floor(Date.now() / 1000)
  const expiry = expiryDate ?? now + 365 * 24 * 60 * 60

  const isWrapped = type === 'wrapped' || type === 'locked'

  return {
    id: node,
    labelName: label,
    labelhash,
    name,
    isMigrated: false,
    createdAt: String(registrationDate ?? now),
    resolvedAddress: null,
    // Include resolver info when the name has records set
    resolver:
      hasRecords || isWrapped
        ? { id: V1_PUBLIC_RESOLVER, address: V1_PUBLIC_RESOLVER }
        : null,
    // For unwrapped: owner is the EOA. For wrapped: owner is the NameWrapper.
    owner: {
      id: isWrapped
        ? '0xc7e033b8836e4bd55d069d113f018b98478cb091' // NameWrapper
        : owner,
    },
    // registrant is always the EOA (BaseRegistrar ERC-721 holder or original registrant)
    registrant: { id: owner },
    wrappedOwner: isWrapped ? { id: owner } : null,
    parent: {
      name: 'eth',
      id: namehash('eth'),
      wrappedDomain: null,
    },
    registration: {
      registrationDate: String(registrationDate ?? now),
      expiryDate: String(expiry),
    },
    wrappedDomain: isWrapped
      ? {
          expiryDate: String(expiry),
          // If caller provides explicit owner-controlled fuses, OR in the
          // auto-set parent fuses (PARENT_CANNOT_CONTROL + IS_DOT_ETH).
          // Otherwise fall back to the defaults derived from type.
          fuses:
            params.fuses !== undefined
              ? params.fuses | FUSES.PARENT_CANNOT_CONTROL | FUSES.IS_DOT_ETH
              : type === 'locked'
                ? LOCKED_2LD_FUSES
                : UNLOCKED_2LD_FUSES,
        }
      : null,
  }
}

export type MockV1Name = {
  /** Full name including .eth (e.g. "migtest-123.eth") */
  name: string
  /** EOA address that owns this V1 name */
  ownerAddress: string
  /** V1 name type — must match what was passed to makeV1Name */
  type?: V1NameType
  /**
   * Override the full fuse bitmap injected into the subgraph mock.
   * When provided, overrides the default fuses derived from `type`.
   * The NameWrapper always auto-adds PARENT_CANNOT_CONTROL | IS_DOT_ETH for .eth
   * 2LDs, so pass only the owner-controlled bits (e.g. FUSES.CANNOT_UNWRAP | FUSES.CANNOT_BURN_FUSES).
   * The mock will OR in PARENT_CANNOT_CONTROL and IS_DOT_ETH automatically.
   */
  fuses?: number
  /** Registration expiry timestamp (Unix seconds). Defaults to now + 1 year. */
  expiryDate?: number
  /** V1 records set on this name (used to mock getProfilesForDomains) */
  records?: {
    texts?: V1TextRecord[]
    addresses?: V1AddressRecord[]
  }
}

/**
 * Intercept V1 subgraph requests and inject mock V1 names.
 *
 * Any request to the V1 subgraph URL that contains `getNamesForAddress`
 * will have the mock names appended to the response. Other subgraph
 * queries (like getProfilesForDomains) are passed through unmodified.
 *
 * Call this BEFORE navigating to pages that trigger V1 name queries.
 */
export async function mockV1Subgraph(
  page: Page,
  mockNames: MockV1Name[],
): Promise<void> {
  // Build a lookup of mock names by their namehash for profile queries
  const namesByNode = new Map<string, MockV1Name>()
  for (const n of mockNames) {
    const label = n.name.replace('.eth', '')
    namesByNode.set(namehash(`${label}.eth`), n)
  }

  await page.route(`**/${V1_SUBGRAPH_URL}`, async (route, request) => {
    const postData = request.postData()

    // ── Handle getProfilesForDomains queries ────────────────────────
    // The migration fetches V1 profile keys (texts, coinTypes) from the
    // subgraph before reading actual values on-chain.
    if (postData?.includes('getProfilesForDomains')) {
      // Extract requested domain IDs from the filter
      let requestedIds: string[] = []
      try {
        const body = JSON.parse(postData)
        requestedIds = body?.variables?.whereFilter?.id_in ?? []
      } catch {
        /* ignore */
      }

      // Build mock profile entries for our names that have records
      const mockProfileDomains = requestedIds
        .filter((id: string) => namesByNode.has(id))
        .map((id: string) => {
          const mockName = namesByNode.get(id)!
          return {
            id,
            resolver: {
              texts: mockName.records?.texts?.map((t) => t.key) ?? [],
              coinTypes:
                mockName.records?.addresses?.map((a) => a.coinType) ?? [],
            },
          }
        })

      // Fetch real response and merge
      let realDomains: any[] = []
      try {
        const response = await route.fetch()
        const json = await response.json()
        realDomains = json?.data?.domains ?? []
      } catch {
        /* subgraph unreachable */
      }

      const allDomains = [...realDomains, ...mockProfileDomains]

      console.log(
        `[mock-v1-subgraph] Injecting ${mockProfileDomains.length} mock profiles into getProfilesForDomains`,
      )

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { domains: allDomains } }),
      })
    }

    // ── Handle getNamesForAddress queries ────────────────────────────
    if (!postData?.includes('getNamesForAddress')) {
      return route.continue()
    }

    // Build mock domains from our test names
    const mockDomains = mockNames.map((n) => {
      const label = n.name.replace('.eth', '')
      return buildV1Domain({
        label,
        ownerAddress: n.ownerAddress,
        type: n.type,
        fuses: n.fuses,
        hasRecords: Boolean(n.records),
        expiryDate: n.expiryDate,
      })
    })

    // Fetch the real response first to merge with existing names
    let realDomains: any[] = []
    try {
      const response = await route.fetch()
      const json = await response.json()
      realDomains = json?.data?.domains ?? []
    } catch {
      // If the real subgraph is unreachable, just use our mocks
    }

    // Merge: real names + our mock names
    const allDomains = [...realDomains, ...mockDomains]

    console.log(
      `[mock-v1-subgraph] Injecting ${mockDomains.length} mock V1 names ` +
        `(${mockDomains.map((d) => d.name).join(', ')}) into subgraph response ` +
        `(${realDomains.length} real names)`,
    )

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { domains: allDomains },
      }),
    })
  })
}
